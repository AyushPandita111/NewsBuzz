// ---------------------------------------------------------------------------
// cdailyquiz.js — Daily News Quiz controller.
//
//   GET  /api/quiz/meta            (public)  is today's quiz live? + reset timer
//   GET  /api/quiz/today           (auth)    questions w/o answers + my status
//   POST /api/quiz/today/start     (auth)    create/resume my attempt
//   POST /api/quiz/today/progress  (auth)    save one answer (resume support)
//   POST /api/quiz/today/submit    (auth)    grade server-side, streaks, badges
//   GET  /api/quiz/today/results   (auth)    my graded results (revisit)
//   GET  /api/quiz/stats           (auth)    streaks, totals, badges
//   GET  /api/quiz/leaderboard     (auth)    ?type=daily|weekly|alltime
//   GET  /api/quiz/history         (auth)    my past attempts (quiz calendar)
//   POST /api/quiz/admin/regenerate (auth + x-admin-key) force regeneration
//
// All grading, streak and badge logic is server-side; the client only ever
// submits raw answers. Dates compare in QUIZ_TIMEZONE via utils/quizTime.js.
// ---------------------------------------------------------------------------

import dailyQuizModel from '../models/mdailyquiz.js';
import quizAttemptModel from '../models/mquizattempt.js';
import userQuizStatsModel from '../models/muserquizstats.js';
import badgeModel from '../models/mbadge.js';
import usermodel from '../models/muser.js';
import { generateQuizForDate } from '../algorithms/quizGenerator.js';
import { todayStr, yesterdayStr, addDays, hourInTz, msUntilNextReset } from '../utils/quizTime.js';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------
const norm = (s) => String(s ?? '').trim().toLowerCase();

const isCorrectAnswer = (question, userAnswer) => {
  if (question.type === 'timeline_order') {
    const correct = (question.correct_answer || []).map(norm);
    const user = Array.isArray(userAnswer) ? userAnswer.map(norm) : [];
    return correct.length > 0 && correct.length === user.length && correct.every((v, i) => v === user[i]);
  }
  return norm(question.correct_answer) === norm(userAnswer);
};

const getPublishedQuiz = (date) => dailyQuizModel.findOne({ date, status: 'published' });

/** Question as the client may see it BEFORE submitting (no answer/explanation/source link). */
const sanitizeQuestion = (q) => ({
  id: String(q._id),
  type: q.type,
  question_text: q.question_text,
  options: q.options,
  difficulty: q.difficulty,
  order_index: q.order_index,
});

/** Full graded breakdown — only sent after the attempt is completed. */
const buildResults = (quiz, attempt) => {
  const byId = new Map(attempt.answers.map((a) => [String(a.question_id), a]));
  return quiz.questions.map((q) => {
    const a = byId.get(String(q._id));
    return {
      id: String(q._id),
      type: q.type,
      question_text: q.question_text,
      options: q.options,
      difficulty: q.difficulty,
      order_index: q.order_index,
      correct_answer: q.correct_answer,
      explanation: q.explanation,
      source_article_title: q.source_article_title,
      source_article_url: q.source_article_url,
      user_answer: a ? a.user_answer : null,
      is_correct: a ? a.is_correct : false,
      time_taken_ms: a ? a.time_taken_ms : 0,
    };
  });
};

const getOrCreateStats = async (userId) => {
  let stats = await userQuizStatsModel.findOne({ userId });
  if (!stats) stats = await userQuizStatsModel.create({ userId, badges: [] });
  return stats;
};

/** Applies completion to stats (streak rules) and returns newly earned badge keys. */
const applyCompletionToStats = async (stats, { score, total, durationMs }) => {
  const today = todayStr();

  if (stats.last_completed_date !== today) {
    stats.current_streak = stats.last_completed_date === yesterdayStr() ? stats.current_streak + 1 : 1;
    stats.last_completed_date = today;
    stats.longest_streak = Math.max(stats.longest_streak, stats.current_streak);
    stats.total_quizzes_completed += 1;
  }
  stats.total_correct_answers += score;
  stats.total_questions_answered += total;
  stats.updated_at = new Date();

  // ---- badge checks ----
  const earned = new Set(stats.badges || []);
  const fresh = [];
  const award = (key, condition) => {
    if (condition && !earned.has(key)) { earned.add(key); fresh.push(key); }
  };

  award('first-quiz', stats.total_quizzes_completed >= 1);
  award('perfect-score', total > 0 && score === total);
  award('streak-3', stats.current_streak >= 3);
  award('streak-7', stats.current_streak >= 7);
  award('streak-30', stats.current_streak >= 30);
  award('night-owl', hourInTz() < 5); // 12 AM - 5 AM in quiz timezone
  award('speed-reader', durationMs < 60000 && total > 0 && score / total >= 0.8);
  award('century-club', stats.total_correct_answers >= 100);

  stats.badges = [...earned];
  await stats.save();

  const newBadges = fresh.length ? await badgeModel.find({ key: { $in: fresh } }).lean() : [];
  return newBadges;
};

// ---------------------------------------------------------------------------
// GET /api/quiz/meta  (public — used by the homepage banner)
// ---------------------------------------------------------------------------
const getQuizMeta = async (req, res) => {
  try {
    const quiz = await getPublishedQuiz(todayStr());
    return res.status(200).json({
      success: true,
      available: !!quiz,
      date: todayStr(),
      questionCount: quiz ? quiz.questions.length : 0,
      resetInMs: msUntilNextReset(),
    });
  } catch (err) {
    return res.status(500).json({ success: false, message: err.message });
  }
};

// ---------------------------------------------------------------------------
// GET /api/quiz/today
// ---------------------------------------------------------------------------
const getToday = async (req, res) => {
  try {
    const userId = req.user.id;
    const [quiz, stats] = await Promise.all([
      getPublishedQuiz(todayStr()),
      userQuizStatsModel.findOne({ userId }).lean(),
    ]);

    const common = {
      success: true,
      date: todayStr(),
      resetInMs: msUntilNextReset(),
      streak: stats?.current_streak || 0,
    };

    if (!quiz) {
      return res.status(200).json({
        ...common,
        available: false,
        message: "Today's quiz is being prepared, check back soon!",
      });
    }

    const attempt = await quizAttemptModel.findOne({ userId, quizId: quiz._id }).lean();
    const attemptStatus = !attempt ? 'not_started' : attempt.status === 'completed' ? 'completed' : 'in_progress';

    return res.status(200).json({
      ...common,
      available: true,
      questionCount: quiz.questions.length,
      questions: quiz.questions.map(sanitizeQuestion),
      attempt_status: attemptStatus,
      attempt_id: attempt ? String(attempt._id) : null,
      score: attemptStatus === 'completed' ? attempt.score : null,
      total_questions: attemptStatus === 'completed' ? attempt.total_questions : quiz.questions.length,
      // saved progress so a closed app can resume (answers are the user's own)
      saved_answers:
        attemptStatus === 'in_progress'
          ? attempt.answers.map((a) => ({ question_id: a.question_id, user_answer: a.user_answer, time_taken_ms: a.time_taken_ms }))
          : [],
    });
  } catch (err) {
    return res.status(500).json({ success: false, message: err.message });
  }
};

// ---------------------------------------------------------------------------
// POST /api/quiz/today/start
// ---------------------------------------------------------------------------
const startToday = async (req, res) => {
  try {
    const userId = req.user.id;
    const quiz = await getPublishedQuiz(todayStr());
    if (!quiz) {
      return res.status(404).json({ success: false, message: "Today's quiz is being prepared, check back soon!" });
    }

    const existing = await quizAttemptModel.findOne({ userId, quizId: quiz._id });
    if (existing) {
      if (existing.status === 'completed') {
        return res.status(409).json({ success: false, message: "You've already completed today's quiz.", attempt_id: String(existing._id) });
      }
      // resume the in-progress attempt, same attempt_id
      return res.status(200).json({ success: true, attempt_id: String(existing._id), resumed: true, started_at: existing.started_at });
    }

    const attempt = await quizAttemptModel.create({
      userId,
      quizId: quiz._id,
      date: quiz.date,
      total_questions: quiz.questions.length,
      answers: [],
    });
    return res.status(201).json({ success: true, attempt_id: String(attempt._id), resumed: false, started_at: attempt.started_at });
  } catch (err) {
    if (err.code === 11000) {
      // raced a duplicate start — treat as resume
      return res.status(409).json({ success: false, message: 'Attempt already exists.' });
    }
    return res.status(500).json({ success: false, message: err.message });
  }
};

// ---------------------------------------------------------------------------
// POST /api/quiz/today/progress   { attempt_id, question_id, user_answer, time_taken_ms }
// Saves one answer as the user goes, so closing the app doesn't lose progress.
// Correctness is NOT computed (or revealed) here — only at submit.
// ---------------------------------------------------------------------------
const saveProgress = async (req, res) => {
  try {
    const { attempt_id, question_id, user_answer, time_taken_ms } = req.body || {};
    const attempt = await quizAttemptModel.findOne({ _id: attempt_id, userId: req.user.id });
    if (!attempt) return res.status(404).json({ success: false, message: 'Attempt not found' });
    if (attempt.status === 'completed') {
      return res.status(409).json({ success: false, message: 'Attempt already completed' });
    }

    const idx = attempt.answers.findIndex((a) => String(a.question_id) === String(question_id));
    const entry = {
      question_id: String(question_id),
      user_answer,
      is_correct: false, // graded at submit
      time_taken_ms: Math.max(0, Number(time_taken_ms) || 0),
    };
    if (idx >= 0) attempt.answers[idx] = entry;
    else attempt.answers.push(entry);

    await attempt.save();
    return res.status(200).json({ success: true, saved: attempt.answers.length });
  } catch (err) {
    return res.status(500).json({ success: false, message: err.message });
  }
};

// ---------------------------------------------------------------------------
// POST /api/quiz/today/submit   { attempt_id, answers: [{question_id, user_answer, time_taken_ms}] }
// ---------------------------------------------------------------------------
const submitToday = async (req, res) => {
  try {
    const userId = req.user.id;
    const { attempt_id, answers } = req.body || {};

    const attempt = await quizAttemptModel.findOne({ _id: attempt_id, userId });
    if (!attempt) return res.status(404).json({ success: false, message: 'Attempt not found' });

    const quiz = await dailyQuizModel.findById(attempt.quizId);
    if (!quiz) return res.status(404).json({ success: false, message: 'Quiz not found' });

    // Idempotency: a second submit returns the stored results, no re-grading.
    if (attempt.status === 'completed') {
      return res.status(200).json({
        success: true,
        already_submitted: true,
        score: attempt.score,
        total_questions: attempt.total_questions,
        results: buildResults(quiz, attempt),
        resetInMs: msUntilNextReset(),
      });
    }

    // Merge submitted answers over progressively-saved ones (submitted wins).
    const merged = new Map(attempt.answers.map((a) => [String(a.question_id), a]));
    for (const a of Array.isArray(answers) ? answers : []) {
      if (!a || !a.question_id) continue;
      merged.set(String(a.question_id), {
        question_id: String(a.question_id),
        user_answer: a.user_answer,
        time_taken_ms: Math.max(0, Number(a.time_taken_ms) || 0),
      });
    }

    // Grade strictly server-side against the stored quiz.
    let score = 0;
    attempt.answers = quiz.questions.map((q) => {
      const a = merged.get(String(q._id));
      const correct = a ? isCorrectAnswer(q, a.user_answer) : false;
      if (correct) score += 1;
      return {
        question_id: String(q._id),
        user_answer: a ? a.user_answer : null,
        is_correct: correct,
        time_taken_ms: a ? a.time_taken_ms : 0,
      };
    });

    attempt.score = score;
    attempt.total_questions = quiz.questions.length;
    attempt.completed_at = new Date();
    attempt.duration_ms = attempt.completed_at - attempt.started_at; // server-measured
    attempt.status = 'completed';
    await attempt.save();

    const stats = await getOrCreateStats(userId);
    const newBadges = await applyCompletionToStats(stats, {
      score,
      total: attempt.total_questions,
      durationMs: attempt.duration_ms,
    });

    return res.status(200).json({
      success: true,
      score,
      total_questions: attempt.total_questions,
      duration_ms: attempt.duration_ms,
      results: buildResults(quiz, attempt),
      streak: {
        current: stats.current_streak,
        longest: stats.longest_streak,
        increased: stats.current_streak > 1,
      },
      new_badges: newBadges,
      resetInMs: msUntilNextReset(),
    });
  } catch (err) {
    return res.status(500).json({ success: false, message: err.message });
  }
};

// ---------------------------------------------------------------------------
// GET /api/quiz/today/results
// ---------------------------------------------------------------------------
const getTodayResults = async (req, res) => {
  try {
    const userId = req.user.id;
    const quiz = await getPublishedQuiz(todayStr());
    if (!quiz) return res.status(404).json({ success: false, message: 'No quiz today' });

    const attempt = await quizAttemptModel.findOne({ userId, quizId: quiz._id, status: 'completed' });
    if (!attempt) {
      return res.status(404).json({ success: false, message: "You haven't completed today's quiz yet." });
    }

    const stats = await userQuizStatsModel.findOne({ userId }).lean();
    return res.status(200).json({
      success: true,
      score: attempt.score,
      total_questions: attempt.total_questions,
      duration_ms: attempt.duration_ms,
      results: buildResults(quiz, attempt),
      streak: {
        current: stats?.current_streak || 0,
        longest: stats?.longest_streak || 0,
        increased: false,
      },
      new_badges: [],
      resetInMs: msUntilNextReset(),
    });
  } catch (err) {
    return res.status(500).json({ success: false, message: err.message });
  }
};

// ---------------------------------------------------------------------------
// GET /api/quiz/stats
// ---------------------------------------------------------------------------
const getStats = async (req, res) => {
  try {
    const [stats, allBadges] = await Promise.all([
      userQuizStatsModel.findOne({ userId: req.user.id }).lean(),
      badgeModel.find({}).lean(),
    ]);
    const earned = new Set(stats?.badges || []);
    return res.status(200).json({
      success: true,
      current_streak: stats?.current_streak || 0,
      longest_streak: stats?.longest_streak || 0,
      last_completed_date: stats?.last_completed_date || null,
      total_quizzes_completed: stats?.total_quizzes_completed || 0,
      total_correct_answers: stats?.total_correct_answers || 0,
      total_questions_answered: stats?.total_questions_answered || 0,
      badges: allBadges.map((b) => ({
        key: b.key,
        name: b.name,
        description: b.description,
        icon: b.icon,
        earned: earned.has(b.key),
      })),
    });
  } catch (err) {
    return res.status(500).json({ success: false, message: err.message });
  }
};

// ---------------------------------------------------------------------------
// GET /api/quiz/leaderboard?type=daily|weekly|alltime
// ---------------------------------------------------------------------------
const getLeaderboard = async (req, res) => {
  try {
    const userId = req.user.id;
    const type = ['daily', 'weekly', 'alltime'].includes(req.query.type) ? req.query.type : 'daily';
    const LIMIT = 25;

    if (type === 'daily') {
      const today = todayStr();
      const top = await quizAttemptModel
        .find({ date: today, status: 'completed' })
        .sort({ score: -1, duration_ms: 1 })
        .limit(LIMIT)
        .populate('userId', 'username')
        .lean();

      const mine = await quizAttemptModel.findOne({ userId, date: today, status: 'completed' }).lean();
      let myRank = null;
      if (mine) {
        myRank =
          (await quizAttemptModel.countDocuments({
            date: today,
            status: 'completed',
            $or: [{ score: { $gt: mine.score } }, { score: mine.score, duration_ms: { $lt: mine.duration_ms } }],
          })) + 1;
      }

      return res.status(200).json({
        success: true,
        type,
        entries: top.map((a, i) => ({
          rank: i + 1,
          username: a.userId?.username || 'Player',
          isMe: String(a.userId?._id) === String(userId),
          score: a.score,
          total: a.total_questions,
          duration_ms: a.duration_ms,
        })),
        me: mine ? { rank: myRank, score: mine.score, total: mine.total_questions, duration_ms: mine.duration_ms } : null,
      });
    }

    if (type === 'weekly') {
      const since = addDays(todayStr(), -6);
      const rows = await quizAttemptModel.aggregate([
        { $match: { date: { $gte: since }, status: 'completed' } },
        {
          $group: {
            _id: '$userId',
            score: { $sum: '$score' },
            total: { $sum: '$total_questions' },
            quizzes: { $sum: 1 },
          },
        },
        { $sort: { score: -1, quizzes: -1 } },
        { $limit: LIMIT },
      ]);

      const users = await usermodel.find({ _id: { $in: rows.map((r) => r._id) } }, 'username').lean();
      const nameById = new Map(users.map((u) => [String(u._id), u.username]));

      return res.status(200).json({
        success: true,
        type,
        entries: rows.map((r, i) => ({
          rank: i + 1,
          username: nameById.get(String(r._id)) || 'Player',
          isMe: String(r._id) === String(userId),
          score: r.score,
          total: r.total,
          quizzes: r.quizzes,
        })),
        me: null,
      });
    }

    // alltime — longest streak first, then total correct
    const top = await userQuizStatsModel
      .find({ total_quizzes_completed: { $gt: 0 } })
      .sort({ longest_streak: -1, total_correct_answers: -1 })
      .limit(LIMIT)
      .populate('userId', 'username')
      .lean();

    return res.status(200).json({
      success: true,
      type,
      entries: top.map((s, i) => ({
        rank: i + 1,
        username: s.userId?.username || 'Player',
        isMe: String(s.userId?._id) === String(userId),
        longest_streak: s.longest_streak,
        current_streak: s.current_streak,
        total_correct: s.total_correct_answers,
      })),
      me: null,
    });
  } catch (err) {
    return res.status(500).json({ success: false, message: err.message });
  }
};

// ---------------------------------------------------------------------------
// GET /api/quiz/history — for the quiz calendar view
// ---------------------------------------------------------------------------
const getHistory = async (req, res) => {
  try {
    const attempts = await quizAttemptModel
      .find({ userId: req.user.id, status: 'completed' })
      .sort({ date: -1 })
      .limit(90)
      .select('date score total_questions duration_ms completed_at')
      .lean();
    return res.status(200).json({
      success: true,
      attempts: attempts.map((a) => ({
        date: a.date,
        score: a.score,
        total: a.total_questions,
        duration_ms: a.duration_ms,
      })),
    });
  } catch (err) {
    return res.status(500).json({ success: false, message: err.message });
  }
};

// ---------------------------------------------------------------------------
// POST /api/quiz/admin/regenerate   { date? }  (auth + x-admin-key)
// ---------------------------------------------------------------------------
const adminRegenerate = async (req, res) => {
  try {
    const date = /^\d{4}-\d{2}-\d{2}$/.test(req.body?.date || '') ? req.body.date : todayStr();
    const quiz = await generateQuizForDate(date, { force: true });
    return res.status(200).json({
      success: true,
      date: quiz.date,
      status: quiz.status,
      questionCount: quiz.questions.length,
      notes: quiz.generation_notes,
    });
  } catch (err) {
    return res.status(500).json({ success: false, message: err.message });
  }
};

export {
  getQuizMeta,
  getToday,
  startToday,
  saveProgress,
  submitToday,
  getTodayResults,
  getStats,
  getLeaderboard,
  getHistory,
  adminRegenerate,
};
