import History from "../models/mhistory.js";

const gethistory = async(req,res,next)=>{
    let history = await History.find({});
    res.send(history);
}
const deletehistory =async(req,res,next)=>{
    let {id}=req.params;
   await History.findByIdAndDelete(id);
    res.status(202).json({succes:true,message:"Delete Succesfully"});
}
export { gethistory, deletehistory };