const mongoose = require("mongoose")

const otpSchema = new mongoose.Schema({
  otp: {
    type: Number,
    required: true,
  },
  email: {
    type: String,
    required: true,
    trim: true,
    unique: true
  },
  expiredAt: {
    type: Date,
    default: Date.now,
    expires: 5*60
  }
}, {timestamps: true}
)

const OTP = mongoose.model("otp", otpSchema)

module.exports = {
  OTP
}