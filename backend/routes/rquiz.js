import express from "express";
const router = express.Router();
import { getQuiz } from "../controllers/cquiz.js";
import checkAdmin from "../middleware/checkAdmin.js";
import checkAuth from "../middleware/checkAuth.js";
import optionalAuth from "../middleware/optionalAuth.js";
import {
  getToday,
  startToday,
  saveProgress,
  submitToday,
  getTodayResults,
  getStats,
  getLeaderboard,
  getHistory,
  adminRegenerate,
} from "../controllers/cdailyquiz.js";

// Legacy random-trivia quiz (kept for backwards compatibility).
router.get("/getquestions", checkAuth, getQuiz);

// Daily News Quiz.
// Playing is open to everyone (optionalAuth): guests can play and get graded
// results, while logged-in users additionally get saved attempts, streaks,
// badges and a leaderboard spot. The account-only endpoints stay behind
// checkAuth.
router.get("/today", optionalAuth, getToday);
router.post("/today/start", optionalAuth, startToday);
router.post("/today/progress", optionalAuth, saveProgress);
router.post("/today/submit", optionalAuth, submitToday);
router.get("/today/results", optionalAuth, getTodayResults);
router.get("/stats", checkAuth, getStats);
router.get("/leaderboard", checkAuth, getLeaderboard);
router.get("/history", checkAuth, getHistory);

// Admin: force-regenerate a day's quiz (requires x-admin-key header too).
router.post("/admin/regenerate", checkAuth, checkAdmin, adminRegenerate);

export default router;
