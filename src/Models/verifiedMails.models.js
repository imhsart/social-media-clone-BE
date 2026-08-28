const mongoose = require("mongoose")

const verfiedMailsSchema = new mongoose.Schema({
  email: {
    type: String,
    unique: true,
    required: true
  }
})

const VerifiedMail = mongoose.model("verfiedMail", verfiedMailsSchema)
module.exports = {
  VerifiedMail
}