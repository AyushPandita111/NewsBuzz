import mongoose from 'mongoose';

const Schema = mongoose.Schema;

const badgeSchema = new Schema({
  key: {
    type: String,
    required: true,
    unique: true,
  },
  name: { type: String, required: true },
  description: { type: String, required: true },
  icon: { type: String, default: '🏅' }, // emoji icon, rendered directly by the UI
  criteria_type: {
    type: String,
    enum: ['first_quiz', 'streak', 'perfect_score', 'total_completed', 'total_correct', 'night_owl', 'speed'],
    required: true,
  },
  criteria_value: { type: Number, default: 0 },
});

const badgeModel = mongoose.model('badge', badgeSchema);

// Initial badge set. Upserted on startup so re-running is harmless.
const INITIAL_BADGES = [
  { key: 'first-quiz', name: 'First Quiz', description: 'Complete your first daily quiz', icon: '🎯', criteria_type: 'first_quiz', criteria_value: 1 },
  { key: 'perfect-score', name: 'Perfect Score', description: 'Get 100% on any daily quiz', icon: '💯', criteria_type: 'perfect_score', criteria_value: 100 },
  { key: 'streak-3', name: '3-Day Streak', description: 'Complete the quiz 3 days in a row', icon: '🔥', criteria_type: 'streak', criteria_value: 3 },
  { key: 'streak-7', name: '7-Day Streak', description: 'Complete the quiz 7 days in a row', icon: '⚡', criteria_type: 'streak', criteria_value: 7 },
  { key: 'streak-30', name: '30-Day Streak', description: 'Complete the quiz 30 days in a row', icon: '🏆', criteria_type: 'streak', criteria_value: 30 },
  { key: 'night-owl', name: 'Night Owl', description: 'Complete a quiz between 12 AM and 5 AM', icon: '🦉', criteria_type: 'night_owl', criteria_value: 0 },
  { key: 'speed-reader', name: 'Speed Reader', description: 'Finish in under 60 seconds with 80%+ score', icon: '🚀', criteria_type: 'speed', criteria_value: 60 },
  { key: 'century-club', name: 'Century Club', description: 'Answer 100 total questions correctly', icon: '💎', criteria_type: 'total_correct', criteria_value: 100 },
];

const seedBadges = async () => {
  try {
    for (const badge of INITIAL_BADGES) {
      await badgeModel.updateOne({ key: badge.key }, { $set: badge }, { upsert: true });
    }
    console.log(`[quiz] badge table seeded (${INITIAL_BADGES.length} badges)`);
  } catch (err) {
    console.error('[quiz] failed to seed badges:', err.message);
  }
};

export default badgeModel;
export { seedBadges, INITIAL_BADGES };
