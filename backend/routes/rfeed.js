import express from "express";
const router = express.Router();
import { ByText, ByTopic } from "../algorithms/myFeed.js";

router.get("/getmyfeed/text/:textId", ByText);
router.get("/getmyfeed/topic/:topicId", ByTopic);

export default router;
