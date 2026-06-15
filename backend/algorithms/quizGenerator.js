// ---------------------------------------------------------------------------
// quizGenerator.js — Daily News Quiz generation job.
//
// Once a day (5 AM in QUIZ_TIMEZONE, IST by default) this job:
//   1. takes the freshest "Top Stories" (+ World/India overflow) from the
//      in-memory news aggregator cache,
//   2. asks Gemini for a mixed-format question set (strict JSON via
//      responseSchema, same pattern as the Glance feature),
//   3. validates every question per type, retrying up to 2 times,
//   4. stores the quiz as draft and auto-publishes when validation passes.
//
// A catch-up run fires shortly after server startup so a restarted server
// still gets today's quiz, and the admin endpoint can force a regeneration.
// ---------------------------------------------------------------------------

import cron from 'node-cron';
import { generateJSON, isConfigured } from '../utils/geminiClient.js';
import { getCategory } from './newsAggregator.js';
import { QUIZ_TIMEZONE, todayStr } from '../utils/quizTime.js';
import dailyQuizModel from '../models/mdailyquiz.js';
import { seedBadges } from '../models/mbadge.js';

const GENERATION_CRON = '0 5 * * *'; // 5 AM in QUIZ_TIMEZONE
const MAX_ATTEMPTS = 3;              // 1 try + 2 retries
const MIN_QUESTIONS = 5;
const MAX_QUESTIONS = 8;
const MAX_ARTICLE_AGE_MS = 36 * 3600 * 1000;

// ---------------------------------------------------------------------------
// Article selection — newest Top Stories first, padded from World + India so
// the model always has 10-15 stories to work with.
// ---------------------------------------------------------------------------
const pickArticles = () => {
  const fresh = (cat) =>
    (getCategory(cat)?.articles || []).filter(
      (a) => Date.now() - new Date(a.pubDate).getTime() < MAX_ARTICLE_AGE_MS
    );

  const seen = new Set();
  const picked = [];
  for (const cat of ['Top Stories', 'World', 'India']) {
    for (const a of fresh(cat)) {
      if (picked.length >= 14) break;
      if (seen.has(a.link)) continue;
      seen.add(a.link);
      picked.push(a);
    }
  }
  return picked;
};

// ---------------------------------------------------------------------------
// Gemini request
// ---------------------------------------------------------------------------
const QUESTIONS_SCHEMA = {
  type: 'OBJECT',
  properties: {
    questions: {
      type: 'ARRAY',
      items: {
        type: 'OBJECT',
        properties: {
          type: { type: 'STRING', enum: ['mcq', 'real_or_fake', 'fill_blank', 'timeline_order'] },
          question_text: { type: 'STRING' },
          options: { type: 'ARRAY', items: { type: 'STRING' } },
          correct_answer: { type: 'STRING' },
          correct_order: {
            type: 'ARRAY',
            items: { type: 'STRING' },
            description: 'Only for timeline_order: the events in true chronological order (earliest first).',
          },
          explanation: { type: 'STRING' },
          difficulty: { type: 'STRING', enum: ['easy', 'medium', 'hard'] },
          source_index: { type: 'NUMBER', description: '0-based index of the source article in the provided list.' },
        },
        required: ['type', 'question_text', 'explanation', 'difficulty', 'source_index'],
      },
    },
  },
  required: ['questions'],
};

const SYSTEM_PROMPT = `You are a news quiz writer creating engaging, fair daily quiz questions for a general audience.
You will receive a numbered list of today's top news articles. Write 8 questions based ONLY on facts present in those articles.

Question mix (exactly):
- 4 "mcq": multiple choice with exactly 4 options, one correct. Distractors must be plausible (not absurd) yet clearly distinguishable to someone who read the news.
- 2 "real_or_fake": question_text is a headline. For a FAKE one, take a real headline and subtly alter ONE key fact (a number, name, date, or outcome) — keep the rest intact. For a REAL one, use the headline accurately. correct_answer is exactly "real" or "fake". Make one of each.
- 1 "fill_blank": question_text is a sentence from the news with one specific entity, number, or proper noun replaced by "___" (three underscores). Provide exactly 4 options (the correct word/phrase plus 3 plausible alternatives). correct_answer must match one option exactly.
- 1 "timeline_order": pick 3-4 events from the articles with clear, unambiguous chronological order. Put each event as a short phrase in correct_order (earliest first). Leave options empty; question_text should ask the player to arrange the events.

Rules:
- Avoid obscure trivia; focus on significant, memorable facts from the stories.
- Each question must cite its source article via source_index (0-based index into the list you were given).
- explanation: 1-2 sentences explaining the correct answer.
- difficulty: aim for a mix of easy, medium and hard across the set.
- For mcq and fill_blank, correct_answer must be EXACTLY equal to one of the options.
- Never reference "the article above" in question_text — each question must stand alone.
- Return strict JSON matching the schema. No markdown, no preamble.`;

const buildUserText = (articles, dateStr) => {
  const lines = articles.map(
    (a, i) =>
      `[${i}] (${a.source}, ${new Date(a.pubDate).toUTCString()}) ${a.title}\n    ${a.description || ''}`
  );
  return `Today's date: ${dateStr}\n\nTop news articles from the past 24 hours:\n\n${lines.join('\n\n')}`;
};

// ---------------------------------------------------------------------------
// Validation — per-type checks; returns { questions, issues }.
// Invalid questions are dropped and reported, never stored.
// ---------------------------------------------------------------------------
const norm = (s) => String(s ?? '').trim().toLowerCase();

const shuffled = (arr) => {
  const out = [...arr];
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [out[i], out[j]] = [out[j], out[i]];
  }
  return out;
};

const validateQuestions = (raw, articles) => {
  const issues = [];
  const questions = [];

  if (!raw || !Array.isArray(raw.questions)) {
    return { questions, issues: ['response has no questions array'] };
  }

  raw.questions.forEach((q, i) => {
    const fail = (msg) => issues.push(`q${i} (${q?.type || '?'}): ${msg}`);

    if (!q || typeof q !== 'object') return fail('not an object');
    if (!q.question_text || typeof q.question_text !== 'string') return fail('missing question_text');
    if (!q.explanation) return fail('missing explanation');

    const article = articles[Number(q.source_index)];
    if (!article) return fail(`bad source_index ${q.source_index}`);

    const base = {
      type: q.type,
      question_text: q.question_text.trim(),
      explanation: String(q.explanation).trim(),
      difficulty: ['easy', 'medium', 'hard'].includes(q.difficulty) ? q.difficulty : 'medium',
      source_article_id: article.id,
      source_article_title: article.title,
      source_article_url: article.link,
    };

    if (q.type === 'mcq' || q.type === 'fill_blank') {
      const options = (q.options || []).map((o) => String(o).trim()).filter(Boolean);
      if (options.length !== 4) return fail(`needs 4 options, got ${options.length}`);
      if (new Set(options.map(norm)).size !== 4) return fail('duplicate options');
      const correct = options.find((o) => norm(o) === norm(q.correct_answer));
      if (!correct) return fail('correct_answer not among options');
      if (q.type === 'fill_blank' && !q.question_text.includes('___')) return fail('fill_blank has no ___ blank');
      questions.push({ ...base, options: shuffled(options), correct_answer: correct });
    } else if (q.type === 'real_or_fake') {
      const answer = norm(q.correct_answer);
      if (answer !== 'real' && answer !== 'fake') return fail(`correct_answer must be real|fake, got "${q.correct_answer}"`);
      questions.push({ ...base, options: ['Real', 'Fake'], correct_answer: answer });
    } else if (q.type === 'timeline_order') {
      const order = (q.correct_order || []).map((e) => String(e).trim()).filter(Boolean);
      if (order.length < 3 || order.length > 4) return fail(`needs 3-4 events, got ${order.length}`);
      if (new Set(order.map(norm)).size !== order.length) return fail('duplicate events');
      // display order must not give away the answer
      let display = shuffled(order);
      if (display.every((e, idx) => e === order[idx])) display = [...display.slice(1), display[0]];
      questions.push({ ...base, options: display, correct_answer: order });
    } else {
      return fail(`unknown type "${q.type}"`);
    }
  });

  // Keep the variety pleasant: timeline last, everything else in given order.
  questions.sort((a, b) => (a.type === 'timeline_order') - (b.type === 'timeline_order'));
  questions.splice(MAX_QUESTIONS);
  questions.forEach((q, idx) => { q.order_index = idx; });

  return { questions, issues };
};

// ---------------------------------------------------------------------------
// Generation entry point. Returns the saved quiz document.
// ---------------------------------------------------------------------------
const generateQuizForDate = async (dateStr = todayStr(), { force = false } = {}) => {
  const existing = await dailyQuizModel.findOne({ date: dateStr });
  if (existing && existing.status === 'published' && !force) {
    console.log(`[quiz] quiz for ${dateStr} already published — skipping generation`);
    return existing;
  }

  if (!isConfigured()) {
    throw new Error('GEMINI_API_KEY is not configured — cannot generate the daily quiz');
  }

  const articles = pickArticles();
  if (articles.length < 5) {
    throw new Error(`not enough fresh articles in cache (${articles.length}) — is the news aggregator warmed up?`);
  }

  let lastIssues = [];
  for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt++) {
    try {
      console.log(`[quiz] generating quiz for ${dateStr} (attempt ${attempt}/${MAX_ATTEMPTS}, ${articles.length} articles)`);
      const raw = await generateJSON({
        system: SYSTEM_PROMPT,
        userText: buildUserText(articles, dateStr),
        schema: QUESTIONS_SCHEMA,
        maxOutputTokens: 4096,
        temperature: 0.7,
        timeoutMs: 60000,
      });

      const { questions, issues } = validateQuestions(raw, articles);
      lastIssues = issues;

      if (questions.length >= MIN_QUESTIONS) {
        const status = 'published'; // validation passed (dropped questions are logged below)
        const notes = issues.length ? `auto-published; dropped: ${issues.join('; ')}` : 'clean generation';
        const quiz = await dailyQuizModel.findOneAndUpdate(
          { date: dateStr },
          { date: dateStr, status, questions, generation_notes: notes, created_at: new Date() },
          { upsert: true, new: true, setDefaultsOnInsert: true }
        );
        if (issues.length) console.warn(`[quiz] ${dateStr}: ${issues.length} question(s) dropped — ${issues.join(' | ')}`);
        console.log(`[quiz] ✓ quiz for ${dateStr} published with ${questions.length} questions`);
        return quiz;
      }

      console.warn(`[quiz] attempt ${attempt}: only ${questions.length} valid questions (need ${MIN_QUESTIONS}) — ${issues.join(' | ')}`);
    } catch (err) {
      lastIssues = [err.message];
      console.warn(`[quiz] attempt ${attempt} failed: ${err.message}`);
    }
  }

  // All attempts failed → keep whatever we have as a draft for admin review.
  await dailyQuizModel.findOneAndUpdate(
    { date: dateStr },
    {
      $setOnInsert: { date: dateStr, questions: [] },
      $set: { status: 'draft', generation_notes: `generation failed after ${MAX_ATTEMPTS} attempts: ${lastIssues.join('; ')}` },
    },
    { upsert: true }
  );
  console.error(`[quiz] ✗ FAILED to generate quiz for ${dateStr} after ${MAX_ATTEMPTS} attempts: ${lastIssues.join('; ')}`);
  throw new Error(`quiz generation failed for ${dateStr}: ${lastIssues.join('; ')}`);
};

// ---------------------------------------------------------------------------
// Scheduler — daily cron + a startup catch-up (waits for the RSS cache).
// ---------------------------------------------------------------------------
const startQuizScheduler = () => {
  seedBadges();

  cron.schedule(GENERATION_CRON, () => {
    generateQuizForDate(todayStr()).catch(() => { /* already logged */ });
  }, { timezone: QUIZ_TIMEZONE });

  // Catch-up: if the server (re)starts and today's quiz is missing, generate
  // it once the aggregator has had time to warm its cache.
  setTimeout(async () => {
    try {
      const existing = await dailyQuizModel.findOne({ date: todayStr(), status: 'published' });
      if (!existing) await generateQuizForDate(todayStr());
    } catch { /* already logged */ }
  }, 75 * 1000);

  console.log(`[quiz] scheduler started — generating daily at 5 AM ${QUIZ_TIMEZONE}`);
};

export { startQuizScheduler, generateQuizForDate };
