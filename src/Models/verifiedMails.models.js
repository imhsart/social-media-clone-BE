const mongoose = require("mongoose")

const verfiedMailsSchema = new mongoose.Schema({
  email: {
    type: String,
    unique: true,
    required: [true, "Email is required."]
  },
  expiresAt : {
    type: Date,
    expires: 0,
    default: () => new Date(Date.now() + 24 * 60 * 60 * 1000)
  }
})

const VerifiedMail = mongoose.model("verfiedMail", verfiedMailsSchema)
module.exports = {
  VerifiedMail
}