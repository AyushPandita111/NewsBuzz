// ---------------------------------------------------------------------------
// newsAggregator.js
// Multi-source RSS aggregation for the public homepage feed.
//
// Pulls 30+ free RSS feeds across 8 categories, normalises every item to a
// single shape, dedupes + sorts + caps per category, and keeps the result in
// an in-memory cache. A node-cron job refreshes everything every 15 minutes
// (plus once on startup); the API only ever reads the cache, so visitors never
// trigger a live fetch.
//
// NOTE: the authed personalized feed (/api/myfeed) still uses the older
// ScrapForFeed.js — this module powers the public homepage only.
// ---------------------------------------------------------------------------

import Parser from "rss-parser";
import cron from "node-cron";
import crypto from "crypto";

// ---------------------------------------------------------------------------
// FEED SOURCES — category → list of RSS URLs
// ---------------------------------------------------------------------------
const FEEDS = {
  "Top Stories": [
    "https://feeds.bbci.co.uk/news/rss.xml",
    "https://rss.nytimes.com/services/xml/rss/nyt/HomePage.xml",
    "https://feeds.npr.org/1001/rss.xml",
    "https://www.aljazeera.com/xml/rss/all.xml",
  ],
  World: [
    "https://feeds.bbci.co.uk/news/world/rss.xml",
    "https://rss.nytimes.com/services/xml/rss/nyt/World.xml",
    "https://www.aljazeera.com/xml/rss/all.xml",
    "https://feeds.npr.org/1004/rss.xml",
  ],
  Business: [
    "https://feeds.bbci.co.uk/news/business/rss.xml",
    "https://rss.nytimes.com/services/xml/rss/nyt/Business.xml",
    "https://feeds.reuters.com/reuters/businessNews",
    "https://www.cnbc.com/id/100003114/device/rss/rss.html",
  ],
  Sports: [
    "https://feeds.bbci.co.uk/sport/rss.xml",
    "https://rss.nytimes.com/services/xml/rss/nyt/Sports.xml",
    "https://www.espn.com/espn/rss/news",
  ],
  Politics: [
    "https://rss.nytimes.com/services/xml/rss/nyt/Politics.xml",
    "https://feeds.bbci.co.uk/news/politics/rss.xml",
    "https://feeds.npr.org/1014/rss.xml",
  ],
  Science: [
    "https://rss.nytimes.com/services/xml/rss/nyt/Science.xml",
    "https://feeds.bbci.co.uk/news/science_and_environment/rss.xml",
    "https://www.newscientist.com/section/news/feed/",
    "https://feeds.npr.org/1007/rss.xml",
  ],
  India: [
    "https://timesofindia.indiatimes.com/rssfeedstopstories.cms",
    "https://www.thehindu.com/news/national/feeder/default.rss",
    "https://feeds.feedburner.com/ndtvnews-top-stories",
    "https://indianexpress.com/feed/",
  ],
  History: [
    "https://www.smithsonianmag.com/rss/history/",
    "https://feeds.feedburner.com/HistoryExtra",
    "https://www.nationalgeographic.com/history/feed",
  ],
};

const MAX_PER_CATEGORY = 30;
const REFRESH_CRON = "*/15 * * * *"; // every 15 minutes

// ---------------------------------------------------------------------------
// PARSER
// ---------------------------------------------------------------------------
const parser = new Parser({
  timeout: 12000,
  headers: {
    "User-Agent":
      "Mozilla/5.0 (compatible; NewsBuzz/1.0; +https://newsbuzz.app) RSSReader",
    Accept: "application/rss+xml, application/xml, text/xml, */*",
  },
  customFields: {
    item: [
      ["media:content", "mediaContent", { keepArray: true }],
      ["media:thumbnail", "mediaThumbnail", { keepArray: true }],
      ["content:encoded", "contentEncoded"],
    ],
  },
});

// ---------------------------------------------------------------------------
// IN-MEMORY CACHE
// ---------------------------------------------------------------------------
const cache = {
  categories: Object.fromEntries(Object.keys(FEEDS).map((c) => [c, []])),
  lastUpdated: null,
};

// ---------------------------------------------------------------------------
// SOURCE NAME DERIVATION
// ---------------------------------------------------------------------------
const SOURCE_MAP = [
  ["bbci.co.uk", "BBC"],
  ["bbc.co.uk", "BBC"],
  ["nytimes.com", "NYT"],
  ["npr.org", "NPR"],
  ["aljazeera.com", "Al Jazeera"],
  ["reuters.com", "Reuters"],
  ["cnbc.com", "CNBC"],
  ["espn.com", "ESPN"],
  ["timesofindia", "Times of India"],
  ["thehindu.com", "The Hindu"],
  ["ndtv", "NDTV"],
  ["indianexpress.com", "Indian Express"],
  ["smithsonianmag.com", "Smithsonian"],
  ["historyextra", "HistoryExtra"],
  ["nationalgeographic.com", "National Geographic"],
  ["newscientist.com", "New Scientist"],
];

const deriveSource = (feedUrl, feedTitle) => {
  const u = (feedUrl || "").toLowerCase();
  for (const [needle, name] of SOURCE_MAP) {
    if (u.includes(needle)) return name;
  }
  if (feedTitle) {
    const clean = feedTitle.split(/[-|:–—]/)[0].trim();
    if (clean) return clean;
  }
  try {
    return new URL(feedUrl).hostname.replace(/^www\./, "");
  } catch {
    return "News";
  }
};

// ---------------------------------------------------------------------------
// HELPERS
// ---------------------------------------------------------------------------
const stripHtml = (html) =>
  (html || "")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#0?39;|&#x27;|&apos;/gi, "'")
    .replace(/&#(\d+);/g, (_, n) => String.fromCharCode(Number(n)))
    .replace(/\s+/g, " ")
    .trim();

const isHttp = (url) => typeof url === "string" && /^https?:\/\//i.test(url);

/**
 * Image priority: enclosure → media:content → media:thumbnail → first <img>.
 */
const extractImage = (item) => {
  // 1. enclosure
  const enc = item.enclosure;
  if (enc && isHttp(enc.url) && (!enc.type || enc.type.startsWith("image"))) {
    return enc.url;
  }

  // 2. media:content (array of { $: { url, ... } })
  const mc = item.mediaContent;
  const mcList = Array.isArray(mc) ? mc : mc ? [mc] : [];
  for (const m of mcList) {
    const url = m?.$?.url;
    const type = m?.$?.medium || m?.$?.type || "";
    if (isHttp(url) && (!type || type.startsWith("image"))) return url;
  }

  // 3. media:thumbnail
  const mt = item.mediaThumbnail;
  const mtList = Array.isArray(mt) ? mt : mt ? [mt] : [];
  for (const m of mtList) {
    if (isHttp(m?.$?.url)) return m.$.url;
  }

  // 4. first <img> in the (encoded) content
  const html = item.contentEncoded || item.content || "";
  const match = html.match(/<img[^>]+src=["']([^"']+)["']/i);
  if (match && isHttp(match[1])) return match[1];

  return null;
};

const makeId = (link) =>
  crypto.createHash("sha1").update(link || String(Math.random())).digest("hex").slice(0, 16);

const normalizeItem = (item, source, category) => {
  const link = (item.link || item.guid || "").trim();
  const title = (item.title || "").trim();
  if (!link || !title) return null;

  let pubDate = item.isoDate || item.pubDate || null;
  if (pubDate) {
    const d = new Date(pubDate);
    pubDate = isNaN(d.getTime()) ? null : d.toISOString();
  }

  return {
    id: makeId(link),
    title: stripHtml(title),
    description: stripHtml(
      item.contentSnippet || item.summary || item.content || item.contentEncoded || ""
    ).slice(0, 400),
    link,
    image: extractImage(item),
    source,
    category,
    pubDate: pubDate || new Date(0).toISOString(),
  };
};

// ---------------------------------------------------------------------------
// FETCH + REFRESH
// ---------------------------------------------------------------------------
const fetchFeed = async (url, category) => {
  const feed = await parser.parseURL(url);
  const source = deriveSource(url, feed.title);
  return (feed.items || [])
    .map((it) => normalizeItem(it, source, category))
    .filter(Boolean);
};

const refreshCategory = async (category, urls) => {
  const results = await Promise.allSettled(urls.map((u) => fetchFeed(u, category)));

  let articles = [];
  results.forEach((r, i) => {
    if (r.status === "fulfilled") {
      articles.push(...r.value);
    } else {
      console.warn(`[news] ✗ feed failed (${category}): ${urls[i]} → ${r.reason?.message || r.reason}`);
    }
  });

  // Dedupe by article URL.
  const seen = new Set();
  articles = articles.filter((a) => (seen.has(a.link) ? false : seen.add(a.link)));

  // Newest first, then cap.
  articles.sort((a, b) => new Date(b.pubDate) - new Date(a.pubDate));
  return articles.slice(0, MAX_PER_CATEGORY);
};

let refreshing = false;

const refreshAll = async () => {
  if (refreshing) return;
  refreshing = true;
  const started = Date.now();
  console.log("[news] refreshing all feeds…");

  try {
    const entries = Object.entries(FEEDS);
    const results = await Promise.allSettled(
      entries.map(([cat, urls]) => refreshCategory(cat, urls))
    );

    results.forEach((r, i) => {
      const cat = entries[i][0];
      if (r.status === "fulfilled") {
        // Only overwrite when we actually got articles, so a transient
        // total-failure keeps the previously cached content.
        if (r.value.length > 0) cache.categories[cat] = r.value;
        console.log(`[news] ✓ ${cat}: ${cache.categories[cat].length} articles`);
      } else {
        console.warn(`[news] ✗ category "${cat}" failed: ${r.reason?.message || r.reason}`);
      }
    });

    cache.lastUpdated = new Date().toISOString();
    console.log(`[news] refresh complete in ${((Date.now() - started) / 1000).toFixed(1)}s`);
  } finally {
    refreshing = false;
  }
};

// ---------------------------------------------------------------------------
// PUBLIC GETTERS (served from cache — no live fetching)
// ---------------------------------------------------------------------------
const getAll = () => ({
  categories: cache.categories,
  lastUpdated: cache.lastUpdated,
});

const normalizeKey = (s) => String(s || "").toLowerCase().replace(/[^a-z0-9]/g, "");

const resolveCategory = (name) => {
  const target = normalizeKey(name);
  return Object.keys(FEEDS).find((k) => normalizeKey(k) === target) || null;
};

const getCategory = (name) => {
  const key = resolveCategory(name);
  if (!key) return null;
  return { category: key, articles: cache.categories[key], lastUpdated: cache.lastUpdated };
};

const getCategoryNames = () => Object.keys(FEEDS);

// ---------------------------------------------------------------------------
// SCHEDULER
// ---------------------------------------------------------------------------
const startNewsScheduler = () => {
  refreshAll(); // fire once immediately on startup (non-blocking)
  cron.schedule(REFRESH_CRON, refreshAll);
  console.log(`[news] scheduler started — refreshing every 15 minutes`);
};

export { startNewsScheduler, refreshAll, getAll, getCategory, getCategoryNames };
