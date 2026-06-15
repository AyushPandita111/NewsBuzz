import React, { useState, useEffect, useMemo, useRef, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { GET, POST } from '../api';

// ---------------------------------------------------------------------------
// DailyQuiz — Wordle-style daily news quiz.
// Self-contained page using the same design tokens as the NewsApp homepage
// (CSS variables + Tailwind CDN utilities, dark mode via the `dark` class
// and the shared `nb-theme` localStorage key).
// ---------------------------------------------------------------------------
const styles = `
@import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800&family=Space+Grotesk:wght@500;600;700&display=swap');

:root {
  --bg-primary: #F4F6FA; --bg-secondary: #E9EDF3; --bg-card: #FFFFFF;
  --text-primary: #0B0D12; --text-secondary: #4A5263; --text-muted: #8A93A3;
  --accent: #0AA5C7; --accent-soft: rgba(10,165,199,0.12); --on-accent: #FFFFFF;
  --border: #DCE2EC;
  --correct: #16a34a; --correct-soft: rgba(22,163,74,0.12);
  --wrong: #dc2626; --wrong-soft: rgba(220,38,38,0.12);
  --card-shadow: 0 1px 2px rgba(11,13,18,0.05), 0 6px 20px rgba(11,13,18,0.05);
}
.dark {
  --bg-primary: #0B0D12; --bg-secondary: #12151C; --bg-card: #14171F;
  --text-primary: #F2F5FA; --text-secondary: #9AA3B2; --text-muted: #5C6473;
  --accent: #3DD6F5; --accent-soft: rgba(61,214,245,0.14); --on-accent: #051016;
  --border: #232733;
  --correct: #4ade80; --correct-soft: rgba(74,222,128,0.14);
  --wrong: #f87171; --wrong-soft: rgba(248,113,113,0.14);
  --card-shadow: 0 1px 2px rgba(0,0,0,0.5), 0 8px 30px rgba(0,0,0,0.4);
}

.qz-root {
  background-color: var(--bg-primary); color: var(--text-primary);
  font-family: 'Inter', system-ui, sans-serif; min-height: 100vh;
  -webkit-font-smoothing: antialiased;
  transition: background-color 0.3s ease, color 0.3s ease;
}
.font-editorial { font-family: 'Space Grotesk', 'Inter', sans-serif; letter-spacing: -0.025em; }
.bg-card { background-color: var(--bg-card); }
.bg-secondary { background-color: var(--bg-secondary); }
.text-primary { color: var(--text-primary); }
.text-secondary { color: var(--text-secondary); }
.text-muted { color: var(--text-muted); }
.text-accent { color: var(--accent); }
.bg-accent { background-color: var(--accent); }
.bg-accent-soft { background-color: var(--accent-soft); }
.on-accent { color: var(--on-accent); }
.border-color { border-color: var(--border) !important; }

.qz-card { background-color: var(--bg-card); border: 1px solid var(--border); box-shadow: var(--card-shadow); }

.qz-option {
  background-color: var(--bg-card); border: 1.5px solid var(--border); color: var(--text-primary);
  cursor: pointer; transition: border-color .15s ease, background-color .15s ease, transform .1s ease;
  text-align: left; width: 100%; font-family: inherit; font-size: 0.95rem;
}
.qz-option:hover { border-color: var(--accent); }
.qz-option:active { transform: scale(0.99); }
.qz-option.selected { border-color: var(--accent); background-color: var(--accent-soft); }
.qz-option.correct { border-color: var(--correct); background-color: var(--correct-soft); }
.qz-option.wrong { border-color: var(--wrong); background-color: var(--wrong-soft); }
.qz-option:disabled { cursor: default; }

.qz-btn {
  background-color: var(--accent); color: var(--on-accent); border: none; cursor: pointer;
  font-weight: 700; font-family: inherit; transition: opacity .15s ease, transform .1s ease;
}
.qz-btn:hover:not(:disabled) { opacity: 0.9; }
.qz-btn:active:not(:disabled) { transform: scale(0.98); }
.qz-btn:disabled { opacity: 0.35; cursor: not-allowed; }
.qz-btn-ghost {
  background: none; border: 1.5px solid var(--border); color: var(--text-secondary); cursor: pointer;
  font-weight: 600; font-family: inherit; transition: border-color .15s ease, color .15s ease;
}
.qz-btn-ghost:hover { border-color: var(--accent); color: var(--accent); }

.qz-progress-track { background-color: var(--bg-secondary); border-radius: 99px; overflow: hidden; }
.qz-progress-fill { background-color: var(--accent); height: 100%; border-radius: 99px; transition: width .4s cubic-bezier(.2,.7,.3,1); }

.qz-tab { background: none; border: none; cursor: pointer; color: var(--text-muted); font-weight: 600; font-family: inherit; padding: 10px 4px; position: relative; }
.qz-tab.active { color: var(--text-primary); }
.qz-tab.active::after { content: ''; position: absolute; bottom: 0; left: 0; right: 0; height: 2px; background: var(--accent); border-radius: 2px; }

.fade-in-up { animation: qzFadeUp 0.45s ease forwards; opacity: 0; transform: translateY(12px); }
@keyframes qzFadeUp { to { opacity: 1; transform: translateY(0); } }

.qz-pop { animation: qzPop 0.5s cubic-bezier(.2,1.4,.4,1) forwards; transform: scale(0.6); opacity: 0; }
@keyframes qzPop { to { transform: scale(1); opacity: 1; } }

.qz-flame { display: inline-block; animation: qzFlame 1s ease-in-out infinite alternate; transform-origin: bottom center; }
@keyframes qzFlame { from { transform: scale(1) rotate(-3deg); } to { transform: scale(1.12) rotate(3deg); } }

.qz-square { width: 26px; height: 26px; border-radius: 6px; display: inline-block; }

.qz-modal-backdrop { position: fixed; inset: 0; background: rgba(0,0,0,0.55); z-index: 60; display: flex; align-items: center; justify-content: center; padding: 16px; -webkit-backdrop-filter: blur(4px); backdrop-filter: blur(4px); }

.qz-row-me { background-color: var(--accent-soft); }
.qz-spinner { width: 26px; height: 26px; border-radius: 50%; border: 2.5px solid var(--border); border-top-color: var(--accent); animation: qzspin 0.7s linear infinite; }
@keyframes qzspin { to { transform: rotate(360deg); } }
`;

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------
const TYPE_LABEL = {
  mcq: 'Multiple Choice',
  real_or_fake: 'Real or Fake?',
  fill_blank: 'Fill in the Blank',
  timeline_order: 'Timeline Order',
};

const DIFF_COLOR = { easy: 'var(--correct)', medium: 'var(--accent)', hard: 'var(--wrong)' };

const fmtCountdown = (ms) => {
  if (ms == null || ms <= 0) return '0h 0m';
  const h = Math.floor(ms / 3600000);
  const m = Math.floor((ms % 3600000) / 60000);
  return `${h}h ${m}m`;
};

const fmtDuration = (ms) => {
  if (!ms && ms !== 0) return '—';
  const s = Math.round(ms / 1000);
  return s < 60 ? `${s}s` : `${Math.floor(s / 60)}m ${s % 60}s`;
};

const answerLabel = (q, answer) => {
  if (answer == null || answer === '') return 'No answer';
  if (q.type === 'timeline_order') {
    return (Array.isArray(answer) ? answer : []).map((e, i) => `${i + 1}. ${e}`).join('  →  ');
  }
  if (q.type === 'real_or_fake') {
    const a = String(answer).toLowerCase();
    return a === 'real' ? 'Real' : a === 'fake' ? 'Fake' : String(answer);
  }
  return String(answer);
};

const isAuthFailure = (res) => !res || !res.data || res.data.caught || res.data.success === false && /token|authoriz/i.test(res.data.message || '');

// ---------------------------------------------------------------------------
// Shareable result card — drawn on a canvas, shared via Web Share API with
// download / copy-image fallbacks.
// ---------------------------------------------------------------------------
const drawShareCard = (canvas, { date, score, total, streak, pattern }) => {
  const W = 1080, H = 1080;
  canvas.width = W; canvas.height = H;
  const ctx = canvas.getContext('2d');

  // background
  ctx.fillStyle = '#0B0D12';
  ctx.fillRect(0, 0, W, H);
  const glow = ctx.createRadialGradient(W / 2, 220, 60, W / 2, 220, 700);
  glow.addColorStop(0, 'rgba(61,214,245,0.16)');
  glow.addColorStop(1, 'rgba(61,214,245,0)');
  ctx.fillStyle = glow;
  ctx.fillRect(0, 0, W, H);

  ctx.textAlign = 'center';

  // brand
  ctx.font = "800 72px 'Space Grotesk', 'Inter', sans-serif";
  const brandY = 170;
  const newsW = ctx.measureText('News').width;
  const buzzW = ctx.measureText('Buzz').width;
  const startX = W / 2 - (newsW + buzzW) / 2;
  ctx.textAlign = 'left';
  ctx.fillStyle = '#F2F5FA';
  ctx.fillText('News', startX, brandY);
  ctx.fillStyle = '#3DD6F5';
  ctx.fillText('Buzz', startX + newsW, brandY);
  ctx.textAlign = 'center';

  ctx.fillStyle = '#9AA3B2';
  ctx.font = "600 34px 'Inter', sans-serif";
  ctx.fillText('DAILY NEWS QUIZ', W / 2, 238);
  ctx.font = "500 30px 'Inter', sans-serif";
  ctx.fillStyle = '#5C6473';
  ctx.fillText(date, W / 2, 290);

  // score
  ctx.fillStyle = '#F2F5FA';
  ctx.font = "800 220px 'Space Grotesk', 'Inter', sans-serif";
  ctx.fillText(`${score}/${total}`, W / 2, 560);

  // streak
  ctx.font = "700 52px 'Inter', sans-serif";
  ctx.fillStyle = '#3DD6F5';
  ctx.fillText(`🔥 ${streak} day streak`, W / 2, 660);

  // result squares (Wordle pattern — no question order revealed beyond correctness)
  const size = 86, gap = 22;
  const perRow = Math.min(pattern.length, 8);
  const rowW = perRow * size + (perRow - 1) * gap;
  let x0 = W / 2 - rowW / 2, y = 740;
  pattern.forEach((ok, i) => {
    const col = i % perRow, row = Math.floor(i / perRow);
    const x = x0 + col * (size + gap);
    const yy = y + row * (size + gap);
    ctx.fillStyle = ok ? '#22c55e' : '#ef4444';
    const r = 18;
    ctx.beginPath();
    ctx.roundRect(x, yy, size, size, r);
    ctx.fill();
  });

  // footer
  ctx.fillStyle = '#9AA3B2';
  ctx.font = "600 32px 'Inter', sans-serif";
  const origin = (typeof window !== 'undefined' && window.location.origin) || 'NewsBuzz';
  ctx.fillText(`Play today's quiz at ${origin.replace(/^https?:\/\//, '')}/quiz`, W / 2, 1000);
};

// ---------------------------------------------------------------------------
// Small pieces
// ---------------------------------------------------------------------------
const Spinner = () => (
  <div className="flex items-center justify-center py-32"><div className="qz-spinner" /></div>
);

const Kicker = ({ children }) => (
  <span className="text-accent font-bold tracking-[0.2em] uppercase text-xs">{children}</span>
);

const StatChip = ({ label, value }) => (
  <div className="qz-card rounded-xl px-5 py-4 text-center min-w-[110px]">
    <div className="font-editorial text-2xl font-bold text-primary">{value}</div>
    <div className="text-xs text-muted font-semibold mt-1 uppercase tracking-wide">{label}</div>
  </div>
);

// ---------------------------------------------------------------------------
// Question renderers — each gets (question, value, onChange)
// ---------------------------------------------------------------------------
const OptionList = ({ options, value, onChange }) => (
  <div className="flex flex-col gap-3">
    {options.map((opt) => (
      <button
        key={opt}
        className={`qz-option rounded-xl px-5 py-4 font-medium ${value === opt ? 'selected' : ''}`}
        onClick={() => onChange(opt)}
      >
        {opt}
      </button>
    ))}
  </div>
);

const RealOrFake = ({ value, onChange }) => (
  <div className="grid grid-cols-2 gap-4">
    {[{ v: 'real', label: '✅ Real' }, { v: 'fake', label: '🚫 Fake' }].map(({ v, label }) => (
      <button
        key={v}
        className={`qz-option rounded-2xl px-5 py-8 text-center font-editorial text-xl font-bold ${value === v ? 'selected' : ''}`}
        onClick={() => onChange(v)}
      >
        {label}
      </button>
    ))}
  </div>
);

// Tap-to-order: tap events in chronological order; tap a picked one to undo from there.
const TimelineOrder = ({ options, value, onChange }) => {
  const order = Array.isArray(value) ? value : [];
  const toggle = (opt) => {
    const idx = order.indexOf(opt);
    if (idx >= 0) onChange(order.slice(0, idx)); // undo from this point
    else onChange([...order, opt]);
  };
  return (
    <div>
      <p className="text-sm text-muted mb-3 font-medium">
        Tap the events in order — earliest first. Tap a numbered event to undo.
      </p>
      <div className="flex flex-col gap-3">
        {options.map((opt) => {
          const pos = order.indexOf(opt);
          return (
            <button
              key={opt}
              className={`qz-option rounded-xl px-5 py-4 font-medium flex items-center gap-3 ${pos >= 0 ? 'selected' : ''}`}
              onClick={() => toggle(opt)}
            >
              <span
                className="flex-shrink-0 w-8 h-8 rounded-full flex items-center justify-center font-bold text-sm"
                style={{
                  backgroundColor: pos >= 0 ? 'var(--accent)' : 'var(--bg-secondary)',
                  color: pos >= 0 ? 'var(--on-accent)' : 'var(--text-muted)',
                }}
              >
                {pos >= 0 ? pos + 1 : '·'}
              </span>
              <span>{opt}</span>
            </button>
          );
        })}
      </div>
      {order.length > 0 && (
        <button className="qz-btn-ghost rounded-lg px-4 py-2 text-sm mt-3" onClick={() => onChange([])}>
          Reset order
        </button>
      )}
    </div>
  );
};

const QuestionBody = ({ question, value, onChange }) => {
  if (question.type === 'real_or_fake') {
    return (
      <div>
        <blockquote
          className="font-editorial text-xl md:text-2xl font-bold leading-snug rounded-xl px-6 py-6 mb-6 bg-secondary"
          style={{ borderLeft: '4px solid var(--accent)' }}
        >
          “{question.question_text}”
        </blockquote>
        <RealOrFake value={value} onChange={onChange} />
      </div>
    );
  }
  if (question.type === 'timeline_order') {
    return <TimelineOrder options={question.options} value={value} onChange={onChange} />;
  }
  return <OptionList options={question.options} value={value} onChange={onChange} />;
};

const answered = (q, value) => {
  if (value == null) return false;
  if (q.type === 'timeline_order') return Array.isArray(value) && value.length === q.options.length;
  return value !== '';
};

// ---------------------------------------------------------------------------
// Results breakdown item
// ---------------------------------------------------------------------------
const ResultItem = ({ r, index }) => (
  <div className="qz-card rounded-xl p-5 fade-in-up" style={{ animationDelay: `${index * 60}ms` }}>
    <div className="flex items-start justify-between gap-3 mb-2">
      <span className="text-xs font-bold uppercase tracking-wider text-muted">
        Q{index + 1} · {TYPE_LABEL[r.type]} ·{' '}
        <span style={{ color: DIFF_COLOR[r.difficulty] }}>{r.difficulty}</span>
      </span>
      <span
        className="text-xs font-bold px-2.5 py-1 rounded-full flex-shrink-0"
        style={{
          backgroundColor: r.is_correct ? 'var(--correct-soft)' : 'var(--wrong-soft)',
          color: r.is_correct ? 'var(--correct)' : 'var(--wrong)',
        }}
      >
        {r.is_correct ? '✓ Correct' : '✗ Incorrect'}
      </span>
    </div>
    <p className="font-editorial font-bold text-primary mb-3">{r.question_text}</p>
    <div className="text-sm space-y-1.5">
      <p className="text-secondary">
        <span className="font-semibold text-muted">Your answer: </span>
        <span style={{ color: r.is_correct ? 'var(--correct)' : 'var(--wrong)' }}>{answerLabel(r, r.user_answer)}</span>
      </p>
      {!r.is_correct && (
        <p className="text-secondary">
          <span className="font-semibold text-muted">Correct answer: </span>
          <span style={{ color: 'var(--correct)' }}>{answerLabel(r, r.correct_answer)}</span>
        </p>
      )}
      {r.explanation && <p className="text-secondary leading-relaxed pt-1">{r.explanation}</p>}
      {r.source_article_url && (
        <a
          href={r.source_article_url}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-block text-accent font-semibold pt-1 hover:underline"
        >
          Read the article →
        </a>
      )}
    </div>
  </div>
);

// ---------------------------------------------------------------------------
// MAIN COMPONENT
// ---------------------------------------------------------------------------
export default function DailyQuiz() {
  const navigate = useNavigate();
  const loggedIn = !!localStorage.getItem('token');

  // shared theme with the homepage
  const [isDark, setIsDark] = useState(() => localStorage.getItem('nb-theme') === 'dark');
  useEffect(() => {
    document.documentElement.classList.toggle('dark', isDark);
    localStorage.setItem('nb-theme', isDark ? 'dark' : 'light');
  }, [isDark]);

  const [tab, setTab] = useState('play'); // play | leaderboard | badges
  const [view, setView] = useState('loading'); // loading | unavailable | lobby | playing | results
  const [today, setToday] = useState(null);
  const [statsData, setStatsData] = useState(null);
  const [resultsData, setResultsData] = useState(null);
  const [error, setError] = useState('');

  // play state
  const [attemptId, setAttemptId] = useState(null);
  const [qIndex, setQIndex] = useState(0);
  const [answers, setAnswers] = useState({}); // question_id → user_answer
  const [elapsed, setElapsed] = useState(0); // soft per-question seconds
  const [submitting, setSubmitting] = useState(false);
  const questionStart = useRef(Date.now());
  const timeTaken = useRef({}); // question_id → ms

  // countdown to next quiz
  const [resetAt, setResetAt] = useState(null);
  const [countdown, setCountdown] = useState('');
  useEffect(() => {
    if (!resetAt) return;
    const tick = () => setCountdown(fmtCountdown(resetAt - Date.now()));
    tick();
    const t = setInterval(tick, 30000);
    return () => clearInterval(t);
  }, [resetAt]);

  // badge celebration modal
  const [newBadges, setNewBadges] = useState([]);

  // leaderboard
  const [lbType, setLbType] = useState('daily');
  const [lbData, setLbData] = useState(null);
  const [lbLoading, setLbLoading] = useState(false);

  const questions = useMemo(
    () => (today?.questions || []).slice().sort((a, b) => a.order_index - b.order_index),
    [today]
  );

  // ---- initial load ----
  // Playing requires an account: anyone not logged in (or with an expired
  // token) is sent to the login screen, then returned here afterwards.
  const loadToday = useCallback(async () => {
    if (!loggedIn) {
      navigate('/login', { replace: true, state: { from: '/quiz' } });
      return;
    }
    const res = await GET('/api/quiz/today');
    if (isAuthFailure(res)) {
      navigate('/login', { replace: true, state: { from: '/quiz' } });
      return;
    }
    const data = res.data;
    setToday(data);
    if (data.resetInMs != null) setResetAt(Date.now() + data.resetInMs);
    if (!data.available) { setView('unavailable'); return; }
    if (data.attempt_status === 'completed') {
      const r = await GET('/api/quiz/today/results');
      if (r?.data?.success) setResultsData(r.data);
      setView('results');
      return;
    }
    setAttemptId(data.attempt_id);
    setView('lobby');
  }, [loggedIn, navigate]);

  useEffect(() => { loadToday(); }, [loadToday]);

  // soft per-question timer
  useEffect(() => {
    if (view !== 'playing') return;
    questionStart.current = Date.now();
    setElapsed(0);
    const t = setInterval(() => setElapsed(Math.floor((Date.now() - questionStart.current) / 1000)), 1000);
    return () => clearInterval(t);
  }, [view, qIndex]);

  // ---- actions ----
  const handleStart = async () => {
    setError('');
    const res = await POST('/api/quiz/today/start', {});
    if (!res?.data?.success) {
      // 409 (already completed) lands here via the helper's catch — reload state
      await loadToday();
      return;
    }
    setAttemptId(res.data.attempt_id);

    // resume: prefill saved answers, jump to first unanswered
    const saved = today?.saved_answers || [];
    const map = {};
    saved.forEach((a) => { map[a.question_id] = a.user_answer; timeTaken.current[a.question_id] = a.time_taken_ms || 0; });
    setAnswers(map);
    const firstUnanswered = questions.findIndex((q) => map[q.id] == null);
    setQIndex(firstUnanswered === -1 ? 0 : firstUnanswered);
    setView('playing');
  };

  const recordAndNext = async () => {
    const q = questions[qIndex];
    const ms = Date.now() - questionStart.current;
    timeTaken.current[q.id] = (timeTaken.current[q.id] || 0) + ms;

    // save progress in the background so closing the app keeps the answer
    POST('/api/quiz/today/progress', {
      attempt_id: attemptId,
      question_id: q.id,
      user_answer: answers[q.id],
      time_taken_ms: timeTaken.current[q.id],
    });

    if (qIndex < questions.length - 1) {
      setQIndex(qIndex + 1);
    } else {
      await handleSubmit();
    }
  };

  const handleSubmit = async () => {
    setSubmitting(true);
    setError('');
    const payload = {
      attempt_id: attemptId,
      answers: questions.map((q) => ({
        question_id: q.id,
        user_answer: answers[q.id] ?? null,
        time_taken_ms: timeTaken.current[q.id] || 0,
      })),
    };
    const res = await POST('/api/quiz/today/submit', payload);
    setSubmitting(false);
    if (!res?.data?.success) {
      setError('Could not submit your quiz — please try again.');
      return;
    }
    setResultsData(res.data);
    if (res.data.resetInMs != null) setResetAt(Date.now() + res.data.resetInMs);
    if (res.data.new_badges?.length) setNewBadges(res.data.new_badges);
    setView('results');
  };

  // ---- leaderboard ----
  useEffect(() => {
    if (tab !== 'leaderboard' || !loggedIn) return;
    let cancelled = false;
    setLbLoading(true);
    GET(`/api/quiz/leaderboard?type=${lbType}`).then((res) => {
      if (cancelled) return;
      setLbData(res?.data?.success ? res.data : null);
      setLbLoading(false);
    });
    return () => { cancelled = true; };
  }, [tab, lbType, loggedIn]);

  // ---- badges/stats ----
  useEffect(() => {
    if (tab !== 'badges' || !loggedIn) return;
    GET('/api/quiz/stats').then((res) => {
      if (res?.data?.success) setStatsData(res.data);
    });
  }, [tab, loggedIn]);

  // ---- share ----
  const canvasRef = useRef(null);
  const [shareMsg, setShareMsg] = useState('');
  const handleShare = async () => {
    if (!resultsData) return;
    const canvas = canvasRef.current;
    drawShareCard(canvas, {
      date: today?.date || new Date().toISOString().slice(0, 10),
      score: resultsData.score,
      total: resultsData.total_questions,
      streak: resultsData.streak?.current ?? 0,
      pattern: (resultsData.results || []).map((r) => r.is_correct),
    });
    const blob = await new Promise((resolve) => canvas.toBlob(resolve, 'image/png'));
    if (!blob) return;
    const file = new File([blob], 'newsbuzz-quiz.png', { type: 'image/png' });

    if (navigator.canShare && navigator.canShare({ files: [file] })) {
      try {
        await navigator.share({
          files: [file],
          title: 'NewsBuzz Daily Quiz',
          text: `I scored ${resultsData.score}/${resultsData.total_questions} on today's NewsBuzz quiz! 🔥`,
        });
        return;
      } catch { /* user cancelled — fall through to download */ }
    }
    try {
      if (navigator.clipboard && window.ClipboardItem) {
        await navigator.clipboard.write([new window.ClipboardItem({ 'image/png': blob })]);
        setShareMsg('Image copied to clipboard!');
        setTimeout(() => setShareMsg(''), 2500);
        return;
      }
    } catch { /* clipboard blocked — fall through */ }
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = 'newsbuzz-quiz.png';
    a.click();
    URL.revokeObjectURL(a.href);
    setShareMsg('Image downloaded!');
    setTimeout(() => setShareMsg(''), 2500);
  };

  // -------------------------------------------------------------------------
  // RENDER
  // -------------------------------------------------------------------------
  const header = (
    <header className="border-b border-color" style={{ backgroundColor: 'var(--bg-card)' }}>
      <div className="max-w-3xl mx-auto px-4 sm:px-6 flex items-center justify-between h-16">
        <button onClick={() => navigate('/')} className="qz-btn-ghost rounded-lg px-3 py-1.5 text-sm">
          ← Home
        </button>
        <span className="font-editorial text-lg font-black">
          <span className="text-primary">News</span><span className="text-accent">Buzz</span>
          <span className="text-muted font-semibold text-sm ml-2">Daily Quiz</span>
        </span>
        <button onClick={() => setIsDark((d) => !d)} className="qz-btn-ghost rounded-lg px-3 py-1.5 text-sm" aria-label="Toggle theme">
          {isDark ? '☀️' : '🌙'}
        </button>
      </div>
      {loggedIn && view !== 'playing' && (
        <div className="max-w-3xl mx-auto px-4 sm:px-6 flex gap-6">
          {[['play', 'Play'], ['leaderboard', 'Leaderboard'], ['badges', 'Badges']].map(([k, label]) => (
            <button key={k} className={`qz-tab text-sm ${tab === k ? 'active' : ''}`} onClick={() => setTab(k)}>
              {label}
            </button>
          ))}
        </div>
      )}
    </header>
  );

  const renderPlayTab = () => {
    if (view === 'loading') return <Spinner />;

    if (view === 'unavailable') {
      return (
        <div className="text-center py-24 fade-in-up">
          <div className="text-5xl mb-4">⏳</div>
          <h1 className="font-editorial text-3xl font-bold mb-3">Today's quiz is being prepared</h1>
          <p className="text-secondary max-w-sm mx-auto">
            Our newsroom robots are writing today's questions. Check back soon!
          </p>
        </div>
      );
    }

    if (view === 'lobby') {
      const resuming = today?.attempt_status === 'in_progress';
      return (
        <div className="py-10 fade-in-up">
          <div className="text-center mb-8">
            <Kicker>{today?.date}</Kicker>
            <h1 className="font-editorial text-4xl md:text-5xl font-black mt-2 mb-3">
              Today's Quiz is Live <span className="qz-flame">🔥</span>
            </h1>
            <p className="text-secondary">
              {questions.length} questions on today's top stories · ~3 min
            </p>
          </div>
          <div className="flex justify-center gap-3 mb-10 flex-wrap">
            <StatChip label="Current streak" value={`🔥 ${today?.streak ?? 0}`} />
            <StatChip label="Questions" value={questions.length} />
            <StatChip label="Next quiz in" value={countdown || '—'} />
          </div>
          <div className="text-center">
            <button className="qz-btn rounded-2xl px-12 py-4 text-lg" onClick={handleStart}>
              {resuming ? 'Resume Quiz →' : 'Start Quiz →'}
            </button>
            <p className="text-xs text-muted mt-4">One attempt per day · no going back between questions</p>
          </div>
        </div>
      );
    }

    if (view === 'playing') {
      const q = questions[qIndex];
      if (!q) return <Spinner />;
      const value = answers[q.id];
      const isLast = qIndex === questions.length - 1;
      return (
        <div className="py-8 fade-in-up" key={q.id}>
          <div className="flex items-center justify-between mb-3">
            <span className="text-sm font-bold text-muted">
              Question {qIndex + 1} of {questions.length}
            </span>
            <span className="text-xs font-semibold text-muted tabular-nums">⏱ {elapsed}s</span>
          </div>
          <div className="qz-progress-track h-2 mb-8">
            <div className="qz-progress-fill" style={{ width: `${((qIndex + 1) / questions.length) * 100}%` }} />
          </div>

          <div className="mb-2 flex items-center gap-2">
            <span className="text-xs font-bold uppercase tracking-wider px-2.5 py-1 rounded-full bg-accent-soft text-accent">
              {TYPE_LABEL[q.type]}
            </span>
            <span className="text-xs font-bold uppercase tracking-wider" style={{ color: DIFF_COLOR[q.difficulty] }}>
              {q.difficulty}
            </span>
          </div>

          {q.type !== 'real_or_fake' && (
            <h2 className="font-editorial text-xl md:text-2xl font-bold leading-snug mb-6">{q.question_text}</h2>
          )}
          {q.type === 'real_or_fake' && (
            <h2 className="font-editorial text-lg font-bold leading-snug mb-4 text-secondary">
              Is this headline real, or has a key fact been altered?
            </h2>
          )}

          <QuestionBody question={q} value={value} onChange={(v) => setAnswers((m) => ({ ...m, [q.id]: v }))} />

          {error && <p className="text-sm font-semibold mt-4" style={{ color: 'var(--wrong)' }}>{error}</p>}

          <div className="flex justify-end mt-8">
            <button
              className="qz-btn rounded-xl px-8 py-3"
              disabled={!answered(q, value) || submitting}
              onClick={recordAndNext}
            >
              {submitting ? 'Submitting…' : isLast ? 'Submit Quiz ✓' : 'Next →'}
            </button>
          </div>
        </div>
      );
    }

    if (view === 'results') {
      const data = resultsData;
      if (!data) return <Spinner />;
      const pct = data.total_questions ? data.score / data.total_questions : 0;
      const emoji = pct === 1 ? '🏆' : pct >= 0.75 ? '🎉' : pct >= 0.5 ? '👏' : '📚';
      return (
        <div className="py-10">
          <div className="text-center mb-8 fade-in-up">
            <Kicker>{today?.date}</Kicker>
            <h1 className="font-editorial text-4xl md:text-5xl font-black mt-3">
              You scored {data.score}/{data.total_questions}! {emoji}
            </h1>
            <p className="font-editorial text-xl font-bold mt-4">
              <span className="qz-flame">🔥</span>{' '}
              <span className="text-accent">{data.streak?.current ?? 0}-day streak</span>
              {data.streak?.current >= (data.streak?.longest || 0) && data.streak?.current > 1 && (
                <span className="text-muted text-sm font-semibold ml-2">— personal best!</span>
              )}
            </p>
            {data.duration_ms != null && (
              <p className="text-sm text-muted mt-2">Finished in {fmtDuration(data.duration_ms)}</p>
            )}
          </div>

          {/* Wordle pattern */}
          <div className="flex justify-center gap-2 mb-8 fade-in-up">
            {(data.results || []).map((r, i) => (
              <span
                key={i}
                className="qz-square"
                style={{ backgroundColor: r.is_correct ? '#22c55e' : '#ef4444' }}
                title={`Question ${i + 1}`}
              />
            ))}
          </div>

          <div className="flex justify-center gap-3 mb-10 flex-wrap fade-in-up">
            <button className="qz-btn rounded-xl px-7 py-3" onClick={handleShare}>
              Share Your Score 📤
            </button>
            <div className="qz-card rounded-xl px-5 py-3 text-sm font-semibold text-secondary flex items-center">
              Next quiz in: <span className="text-accent ml-1.5 tabular-nums">{countdown || '—'}</span>
            </div>
          </div>
          {shareMsg && <p className="text-center text-sm text-accent font-semibold -mt-6 mb-8">{shareMsg}</p>}

          <h2 className="font-editorial text-2xl font-bold mb-4">How you did</h2>
          <div className="flex flex-col gap-4">
            {(data.results || []).map((r, i) => <ResultItem key={r.id || i} r={r} index={i} />)}
          </div>
        </div>
      );
    }

    return null;
  };

  const renderLeaderboard = () => (
    <div className="py-8 fade-in-up">
      <h1 className="font-editorial text-3xl font-bold mb-6">Leaderboard</h1>
      <div className="flex gap-2 mb-6">
        {[['daily', 'Today'], ['weekly', 'This Week'], ['alltime', 'All Time']].map(([k, label]) => (
          <button
            key={k}
            className={`rounded-full px-4 py-2 text-sm font-semibold ${lbType === k ? 'qz-btn' : 'qz-btn-ghost'}`}
            onClick={() => setLbType(k)}
          >
            {label}
          </button>
        ))}
      </div>

      {lbLoading ? (
        <Spinner />
      ) : !lbData || !lbData.entries?.length ? (
        <div className="qz-card rounded-xl p-10 text-center text-secondary">
          No scores yet{lbType === 'daily' ? ' today' : ''} — be the first! 🏁
        </div>
      ) : (
        <div className="qz-card rounded-xl overflow-hidden">
          {lbData.entries.map((e) => (
            <div
              key={`${e.rank}-${e.username}`}
              className={`flex items-center gap-4 px-5 py-3.5 border-b border-color last:border-0 ${e.isMe ? 'qz-row-me' : ''}`}
            >
              <span className="font-editorial font-black text-lg w-8 text-muted">
                {e.rank <= 3 ? ['🥇', '🥈', '🥉'][e.rank - 1] : e.rank}
              </span>
              <span
                className="w-9 h-9 rounded-full flex items-center justify-center font-bold text-sm flex-shrink-0 bg-accent-soft text-accent"
              >
                {(e.username || 'P').slice(0, 1).toUpperCase()}
              </span>
              <span className="font-semibold text-primary flex-1 truncate">
                {e.username}{e.isMe && <span className="text-accent text-xs font-bold ml-2">YOU</span>}
              </span>
              <span className="text-sm font-bold text-secondary text-right">
                {lbType === 'alltime'
                  ? <>🔥 {e.longest_streak} <span className="text-muted font-medium">· {e.total_correct} correct</span></>
                  : lbType === 'weekly'
                    ? <>{e.score} pts <span className="text-muted font-medium">· {e.quizzes} quizzes</span></>
                    : <>{e.score}/{e.total} <span className="text-muted font-medium">· {fmtDuration(e.duration_ms)}</span></>}
              </span>
            </div>
          ))}
        </div>
      )}

      {lbType === 'daily' && lbData?.me && lbData.me.rank > lbData.entries.length && (
        <p className="text-sm text-secondary mt-4 text-center">
          You're ranked <span className="text-accent font-bold">#{lbData.me.rank}</span> today with {lbData.me.score}/{lbData.me.total}.
        </p>
      )}
    </div>
  );

  const renderBadges = () => (
    <div className="py-8 fade-in-up">
      <h1 className="font-editorial text-3xl font-bold mb-6">Your Stats & Badges</h1>
      {!statsData ? (
        <Spinner />
      ) : (
        <>
          <div className="flex gap-3 mb-8 flex-wrap">
            <StatChip label="Current streak" value={`🔥 ${statsData.current_streak}`} />
            <StatChip label="Longest streak" value={statsData.longest_streak} />
            <StatChip label="Quizzes done" value={statsData.total_quizzes_completed} />
            <StatChip
              label="Accuracy"
              value={
                statsData.total_questions_answered
                  ? `${Math.round((statsData.total_correct_answers / statsData.total_questions_answered) * 100)}%`
                  : '—'
              }
            />
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
            {(statsData.badges || []).map((b) => (
              <div
                key={b.key}
                className="qz-card rounded-xl p-5 text-center"
                style={{ opacity: b.earned ? 1 : 0.45, filter: b.earned ? 'none' : 'grayscale(1)' }}
                title={b.description}
              >
                <div className="text-4xl mb-2">{b.icon}</div>
                <div className="font-bold text-sm text-primary">{b.name}</div>
                <div className="text-xs text-muted mt-1 leading-snug">{b.description}</div>
                {!b.earned && <div className="text-[0.65rem] font-bold uppercase tracking-wider text-muted mt-2">🔒 Locked</div>}
              </div>
            ))}
          </div>
        </>
      )}
    </div>
  );

  return (
    <>
      <style>{styles}</style>
      <div className="qz-root">
        {header}
        <main className="max-w-3xl mx-auto px-4 sm:px-6 pb-20">
          {tab === 'play' && renderPlayTab()}
          {tab === 'leaderboard' && (loggedIn ? renderLeaderboard() : renderPlayTab())}
          {tab === 'badges' && (loggedIn ? renderBadges() : renderPlayTab())}
        </main>

        {/* hidden canvas for the share card */}
        <canvas ref={canvasRef} style={{ display: 'none' }} />

        {/* badge celebration modal */}
        {newBadges.length > 0 && (
          <div className="qz-modal-backdrop" onClick={() => setNewBadges([])}>
            <div className="qz-card rounded-2xl p-8 text-center max-w-sm w-full qz-pop" onClick={(e) => e.stopPropagation()}>
              <h2 className="font-editorial text-2xl font-black mb-1">Badge unlocked! 🎊</h2>
              <p className="text-sm text-muted mb-6">You earned {newBadges.length > 1 ? `${newBadges.length} new badges` : 'a new badge'}</p>
              <div className="flex justify-center gap-4 flex-wrap mb-6">
                {newBadges.map((b) => (
                  <div key={b.key} className="text-center">
                    <div className="text-5xl qz-flame">{b.icon}</div>
                    <div className="font-bold text-sm mt-2 text-primary">{b.name}</div>
                    <div className="text-xs text-muted max-w-[140px] mt-1">{b.description}</div>
                  </div>
                ))}
              </div>
              <button className="qz-btn rounded-xl px-8 py-2.5" onClick={() => setNewBadges([])}>
                Nice!
              </button>
            </div>
          </div>
        )}
      </div>
    </>
  );
}
