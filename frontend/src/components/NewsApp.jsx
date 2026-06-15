import React, { useState, useEffect, useMemo, useCallback, useId } from 'react';
import { useNavigate } from 'react-router-dom';
import { GET } from '../api';
import GlancePanel from './GlancePanel';

// ---------------------------------------------------------------------------
// DESIGN SYSTEM (injected so the component is fully self-contained)
// Editorial-modern news aesthetic — warm paper light theme, deep charcoal
// dark theme, a single confident red accent, Playfair Display headlines on
// a clean DM Sans body. Tailwind (loaded via CDN in index.html) handles
// layout utilities; these classes own the color tokens + bespoke motion.
// ---------------------------------------------------------------------------
const styles = `
@import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800&family=Space+Grotesk:wght@500;600;700&display=swap');

/* Light variant — cool, low-glare (kept for the toggle; app is dark-first) */
:root {
  --bg-primary: #F4F6FA;
  --bg-secondary: #E9EDF3;
  --bg-card: #FFFFFF;
  --text-primary: #0B0D12;
  --text-secondary: #4A5263;
  --text-muted: #8A93A3;
  --accent: #0AA5C7;
  --accent-soft: rgba(10,165,199,0.12);
  --on-accent: #FFFFFF;
  --border: #DCE2EC;
  --nav-bg: rgba(244,246,250,0.82);
  --card-shadow: 0 1px 2px rgba(11,13,18,0.05), 0 6px 20px rgba(11,13,18,0.05);
  --card-shadow-hover: 0 0 0 1px rgba(10,165,199,0.30), 0 12px 34px rgba(10,165,199,0.12);
}

/* Midnight / Electric — the default look */
.dark {
  --bg-primary: #0B0D12;
  --bg-secondary: #12151C;
  --bg-card: #14171F;
  --text-primary: #F2F5FA;
  --text-secondary: #9AA3B2;
  --text-muted: #5C6473;
  --accent: #3DD6F5;
  --accent-soft: rgba(61,214,245,0.14);
  --on-accent: #051016;
  --border: #232733;
  --nav-bg: rgba(11,13,18,0.80);
  --card-shadow: 0 1px 2px rgba(0,0,0,0.5), 0 8px 30px rgba(0,0,0,0.4);
  --card-shadow-hover: 0 0 0 1px rgba(61,214,245,0.40), 0 10px 44px rgba(61,214,245,0.16);
}

.nb-root {
  background-color: var(--bg-primary);
  color: var(--text-primary);
  font-family: 'Inter', system-ui, sans-serif;
  transition: background-color 0.3s ease, color 0.3s ease;
  min-height: 100vh;
  -webkit-font-smoothing: antialiased;
}

.font-editorial { font-family: 'Space Grotesk', 'Inter', sans-serif; letter-spacing: -0.025em; }
.on-accent { color: var(--on-accent); }
.badge-glass {
  background: rgba(5,8,14,0.66);
  color: var(--accent);
  border: 1px solid color-mix(in srgb, var(--accent) 48%, transparent);
  box-shadow: 0 0 20px var(--accent-soft);
  -webkit-backdrop-filter: blur(6px); backdrop-filter: blur(6px);
}
.btn-glow { box-shadow: 0 0 26px var(--accent-soft); }
.text-glow { text-shadow: 0 0 18px var(--accent-soft); }

.bg-primary { background-color: var(--bg-primary); }
.bg-secondary { background-color: var(--bg-secondary); }
.bg-card { background-color: var(--bg-card); }
.text-primary { color: var(--text-primary); }
.text-secondary { color: var(--text-secondary); }
.text-muted { color: var(--text-muted); }
.text-accent { color: var(--accent); }
.bg-accent { background-color: var(--accent); }
.bg-accent-soft { background-color: var(--accent-soft); }
.border-color { border-color: var(--border) !important; }

.nb-nav {
  background-color: var(--nav-bg);
  -webkit-backdrop-filter: blur(14px);
  backdrop-filter: blur(14px);
  border-bottom: 1px solid var(--border);
}

.card-container {
  background-color: var(--bg-card);
  border: 1px solid var(--border);
  box-shadow: var(--card-shadow);
  transition: transform 0.25s cubic-bezier(.2,.7,.3,1), box-shadow 0.25s ease, border-color 0.25s ease;
}
.card-container:hover {
  transform: translateY(-3px);
  box-shadow: var(--card-shadow-hover);
  border-color: color-mix(in srgb, var(--accent) 35%, var(--border));
}

.nb-img { transition: transform 0.5s cubic-bezier(.2,.7,.3,1); }
.group:hover .nb-img { transform: scale(1.05); }

.nav-link {
  position: relative; cursor: pointer; background: none; border: none;
  color: var(--text-secondary); transition: color 0.2s ease;
  font-family: inherit;
}
.nav-link:hover { color: var(--text-primary); }
.nav-link.active { color: var(--text-primary); }
.nav-link::after {
  content: ''; position: absolute; bottom: -6px; left: 0; width: 0%;
  height: 2px; background-color: var(--accent); border-radius: 2px;
  transition: width 0.3s ease;
}
.nav-link:hover::after, .nav-link.active::after { width: 100%; }

.nb-pill {
  border: 1px solid var(--border); background-color: var(--bg-card);
  color: var(--text-secondary); cursor: pointer; transition: all 0.2s ease;
  font-family: inherit; white-space: nowrap;
}
.nb-pill:hover { color: var(--text-primary); border-color: var(--accent); }
.nb-pill.active {
  background-color: var(--accent); color: #fff; border-color: var(--accent);
}

.headline-link { color: var(--text-primary); text-decoration: none; transition: color 0.2s ease; }
.group:hover .headline-link, .headline-link:hover { color: var(--accent); }

.skeleton-pulse {
  background: linear-gradient(90deg, var(--bg-secondary) 25%, var(--border) 50%, var(--bg-secondary) 75%);
  background-size: 200% 100%; animation: skeleton-loading 1.4s infinite;
}
@keyframes skeleton-loading { 0% { background-position: 200% 0; } 100% { background-position: -200% 0; } }

.fade-in-up { animation: fadeInUp 0.5s ease forwards; opacity: 0; transform: translateY(12px); }
@keyframes fadeInUp { to { opacity: 1; transform: translateY(0); } }

.gradient-placeholder {
  background:
    radial-gradient(120% 120% at 0% 0%, var(--accent-soft) 0%, transparent 55%),
    linear-gradient(135deg, var(--bg-secondary) 0%, var(--border) 100%);
  position: relative; overflow: hidden;
}

.icon-button {
  color: var(--text-muted); background: none; border: none; cursor: pointer;
  display: inline-flex; align-items: center; justify-content: center;
  transition: color 0.2s ease, transform 0.2s ease;
}
.icon-button:hover { color: var(--accent); transform: translateY(-1px); }
.bookmark-active { color: var(--accent); }

.hide-scrollbar::-webkit-scrollbar { display: none; }
.hide-scrollbar { -ms-overflow-style: none; scrollbar-width: none; }

/* Breaking-news ticker */
.ticker-track { display: inline-flex; align-items: center; white-space: nowrap; will-change: transform; animation: ticker 38s linear infinite; }
.ticker-wrap:hover .ticker-track { animation-play-state: paused; }
@keyframes ticker { 0% { transform: translateX(0); } 100% { transform: translateX(-50%); } }

.live-dot { width: 7px; height: 7px; border-radius: 50%; background: var(--accent); box-shadow: 0 0 0 0 var(--accent); animation: livePulse 1.6s infinite; }
@keyframes livePulse { 0% { box-shadow: 0 0 0 0 var(--accent-soft); } 70% { box-shadow: 0 0 0 7px transparent; } 100% { box-shadow: 0 0 0 0 transparent; } }

.nb-spinner { width: 22px; height: 22px; border-radius: 50%; border: 2px solid var(--border); border-top-color: var(--accent); animation: nbspin 0.7s linear infinite; }
@keyframes nbspin { to { transform: rotate(360deg); } }
`;

// ---------------------------------------------------------------------------
// SVG ICONS
// ---------------------------------------------------------------------------
const Icons = {
  Search: () => (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="11" cy="11" r="8" /><line x1="21" y1="21" x2="16.65" y2="16.65" /></svg>
  ),
  Moon: () => (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z" /></svg>
  ),
  Sun: () => (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="5" /><line x1="12" y1="1" x2="12" y2="3" /><line x1="12" y1="21" x2="12" y2="23" /><line x1="4.22" y1="4.22" x2="5.64" y2="5.64" /><line x1="18.36" y1="18.36" x2="19.78" y2="19.78" /><line x1="1" y1="12" x2="3" y2="12" /><line x1="21" y1="12" x2="23" y2="12" /><line x1="4.22" y1="19.78" x2="5.64" y2="18.36" /><line x1="18.36" y1="5.64" x2="19.78" y2="4.22" /></svg>
  ),
  Bookmark: ({ active }) => (
    <svg width="18" height="18" viewBox="0 0 24 24" fill={active ? 'currentColor' : 'none'} stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M19 21l-7-5-7 5V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2z" /></svg>
  ),
  Share: () => (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="18" cy="5" r="3" /><circle cx="6" cy="12" r="3" /><circle cx="18" cy="19" r="3" /><line x1="8.59" y1="13.51" x2="15.42" y2="17.49" /><line x1="15.41" y1="6.51" x2="8.59" y2="10.49" /></svg>
  ),
  Arrow: () => (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="5" y1="12" x2="19" y2="12" /><polyline points="12 5 19 12 12 19" /></svg>
  ),
  Close: () => (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" /></svg>
  ),
};

// ---------------------------------------------------------------------------
// LOGO — lightning bolt + broadcast waves. Fully theme-aware:
//   bolt   = var(--accent) gradient
//   waves  = var(--bg-primary)  (reads as a cut-out of the bolt in any theme)
//   word   = "News" var(--text-primary) + "Buzz" var(--accent)
// ---------------------------------------------------------------------------
const Logo = ({ size = 34, wordClass = 'text-[1.5rem]' }) => {
  const gid = useId();
  return (
  <span className="inline-flex items-center gap-2.5">
    <svg width={size} height={size} viewBox="0 0 40 44" fill="none" aria-hidden="true" className="flex-shrink-0">
      <defs>
        <linearGradient id={gid} x1="10" y1="3" x2="32" y2="41" gradientUnits="userSpaceOnUse">
          <stop offset="0" stopColor="var(--accent)" />
          <stop offset="1" stopColor="var(--accent)" stopOpacity="0.75" />
        </linearGradient>
      </defs>
      {/* bolt body */}
      <path d="M26 3 L11 25 L19 25 L16 41 L31 18 L23 18 Z" fill={`url(#${gid})`} />
      {/* broadcast / signal waves cut into the bolt */}
      <g stroke="var(--bg-primary)" strokeWidth="1.7" strokeLinecap="round" fill="none">
        <path d="M14 26 A4 4 0 0 1 18 30" />
        <path d="M14 22.6 A7.4 7.4 0 0 1 21.4 30" />
      </g>
      <circle cx="14" cy="30" r="1.7" fill="var(--bg-primary)" />
    </svg>
    <span className={`font-editorial ${wordClass} font-black tracking-tight leading-none`}>
      <span className="text-primary">News</span><span className="text-accent text-glow">Buzz</span>
    </span>
  </span>
  );
};

// ---------------------------------------------------------------------------
// UTILS
// ---------------------------------------------------------------------------
const formatRelativeTime = (isoString) => {
  if (!isoString) return '';
  const date = new Date(isoString);
  if (isNaN(date.getTime())) return '';
  const diffMs = new Date() - date;
  if (diffMs < 0) return 'Just now';
  const m = Math.floor(diffMs / 60000);
  if (m < 1) return 'Just now';
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  const d = Math.floor(h / 24);
  if (d < 7) return `${d}d ago`;
  const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  return `${date.getDate()} ${months[date.getMonth()]} ${date.getFullYear()}`;
};

const todayLabel = () =>
  new Date().toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' });

// Favicon for a source, derived from the article's link host.
const faviconFor = (link) => {
  try {
    return `https://www.google.com/s2/favicons?domain=${new URL(link).hostname}&sz=64`;
  } catch {
    return null;
  }
};

// ---------------------------------------------------------------------------
// CATEGORY MODEL — the 8 sections served by GET /api/news/:category
// ---------------------------------------------------------------------------
const CATEGORIES = ['Top Stories', 'World', 'Business', 'Sports', 'Politics', 'Science', 'India', 'History'];
const DEFAULT_CATEGORY = 'Top Stories';

// ---------------------------------------------------------------------------
// FALLBACK SAMPLE DATA (used only when the backend is unreachable)
// Matches the live API shape: { id, title, description, link, image, source,
// category, pubDate }.
// ---------------------------------------------------------------------------
const ago = (h) => new Date(Date.now() - h * 3600000).toISOString();
const FALLBACK_ARTICLES = [
  { id: 'fb-1', title: 'The Quiet Revolution in Next-Generation Quantum Computing', description: 'Scientists unveiled a new architecture for quantum processors that drastically reduces error rates, paving the way for commercially viable systems within the decade.', link: '#', image: 'https://images.unsplash.com/photo-1635070041078-e363dbe005cb?auto=format&fit=crop&q=80&w=1200', source: 'BBC', category: 'Top Stories', pubDate: ago(0.5) },
  { id: 'fb-2', title: 'Historic Climate Accord Reached at Global Summit in Geneva', description: 'Delegates from 195 nations agreed to legally binding emission reduction targets starting next year.', link: '#', image: 'https://images.unsplash.com/photo-1611273426858-450d8e3c9fce?auto=format&fit=crop&q=80&w=1200', source: 'Al Jazeera', category: 'World', pubDate: ago(5) },
  { id: 'fb-3', title: 'Global Markets Rally as Inflation Cools Faster Than Expected', description: 'Major indexes reached record highs following data showing consumer prices rising at their slowest pace in over three years.', link: '#', image: 'https://images.unsplash.com/photo-1611974789855-9c2a0a7236a3?auto=format&fit=crop&q=80&w=1200', source: 'NYT', category: 'Business', pubDate: ago(3) },
  { id: 'fb-4', title: 'Underdogs Stun Champions in Last-Minute Cup Final Thriller', description: 'A stoppage-time winner sealed one of the most dramatic upsets in the competition\'s recent history.', link: '#', image: 'https://images.unsplash.com/photo-1431324155629-1a6deb1dec8d?auto=format&fit=crop&q=80&w=1200', source: 'ESPN', category: 'Sports', pubDate: ago(2) },
  { id: 'fb-5', title: 'Lawmakers Reach Bipartisan Deal on Sweeping Infrastructure Bill', description: 'The compromise unlocks funding for roads, broadband and clean energy after months of negotiation.', link: '#', image: 'https://images.unsplash.com/photo-1529107386315-e1a2ed48a620?auto=format&fit=crop&q=80&w=1200', source: 'NPR', category: 'Politics', pubDate: ago(6) },
  { id: 'fb-6', title: 'Unexpected Discovery in Deep Ocean Trenches Baffles Marine Biologists', description: 'A deep-sea expedition recorded footage of a previously unknown ecosystem thriving near hydrothermal vents at extreme depths.', link: '#', image: null, source: 'New Scientist', category: 'Science', pubDate: ago(8) },
  { id: 'fb-7', title: 'India Successfully Launches Next-Generation Lunar Rover', description: "ISRO's latest mission aims to explore the moon's permanently shadowed regions in search of water ice.", link: '#', image: null, source: 'Times of India', category: 'India', pubDate: ago(10) },
  { id: 'fb-8', title: 'Archaeologists Uncover a Lost City Beneath the Desert Sands', description: 'The sprawling settlement rewrites the timeline of early urban civilization in the region.', link: '#', image: 'https://images.unsplash.com/photo-1599940824399-b87987ceb72a?auto=format&fit=crop&q=80&w=1200', source: 'Smithsonian', category: 'History', pubDate: ago(20) },
];

// ---------------------------------------------------------------------------
// SMALL PRESENTATION PIECES
// ---------------------------------------------------------------------------
const CategoryKicker = ({ category }) => {
  if (!category) return null;
  return (
    <span className="inline-block text-accent font-bold tracking-[0.18em] uppercase" style={{ fontSize: '0.66rem' }}>
      {category}
    </span>
  );
};

const ImagePlaceholder = ({ small }) => (
  <div className="w-full h-full gradient-placeholder flex items-center justify-center">
    <span className={`font-editorial text-accent opacity-25 font-black italic ${small ? 'text-2xl' : 'text-5xl'}`}>NB</span>
  </div>
);

// Provenance chip overlaid on a card image — shows which outlet the story is from.
const SourceBadge = ({ source }) => {
  if (!source) return null;
  return (
    <span className="badge-glass absolute top-3 right-3 inline-flex items-center text-[0.62rem] font-bold px-2 py-1 rounded-md tracking-wide uppercase">
      {source}
    </span>
  );
};

const Meta = ({ article, compact }) => {
  const [bookmarked, setBookmarked] = useState(false);
  const stop = (e) => { e.preventDefault(); e.stopPropagation(); };
  const favicon = faviconFor(article.link);
  return (
    <div className="flex items-center justify-between mt-3">
      <div className="flex items-center gap-2 min-w-0">
        {favicon && (
          <img src={favicon} alt="" className="w-4 h-4 rounded-sm flex-shrink-0" />
        )}
        <span className="text-xs text-muted font-medium truncate">
          {article.source || 'News'}
          <span className="mx-1.5 opacity-50">·</span>
          {formatRelativeTime(article.pubDate)}
        </span>
      </div>
      {!compact && (
        <div className="flex items-center gap-2 flex-shrink-0">
          <button onClick={(e) => { stop(e); setBookmarked((b) => !b); }} className={`icon-button ${bookmarked ? 'bookmark-active' : ''}`} aria-label="Bookmark">
            <Icons.Bookmark active={bookmarked} />
          </button>
          <button onClick={stop} className="icon-button" aria-label="Share"><Icons.Share /></button>
        </div>
      )}
    </div>
  );
};

// ---------------------------------------------------------------------------
// CARDS
// ---------------------------------------------------------------------------
// Shared click handler: a normal click opens the AI Glance & Chat panel, while
// modifier / middle clicks still open the original source in a new tab.
const openOnClick = (article, onOpen) => (e) => {
  if (!onOpen) return;
  if (e.metaKey || e.ctrlKey || e.shiftKey || e.altKey || e.button === 1) return;
  e.preventDefault();
  onOpen(article);
};

const HeroCard = ({ article, onOpen }) => {
  if (!article) return null;
  return (
    <a href={article.link} target="_blank" rel="noopener noreferrer" onClick={openOnClick(article, onOpen)} className="group block card-container rounded-xl overflow-hidden fade-in-up">
      <div className="flex flex-col lg:flex-row">
        <div className="relative w-full lg:w-[58%] h-60 sm:h-80 lg:h-[440px] overflow-hidden">
          {article.image ? (
            <img src={article.image} alt={article.title} className="nb-img w-full h-full object-cover" loading="eager" />
          ) : <ImagePlaceholder />}
          <span className="badge-glass absolute top-4 left-4 inline-flex items-center gap-1.5 text-[0.65rem] font-bold px-2.5 py-1 rounded-md tracking-wider uppercase">
            <span className="live-dot" /> Top Story
          </span>
          <SourceBadge source={article.source} />
        </div>
        <div className="w-full lg:w-[42%] p-6 md:p-9 flex flex-col justify-center bg-card">
          <CategoryKicker category={article.category} />
          <h1 className="font-editorial text-3xl md:text-[2.6rem] md:leading-[1.08] font-bold mt-3 mb-4 headline-link">
            {article.title}
          </h1>
          {article.description && (
            <p className="text-secondary text-sm md:text-base leading-relaxed mb-5 line-clamp-4">{article.description}</p>
          )}
          <Meta article={article} />
        </div>
      </div>
    </a>
  );
};

const ListItem = ({ article, index, onOpen }) => {
  if (!article) return null;
  return (
    <a href={article.link} target="_blank" rel="noopener noreferrer" onClick={openOnClick(article, onOpen)} className="group flex gap-3 py-4 border-b border-color last:border-0 fade-in-up" style={{ animationDelay: `${index * 50}ms` }}>
      <span className="font-editorial text-2xl font-black text-muted/60 leading-none w-7 flex-shrink-0 pt-0.5">{index + 1}</span>
      <div className="min-w-0">
        <CategoryKicker category={article.category} />
        <h3 className="font-editorial text-[1.02rem] font-bold leading-snug mt-1 headline-link">{article.title}</h3>
        <span className="text-xs text-muted font-medium mt-1.5 block truncate">
          {article.source && <>{article.source}<span className="mx-1.5 opacity-50">·</span></>}
          {formatRelativeTime(article.pubDate)}
        </span>
      </div>
    </a>
  );
};

const ArticleCard = ({ article, index = 0, showText = false, onOpen }) => {
  if (!article) return null;
  return (
    <a href={article.link} target="_blank" rel="noopener noreferrer" onClick={openOnClick(article, onOpen)} className="group flex flex-col card-container rounded-lg overflow-hidden h-full fade-in-up" style={{ animationDelay: `${index * 45}ms` }}>
      <div className="relative w-full h-44 md:h-48 overflow-hidden">
        {article.image ? (
          <img src={article.image} alt={article.title} className="nb-img w-full h-full object-cover" loading="lazy" />
        ) : <ImagePlaceholder small />}
        <SourceBadge source={article.source} />
      </div>
      <div className="p-4 md:p-5 flex flex-col flex-grow bg-card">
        <CategoryKicker category={article.category} />
        <h2 className="font-editorial text-lg font-bold leading-snug mt-1.5 mb-1 headline-link">{article.title}</h2>
        {showText && article.description && (
          <p className="text-secondary text-sm line-clamp-2 leading-relaxed mb-1">{article.description}</p>
        )}
        <div className="mt-auto"><Meta article={article} compact /></div>
      </div>
    </a>
  );
};

// ---------------------------------------------------------------------------
// SKELETONS
// ---------------------------------------------------------------------------
const SkeletonCard = () => (
  <div className="card-container rounded-lg overflow-hidden h-full flex flex-col">
    <div className="w-full h-44 md:h-48 skeleton-pulse" />
    <div className="p-5 flex flex-col flex-grow bg-card">
      <div className="w-16 h-3 rounded skeleton-pulse mb-3" />
      <div className="w-full h-5 rounded skeleton-pulse mb-2" />
      <div className="w-4/5 h-5 rounded skeleton-pulse mb-4" />
      <div className="flex justify-between mt-auto"><div className="w-24 h-4 rounded skeleton-pulse" /><div className="w-10 h-4 rounded skeleton-pulse" /></div>
    </div>
  </div>
);

const LoadingState = () => (
  <div className="mt-8">
    <div className="card-container rounded-xl overflow-hidden mb-10 flex flex-col lg:flex-row">
      <div className="w-full lg:w-[58%] h-60 lg:h-[440px] skeleton-pulse" />
      <div className="w-full lg:w-[42%] p-9 bg-card">
        <div className="w-20 h-3 rounded skeleton-pulse mb-4" />
        <div className="w-full h-8 rounded skeleton-pulse mb-3" />
        <div className="w-3/4 h-8 rounded skeleton-pulse mb-6" />
        <div className="w-full h-3 rounded skeleton-pulse mb-2" />
        <div className="w-5/6 h-3 rounded skeleton-pulse" />
      </div>
    </div>
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
      {Array.from({ length: 6 }).map((_, i) => <SkeletonCard key={i} />)}
    </div>
  </div>
);

// ---------------------------------------------------------------------------
// TICKER
// ---------------------------------------------------------------------------
const Ticker = ({ articles, onOpen }) => {
  if (!articles || articles.length === 0) return null;
  const items = articles.slice(0, 8);
  const row = (keyPrefix) =>
    items.map((a, i) => (
      <a key={`${keyPrefix}-${i}`} href={a.link} target="_blank" rel="noopener noreferrer" onClick={openOnClick(a, onOpen)} className="inline-flex items-center text-sm text-secondary hover:text-accent transition-colors">
        <span className="mx-4 text-accent">◆</span>
        <span className="font-medium">{a.title}</span>
      </a>
    ));
  return (
    <div className="bg-secondary border-b border-color overflow-hidden">
      <div className="max-w-7xl mx-auto flex items-stretch">
        <div className="flex items-center gap-2 bg-card text-accent text-glow px-4 py-2.5 flex-shrink-0 text-xs font-bold uppercase tracking-wider border-r border-color">
          <span className="live-dot" /> Breaking
        </div>
        <div className="ticker-wrap relative flex-1 overflow-hidden py-2.5">
          <div className="ticker-track">{row('a')}{row('b')}</div>
        </div>
      </div>
    </div>
  );
};

// ---------------------------------------------------------------------------
// NAVBAR
// ---------------------------------------------------------------------------
const Navbar = ({ activeCategory, onSelect, isDark, onToggleDark, search, onSearch }) => {
  const [searchOpen, setSearchOpen] = useState(false);
  return (
    <header className="nb-nav sticky top-0 z-50 w-full">
      {/* Top row: dateline · logo · actions */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16">
          <div className="hidden md:block text-xs text-muted font-medium w-56">{todayLabel()}</div>
          <button onClick={() => onSelect(DEFAULT_CATEGORY)} className="flex-shrink-0 mx-auto md:mx-0 bg-transparent border-0 p-0 cursor-pointer" aria-label="NewsBuzz home">
            <Logo size={36} wordClass="text-[1.6rem]" />
          </button>
          <div className="flex items-center gap-1 sm:gap-2 w-56 justify-end">
            {searchOpen ? (
              <div className="flex items-center bg-secondary rounded-full px-3 py-1.5 w-44 sm:w-56">
                <Icons.Search />
                <input
                  autoFocus value={search} onChange={(e) => onSearch(e.target.value)}
                  placeholder="Search stories…"
                  className="bg-transparent outline-none border-none text-sm text-primary ml-2 w-full"
                  style={{ color: 'var(--text-primary)' }}
                />
                <button className="icon-button" onClick={() => { onSearch(''); setSearchOpen(false); }} aria-label="Close search"><Icons.Close /></button>
              </div>
            ) : (
              <button className="icon-button p-1.5" onClick={() => setSearchOpen(true)} aria-label="Search"><Icons.Search /></button>
            )}
            <button onClick={onToggleDark} className="icon-button p-1.5" aria-label="Toggle theme">
              {isDark ? <Icons.Sun /> : <Icons.Moon />}
            </button>
          </div>
        </div>
      </div>
      {/* Category row */}
      <div className="border-t border-color">
        <nav className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 overflow-x-auto hide-scrollbar">
          <ul className="flex items-center gap-6 h-11 min-w-max">
            {CATEGORIES.map((c) => (
              <li key={c}>
                <button onClick={() => onSelect(c)} className={`nav-link text-[0.82rem] font-semibold uppercase tracking-wide ${activeCategory === c ? 'active' : ''}`}>
                  {c}
                </button>
              </li>
            ))}
          </ul>
        </nav>
      </div>
    </header>
  );
};

// ---------------------------------------------------------------------------
// DAILY QUIZ BANNER — entry point to the Daily News Quiz (/quiz).
// Quiz availability comes from the public /api/quiz/meta endpoint; if the
// visitor is logged in we also fetch their attempt status + streak.
// ---------------------------------------------------------------------------
const QuizBanner = () => {
  const navigate = useNavigate();
  const [quiz, setQuiz] = useState(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const meta = await GET('/api/quiz/meta');
      if (cancelled || !meta?.data?.success || !meta.data.available) return;
      const next = { status: 'guest', streak: 0, questionCount: meta.data.questionCount };
      if (localStorage.getItem('token')) {
        const t = await GET('/api/quiz/today');
        if (!cancelled && t?.data?.success && !t.data.caught) {
          next.status = t.data.attempt_status || 'guest';
          next.streak = t.data.streak || 0;
          next.score = t.data.score;
          next.total = t.data.total_questions;
        }
      }
      if (!cancelled) setQuiz(next);
    })();
    return () => { cancelled = true; };
  }, []);

  if (!quiz) return null;

  const completed = quiz.status === 'completed';
  const inProgress = quiz.status === 'in_progress';
  const title = completed
    ? `You scored ${quiz.score}/${quiz.total} today 🎉`
    : inProgress
      ? 'Your quiz is waiting ⏳'
      : 'Today’s Quiz is Live 🔥';
  const subtitle = completed
    ? 'See the answers, explanations and today’s leaderboard.'
    : inProgress
      ? 'Pick up right where you left off.'
      : `${quiz.questionCount} questions on today’s top stories · ~3 min · one attempt per day`;
  const cta = completed ? 'View results' : inProgress ? 'Resume quiz' : 'Start Quiz';

  return (
    <div
      className="card-container rounded-xl mt-6 px-5 sm:px-7 py-5 flex flex-col sm:flex-row items-start sm:items-center gap-4 fade-in-up cursor-pointer group"
      onClick={() => navigate('/quiz')}
      role="button"
      tabIndex={0}
      onKeyDown={(e) => e.key === 'Enter' && navigate('/quiz')}
    >
      <div className="flex items-center gap-4 flex-1 min-w-0">
        <span className="text-3xl flex-shrink-0">🧠</span>
        <div className="min-w-0">
          <h3 className="font-editorial text-lg font-bold text-primary leading-snug">{title}</h3>
          <p className="text-sm text-secondary mt-0.5">{subtitle}</p>
        </div>
      </div>
      <div className="flex items-center gap-3 flex-shrink-0">
        {quiz.streak > 0 && (
          <span className="bg-accent-soft text-accent text-sm font-bold px-3 py-1.5 rounded-full whitespace-nowrap">
            🔥 {quiz.streak}-day streak
          </span>
        )}
        <span className="bg-accent on-accent text-sm font-bold px-5 py-2.5 rounded-lg btn-glow whitespace-nowrap group-hover:opacity-90 transition-opacity">
          {cta} →
        </span>
      </div>
    </div>
  );
};

// ---------------------------------------------------------------------------
// SECTION HEADER
// ---------------------------------------------------------------------------
const SectionTitle = ({ children }) => (
  <div className="flex items-center gap-4 mb-6">
    <h2 className="font-editorial text-2xl font-bold text-primary whitespace-nowrap">{children}</h2>
    <span className="h-px flex-1 bg-accent/30" style={{ backgroundColor: 'var(--border)' }} />
  </div>
);

// ---------------------------------------------------------------------------
// MAIN GRID LAYOUT
// ---------------------------------------------------------------------------
const FeedLayout = ({ articles, categoryLabel, onOpen }) => {
  if (!articles || articles.length === 0) {
    return (
      <div className="py-24 text-center fade-in-up">
        <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-secondary text-muted mb-6"><Icons.Search /></div>
        <h2 className="font-editorial text-3xl font-bold text-primary mb-3">No stories found</h2>
        <p className="text-secondary max-w-md mx-auto">We couldn't load any articles for this section right now. Try another category or check back shortly.</p>
      </div>
    );
  }

  const hero = articles[0];
  const rail = articles.slice(1, 5);     // "Latest" side rail
  const feature = articles.slice(5, 8);  // 3-up feature row
  const rest = articles.slice(8);        // remaining grid

  return (
    <div className="mt-8 pb-4">
      {/* Hero + Latest rail */}
      <section className="grid grid-cols-1 lg:grid-cols-3 gap-8 mb-12">
        <div className="lg:col-span-2"><HeroCard article={hero} onOpen={onOpen} /></div>
        {rail.length > 0 && (
          <aside className="lg:col-span-1">
            <div className="flex items-center gap-2 mb-1">
              <span className="w-2 h-2 rounded-full bg-accent" />
              <h2 className="font-editorial text-xl font-bold text-primary">Latest</h2>
            </div>
            <div className="flex flex-col">
              {rail.map((a, i) => <ListItem key={(a.link || '') + i} article={a} index={i} onOpen={onOpen} />)}
            </div>
          </aside>
        )}
      </section>

      {/* Feature row */}
      {feature.length > 0 && (
        <section className="mb-12">
          <SectionTitle>In {categoryLabel}</SectionTitle>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {feature.map((a, i) => <ArticleCard key={(a.link || '') + i} article={a} index={i} showText onOpen={onOpen} />)}
          </div>
        </section>
      )}

      {/* More stories */}
      {rest.length > 0 && (
        <section>
          <SectionTitle>More Stories</SectionTitle>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
            {rest.map((a, i) => <ArticleCard key={(a.link || '') + i} article={a} index={i} onOpen={onOpen} />)}
          </div>
        </section>
      )}
    </div>
  );
};

// ---------------------------------------------------------------------------
// FOOTER
// ---------------------------------------------------------------------------
const Footer = () => (
  <footer className="border-t border-color mt-16 bg-secondary">
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
      <div className="grid grid-cols-2 md:grid-cols-4 gap-8">
        <div className="col-span-2 md:col-span-1">
          <Logo size={32} wordClass="text-2xl" />
          <p className="text-sm text-muted mt-3 leading-relaxed">Your daily briefing — the world's most important stories, gathered in one calm, readable place.</p>
        </div>
        {[
          { h: 'Sections', items: ['Top Stories', 'World', 'Business', 'Sports'] },
          { h: 'More', items: ['Politics', 'Science', 'India', 'History'] },
          { h: 'About', items: ['Our Sources', 'Privacy', 'Contact', 'Careers'] },
        ].map((col) => (
          <div key={col.h}>
            <h4 className="text-xs font-bold uppercase tracking-widest text-muted mb-4">{col.h}</h4>
            <ul className="space-y-2.5">
              {col.items.map((i) => <li key={i}><span className="text-sm text-secondary hover:text-accent transition-colors cursor-pointer">{i}</span></li>)}
            </ul>
          </div>
        ))}
      </div>
      <div className="border-t border-color mt-10 pt-6 flex flex-col sm:flex-row items-center justify-between gap-3">
        <p className="text-xs text-muted">© {new Date().getFullYear()} NewsBuzz. Headlines aggregated from leading news sources.</p>
        <p className="text-xs text-muted">Designed for readers, not algorithms.</p>
      </div>
    </div>
  </footer>
);

// ---------------------------------------------------------------------------
// ROOT
// ---------------------------------------------------------------------------
export default function NewsApp() {
  const [activeCategory, setActiveCategory] = useState(DEFAULT_CATEGORY);
  const [isDark, setIsDark] = useState(() => {
    const saved = localStorage.getItem('nb-theme');
    if (saved) return saved === 'dark';
    return false; // light-first by default
  });
  const [loading, setLoading] = useState(true);
  const [articles, setArticles] = useState([]);
  const [lastUpdated, setLastUpdated] = useState(null);
  const [offline, setOffline] = useState(false);
  const [search, setSearch] = useState('');
  const [activeArticle, setActiveArticle] = useState(null); // article shown in the Glance panel

  const openArticle = useCallback((article) => setActiveArticle(article), []);
  const closePanel = useCallback(() => setActiveArticle(null), []);

  // Theme side-effect + persistence
  useEffect(() => {
    document.documentElement.classList.toggle('dark', isDark);
    localStorage.setItem('nb-theme', isDark ? 'dark' : 'light');
  }, [isDark]);

  // Fetch one category from the cached multi-source API; fall back to samples
  // if the backend is unreachable. The API serves everything in one shot
  // (up to 30 per category), so there's no pagination.
  const fetchCategory = useCallback(async (category) => {
    const res = await GET(`/api/news/${encodeURIComponent(category)}`);
    const data = res && res.data;
    if (data && data.success && Array.isArray(data.articles)) {
      return { articles: data.articles, lastUpdated: data.lastUpdated, offline: false };
    }
    const sample = FALLBACK_ARTICLES.filter((a) => category === DEFAULT_CATEGORY || a.category === category);
    return { articles: sample.length ? sample : FALLBACK_ARTICLES, lastUpdated: null, offline: true };
  }, []);

  // Category change → reload from cache
  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setSearch('');
    window.scrollTo({ top: 0, behavior: 'smooth' });
    fetchCategory(activeCategory).then((r) => {
      if (cancelled) return;
      setArticles(r.articles);
      setLastUpdated(r.lastUpdated);
      setOffline(r.offline);
      setLoading(false);
    });
    return () => { cancelled = true; };
  }, [activeCategory, fetchCategory]);

  // Client-side search across the loaded set
  const visible = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return articles;
    return articles.filter(
      (a) => a.title?.toLowerCase().includes(q) || a.description?.toLowerCase().includes(q)
    );
  }, [articles, search]);

  const categoryLabel = activeCategory;

  return (
    <>
      <style>{styles}</style>
      <div className="nb-root">
        <Ticker articles={articles} onOpen={openArticle} />
        <Navbar
          activeCategory={activeCategory}
          onSelect={setActiveCategory}
          isDark={isDark}
          onToggleDark={() => setIsDark((d) => !d)}
          search={search}
          onSearch={setSearch}
        />

        <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          {/* Section masthead */}
          <div className="pt-8 flex items-end justify-between gap-4">
            <div>
              <span className="text-accent font-bold tracking-[0.2em] uppercase text-xs">{offline ? 'Sample edition' : 'Live'}</span>
              <h1 className="font-editorial text-4xl md:text-5xl font-black text-primary mt-1">{categoryLabel}</h1>
            </div>
            {!offline && lastUpdated && (
              <div className="hidden sm:flex items-center gap-2 text-xs text-muted font-medium pb-2 whitespace-nowrap">
                <span className="live-dot" /> Updated {formatRelativeTime(lastUpdated)}
              </div>
            )}
          </div>

          {offline && (
            <div className="mt-4 text-sm rounded-lg px-4 py-3 bg-accent-soft text-accent font-medium">
              Backend offline — showing sample stories. Start the API to load live multi-source headlines.
            </div>
          )}

          {/* Daily News Quiz entry point */}
          <QuizBanner />

          {search && !loading && (
            <p className="mt-4 text-sm text-muted">
              {visible.length} result{visible.length === 1 ? '' : 's'} for “{search}”
            </p>
          )}

          {loading ? <LoadingState /> : <FeedLayout articles={visible} categoryLabel={categoryLabel} onOpen={openArticle} />}

          {!loading && !search && visible.length > 0 && (
            <p className="text-center text-sm text-muted my-12 font-medium">You're all caught up — that's the latest in {categoryLabel}.</p>
          )}
        </main>

        <Footer />

        {/* AI News Glance & Chat slide-in panel */}
        <GlancePanel article={activeArticle} onClose={closePanel} />
      </div>
    </>
  );
}
