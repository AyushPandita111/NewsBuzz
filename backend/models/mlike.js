import mongoose from "mongoose";
const Schema = mongoose.Schema;

const likeSchema = new Schema({
  user_id: { type: Schema.Types.ObjectId, ref: "user", required: true },
  articleTitles: [{ type: String }],
});

const Like = mongoose.model("Like", likeSchema);
export default Like;
