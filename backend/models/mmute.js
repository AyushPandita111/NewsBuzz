import mongoose from "mongoose";
import User from "./muser.js";
const Schema = mongoose.Schema;

const muteschema = new Schema({
    user: {
        type: Schema.Types.ObjectId,
        ref: "User",
    },
    mutedURL : [{
        type: String,
        required: true
    },]
})

const Mute = mongoose.model("Mute", muteschema);
export default Mute;
