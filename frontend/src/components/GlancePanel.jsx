import React, { useState, useEffect, useRef, useCallback } from 'react';
import config from '../config';

// ---------------------------------------------------------------------------
// GlancePanel — AI "News Glance & Chat"
// A slide-in panel on the right edge of the homepage. Top section is an AI
// "glance" (summary / key points / entities / sentiment); bottom section is a
// streaming chat about the article. Reuses NewsApp's global design tokens
// (var(--accent) etc.) and utility classes (.text-primary, .bg-card, …) which
// are injected once by NewsApp, plus the panel-specific CSS below.
// ---------------------------------------------------------------------------

const API = config.BACKEND_API;

// ---------------------------------------------------------------------------
// PANEL-SCOPED STYLES
// ---------------------------------------------------------------------------
const panelStyles = `
.nb-panel-backdrop {
  position: fixed; inset: 0; z-index: 59;
  background: rgba(3,5,10,0.55);
  -webkit-backdrop-filter: blur(2px); backdrop-filter: blur(2px);
  opacity: 0; transition: opacity 0.3s ease;
}
.nb-panel-backdrop.open { opacity: 1; }

.nb-panel {
  position: fixed; top: 0; right: 0; z-index: 60;
  height: 100vh; height: 100dvh;
  max-width: 100vw;
  display: flex; flex-direction: column;
  background-color: var(--bg-primary);
  border-left: 1px solid var(--border);
  box-shadow: -8px 0 24px rgba(0,0,0,0.18), -1px 0 0 var(--border);
  transform: translateX(100%);
  transition: transform 0.3s cubic-bezier(.22,.61,.36,1);
  will-change: transform;
}
.nb-panel.open { transform: translateX(0); }

.nb-panel-resize {
  position: absolute; left: -3px; top: 0; bottom: 0; width: 10px;
  cursor: ew-resize; z-index: 5;
  display: flex; align-items: center; justify-content: center;
}
.nb-panel-resize::after {
  content: ''; width: 3px; height: 46px; border-radius: 3px;
  background: var(--border); transition: background 0.2s ease, height 0.2s ease;
}
.nb-panel-resize:hover::after { background: var(--accent); height: 72px; }

.nb-panel-close {
  position: absolute; top: 12px; right: 12px; z-index: 6;
  width: 34px; height: 34px; border-radius: 9px;
  background-color: var(--bg-card); border: 1px solid var(--border);
}
.nb-panel-close:hover { border-color: var(--accent); }

.nb-panel-inner { display: flex; flex-direction: column; height: 100%; min-height: 0; }

/* ---- Glance (top) ---- */
.nb-glance {
  flex: 0 0 auto; max-height: 46%; overflow-y: auto;
  padding: 20px 22px 18px;
  border-bottom: 1px solid var(--border);
  background:
    radial-gradient(120% 90% at 100% 0%, var(--accent-soft) 0%, transparent 60%),
    var(--bg-primary);
}
.nb-eyebrow {
  display: inline-flex; align-items: center; gap: 6px;
  font-size: 0.66rem; font-weight: 800; letter-spacing: 0.16em;
  text-transform: uppercase; color: var(--accent);
}
.nb-chip {
  display: inline-flex; align-items: center; gap: 6px;
  border: 1px solid var(--border); background-color: var(--bg-card);
  color: var(--text-secondary); border-radius: 999px;
  padding: 4px 11px; font-size: 0.76rem; font-weight: 500;
  cursor: pointer; transition: all 0.18s ease; white-space: nowrap;
}
.nb-chip:hover { color: var(--text-primary); border-color: var(--accent); transform: translateY(-1px); }

.nb-entity {
  display: inline-flex; align-items: center; gap: 6px;
  border: 1px solid var(--border); background-color: var(--bg-secondary);
  border-radius: 7px; padding: 3px 9px; font-size: 0.74rem;
  color: var(--text-secondary); font-weight: 500;
}
.nb-entity-dot { width: 7px; height: 7px; border-radius: 50%; flex-shrink: 0; }

.nb-sent { display: inline-flex; align-items: center; gap: 6px; border-radius: 999px; padding: 3px 11px; font-size: 0.72rem; font-weight: 700; }
.nb-sent-dot { width: 8px; height: 8px; border-radius: 50%; }
.nb-sent-positive { background: rgba(34,197,94,0.14); color: #22c55e; }
.nb-sent-positive .nb-sent-dot { background: #22c55e; }
.nb-sent-neutral  { background: var(--accent-soft);   color: var(--accent); }
.nb-sent-neutral  .nb-sent-dot { background: var(--accent); }
.nb-sent-negative { background: rgba(239,68,68,0.14);  color: #ef4444; }
.nb-sent-negative .nb-sent-dot { background: #ef4444; }

/* ---- Chat (bottom) ---- */
.nb-chat { flex: 1 1 0; min-height: 0; display: flex; flex-direction: column; }
.nb-chat-scroll {
  flex: 1 1 0; min-height: 0; overflow-y: auto;
  padding: 18px 22px 8px; display: flex; flex-direction: column; gap: 14px;
}
.nb-bubble {
  max-width: 86%; padding: 10px 13px; border-radius: 14px;
  font-size: 0.9rem; line-height: 1.55; word-wrap: break-word; overflow-wrap: anywhere;
}
.nb-bubble-user {
  align-self: flex-end; background-color: var(--accent); color: var(--on-accent);
  border-bottom-right-radius: 5px;
}
.nb-bubble-ai {
  align-self: flex-start; background-color: var(--bg-card);
  border: 1px solid var(--border); color: var(--text-primary);
  border-bottom-left-radius: 5px;
}

.nb-typing { display: inline-flex; gap: 4px; align-items: center; padding: 3px 2px; }
.nb-typing span {
  width: 6px; height: 6px; border-radius: 50%; background: var(--text-muted);
  animation: nbTyping 1.2s infinite ease-in-out;
}
.nb-typing span:nth-child(2) { animation-delay: 0.18s; }
.nb-typing span:nth-child(3) { animation-delay: 0.36s; }
@keyframes nbTyping { 0%,60%,100% { transform: translateY(0); opacity: .4; } 30% { transform: translateY(-4px); opacity: 1; } }

.nb-msg-tools { display: flex; align-items: center; gap: 6px; margin-top: 5px; align-self: flex-start; }
.nb-copy-btn {
  display: inline-flex; align-items: center; gap: 5px; font-size: 0.7rem; font-weight: 600;
  color: var(--text-muted); background: none; border: none; cursor: pointer; padding: 2px 4px;
  border-radius: 5px; transition: color 0.18s ease;
}
.nb-copy-btn:hover { color: var(--accent); }

.nb-composer { border-top: 1px solid var(--border); padding: 12px 16px 14px; background-color: var(--bg-primary); }
.nb-input-row {
  display: flex; align-items: flex-end; gap: 8px;
  border: 1px solid var(--border); background-color: var(--bg-card);
  border-radius: 14px; padding: 8px 8px 8px 12px; transition: border-color 0.18s ease;
}
.nb-input-row:focus-within { border-color: var(--accent); }
.nb-textarea {
  flex: 1 1 auto; resize: none; border: none; outline: none; background: transparent;
  color: var(--text-primary); font-family: inherit; font-size: 0.9rem; line-height: 1.5;
  max-height: 120px; padding: 4px 0;
}
.nb-textarea::placeholder { color: var(--text-muted); }
.nb-send-btn {
  flex-shrink: 0; width: 36px; height: 36px; border-radius: 10px; border: none; cursor: pointer;
  background-color: var(--accent); color: var(--on-accent);
  display: inline-flex; align-items: center; justify-content: center; transition: opacity 0.18s ease, transform 0.18s ease;
}
.nb-send-btn:hover:not(:disabled) { transform: translateY(-1px); }
.nb-send-btn:disabled { opacity: 0.45; cursor: not-allowed; }

.nb-error {
  display: flex; align-items: center; justify-content: space-between; gap: 10px;
  font-size: 0.8rem; color: #ef4444; background: rgba(239,68,68,0.10);
  border: 1px solid rgba(239,68,68,0.25); border-radius: 10px; padding: 8px 11px; margin-bottom: 10px;
}
.nb-retry-btn {
  flex-shrink: 0; font-size: 0.75rem; font-weight: 700; color: var(--on-accent);
  background: var(--accent); border: none; border-radius: 7px; padding: 4px 10px; cursor: pointer;
}

/* thin custom scrollbars inside the panel */
.nb-glance::-webkit-scrollbar, .nb-chat-scroll::-webkit-scrollbar { width: 7px; }
.nb-glance::-webkit-scrollbar-thumb, .nb-chat-scroll::-webkit-scrollbar-thumb { background: var(--border); border-radius: 7px; }
.nb-glance::-webkit-scrollbar-thumb:hover, .nb-chat-scroll::-webkit-scrollbar-thumb:hover { background: var(--text-muted); }

/* markdown inside AI bubbles */
.nb-md > *:first-child { margin-top: 0; }
.nb-md > *:last-child { margin-bottom: 0; }
.nb-md p { margin: 0 0 8px; }
.nb-md ul, .nb-md ol { margin: 0 0 8px; padding-left: 20px; }
.nb-md li { margin: 2px 0; }
.nb-md h1, .nb-md h2, .nb-md h3 { font-weight: 700; margin: 10px 0 6px; line-height: 1.3; }
.nb-md h1 { font-size: 1.05rem; } .nb-md h2 { font-size: 1rem; } .nb-md h3 { font-size: 0.94rem; }
.nb-md a { color: var(--accent); text-decoration: underline; text-underline-offset: 2px; }
.nb-md code { background: var(--bg-secondary); border: 1px solid var(--border); border-radius: 5px; padding: 1px 5px; font-size: 0.84em; font-family: 'SF Mono', Menlo, Consolas, monospace; }
.nb-md pre { background: var(--bg-secondary); border: 1px solid var(--border); border-radius: 9px; padding: 10px 12px; overflow-x: auto; margin: 0 0 8px; }
.nb-md pre code { background: none; border: none; padding: 0; }
.nb-md strong { color: inherit; font-weight: 700; }

@media (max-width: 767px) {
  .nb-glance { max-height: 42%; }
}
`;

// ---------------------------------------------------------------------------
// ICONS (self-contained)
// ---------------------------------------------------------------------------
const I = {
  Close: () => (<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" /></svg>),
  External: () => (<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6" /><polyline points="15 3 21 3 21 9" /><line x1="10" y1="14" x2="21" y2="3" /></svg>),
  Send: () => (<svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="22" y1="2" x2="11" y2="13" /><polygon points="22 2 15 22 11 13 2 9 22 2" /></svg>),
  Copy: () => (<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="9" y="9" width="13" height="13" rx="2" ry="2" /><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" /></svg>),
  Check: () => (<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12" /></svg>),
  Spark: () => (<svg width="15" height="15" viewBox="0 0 24 24" fill="currentColor"><path d="M12 2l1.9 5.6L19.5 9.5 13.9 11.4 12 17l-1.9-5.6L4.5 9.5l5.6-1.9L12 2zM19 14l.9 2.6L22.5 17.5 19.9 18.4 19 21l-.9-2.6L15.5 17.5l2.6-.9L19 14z" /></svg>),
  Retry: () => (<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="23 4 23 10 17 10" /><path d="M20.49 15a9 9 0 1 1-2.12-9.36L23 10" /></svg>),
};

// ---------------------------------------------------------------------------
// HELPERS
// ---------------------------------------------------------------------------
// Only forward the fields the backend expects (keeps the payload small + safe).
// Tolerates both the new article shape and any legacy field names.
const pickArticle = (a = {}) => ({
  title: a.title,
  link: a.link,
  source: a.source || a.providerName,
  category: a.category,
  pubDate: a.pubDate || a.timeISO || a.time,
  description: a.description || a.someText,
  image: a.image,
});

const formatDate = (iso) => {
  if (!iso) return '';
  const d = new Date(iso);
  if (isNaN(d.getTime())) return '';
  const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  return `${d.getDate()} ${months[d.getMonth()]} ${d.getFullYear()}`;
};

// Favicon for the source, derived from the article link host.
const faviconFor = (link) => {
  try {
    return `https://www.google.com/s2/favicons?domain=${new URL(link).hostname}&sz=64`;
  } catch {
    return null;
  }
};

const entityColor = (type) => {
  switch ((type || '').toLowerCase()) {
    case 'person': return '#3DD6F5';
    case 'organization': return '#a78bfa';
    case 'location': return '#22c55e';
    default: return 'var(--text-muted)';
  }
};

const STARTERS = [
  'Why does this matter?',
  "What's the other side of this story?",
  "Explain this to me like I'm 15",
  'What happened before this?',
];

const clampWidth = (w) => {
  const max = Math.min(720, window.innerWidth - 48);
  return Math.max(360, Math.min(w, max));
};

// ---------------------------------------------------------------------------
// MINIMAL MARKDOWN RENDERER (bold / italic / code / links / lists / headings)
// Dependency-free; good enough for chat answers.
// ---------------------------------------------------------------------------
const INLINE_RE = /(`[^`]+`)|(\*\*[^*]+\*\*)|(\[[^\]]+\]\([^)\s]+\))|(\*[^*]+\*)|(_[^_]+_)/;

const parseInline = (text, kp) => {
  const nodes = [];
  let rest = String(text);
  let k = 0;
  while (rest.length) {
    const m = rest.match(INLINE_RE);
    if (!m) { nodes.push(rest); break; }
    if (m.index > 0) nodes.push(rest.slice(0, m.index));
    const tok = m[0];
    if (tok.startsWith('`')) {
      nodes.push(<code key={`${kp}-${k}`}>{tok.slice(1, -1)}</code>);
    } else if (tok.startsWith('**')) {
      nodes.push(<strong key={`${kp}-${k}`}>{tok.slice(2, -2)}</strong>);
    } else if (tok.startsWith('[')) {
      const lm = tok.match(/\[([^\]]+)\]\(([^)\s]+)\)/);
      nodes.push(<a key={`${kp}-${k}`} href={lm[2]} target="_blank" rel="noopener noreferrer">{lm[1]}</a>);
    } else { // *italic* or _italic_
      nodes.push(<em key={`${kp}-${k}`}>{tok.slice(1, -1)}</em>);
    }
    rest = rest.slice(m.index + tok.length);
    k++;
  }
  return nodes;
};

const renderMarkdown = (md) => {
  const lines = String(md).replace(/\r\n/g, '\n').split('\n');
  const blocks = [];
  let i = 0;
  while (i < lines.length) {
    const line = lines[i];
    if (line.trim().startsWith('```')) {
      const code = [];
      i++;
      while (i < lines.length && !lines[i].trim().startsWith('```')) { code.push(lines[i]); i++; }
      i++;
      blocks.push({ t: 'code', c: code.join('\n') });
      continue;
    }
    if (/^\s*#{1,6}\s+/.test(line)) {
      const level = line.match(/^\s*(#{1,6})/)[1].length;
      blocks.push({ t: 'h', level: Math.min(level, 3), c: line.replace(/^\s*#{1,6}\s+/, '') });
      i++;
      continue;
    }
    if (/^\s*([-*+]|\d+\.)\s+/.test(line)) {
      const ordered = /^\s*\d+\.\s+/.test(line);
      const items = [];
      while (i < lines.length && /^\s*([-*+]|\d+\.)\s+/.test(lines[i])) {
        items.push(lines[i].replace(/^\s*([-*+]|\d+\.)\s+/, ''));
        i++;
      }
      blocks.push({ t: ordered ? 'ol' : 'ul', items });
      continue;
    }
    if (line.trim() === '') { i++; continue; }
    const para = [];
    while (i < lines.length && lines[i].trim() !== '' &&
      !/^\s*([-*+]|\d+\.)\s+/.test(lines[i]) && !lines[i].trim().startsWith('```') &&
      !/^\s*#{1,6}\s+/.test(lines[i])) {
      para.push(lines[i]); i++;
    }
    blocks.push({ t: 'p', c: para.join(' ') });
  }

  return blocks.map((b, idx) => {
    if (b.t === 'code') return <pre key={idx}><code>{b.c}</code></pre>;
    if (b.t === 'h') {
      const Tag = `h${b.level}`;
      return <Tag key={idx}>{parseInline(b.c, idx)}</Tag>;
    }
    if (b.t === 'ul') return <ul key={idx}>{b.items.map((it, j) => <li key={j}>{parseInline(it, `${idx}-${j}`)}</li>)}</ul>;
    if (b.t === 'ol') return <ol key={idx}>{b.items.map((it, j) => <li key={j}>{parseInline(it, `${idx}-${j}`)}</li>)}</ol>;
    return <p key={idx}>{parseInline(b.c, idx)}</p>;
  });
};

// ---------------------------------------------------------------------------
// GLANCE CACHE — one summary per article for the life of the page.
// Re-opening a story (or quickly toggling between two) reuses the result
// instead of spending another API call, which matters on Gemini's free tier
// (~10 requests/minute). In-flight requests are de-duped via the stored promise.
// ---------------------------------------------------------------------------
const glanceCache = new Map(); // articleKey -> Promise<glance> (resolved on success)

const fetchGlance = (article) => {
  const key = article.link || article.title;
  if (glanceCache.has(key)) return glanceCache.get(key);

  const promise = (async () => {
    const res = await fetch(`${API}/api/news/glance`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ article: pickArticle(article) }),
    });
    let data = {};
    try { data = await res.json(); } catch { /* non-JSON */ }
    if (res.status === 429) throw new Error('AI is busy — try again in a moment.');
    if (!res.ok || !data.success) throw new Error(data.message || 'Could not generate a summary.');
    return data.glance;
  })();

  // Cache the promise so concurrent mounts share it; drop it on failure so Retry refetches.
  glanceCache.set(key, promise);
  promise.catch(() => glanceCache.delete(key));
  return promise;
};

// ---------------------------------------------------------------------------
// GLANCE VIEW (top section)
// ---------------------------------------------------------------------------
const GlanceSkeleton = () => (
  <div className="mt-3">
    <div className="w-24 h-3 rounded skeleton-pulse mb-3" />
    <div className="w-full h-3 rounded skeleton-pulse mb-2" />
    <div className="w-11/12 h-3 rounded skeleton-pulse mb-4" />
    <div className="flex gap-2 mb-4">
      {[44, 60, 38].map((w, i) => <div key={i} className="h-6 rounded-full skeleton-pulse" style={{ width: w }} />)}
    </div>
    <div className="w-3/4 h-3 rounded skeleton-pulse mb-2" />
    <div className="w-2/3 h-3 rounded skeleton-pulse" />
  </div>
);

const SentimentBadge = ({ sentiment }) => {
  const label = { positive: 'Positive', neutral: 'Neutral', negative: 'Negative' }[sentiment] || 'Neutral';
  return (
    <span className={`nb-sent nb-sent-${sentiment || 'neutral'}`}>
      <span className="nb-sent-dot" />{label}
    </span>
  );
};

const GlanceView = ({ article }) => {
  const [glance, setGlance] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await fetchGlance(article); // cached + de-duped
      setGlance(data);
    } catch (e) {
      setError(e.message || 'Could not generate a summary.');
    } finally {
      setLoading(false);
    }
  }, [article]);

  useEffect(() => {
    let alive = true;
    setLoading(true);
    setError(null);
    fetchGlance(article)
      .then((data) => { if (alive) { setGlance(data); setLoading(false); } })
      .catch((e) => { if (alive) { setError(e.message || 'Could not generate a summary.'); setLoading(false); } });
    return () => { alive = false; };
  }, [article]);

  return (
    <div className="nb-glance">
      <span className="nb-eyebrow"><I.Spark /> AI Glance</span>
      <h2 className="font-editorial text-primary font-bold leading-snug mt-2" style={{ fontSize: '1.18rem', paddingRight: 28 }}>
        {article.title}
      </h2>
      <div className="flex items-center flex-wrap gap-x-2 gap-y-1 mt-2 text-xs text-muted">
        {faviconFor(article.link) && <img src={faviconFor(article.link)} alt="" className="w-4 h-4 rounded-sm" />}
        <span className="font-medium">{article.source || 'News'}</span>
        {formatDate(article.pubDate) && (
          <><span className="opacity-50">·</span><span>{formatDate(article.pubDate)}</span></>
        )}
        {article.link && (
          <a href={article.link} target="_blank" rel="noopener noreferrer"
            className="inline-flex items-center gap-1 text-accent font-semibold ml-auto hover:underline">
            Read full article <I.External />
          </a>
        )}
      </div>

      {loading && <GlanceSkeleton />}

      {!loading && error && (
        <div className="nb-error mt-4">
          <span>{error}</span>
          <button className="nb-retry-btn" onClick={load}><I.Retry /> Retry</button>
        </div>
      )}

      {!loading && !error && glance && (
        <div className="mt-3">
          {glance.summary && <p className="text-secondary text-sm leading-relaxed mb-3">{glance.summary}</p>}

          {glance.keyPoints?.length > 0 && (
            <ul className="mb-3 space-y-1.5">
              {glance.keyPoints.map((pt, i) => (
                <li key={i} className="flex gap-2 text-sm text-primary leading-snug">
                  <span className="text-accent flex-shrink-0 mt-1" style={{ fontSize: '0.6rem' }}>●</span>
                  <span>{pt}</span>
                </li>
              ))}
            </ul>
          )}

          <div className="flex items-center flex-wrap gap-2 mb-1">
            <SentimentBadge sentiment={glance.sentiment} />
            {glance.entities?.map((e, i) => (
              <span key={i} className="nb-entity" title={e.type}>
                <span className="nb-entity-dot" style={{ background: entityColor(e.type) }} />
                {e.name}
              </span>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};

// ---------------------------------------------------------------------------
// CHAT MESSAGE
// ---------------------------------------------------------------------------
const ChatMessage = ({ message, streaming }) => {
  const [copied, setCopied] = useState(false);
  const isUser = message.role === 'user';
  const empty = !message.content;

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(message.content);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch { /* clipboard unavailable */ }
  };

  if (isUser) {
    return <div className="nb-bubble nb-bubble-user">{message.content}</div>;
  }

  return (
    <div className="flex flex-col" style={{ alignSelf: 'flex-start', maxWidth: '100%' }}>
      <div className="nb-bubble nb-bubble-ai">
        {empty && streaming ? (
          <span className="nb-typing"><span /><span /><span /></span>
        ) : (
          <div className="nb-md">{renderMarkdown(message.content)}</div>
        )}
      </div>
      {!empty && !streaming && (
        <div className="nb-msg-tools">
          <button className="nb-copy-btn" onClick={copy}>
            {copied ? <><I.Check /> Copied</> : <><I.Copy /> Copy</>}
          </button>
        </div>
      )}
    </div>
  );
};

// ---------------------------------------------------------------------------
// CHAT INTERFACE (bottom section)
// ---------------------------------------------------------------------------
const ChatInterface = ({ article }) => {
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState('');
  const [streaming, setStreaming] = useState(false);
  const [error, setError] = useState(null);
  const scrollRef = useRef(null);
  const taRef = useRef(null);
  const abortRef = useRef(null);
  const pinnedRef = useRef(true);

  // Auto-scroll to bottom (only while pinned near the bottom).
  useEffect(() => {
    const el = scrollRef.current;
    if (!el || !pinnedRef.current) return;
    el.scrollTo({ top: el.scrollHeight, behavior: streaming ? 'auto' : 'smooth' });
  }, [messages, streaming]);

  const onScroll = () => {
    const el = scrollRef.current;
    if (!el) return;
    pinnedRef.current = el.scrollHeight - el.scrollTop - el.clientHeight < 130;
  };

  // Abort any in-flight stream when the article switches (component unmounts).
  useEffect(() => () => { abortRef.current?.abort(); }, []);

  // Core: stream an assistant reply for a given history (ending in a user msg).
  const runStream = useCallback(async (history) => {
    setError(null);
    pinnedRef.current = true;
    setMessages([...history, { role: 'assistant', content: '' }]);
    setStreaming(true);

    const controller = new AbortController();
    abortRef.current = controller;

    const appendDelta = (delta) => {
      setMessages((prev) => {
        const copy = prev.slice();
        const last = copy[copy.length - 1];
        if (last && last.role === 'assistant') copy[copy.length - 1] = { ...last, content: last.content + delta };
        return copy;
      });
    };

    try {
      const res = await fetch(`${API}/api/news/chat`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ article: pickArticle(article), messages: history }),
        signal: controller.signal,
      });

      if (res.status === 429) throw new Error('AI is busy — try again in a moment.');
      if (!res.ok || !res.body) {
        let msg = 'The AI could not respond. Please try again.';
        try { const d = await res.json(); if (d.message) msg = d.message; } catch { /* ignore */ }
        throw new Error(msg);
      }

      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let buffer = '';
      let streamErr = null;

      while (true) {
        const { value, done } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });
        let idx;
        while ((idx = buffer.indexOf('\n\n')) !== -1) {
          const block = buffer.slice(0, idx);
          buffer = buffer.slice(idx + 2);
          const dataLine = block.split('\n').find((l) => l.startsWith('data:'));
          if (!dataLine) continue;
          const payload = dataLine.slice(5).trim();
          if (!payload) continue;
          let evt;
          try { evt = JSON.parse(payload); } catch { continue; }
          if (evt.delta) appendDelta(evt.delta);
          else if (evt.error) streamErr = evt.error;
        }
      }

      if (streamErr) {
        setError(streamErr);
        // drop the empty assistant placeholder if nothing streamed
        setMessages((prev) => {
          const last = prev[prev.length - 1];
          return last && last.role === 'assistant' && !last.content ? prev.slice(0, -1) : prev;
        });
      }
    } catch (e) {
      if (e.name === 'AbortError') return; // article switched / unmounted
      setError(e.message || 'The AI could not respond. Please try again.');
      setMessages((prev) => {
        const last = prev[prev.length - 1];
        return last && last.role === 'assistant' && !last.content ? prev.slice(0, -1) : prev;
      });
    } finally {
      setStreaming(false);
      abortRef.current = null;
    }
  }, [article]);

  const send = (text) => {
    const content = (text || '').trim();
    if (!content || streaming) return;
    const clean = messages.filter((m) => !(m.role === 'assistant' && !m.content));
    setInput('');
    if (taRef.current) taRef.current.style.height = 'auto';
    runStream([...clean, { role: 'user', content }]);
  };

  const retry = () => {
    if (streaming) return;
    let history = messages.slice();
    while (history.length && history[history.length - 1].role === 'assistant') history.pop();
    if (history.length) runStream(history);
  };

  const onKeyDown = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      send(input);
    }
  };

  const onInput = (e) => {
    setInput(e.target.value);
    const el = e.target;
    el.style.height = 'auto';
    el.style.height = Math.min(el.scrollHeight, 120) + 'px';
  };

  const isEmpty = messages.length === 0;

  return (
    <div className="nb-chat">
      <div className="nb-chat-scroll" ref={scrollRef} onScroll={onScroll}>
        {isEmpty ? (
          <div className="flex flex-col items-start gap-2 mt-1">
            <div className="inline-flex items-center gap-2 text-accent font-semibold text-sm">
              <I.Spark /> Chat about this story
            </div>
            <p className="text-sm text-muted leading-relaxed">
              Ask anything — context, background, different perspectives, or a quick fact-check.
            </p>
          </div>
        ) : (
          messages.map((m, i) => (
            <ChatMessage
              key={i}
              message={m}
              streaming={streaming && i === messages.length - 1}
            />
          ))
        )}
      </div>

      <div className="nb-composer">
        {error && (
          <div className="nb-error">
            <span>{error}</span>
            <button className="nb-retry-btn" onClick={retry}><I.Retry /> Retry</button>
          </div>
        )}

        {/* Suggested starters — only before the conversation begins */}
        {isEmpty && !streaming && (
          <div className="flex flex-wrap gap-2 mb-2.5">
            {STARTERS.map((q) => (
              <button key={q} className="nb-chip" onClick={() => send(q)}>{q}</button>
            ))}
          </div>
        )}

        <div className="nb-input-row">
          <textarea
            ref={taRef}
            className="nb-textarea"
            rows={1}
            placeholder="Ask about this article…  (Enter to send, Shift+Enter for newline)"
            value={input}
            onChange={onInput}
            onKeyDown={onKeyDown}
            disabled={streaming}
          />
          <button
            className="nb-send-btn"
            onClick={() => send(input)}
            disabled={streaming || !input.trim()}
            aria-label="Send message"
          >
            <I.Send />
          </button>
        </div>
      </div>
    </div>
  );
};

// ---------------------------------------------------------------------------
// PANEL CONTENT — remounts (fresh glance + empty chat) whenever article changes
// ---------------------------------------------------------------------------
const GlanceContent = ({ article }) => (
  <div className="nb-panel-inner">
    <GlanceView article={article} />
    <ChatInterface article={article} />
  </div>
);

// ---------------------------------------------------------------------------
// PANEL SHELL — slide animation, resize, mobile handling
// ---------------------------------------------------------------------------
export default function GlancePanel({ article, onClose }) {
  const [render, setRender] = useState(false);
  const [shown, setShown] = useState(false);
  const [display, setDisplay] = useState(null);
  const [isMobile, setIsMobile] = useState(() => (typeof window !== 'undefined' ? window.innerWidth < 768 : false));
  const [width, setWidth] = useState(() => (typeof window !== 'undefined' ? clampWidth(Math.round(window.innerWidth * 0.4)) : 480));
  const draggingRef = useRef(false);

  useEffect(() => {
    const onResize = () => setIsMobile(window.innerWidth < 768);
    window.addEventListener('resize', onResize);
    return () => window.removeEventListener('resize', onResize);
  }, []);

  // Open / replace / close orchestration (keeps content during the exit slide).
  useEffect(() => {
    if (article) {
      setDisplay(article);
      setRender(true);
      const id = requestAnimationFrame(() => requestAnimationFrame(() => setShown(true)));
      return () => cancelAnimationFrame(id);
    }
    if (render) {
      setShown(false);
      const t = setTimeout(() => { setRender(false); setDisplay(null); }, 320);
      return () => clearTimeout(t);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [article]);

  // Escape closes the panel.
  useEffect(() => {
    if (!render) return;
    const onKey = (e) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [render, onClose]);

  // Lock body scroll while the full-screen mobile overlay is open.
  useEffect(() => {
    if (render && isMobile) {
      const prev = document.body.style.overflow;
      document.body.style.overflow = 'hidden';
      return () => { document.body.style.overflow = prev; };
    }
  }, [render, isMobile]);

  const startDrag = useCallback((e) => {
    if (isMobile) return;
    e.preventDefault();
    draggingRef.current = true;
    document.body.style.userSelect = 'none';
    document.body.style.cursor = 'ew-resize';
    const onMove = (ev) => {
      if (!draggingRef.current) return;
      setWidth(clampWidth(window.innerWidth - ev.clientX));
    };
    const onUp = () => {
      draggingRef.current = false;
      document.body.style.userSelect = '';
      document.body.style.cursor = '';
      window.removeEventListener('mousemove', onMove);
      window.removeEventListener('mouseup', onUp);
    };
    window.addEventListener('mousemove', onMove);
    window.addEventListener('mouseup', onUp);
  }, [isMobile]);

  if (!render || !display) return null;

  return (
    <>
      <style>{panelStyles}</style>
      {isMobile && <div className={`nb-panel-backdrop ${shown ? 'open' : ''}`} onClick={onClose} />}
      <aside
        className={`nb-panel ${shown ? 'open' : ''}`}
        style={{ width: isMobile ? '100vw' : width }}
        role="dialog"
        aria-modal={isMobile ? 'true' : 'false'}
        aria-label="Article glance and chat"
      >
        {!isMobile && <div className="nb-panel-resize" onMouseDown={startDrag} title="Drag to resize" />}
        <button className="nb-panel-close icon-button" onClick={onClose} aria-label="Close panel">
          <I.Close />
        </button>
        <GlanceContent key={display.link || display.title} article={display} />
      </aside>
    </>
  );
}
