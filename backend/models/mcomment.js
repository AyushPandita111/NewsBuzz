import mongoose from "mongoose";
const Schema = mongoose.Schema;

const commentSchema = new Schema({
  articleURL: { type: String, required: true },
  comments: [
    {
      user_id: { type: Schema.Types.ObjectId, ref: "user", required: true },
      username: { type: String, required: true },
      text: { type: String, required: true },
      createdAt: { type: Date, default: Date.now },
    },
  ],
});

const Comment = mongoose.model("Comment", commentSchema);
export default Comment;
