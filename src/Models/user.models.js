const mongoose = require("mongoose")

const userSchema = new mongoose.Schema({
  email: {
    type: String,
    required: [true, "Email is required."],
    trim: true,
    unique: true,
    lowercase: true,
    immutable: true
  },
  password: {
    type: String,
    required: [true, "Password is required."],
    minLength: [8, "Password must be at least 8 characters long."]
  },
  username: {
    type: String,
    trim: true,
    unique: true,
    lowercase: true,
    required: [true, "Username is required."],
    minLength: [4, "Username must be at least 4 characters long."],
    maxLength: [15, "Username must be at most 15 characters long."],
    immutable: true
  },
  firstName: {
    type: String,
    trim: true
  },
  lastName: {
    type: String, 
    trim: true
  },
  DOB: {
    type: Date,
    immutable: true
  },
  gender: {
    type: String,
    enum: {
      values: ["male", "female", "other"],
      message: "{VALUE} is not a valid gender"
    },
    immutable: true
  },
  followers: [
    // {
    //   type: mongoose.Schema.Types.ObjectId,
    //   ref: "User"
    // }
  ],
  following: [
    // {
    // type: mongoose.Schema.Types.ObjectId,
    // ref: "User"
    // }
  ],
  posts: [
    // {
    //   type: mongoose.Schema.Types.ObjectId,
    //   ref: "Post"
    // }
  ],
  displayPicture: {
    type: String,
    default: ""
  },
  bio: {
    type: String,
    maxLength: [300, "Bio must be at most 300 characters long."],
    default: ""
  },
  isProfileComplete: {
    type: Boolean,
    default: false
  }
}, {timestamps: true})


const User = mongoose.model("user", userSchema)

module.exports = {
  User
}