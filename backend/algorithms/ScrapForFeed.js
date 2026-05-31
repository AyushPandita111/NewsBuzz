import https from "https";
import http from "http";

const delay = (ms) => new Promise((resolve) => setTimeout(resolve, ms));


/**
 * Fetches raw text content from a URL, following redirects.
 * Rejects on non-2xx status (so the caller can handle errors cleanly).
 */
const fetchUrl = (url, maxRedirects = 5) => {
  return new Promise((resolve, reject) => {
    const protocol = url.startsWith("https") ? https : http;
    protocol
      .get(
        url,
        {
          headers: {
            "User-Agent": "Mozilla/5.0 (compatible; NewsBuzz/1.0)",
            "Accept": "application/rss+xml, application/xml, text/xml, */*",
          },
        },
        (res) => {
          console.log(`  [fetchUrl] HTTP ${res.statusCode} => ${url.slice(0, 80)}...`);
          if (res.statusCode >= 300 && res.statusCode < 400 && res.headers.location && maxRedirects > 0) {
            res.resume();
            let redirectUrl = res.headers.location;
            if (redirectUrl.startsWith("/")) {
              const parsed = new URL(url);
              redirectUrl = `${parsed.protocol}//${parsed.host}${redirectUrl}`;
            }
            return resolve(fetchUrl(redirectUrl, maxRedirects - 1));
          }
          if (res.statusCode && (res.statusCode < 200 || res.statusCode >= 300)) {
            res.resume(); // discard body
            return reject(new Error(`HTTP ${res.statusCode} from ${url.slice(0, 60)}`));
          }
          let data = "";
          res.on("data", (chunk) => (data += chunk));
          res.on("end", () => resolve(data));
        }
      )
      .on("error", reject);
  });
};

/**
 * Wraps fetchUrl with automatic retry + exponential backoff for transient errors
 * (503 Service Unavailable, 429 Too Many Requests, 502 Bad Gateway).
 */
const fetchUrlWithRetry = async (url, maxRetries = 3) => {
  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      return await fetchUrl(url);
    } catch (err) {
      const isRetryable = /HTTP (503|429|502|500)/.test(err.message);
      if (isRetryable && attempt < maxRetries) {
        const waitMs = Math.pow(2, attempt + 1) * 1000; // 2s, 4s, 8s
        console.log(`  [retry] Attempt ${attempt + 1} failed (${err.message}). Retrying in ${waitMs / 1000}s...`);
        await delay(waitMs);
      } else {
        throw err;
      }
    }
  }
};

/**
 * Decodes HTML entities like &lt; &gt; &amp; etc.
 */
const decodeHTMLEntities = (str) => {
  return str
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&apos;/g, "'")
    .replace(/&#(\d+);/g, (_, n) => String.fromCharCode(Number(n)))
    .replace(/&#x([0-9a-f]+);/gi, (_, n) => String.fromCharCode(parseInt(n, 16)));
};

/**
 * Extracts a value between two XML tags from a raw string.
 */
const extractTag = (str, tag) => {
  const open = `<${tag}`;
  const close = `</${tag}>`;
  const start = str.indexOf(open);
  if (start === -1) return null;
  const attrEnd = str.indexOf(">", start);
  const end = str.indexOf(close, attrEnd);
  if (attrEnd === -1 || end === -1) return null;
  const value = str.slice(attrEnd + 1, end).trim();
  // Strip CDATA
  if (value.startsWith("<![CDATA[")) {
    return value.slice(9, value.endsWith("]]>") ? -3 : undefined).trim() ||
      value.slice(9, value.length - 3).trim();
  }
  return value || null;
};

/**
 * Extracts a specific attribute value from a tag.
 */
const extractAttr = (str, tag, attr) => {
  const open = `<${tag}`;
  const start = str.indexOf(open);
  if (start === -1) return null;
  const end = str.indexOf(">", start);
  const tagStr = str.slice(start, end + 1);
  const attrMatch = tagStr.match(new RegExp(`${attr}="([^"]+)"`));
  return attrMatch ? attrMatch[1] : null;
};

/**
 * Tries to extract og:image from a news article URL.
 * Returns null if it fails or times out.
 */
const fetchOgImage = (articleUrl) => {
  return new Promise((resolve) => {
    const timeout = setTimeout(() => resolve(null), 6000);
    try {
      const protocol = articleUrl.startsWith("https") ? https : http;
      const req = protocol.get(
        articleUrl,
        {
          headers: {
            "User-Agent":
              "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36",
            "Accept": "text/html,application/xhtml+xml",
            "Accept-Language": "en-US,en;q=0.9",
          },
        },
        (res) => {
          let data = "";
          res.on("data", (chunk) => {
            data += chunk;
            // Stop reading after we find og:image or after 50KB
            if (data.length > 51200 || data.includes("og:image")) {
              req.destroy();
            }
          });
          res.on("end", () => {
            clearTimeout(timeout);
            const match = data.match(/<meta[^>]+property=["']og:image["'][^>]+content=["']([^"']+)["']/i) ||
                          data.match(/<meta[^>]+content=["']([^"']+)["'][^>]+property=["']og:image["']/i);
            resolve(match ? match[1] : null);
          });
          res.on("error", () => { clearTimeout(timeout); resolve(null); });
        }
      );
      req.on("error", () => { clearTimeout(timeout); resolve(null); });
    } catch {
      clearTimeout(timeout);
      resolve(null);
    }
  });
};


// ---------------------------------------------------------------------------
// BBC RSS TOPIC MAP
// ---------------------------------------------------------------------------
const BBC_TOPIC_FEEDS = {
  news:          "https://feeds.bbci.co.uk/news/rss.xml",
  world:         "https://feeds.bbci.co.uk/news/world/rss.xml",
  technology:    "https://feeds.bbci.co.uk/news/technology/rss.xml",
  tech:          "https://feeds.bbci.co.uk/news/technology/rss.xml",
  business:      "https://feeds.bbci.co.uk/news/business/rss.xml",
  finance:       "https://feeds.bbci.co.uk/news/business/rss.xml",
  science:       "https://feeds.bbci.co.uk/news/science_and_environment/rss.xml",
  environment:   "https://feeds.bbci.co.uk/news/science_and_environment/rss.xml",
  health:        "https://feeds.bbci.co.uk/news/health/rss.xml",
  politics:      "https://feeds.bbci.co.uk/news/politics/rss.xml",
  entertainment: "https://feeds.bbci.co.uk/news/entertainment_and_arts/rss.xml",
  arts:          "https://feeds.bbci.co.uk/news/entertainment_and_arts/rss.xml",
  sport:         "https://feeds.bbci.co.uk/sport/rss.xml",
  sports:        "https://feeds.bbci.co.uk/sport/rss.xml",
  cricket:       "https://feeds.bbci.co.uk/sport/cricket/rss.xml",
  football:      "https://feeds.bbci.co.uk/sport/football/rss.xml",
  formula1:      "https://feeds.bbci.co.uk/sport/formula1/rss.xml",
  f1:            "https://feeds.bbci.co.uk/sport/formula1/rss.xml",
  india:         "https://feeds.bbci.co.uk/news/world/asia/india/rss.xml",
  asia:          "https://feeds.bbci.co.uk/news/world/asia/rss.xml",
  europe:        "https://feeds.bbci.co.uk/news/world/europe/rss.xml",
  us:            "https://feeds.bbci.co.uk/news/world/us_and_canada/rss.xml",
  usa:           "https://feeds.bbci.co.uk/news/world/us_and_canada/rss.xml",
  america:       "https://feeds.bbci.co.uk/news/world/us_and_canada/rss.xml",
  africa:        "https://feeds.bbci.co.uk/news/world/africa/rss.xml",
  middleeast:    "https://feeds.bbci.co.uk/news/world/middle_east/rss.xml",
  middle_east:   "https://feeds.bbci.co.uk/news/world/middle_east/rss.xml",
  latinamerica:  "https://feeds.bbci.co.uk/news/world/latin_america/rss.xml",
};

const BBC_DEFAULT_FEED = "https://feeds.bbci.co.uk/news/rss.xml";

// ---------------------------------------------------------------------------
// FEED URL → CATEGORY MAP
// ---------------------------------------------------------------------------
const deriveCategoryFromFeedUrl = (feedUrl) => {
  if (feedUrl.includes("/sport/cricket/"))           return "cricket";
  if (feedUrl.includes("/sport/football/"))           return "football";
  if (feedUrl.includes("/sport/formula1/"))           return "formula1";
  if (feedUrl.includes("/sport"))                     return "sport";
  if (feedUrl.includes("/world/asia/india/"))          return "india";
  if (feedUrl.includes("/world/asia/"))               return "asia";
  if (feedUrl.includes("/world/europe/"))             return "europe";
  if (feedUrl.includes("/world/us_and_canada/"))      return "us";
  if (feedUrl.includes("/world/africa/"))             return "africa";
  if (feedUrl.includes("/world/middle_east/"))        return "middleeast";
  if (feedUrl.includes("/world/latin_america/"))      return "latinamerica";
  if (feedUrl.includes("/world/"))                    return "world";
  if (feedUrl.includes("/technology/"))               return "technology";
  if (feedUrl.includes("/business/"))                 return "business";
  if (feedUrl.includes("/science_and_environment/"))  return "science";
  if (feedUrl.includes("/health/"))                   return "health";
  if (feedUrl.includes("/politics/"))                 return "politics";
  if (feedUrl.includes("/entertainment_and_arts/"))   return "entertainment";
  return "general";
};

// ---------------------------------------------------------------------------
// IMAGE FILTER
// ---------------------------------------------------------------------------
const REJECT_PATTERNS = [
  "pixel", "tracking", "1x1", "beacon", "placeholder",
  "logo", "icon", "avatar", "spinner", "ad=", "banner",
];

const isImageValid = (url, widthAttr) => {
  if (!url || typeof url !== "string" || url.trim() === "") return false;
  if (!url.startsWith("http")) return false;

  const lower = url.toLowerCase();
  for (const pattern of REJECT_PATTERNS) {
    if (lower.includes(pattern)) return false;
  }
  if (lower.endsWith(".gif") || lower.endsWith(".svg")) return false;

  if (widthAttr !== null && widthAttr !== undefined) {
    const w = parseInt(widthAttr, 10);
    if (!isNaN(w) && w < 200) return false;
  }
  return true;
};

// ---------------------------------------------------------------------------
// BBC IMAGE RESIZING HELPERS
// ---------------------------------------------------------------------------
const resizeBBCImage = (url, size) => {
  if (!url) return null;
  // Format 1: /ace/standard/{size}/ or /news/{size}/ (numeric segment)
  const numericResized = url.replace(/(\/ace\/standard\/|\/)\d+\//, `$1${size}/`);
  if (numericResized !== url) return numericResized;
  // Format 2: /images/ic/{w}x{h}/ → replace with /{size}x{proportionalH}/
  const icMatch = url.match(/\/images\/ic\/(\d+)x(\d+)\//);
  if (icMatch) {
    const origW = parseInt(icMatch[1], 10);
    const origH = parseInt(icMatch[2], 10);
    const newH = Math.round((size / origW) * origH);
    return url.replace(/\/images\/ic\/\d+x\d+\//, `/images/ic/${size}x${newH}/`);
  }
  return url;
};

// ---------------------------------------------------------------------------
// TIMEOUT PROMISE
// ---------------------------------------------------------------------------
const timeoutPromise = (ms) =>
  new Promise((_, reject) =>
    setTimeout(() => reject(new Error(`Timeout after ${ms}ms`)), ms)
  );

// ---------------------------------------------------------------------------
// SEMAPHORE for og:image concurrency control
// ---------------------------------------------------------------------------
const runWithConcurrency = async (tasks, maxConcurrent) => {
  const results = [];
  let index = 0;

  const runNext = async () => {
    while (index < tasks.length) {
      const currentIndex = index++;
      results[currentIndex] = await tasks[currentIndex]();
    }
  };

  const workers = [];
  for (let i = 0; i < Math.min(maxConcurrent, tasks.length); i++) {
    workers.push(runNext());
  }
  await Promise.all(workers);
  return results;
};

// ---------------------------------------------------------------------------
// parseBBCRSS()
// ---------------------------------------------------------------------------
/**
 * Parses a BBC RSS 2.0 XML string into an array of article objects.
 * Extracts all fields per the BBC RSS spec, applies image filtering,
 * and falls back to fetchOgImage only when inline media tags are absent.
 *
 * @param {string} xml      - Raw RSS XML string from BBC
 * @param {string} feedUrl  - The feed URL used to fetch this XML (for category derivation)
 * @returns {Promise<Array>} - Array of article objects
 */
const parseBBCRSS = async (xml, feedUrl) => {
  // Log channel lastBuildDate for debugging
  const channelBlock = xml.split("<item>")[0] || "";
  const lastBuildDate = extractTag(channelBlock, "lastBuildDate");
  if (lastBuildDate) {
    console.log(`[ScrapForFeed] Feed lastBuildDate: ${lastBuildDate}`);
  }

  const category = deriveCategoryFromFeedUrl(feedUrl);
  const articles = [];
  const ogImageFallbacks = []; // { article, link } pairs needing og:image

  const items = xml.split("<item>");
  items.shift(); // drop channel header before first <item>

  for (const item of items) {
    const endIndex = item.indexOf("</item>");
    const block = endIndex !== -1 ? item.slice(0, endIndex) : item;

    // --- TITLE ---
    let title = extractTag(block, "title");
    if (!title) continue;
    title = decodeHTMLEntities(title).trim();
    if (!title) continue;

    // --- LINK ---
    let link = extractTag(block, "link") || extractTag(block, "guid");
    if (!link) continue;
    link = link.trim();
    if (!link) continue;

    // --- PUBDATE ---
    const pubDate = extractTag(block, "pubDate");
    const time = pubDate ? pubDate.trim() : "";
    let timeISO = "";
    if (time) {
      const parsed = new Date(time);
      timeISO = isNaN(parsed.getTime()) ? "" : parsed.toISOString();
    }

    // --- DESCRIPTION → someText ---
    let someText = "";
    const rawDescription = extractTag(block, "description");
    if (rawDescription) {
      someText = decodeHTMLEntities(rawDescription)
        .replace(/<[^>]+>/g, " ")
        .replace(/\s+/g, " ")
        .trim()
        .slice(0, 200);
    }

    // --- IMAGE EXTRACTION (priority: media:content → media:thumbnail → og:image) ---
    let imgURL = null;
    let imgURLSmall = null;

    // Priority 1: <media:content url="...">
    const mediaContentUrl = extractAttr(block, "media:content", "url");
    const mediaContentWidth = extractAttr(block, "media:content", "width");
    if (mediaContentUrl && isImageValid(mediaContentUrl, mediaContentWidth)) {
      imgURL = resizeBBCImage(mediaContentUrl, 976);
      imgURLSmall = resizeBBCImage(mediaContentUrl, 320);
    }

    // Priority 2: <media:thumbnail url="..."> (only if Priority 1 missed)
    if (!imgURL) {
      const mediaThumbnailUrl = extractAttr(block, "media:thumbnail", "url");
      const mediaThumbnailWidth = extractAttr(block, "media:thumbnail", "width");
      if (mediaThumbnailUrl && isImageValid(mediaThumbnailUrl, mediaThumbnailWidth)) {
        imgURL = resizeBBCImage(mediaThumbnailUrl, 976);
        imgURLSmall = resizeBBCImage(mediaThumbnailUrl, 320);
      }
    }

    const article = {
      // Core fields
      title,
      link,
      time,
      timeISO,

      // Source identity
      providerName: "BBC News",
      providerImg:  "https://www.google.com/s2/favicons?domain=bbc.com&sz=64",
      source:       "bbc",

      // Content
      someText,
      category,

      // Images
      imgURL,
      imgURLSmall,

      // AI-ready fields — always null now
      summary_ai:   null,
      category_ai:  null,
      sentiment:    null,
      embedding_id: null,
    };

    articles.push(article);

    // Priority 3: queue for og:image fallback if both inline media tags missed
    if (!imgURL) {
      ogImageFallbacks.push(article);
    }
  }

  // --- OG:IMAGE FALLBACKS (max 8 concurrent) ---
  if (ogImageFallbacks.length > 0) {
    console.log(`[ScrapForFeed] og:image fallback for ${ogImageFallbacks.length} articles`);

    const tasks = ogImageFallbacks.map((article) => async () => {
      const ogImg = await fetchOgImage(article.link);
      if (ogImg && isImageValid(ogImg, null)) {
        article.imgURL = resizeBBCImage(ogImg, 976);
        article.imgURLSmall = resizeBBCImage(ogImg, 320);
      }
    });

    await runWithConcurrency(tasks, 8);
  }

  // Sort by timeISO descending (newest first)
  articles.sort((a, b) => {
    if (!a.timeISO && !b.timeISO) return 0;
    if (!a.timeISO) return 1;
    if (!b.timeISO) return -1;
    return b.timeISO.localeCompare(a.timeISO);
  });

  return articles;
};


// ---------------------------------------------------------------------------
// DEDUPLICATION
// ---------------------------------------------------------------------------
const titleWords = (title) =>
  new Set(
    title
      .toLowerCase()
      .replace(/[^a-z0-9\s]/g, "")
      .split(/\s+/)
      .filter(Boolean)
  );

const jaccardSimilarity = (a, b) => {
  const A = titleWords(a);
  const B = titleWords(b);
  const intersection = [...A].filter((x) => B.has(x)).length;
  const union = new Set([...A, ...B]).size;
  return union === 0 ? 0 : intersection / union;
};

const deduplicateArticles = (articles) => {
  // Rule 1: Exact URL dedup
  const seenLinks = new Set();
  const urlDeduped = [];
  for (const article of articles) {
    if (seenLinks.has(article.link)) continue;
    seenLinks.add(article.link);
    urlDeduped.push(article);
  }

  // Rule 2: Jaccard title similarity dedup (>= 75%)
  const result = [];
  for (const article of urlDeduped) {
    let isDuplicate = false;
    for (let i = 0; i < result.length; i++) {
      if (jaccardSimilarity(article.title, result[i].title) >= 0.75) {
        // Keep the one with an image; if both or neither, keep earlier timeISO
        if (!result[i].imgURL && article.imgURL) {
          result[i] = article; // replace with the one that has an image
        }
        // otherwise keep existing (already has image or is earlier)
        isDuplicate = true;
        break;
      }
    }
    if (!isDuplicate) {
      result.push(article);
    }
  }

  return result;
};


// ---------------------------------------------------------------------------
// ScrapForFeed()
// ---------------------------------------------------------------------------
/**
 * Fetches news articles from BBC News RSS feeds.
 * Supports pagination: page (0-indexed), pageSize (default 10).
 * Returns { articles, hasMore, total, page, pageSize, source, feedsUsed }.
 */
const ScrapForFeed = async (SearchTexts, page = 0, pageSize = 10) => {
  try {
    // 1. Normalize SearchTexts
    if (!SearchTexts || SearchTexts.length === 0) {
      SearchTexts = ["news"];
    }
    const normalizedQueries = [
      ...new Set(SearchTexts.map((q) => (q || "").toLowerCase().trim()).filter(Boolean)),
    ];
    if (normalizedQueries.length === 0) {
      normalizedQueries.push("news");
    }

    // 2. Map each query to a BBC feed URL
    const feedUrlSet = new Set();
    const feedUrls = [];
    for (const query of normalizedQueries) {
      const url = BBC_TOPIC_FEEDS[query] || BBC_DEFAULT_FEED;
      if (!feedUrlSet.has(url)) {
        feedUrlSet.add(url);
        feedUrls.push(url);
      }
    }

    console.log(`[ScrapForFeed] Fetching ${feedUrls.length} feed(s): ${feedUrls.join(", ")}`);

    // 3. Fetch all feeds in parallel with per-feed 8s timeout
    const feedPromises = feedUrls.map((url) =>
      Promise.race([fetchUrlWithRetry(url), timeoutPromise(8000)])
        .then((xml) => ({ status: "fulfilled", value: xml, url }))
        .catch((err) => ({ status: "rejected", reason: err, url }))
    );

    const results = await Promise.all(feedPromises);

    // 4. Parse fulfilled feeds, skip rejected
    let allArticles = [];
    const feedsUsed = [];

    const parsePromises = [];
    for (const result of results) {
      if (result.status === "fulfilled") {
        const xml = result.value;
        if (!xml.includes("<item>") && !xml.includes("<item ")) {
          console.log(`[ScrapForFeed] ✗ ${result.url} → No <item> tags found`);
          continue;
        }
        parsePromises.push(
          parseBBCRSS(xml, result.url).then((articles) => {
            console.log(`[ScrapForFeed] ✓ ${result.url} → ${articles.length} articles`);
            feedsUsed.push(result.url);
            return articles;
          })
        );
      } else {
        console.log(`[ScrapForFeed] ✗ ${result.url} → ${result.reason.message}`);
      }
    }

    const parsedArrays = await Promise.all(parsePromises);
    for (const articles of parsedArrays) {
      allArticles.push(...articles);
    }

    // 5. Check if all feeds failed
    if (feedsUsed.length === 0) {
      console.log("[ScrapForFeed] All feeds failed");
      return {
        articles: [],
        hasMore: false,
        total: 0,
        page,
        pageSize,
        source: "bbc",
        feedsUsed: [],
        error: "All feeds failed",
      };
    }

    // 6. Deduplicate
    allArticles = deduplicateArticles(allArticles);

    // 7. Sort merged array by timeISO descending (newest first)
    allArticles.sort((a, b) => {
      if (!a.timeISO && !b.timeISO) return 0;
      if (!a.timeISO) return 1;
      if (!b.timeISO) return -1;
      return b.timeISO.localeCompare(a.timeISO);
    });

    // 8. Paginate
    const start = page * pageSize;
    const end = start + pageSize;

    console.log(
      `[ScrapForFeed] Returning articles ${start}–${Math.min(end, allArticles.length) - 1} of ${allArticles.length} total`
    );

    return {
      articles: allArticles.slice(start, end),
      hasMore: end < allArticles.length,
      total: allArticles.length,
      page,
      pageSize,
      source: "bbc",
      feedsUsed,
    };
  } catch (err) {
    console.error(`[ScrapForFeed] Unexpected error: ${err.message}`);
    return {
      articles: [],
      hasMore: false,
      total: 0,
      page,
      pageSize,
      source: "bbc",
      feedsUsed: [],
      error: err.message,
    };
  }
};

export { ScrapForFeed };
