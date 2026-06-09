// ---------------------------------------------------------------------------
// geminiClient.js
// Thin server-side wrapper around Google's free Gemini API
// (generativelanguage.googleapis.com). Used by the News Glance & Chat feature.
//
//   • generateJSON()  → single structured-JSON call (used for the Glance summary)
//   • streamChat()    → token-by-token SSE stream (used for the Chat panel)
//
// The API key lives ONLY here / in process.env and is never sent to the client.
// Get a free key at https://aistudio.google.com/app/apikey and put it in
// backend/.env as GEMINI_API_KEY=...
// ---------------------------------------------------------------------------

const API_BASE = "https://generativelanguage.googleapis.com/v1beta/models";
const DEFAULT_MODEL = process.env.GEMINI_MODEL || "gemini-2.5-flash-lite";

/**
 * Gemini 2.5 models "think" by default, which adds latency and can eat into a
 * small maxOutputTokens budget. We disable it (thinkingBudget: 0) for fast,
 * predictable summaries/chat. Older models reject thinkingConfig, so only emit
 * it for the 2.5 family.
 */
const thinkingConfigFor = (model) =>
  /2\.5/.test(model) ? { thinkingConfig: { thinkingBudget: 0 } } : {};

/**
 * Typed error so controllers can map failures onto friendly HTTP responses.
 *   code: 'no_key' | 'rate_limited' | 'timeout' | 'upstream' | 'parse'
 */
class AIError extends Error {
  constructor(message, code = "upstream", status = 502) {
    super(message);
    this.name = "AIError";
    this.code = code;
    this.status = status;
  }
}

const getApiKey = () => {
  const key = (process.env.GEMINI_API_KEY || "").trim();
  return key && key !== "your_gemini_api_key_here" ? key : null;
};

/** True when a usable API key is configured. */
const isConfigured = () => !!getApiKey();

/**
 * Maps an upstream (non-2xx) Gemini response onto an AIError.
 */
const toAIError = async (res) => {
  let detail = "";
  try {
    const body = await res.text();
    detail = body.slice(0, 300);
  } catch {
    /* ignore */
  }
  if (res.status === 429) {
    return new AIError("Gemini rate limit reached", "rate_limited", 429);
  }
  if (res.status === 400 || res.status === 403) {
    return new AIError(`Gemini rejected the request: ${detail}`, "upstream", 502);
  }
  return new AIError(`Gemini upstream error (${res.status}): ${detail}`, "upstream", 502);
};

/**
 * Runs `fetch` with an abort-based timeout.
 */
const fetchWithTimeout = async (url, options, ms) => {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), ms);
  try {
    return await fetch(url, { ...options, signal: controller.signal });
  } catch (err) {
    if (err.name === "AbortError") {
      throw new AIError("Gemini request timed out", "timeout", 504);
    }
    throw new AIError(`Network error contacting Gemini: ${err.message}`, "upstream", 502);
  } finally {
    clearTimeout(timer);
  }
};

/**
 * Single structured-JSON generation. Gemini is constrained to `schema`
 * (an OpenAPI-subset object) via responseSchema, so the reply parses cleanly.
 *
 * @returns {Promise<object>} the parsed JSON object
 */
const generateJSON = async ({
  system,
  userText,
  schema,
  maxOutputTokens = 512,
  temperature = 0.4,
  model = DEFAULT_MODEL,
  timeoutMs = 20000,
}) => {
  const key = getApiKey();
  if (!key) throw new AIError("AI is not configured on the server", "no_key", 503);

  const url = `${API_BASE}/${model}:generateContent?key=${key}`;
  const body = {
    systemInstruction: { parts: [{ text: system }] },
    contents: [{ role: "user", parts: [{ text: userText }] }],
    generationConfig: {
      temperature,
      maxOutputTokens,
      responseMimeType: "application/json",
      ...(schema ? { responseSchema: schema } : {}),
      ...thinkingConfigFor(model),
    },
  };

  const res = await fetchWithTimeout(
    url,
    { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) },
    timeoutMs
  );

  if (!res.ok) throw await toAIError(res);

  const data = await res.json();
  const text = data?.candidates?.[0]?.content?.parts?.map((p) => p.text || "").join("") || "";
  if (!text.trim()) {
    throw new AIError("Gemini returned an empty response", "upstream", 502);
  }
  try {
    return JSON.parse(text);
  } catch {
    // Last-ditch: pull the first {...} block out of the text.
    const match = text.match(/\{[\s\S]*\}/);
    if (match) {
      try {
        return JSON.parse(match[0]);
      } catch {
        /* fall through */
      }
    }
    throw new AIError("Could not parse Gemini JSON response", "parse", 502);
  }
};

/**
 * Streaming chat. Calls Gemini's SSE endpoint and invokes `onDelta(textChunk)`
 * for every incremental token group as it arrives.
 *
 * @param {object[]} contents  Gemini-format turns: { role: 'user'|'model', parts:[{text}] }
 * @param {function}  onDelta  called with each text delta string
 */
const streamChat = async ({
  system,
  contents,
  onDelta,
  maxOutputTokens = 1024,
  temperature = 0.7,
  model = DEFAULT_MODEL,
  timeoutMs = 45000,
}) => {
  const key = getApiKey();
  if (!key) throw new AIError("AI is not configured on the server", "no_key", 503);

  const url = `${API_BASE}/${model}:streamGenerateContent?alt=sse&key=${key}`;
  const body = {
    systemInstruction: { parts: [{ text: system }] },
    contents,
    generationConfig: { temperature, maxOutputTokens, ...thinkingConfigFor(model) },
  };

  const res = await fetchWithTimeout(
    url,
    { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) },
    timeoutMs
  );

  if (!res.ok) throw await toAIError(res);
  if (!res.body) throw new AIError("Gemini returned no response stream", "upstream", 502);

  const decoder = new TextDecoder();
  let buffer = "";

  // Node 18+/20 web ReadableStream is async-iterable.
  for await (const chunk of res.body) {
    buffer += decoder.decode(chunk, { stream: true });

    // SSE events are separated by a blank line; lines we care about start "data:".
    let nlIndex;
    while ((nlIndex = buffer.indexOf("\n")) !== -1) {
      const line = buffer.slice(0, nlIndex).trim();
      buffer = buffer.slice(nlIndex + 1);
      if (!line || !line.startsWith("data:")) continue;

      const payload = line.slice(5).trim();
      if (!payload || payload === "[DONE]") continue;

      let parsed;
      try {
        parsed = JSON.parse(payload);
      } catch {
        continue; // partial JSON across chunks is rare with line framing; skip safely
      }
      const text =
        parsed?.candidates?.[0]?.content?.parts?.map((p) => p.text || "").join("") || "";
      if (text) onDelta(text);
    }
  }
};

export { generateJSON, streamChat, isConfigured, AIError };
