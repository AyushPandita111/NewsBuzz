import express from "express";
const router = express.Router();
import { getQuiz } from "../controllers/cquiz.js";
import checkAdmin from "../middleware/checkAdmin.js";
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
router.get("/getquestions", getQuiz);

// Daily News Quiz — the whole router is mounted behind checkAuth in index.js.
router.get("/today", getToday);
router.post("/today/start", startToday);
router.post("/today/progress", saveProgress);
router.post("/today/submit", submitToday);
router.get("/today/results", getTodayResults);
router.get("/stats", getStats);
router.get("/leaderboard", getLeaderboard);
router.get("/history", getHistory);

// Admin: force-regenerate a day's quiz (requires x-admin-key header too).
router.post("/admin/regenerate", checkAdmin, adminRegenerate);

export default router;
