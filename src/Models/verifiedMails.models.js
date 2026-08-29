const mongoose = require("mongoose")

const verfiedMailsSchema = new mongoose.Schema({
  email: {
    type: String,
    unique: true,
    required: [true, "Email is required."]
  }
})

const VerifiedMail = mongoose.model("verfiedMail", verfiedMailsSchema)
module.exports = {
  VerifiedMail
}