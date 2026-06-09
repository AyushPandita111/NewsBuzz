// ---------------------------------------------------------------------------
// articleText.js
// Best-effort reader-mode extraction of an article's body text from its URL.
// The homepage feed only carries a ~200-char description (someText), so before
// asking the AI to summarise / discuss a story we try to pull the real article
// text for richer context. This is intentionally tolerant: any failure (timeout,
// non-HTML, blocked) just returns null and the caller falls back to someText.
// ---------------------------------------------------------------------------

import https from "https";
import http from "http";

const decodeHTMLEntities = (str) =>
  str
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&apos;/g, "'")
    .replace(/&nbsp;/g, " ")
    .replace(/&#(\d+);/g, (_, n) => String.fromCharCode(Number(n)))
    .replace(/&#x([0-9a-f]+);/gi, (_, n) => String.fromCharCode(parseInt(n, 16)));

/**
 * Downloads up to `maxBytes` of an article URL (following one level of redirect),
 * giving up after `timeoutMs`. Resolves to raw HTML or null.
 */
const fetchHTML = (articleUrl, { timeoutMs = 7000, maxBytes = 600000, redirects = 3 } = {}) =>
  new Promise((resolve) => {
    let settled = false;
    const done = (val) => {
      if (!settled) {
        settled = true;
        resolve(val);
      }
    };

    const timer = setTimeout(() => done(null), timeoutMs);

    try {
      const protocol = articleUrl.startsWith("https") ? https : http;
      const req = protocol.get(
        articleUrl,
        {
          headers: {
            "User-Agent":
              "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36",
            Accept: "text/html,application/xhtml+xml",
            "Accept-Language": "en-US,en;q=0.9",
          },
        },
        (res) => {
          // Follow redirects.
          if (
            res.statusCode >= 300 &&
            res.statusCode < 400 &&
            res.headers.location &&
            redirects > 0
          ) {
            res.resume();
            clearTimeout(timer);
            let next = res.headers.location;
            if (next.startsWith("/")) {
              const parsed = new URL(articleUrl);
              next = `${parsed.protocol}//${parsed.host}${next}`;
            }
            return done(fetchHTML(next, { timeoutMs, maxBytes, redirects: redirects - 1 }));
          }
          if (res.statusCode < 200 || res.statusCode >= 300) {
            res.resume();
            clearTimeout(timer);
            return done(null);
          }

          let data = "";
          res.on("data", (chunk) => {
            data += chunk;
            if (data.length > maxBytes) req.destroy();
          });
          res.on("end", () => {
            clearTimeout(timer);
            done(data);
          });
          res.on("error", () => {
            clearTimeout(timer);
            done(null);
          });
        }
      );
      req.on("error", () => {
        clearTimeout(timer);
        done(null);
      });
    } catch {
      clearTimeout(timer);
      done(null);
    }
  });

/**
 * Extracts readable paragraph text from an HTML document.
 * Strips script/style/noscript, pulls <p> contents, de-tags and de-entities,
 * drops boilerplate-ish short fragments, and caps the total length.
 */
const extractParagraphs = (html, maxChars) => {
  if (!html) return "";

  // Prefer the <article> region when present (less nav/footer noise).
  const articleMatch = html.match(/<article[\s\S]*?<\/article>/i);
  const scope = articleMatch ? articleMatch[0] : html;

  const cleaned = scope
    .replace(/<script[\s\S]*?<\/script>/gi, " ")
    .replace(/<style[\s\S]*?<\/style>/gi, " ")
    .replace(/<noscript[\s\S]*?<\/noscript>/gi, " ");

  const paragraphs = [];
  const re = /<p\b[^>]*>([\s\S]*?)<\/p>/gi;
  let m;
  while ((m = re.exec(cleaned)) !== null) {
    const text = decodeHTMLEntities(m[1].replace(/<[^>]+>/g, " "))
      .replace(/\s+/g, " ")
      .trim();
    // Skip tiny fragments (share prompts, captions, "Read more", etc.).
    if (text.length >= 40) paragraphs.push(text);
    if (paragraphs.join(" ").length > maxChars) break;
  }

  return paragraphs.join("\n\n").slice(0, maxChars).trim();
};

/**
 * Public entry point. Returns extracted article body text, or null if nothing
 * usable could be retrieved within the time budget.
 */
const fetchArticleText = async (url, { maxChars = 3500, timeoutMs = 7000 } = {}) => {
  if (!url || typeof url !== "string" || !url.startsWith("http")) return null;
  try {
    const html = await fetchHTML(url, { timeoutMs });
    const text = extractParagraphs(html, maxChars);
    return text && text.length >= 120 ? text : null;
  } catch {
    return null;
  }
};

export { fetchArticleText };
