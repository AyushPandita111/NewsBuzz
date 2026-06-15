import mongoose from 'mongoose';

const Schema = mongoose.Schema;

const userQuizStatsSchema = new Schema({
  userId: {
    type: Schema.Types.ObjectId,
    ref: 'user',
    required: true,
    unique: true,
  },
  current_streak: { type: Number, default: 0 },
  longest_streak: { type: Number, default: 0 },
  // YYYY-MM-DD in quiz timezone — drives all streak comparisons
  last_completed_date: String,
  total_quizzes_completed: { type: Number, default: 0 },
  total_correct_answers: { type: Number, default: 0 },
  total_questions_answered: { type: Number, default: 0 },
  // earned badge keys (see mbadge.js)
  badges: [String],
  updated_at: { type: Date, default: Date.now },
});

const userQuizStatsModel = mongoose.model('userquizstats', userQuizStatsSchema);

export default userQuizStatsModel;
