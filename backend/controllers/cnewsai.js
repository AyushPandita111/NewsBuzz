// ---------------------------------------------------------------------------
// cnewsai.js — News Glance & Chat controller
//
//   POST /api/news/glance  → structured AI summary of an article (JSON)
//   POST /api/news/chat    → streamed (SSE) conversational answer about it
//
// Both endpoints accept the article object straight from the homepage feed
// (the feed isn't persisted, so there's no articleId lookup). The Gemini API
// key stays server-side inside geminiClient.js.
// ---------------------------------------------------------------------------

import { generateJSON, streamChat, isConfigured, AIError } from "../utils/geminiClient.js";
import { fetchArticleText } from "../utils/articleText.js";

// ---- Structured schema Gemini must fill for the Glance summary -------------
const GLANCE_SCHEMA = {
  type: "OBJECT",
  properties: {
    summary: {
      type: "STRING",
      description: "One or two sentence plain-language overview of the article.",
    },
    keyPoints: {
      type: "ARRAY",
      description: "3 to 5 concise key takeaways.",
      items: { type: "STRING" },
    },
    entities: {
      type: "ARRAY",
      description: "Notable named entities mentioned in the article.",
      items: {
        type: "OBJECT",
        properties: {
          name: { type: "STRING" },
          type: { type: "STRING", enum: ["person", "organization", "location", "other"] },
        },
        required: ["name", "type"],
      },
    },
    sentiment: {
      type: "STRING",
      enum: ["positive", "neutral", "negative"],
      description: "Overall tone of the article's subject matter.",
    },
  },
  required: ["summary", "keyPoints", "entities", "sentiment"],
};

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Pulls the safe, expected fields out of whatever the client sent. */
const normalizeArticle = (article = {}) => ({
  title: String(article.title || "").slice(0, 400),
  link: typeof article.link === "string" ? article.link : "",
  source: String(article.source || article.providerName || "the source").slice(0, 120),
  category: String(article.category || "").slice(0, 60),
  publishedISO: String(article.pubDate || article.timeISO || article.time || "").slice(0, 40),
  someText: String(article.description || article.someText || "").slice(0, 600),
});

/**
 * Builds the text block describing the article for the model. Tries to enrich
 * with the real article body (best-effort) and otherwise uses the feed snippet.
 */
const buildArticleContext = async (article, { fetchBody = true } = {}) => {
  let body = "";
  if (fetchBody && article.link) {
    body = (await fetchArticleText(article.link)) || "";
  }
  const dateLabel = article.publishedISO
    ? new Date(article.publishedISO).toUTCString()
    : "unknown";

  return [
    `HEADLINE: ${article.title || "(untitled)"}`,
    `SOURCE: ${article.source}`,
    article.category ? `SECTION: ${article.category}` : null,
    `PUBLISHED: ${dateLabel}`,
    article.link ? `URL: ${article.link}` : null,
    "",
    "ARTICLE TEXT:",
    body || article.someText || "(Only the headline is available — reason from your own knowledge and clearly flag anything uncertain.)",
  ]
    .filter((l) => l !== null)
    .join("\n");
};

const CHAT_SYSTEM_BASE =
  "You are a knowledgeable news analyst. The user is reading the following article. " +
  "Help them understand it deeply — provide context, background, different perspectives, " +
  "and fact-check claims when possible. Be concise but thorough. Format answers in clean " +
  "markdown (short paragraphs, **bold** for emphasis, and bullet lists where helpful). " +
  "If the provided article text is thin, rely on your broader knowledge but make clear " +
  "when you are adding outside context.";

/** Maps the client chat history onto Gemini's contents format. */
const toGeminiContents = (messages) =>
  messages
    .filter((m) => m && typeof m.content === "string" && m.content.trim())
    .slice(-20) // keep the last ~20 turns to stay within limits
    .map((m) => ({
      role: m.role === "assistant" ? "model" : "user",
      parts: [{ text: String(m.content).slice(0, 4000) }],
    }));

/** Friendly, user-facing message for each AIError code. */
const friendlyMessage = (err) => {
  switch (err?.code) {
    case "no_key":
      return "AI isn't configured yet. Add a GEMINI_API_KEY to the server's .env file.";
    case "rate_limited":
      return "AI is busy right now — please try again in a moment.";
    case "timeout":
      return "The AI took too long to respond. Please try again.";
    default:
      return "Something went wrong while contacting the AI. Please try again.";
  }
};

// ---------------------------------------------------------------------------
// POST /api/news/glance
// ---------------------------------------------------------------------------
const getGlance = async (req, res) => {
  try {
    const article = normalizeArticle(req.body?.article);
    if (!article.title && !article.link) {
      return res.status(400).json({ success: false, code: "bad_request", message: "Missing article data." });
    }
    if (!isConfigured()) {
      return res
        .status(503)
        .json({ success: false, code: "no_key", message: friendlyMessage({ code: "no_key" }) });
    }

    const context = await buildArticleContext(article);
    const system =
      "You are a precise, neutral news analyst. Summarise the article for a reader " +
      "skimming the news. Base everything strictly on the supplied article text and " +
      "return ONLY JSON that matches the requested schema.";

    const glance = await generateJSON({
      system,
      userText: context,
      schema: GLANCE_SCHEMA,
      maxOutputTokens: 512,
    });

    // Defensive shaping so the UI always gets the fields it expects.
    const safeGlance = {
      summary: String(glance.summary || "").trim(),
      keyPoints: Array.isArray(glance.keyPoints) ? glance.keyPoints.slice(0, 6).map(String) : [],
      entities: Array.isArray(glance.entities)
        ? glance.entities
            .filter((e) => e && e.name)
            .slice(0, 12)
            .map((e) => ({ name: String(e.name), type: String(e.type || "other") }))
        : [],
      sentiment: ["positive", "neutral", "negative"].includes(glance.sentiment)
        ? glance.sentiment
        : "neutral",
    };

    return res.status(200).json({ success: true, glance: safeGlance });
  } catch (error) {
    const status = error instanceof AIError ? error.status : 500;
    const code = error instanceof AIError ? error.code : "error";
    console.error("[getGlance] error:", error.code || "", error.message);
    return res.status(status).json({ success: false, code, message: friendlyMessage(error) });
  }
};

// ---------------------------------------------------------------------------
// POST /api/news/chat  (Server-Sent Events stream)
// ---------------------------------------------------------------------------
const postChat = async (req, res) => {
  const article = normalizeArticle(req.body?.article);
  const messages = Array.isArray(req.body?.messages) ? req.body.messages : [];

  // Plain-JSON guard responses (before we switch into SSE mode).
  if (!article.title && !article.link) {
    return res.status(400).json({ success: false, code: "bad_request", message: "Missing article data." });
  }
  if (messages.length === 0) {
    return res.status(400).json({ success: false, code: "bad_request", message: "No messages provided." });
  }
  if (!isConfigured()) {
    return res
      .status(503)
      .json({ success: false, code: "no_key", message: friendlyMessage({ code: "no_key" }) });
  }

  // --- switch into SSE mode ---
  res.writeHead(200, {
    "Content-Type": "text/event-stream; charset=utf-8",
    "Cache-Control": "no-cache, no-transform",
    Connection: "keep-alive",
    "X-Accel-Buffering": "no", // disable proxy buffering so tokens flush live
  });
  res.flushHeaders?.();

  const send = (obj) => {
    if (!res.writableEnded) res.write(`data: ${JSON.stringify(obj)}\n\n`);
  };

  // Detect a real client disconnect via the RESPONSE stream. (Listening on
  // req's "close" is wrong here: it fires the moment express.json() finishes
  // reading the request body — before streaming starts — which would suppress
  // every delta. res "close" only fires when the connection actually drops.)
  let aborted = false;
  res.on("close", () => {
    if (!res.writableEnded) aborted = true;
  });

  try {
    const context = await buildArticleContext(article);
    const system = `${CHAT_SYSTEM_BASE}\n\n----- ARTICLE THE USER IS READING -----\n${context}`;
    const contents = toGeminiContents(messages);

    await streamChat({
      system,
      contents,
      maxOutputTokens: 1024,
      onDelta: (delta) => {
        if (aborted) return;
        send({ delta });
      },
    });

    send({ done: true });
    res.end();
  } catch (error) {
    console.error("[postChat] error:", error.code || "", error.message);
    const code = error instanceof AIError ? error.code : "error";
    send({ error: friendlyMessage(error), code });
    res.end();
  }
};

export { getGlance, postChat };
