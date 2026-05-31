import mongoose from "mongoose";
const Schema = mongoose.Schema;

const bookmarkSchema = new Schema({
  user_id: { type: Schema.Types.ObjectId, ref: "user", required: true },
  articles: [
    {
      title: { type: String, required: true },
      link: { type: String, required: true },
      imgURL: { type: String },
      providerName: { type: String },
      providerImg: { type: String },
      time: { type: String },
      someText: { type: String },
      savedAt: { type: Date, default: Date.now },
    },
  ],
});

const Bookmark = mongoose.model("Bookmark", bookmarkSchema);
export default Bookmark;
