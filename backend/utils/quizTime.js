// ---------------------------------------------------------------------------
// quizTime.js — timezone-aware date helpers for the Daily News Quiz.
//
// The quiz day rolls over at midnight in QUIZ_TIMEZONE (default IST). All
// streak / "today" comparisons on the server go through these helpers so the
// client clock is never trusted.
// ---------------------------------------------------------------------------

const QUIZ_TIMEZONE = process.env.QUIZ_TIMEZONE || "Asia/Kolkata";

/** YYYY-MM-DD for the given instant, in the quiz timezone. */
const dateStrInTz = (d = new Date()) =>
  new Intl.DateTimeFormat("en-CA", {
    timeZone: QUIZ_TIMEZONE,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(d);

const todayStr = () => dateStrInTz(new Date());

/** Adds n days to a YYYY-MM-DD string (calendar math, no tz involved). */
const addDays = (dateStr, n) => {
  const d = new Date(`${dateStr}T12:00:00Z`);
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
};

const yesterdayStr = () => addDays(todayStr(), -1);

/** Whole days between two YYYY-MM-DD strings (b - a). */
const daysBetween = (a, b) =>
  Math.round((new Date(`${b}T00:00:00Z`) - new Date(`${a}T00:00:00Z`)) / 86400000);

/** Current hour (0-23) in the quiz timezone — used for the Night Owl badge. */
const hourInTz = (d = new Date()) =>
  Number(
    new Intl.DateTimeFormat("en-GB", {
      timeZone: QUIZ_TIMEZONE,
      hour: "2-digit",
      hourCycle: "h23",
    }).format(d)
  );

/** Milliseconds until the next midnight in the quiz timezone (quiz reset). */
const msUntilNextReset = () => {
  const parts = new Intl.DateTimeFormat("en-GB", {
    timeZone: QUIZ_TIMEZONE,
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hourCycle: "h23",
  }).formatToParts(new Date());
  const get = (t) => Number(parts.find((p) => p.type === t)?.value || 0);
  const secondsSoFar = get("hour") * 3600 + get("minute") * 60 + get("second");
  return Math.max(1000, (86400 - secondsSoFar) * 1000);
};

export {
  QUIZ_TIMEZONE,
  todayStr,
  yesterdayStr,
  addDays,
  daysBetween,
  hourInTz,
  msUntilNextReset,
};
