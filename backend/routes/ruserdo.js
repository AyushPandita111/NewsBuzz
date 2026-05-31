import express from "express";
const router = express.Router();
import cuserdo from "../controllers/cuserdo.js";
const { addBookmarkArticle, deleteBookmarkArticle, getBookmarkArticle, isBookmarked, addLikeArticle, deleteLikeArticle, isLiked, addFollow, deleteFollow, isFollowed, addComment, deleteComment, getCommentsOfArticles, getNumLikes, getNumComments } = cuserdo;

router.post("/isBookmarked", isBookmarked);
router.get("/bookmark", getBookmarkArticle);
router.post("/addBookmark", addBookmarkArticle);
router.post("/deleteBookmark", deleteBookmarkArticle);

router.post("/isLiked", isLiked);
router.post("/addLike", addLikeArticle);
router.post("/deleteLike", deleteLikeArticle);
router.post("/numLikes", getNumLikes);

router.post("/follow", addFollow);
router.post("/unfollow", deleteFollow);
router.post("/isFollowed", isFollowed);

router.post("/getComments", getCommentsOfArticles);
router.post("/addComment", addComment);
router.post("/deleteComment", deleteComment);
router.post("/numComments", getNumComments);

export default router;