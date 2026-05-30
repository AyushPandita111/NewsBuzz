import mongoose from "mongoose";
const Schema = mongoose.Schema;


const historyschema = new Schema({

    userid: {
        type: Schema.Types.ObjectId,
        ref: "user"
    },
    historyData: [
        {
            title: {
                type: String,
                required: true,
            },
            link: {
                type: String,
                rrequired: true,
            },
            time: {
                type: Date,
                default: Date.now,
                required: true
            }
        }
    ]
});

const History = mongoose.model("History", historyschema);
export default History;