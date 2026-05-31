import Bookmark from "../models/mbookmark.js";
import Like from "../models/mlike.js";
import Comment from "../models/mcomment.js";
import usermodel from "../models/muser.js";

// ─── BOOKMARK ────────────────────────────────────────────────────────────────

const isBookmarked = async (req, res) => {
  try {
    const { id } = req.user;
    const { title, link } = req.body;
    const doc = await Bookmark.findOne({ user_id: id });
    const bookmarked = doc ? doc.articles.some((a) => a.link === link) : false;
    return res.status(200).json({ success: true, bookmarked });
  } catch (err) {
    console.error("isBookmarked error:", err.message);
    return res.status(500).json({ success: false, message: "Server error" });
  }
};

const addBookmarkArticle = async (req, res) => {
  try {
    const { id } = req.user;
    const { title, link, imgURL, providerName, providerImg, time, someText } = req.body;
    let doc = await Bookmark.findOne({ user_id: id });
    if (!doc) {
      doc = new Bookmark({ user_id: id, articles: [] });
    }
    const alreadyExists = doc.articles.some((a) => a.link === link);
    if (!alreadyExists) {
      doc.articles.push({ title, link, imgURL, providerName, providerImg, time, someText });
      await doc.save();
    }
    return res.status(200).json({ success: true, message: "Bookmark added" });
  } catch (err) {
    console.error("addBookmarkArticle error:", err.message);
    return res.status(500).json({ success: false, message: "Server error" });
  }
};

const deleteBookmarkArticle = async (req, res) => {
  try {
    const { id } = req.user;
    const { link } = req.body;
    await Bookmark.updateOne({ user_id: id }, { $pull: { articles: { link } } });
    return res.status(200).json({ success: true, message: "Bookmark removed" });
  } catch (err) {
    console.error("deleteBookmarkArticle error:", err.message);
    return res.status(500).json({ success: false, message: "Server error" });
  }
};

const getBookmarkArticle = async (req, res) => {
  try {
    const { id } = req.user;
    const doc = await Bookmark.findOne({ user_id: id });
    const articles = doc ? doc.articles : [];
    return res.status(200).json({ success: true, articles });
  } catch (err) {
    console.error("getBookmarkArticle error:", err.message);
    return res.status(500).json({ success: false, message: "Server error" });
  }
};

// ─── LIKE ─────────────────────────────────────────────────────────────────────

const isLiked = async (req, res) => {
  try {
    const { id } = req.user;
    const { title } = req.body;
    const doc = await Like.findOne({ user_id: id });
    const liked = doc ? doc.articleTitles.includes(title) : false;
    return res.status(200).json({ success: true, liked });
  } catch (err) {
    console.error("isLiked error:", err.message);
    return res.status(500).json({ success: false, message: "Server error" });
  }
};

const addLikeArticle = async (req, res) => {
  try {
    const { id } = req.user;
    const { title } = req.body;
    let doc = await Like.findOne({ user_id: id });
    if (!doc) {
      doc = new Like({ user_id: id, articleTitles: [] });
    }
    if (!doc.articleTitles.includes(title)) {
      doc.articleTitles.push(title);
      await doc.save();
    }
    return res.status(200).json({ success: true, message: "Like added" });
  } catch (err) {
    console.error("addLikeArticle error:", err.message);
    return res.status(500).json({ success: false, message: "Server error" });
  }
};

const deleteLikeArticle = async (req, res) => {
  try {
    const { id } = req.user;
    const { title } = req.body;
    await Like.updateOne({ user_id: id }, { $pull: { articleTitles: title } });
    return res.status(200).json({ success: true, message: "Like removed" });
  } catch (err) {
    console.error("deleteLikeArticle error:", err.message);
    return res.status(500).json({ success: false, message: "Server error" });
  }
};

const getNumLikes = async (req, res) => {
  try {
    const { title } = req.body;
    // Count how many users have liked this article
    const count = await Like.countDocuments({ articleTitles: title });
    return res.status(200).json({ success: true, numLikes: count });
  } catch (err) {
    console.error("getNumLikes error:", err.message);
    return res.status(500).json({ success: false, message: "Server error" });
  }
};

// ─── FOLLOW ───────────────────────────────────────────────────────────────────

const addFollow = async (req, res) => {
  try {
    const { id } = req.user;
    const { providerName } = req.body;
    await usermodel.updateOne({ _id: id }, { $addToSet: { following: providerName } });
    return res.status(200).json({ success: true, message: "Followed" });
  } catch (err) {
    console.error("addFollow error:", err.message);
    return res.status(500).json({ success: false, message: "Server error" });
  }
};

const deleteFollow = async (req, res) => {
  try {
    const { id } = req.user;
    const { providerName } = req.body;
    await usermodel.updateOne({ _id: id }, { $pull: { following: providerName } });
    return res.status(200).json({ success: true, message: "Unfollowed" });
  } catch (err) {
    console.error("deleteFollow error:", err.message);
    return res.status(500).json({ success: false, message: "Server error" });
  }
};

const isFollowed = async (req, res) => {
  try {
    const { id } = req.user;
    const { providerName } = req.body;
    const user = await usermodel.findById(id).select("following");
    const followed = user ? user.following.includes(providerName) : false;
    return res.status(200).json({ success: true, followed });
  } catch (err) {
    console.error("isFollowed error:", err.message);
    return res.status(500).json({ success: false, message: "Server error" });
  }
};

// ─── COMMENTS ─────────────────────────────────────────────────────────────────

const addComment = async (req, res) => {
  try {
    const { id } = req.user;
    const { articleURL, text, username } = req.body;
    let doc = await Comment.findOne({ articleURL });
    if (!doc) {
      doc = new Comment({ articleURL, comments: [] });
    }
    doc.comments.push({ user_id: id, username, text });
    await doc.save();
    return res.status(200).json({ success: true, message: "Comment added" });
  } catch (err) {
    console.error("addComment error:", err.message);
    return res.status(500).json({ success: false, message: "Server error" });
  }
};

const deleteComment = async (req, res) => {
  try {
    const { id } = req.user;
    const { articleURL, commentId } = req.body;
    await Comment.updateOne(
      { articleURL },
      { $pull: { comments: { _id: commentId, user_id: id } } }
    );
    return res.status(200).json({ success: true, message: "Comment deleted" });
  } catch (err) {
    console.error("deleteComment error:", err.message);
    return res.status(500).json({ success: false, message: "Server error" });
  }
};

const getCommentsOfArticles = async (req, res) => {
  try {
    const { articleURL } = req.body;
    const doc = await Comment.findOne({ articleURL });
    const comments = doc ? doc.comments : [];
    return res.status(200).json({ success: true, comments });
  } catch (err) {
    console.error("getCommentsOfArticles error:", err.message);
    return res.status(500).json({ success: false, message: "Server error" });
  }
};

const getNumComments = async (req, res) => {
  try {
    const { articleURL } = req.body;
    const doc = await Comment.findOne({ articleURL });
    const numComments = doc ? doc.comments.length : 0;
    return res.status(200).json({ success: true, numComments });
  } catch (err) {
    console.error("getNumComments error:", err.message);
    return res.status(500).json({ success: false, message: "Server error" });
  }
};

export default {
  addBookmarkArticle,
  deleteBookmarkArticle,
  getBookmarkArticle,
  isBookmarked,
  addLikeArticle,
  deleteLikeArticle,
  isLiked,
  addFollow,
  deleteFollow,
  isFollowed,
  addComment,
  deleteComment,
  getCommentsOfArticles,
  getNumLikes,
  getNumComments,
};
