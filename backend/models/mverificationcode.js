import mongoose from 'mongoose';

const verificationCodeSchema = new mongoose.Schema({
  username: {
    type: String,
    required: true
  },
  email: {
    type: String,
    required: true,
    unique: true
  },
  code: {
    type: String,
    required: true
  },
  createdAt: {
    type: Date,
    default: Date.now,
    expires: 600 // code expires in 10 minutes
  }
});

const verificationcodemodel = mongoose.model('verificationcode', verificationCodeSchema);

export default verificationcodemodel;
