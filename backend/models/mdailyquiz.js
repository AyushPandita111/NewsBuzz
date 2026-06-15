import mongoose from 'mongoose';

const Schema = mongoose.Schema;

// One question of the daily quiz. Embedded inside the DailyQuiz document —
// each subdocument still gets its own _id, which the API exposes as the
// question id for answers.
const quizQuestionSchema = new Schema({
  type: {
    type: String,
    enum: ['mcq', 'real_or_fake', 'fill_blank', 'timeline_order'],
    required: true,
  },
  question_text: {
    type: String,
    required: true,
  },
  // mcq / fill_blank: the 4 choices · real_or_fake: ["Real","Fake"]
  // timeline_order: the events in SHUFFLED display order
  options: [String],
  // string for mcq / fill_blank / real_or_fake ("real"|"fake"),
  // array of event strings (chronological) for timeline_order
  correct_answer: {
    type: Schema.Types.Mixed,
    required: true,
  },
  explanation: String,
  source_article_id: String,
  source_article_title: String,
  source_article_url: String,
  difficulty: {
    type: String,
    enum: ['easy', 'medium', 'hard'],
    default: 'medium',
  },
  order_index: {
    type: Number,
    default: 0,
  },
});

const dailyQuizSchema = new Schema({
  // YYYY-MM-DD in the quiz timezone (see utils/quizTime.js)
  date: {
    type: String,
    required: true,
    unique: true,
  },
  status: {
    type: String,
    enum: ['draft', 'published', 'archived'],
    default: 'draft',
  },
  questions: [quizQuestionSchema],
  // human-readable notes from the generation job (validation issues etc.)
  generation_notes: String,
  created_at: {
    type: Date,
    default: Date.now,
  },
});

const dailyQuizModel = mongoose.model('dailyquiz', dailyQuizSchema);

export default dailyQuizModel;
