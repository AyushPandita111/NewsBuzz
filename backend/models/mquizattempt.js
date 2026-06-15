import mongoose from 'mongoose';

const Schema = mongoose.Schema;

const attemptAnswerSchema = new Schema(
  {
    question_id: { type: String, required: true },
    // string, or array of strings for timeline_order
    user_answer: Schema.Types.Mixed,
    is_correct: { type: Boolean, default: false },
    time_taken_ms: { type: Number, default: 0 },
  },
  { _id: false }
);

const quizAttemptSchema = new Schema({
  userId: {
    type: Schema.Types.ObjectId,
    ref: 'user',
    required: true,
    index: true,
  },
  quizId: {
    type: Schema.Types.ObjectId,
    ref: 'dailyquiz',
    required: true,
  },
  // YYYY-MM-DD of the quiz (denormalized for fast leaderboard/history queries)
  date: {
    type: String,
    required: true,
    index: true,
  },
  answers: [attemptAnswerSchema],
  score: { type: Number, default: 0 },
  total_questions: { type: Number, default: 0 },
  started_at: { type: Date, default: Date.now },
  completed_at: Date,
  // wall-clock time from start to submit, server-measured
  duration_ms: Number,
  status: {
    type: String,
    enum: ['in_progress', 'completed'],
    default: 'in_progress',
  },
});

// One attempt per user per quiz — the DB-level guarantee behind "one try a day".
quizAttemptSchema.index({ userId: 1, quizId: 1 }, { unique: true });

const quizAttemptModel = mongoose.model('quizattempt', quizAttemptSchema);

export default quizAttemptModel;
