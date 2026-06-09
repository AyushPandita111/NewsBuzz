import express from "express";
import { getAllNews, getNewsByCategory } from "../controllers/cnews.js";
import { getGlance, postChat } from "../controllers/cnewsai.js";

const router = express.Router();

// Public homepage feed (served from the aggregator cache).
router.get("/", getAllNews);

// AI News Glance & Chat (POST) — defined before the catch-all GET param route.
router.post("/glance", getGlance);
router.post("/chat", postChat);

// Single category — keep last so it doesn't shadow the static routes above.
router.get("/:category", getNewsByCategory);

export default router;
