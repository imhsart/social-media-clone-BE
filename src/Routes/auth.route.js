const express = require("express")
const { OTP } = require("../Models/otp.models")
const validator = require("validator")
const { Resend } = require("resend")
const { VerifiedMail } = require("../Models/verifiedMails.models")
const { User } = require("../Models/user.models")
const router = express.Router()
const resend = new Resend(process.env.RESEND_API_KEY)
const AppError = require("../Utils/AppError")
const bcrypt = require("bcrypt")
const jwt = require("jsonwebtoken")
const isLoggedInUser = require("../Middlewares/auth.middleware")
const { Posts } = require("../Models/post.models")
const { getPagination, buildPage } = require("../Utils/Pagination")
const mongoose = require("mongoose")


//Validate userId route parameter
router.param("userId" , (req, res, next, id) => {
  if(!mongoose.isValidObjectId(id)){
    return next(new AppError("Invalid user id.", 400))
  }
  next()
})

//send otp api
router.post("/send-otp" , async (req, res, next) => {
  try{
    const { email } = req.body
    if(!email){
      throw new AppError("Email is required!", 400)
    }
    if(!validator.isEmail(email)){
      throw new AppError("Please enter a valid email!", 400)
    }
    const checkVerified = await VerifiedMail.findOne({
      email, 
      expiresAt: {$exists: true}
    })
    //checking if the email is already a verified email and has expiresAt or not
    if(checkVerified){
      return res.status(200).json({
        success: true,
        alreadyVerified: true,
        message: "Email already verified. Please proceed to Sign up."
      })
    }
    const genOtp = Math.floor(100000 + Math.random() * 900000)

    const {data, error} = await resend.emails.send({
      from: "onboarding@resend.dev",
      to: email,
      subject: "OTP verification",
      html: `<div style="font-family: Arial, sans-serif;max-width: 500px;margin: 40px auto;padding: 30px;background-color: #f8fafc;border-radius: 12px;text-align: center;color: #1e293b;">
        <h2 style="margin-bottom: 10px;">Verify Your Email</h2>
        <p style="color: #64748b;">Use the OTP below to verify your email address.</p>
        <div style="margin: 25px 0;padding: 15px;background-color: #ede9fe;border-radius: 8px;">
          <h1 style="margin: 0;color: #7c3aed;letter-spacing: 8px;font-size: 32px;">${genOtp}</h1>
        </div>
        <p style="color: #64748b; font-size: 14px;">This OTP will expire in 5 minutes.</p>
        <p style="color: #94a3b8;font-size: 12px;margin-top: 25px;">If you didn't request this code, you can safely ignore this email.</p>
      </div>`
    })
    if(error){
      throw new AppError(error.message, 400)
    }
    
    await OTP.findOneAndUpdate(
      {email},
      {otp: genOtp,expiredAt: new Date()},
      {runValidators: true, upsert: true, returnDocument: "after"}
    )
    res.status(201).json({success: true})
  }
  catch(error){
    next(error)
  }
})


//verify otp api
router.post("/verify-otp", async (req, res, next) => {
  try{
    const { email, otp } = req.body
    if(!email){
      throw new AppError("Please enter a valid email.", 400)
    }
    if(!otp){
      throw new AppError("Please enter the OTP!", 400)
    }
    const foundOtp = await OTP.findOne({email, otp})
    if(!foundOtp){
      throw new AppError("Invalid OTP! Please try again.", 400)
    }
    await OTP.deleteOne({ _id: foundOtp._id})

    await VerifiedMail.findOneAndUpdate(
      {email},
      {email, expiresAt: new Date(Date.now() + 6 * 60 * 60 * 1000)},
      {upsert: true, returnDocument: "after"}
    )
    
    res.status(201).json({
      success: true,
      message: "Email verified! Please sign up."
    })
  }
  catch(error){
    next(error)
  }
})


//signup api
router.post("/signup", async (req, res, next) => {
  try{
    const { email, username, password } = req.body
    if(!email || !username || !password) {
      throw new AppError("Please fill in all the fields.", 400)
    }
    if(!validator.isEmail(email)){
      throw new AppError("Please enter a valid email.", 400)
    }
    if(username.length < 4 || username.length > 15){
      throw new AppError("Username must be 4 to 15 characters long.", 400)
    }
    if(!validator.isStrongPassword(password)){
      throw new AppError("Please enter a strong password.", 400)
    }
    const verifiedUser = await VerifiedMail.findOne({email})
    if(!verifiedUser){
      throw new AppError("Please verify your mail.", 400)
    }
    const existingUser = await User.findOne({email})
    if(existingUser){
      throw new AppError("User already exists. Please use another email.", 400)
    }
    
    const saltRounds = 10
    const hashedPass = await bcrypt.hash(password, saltRounds)
    await User.create({
      email,
      username,
      password: hashedPass
    })
    await VerifiedMail.findOneAndUpdate(
      {email},
      {$unset: { expiresAt: ""}}
    ) 
    //removing the expiresAt from verified email if a successfull signup occurs

    res.status(201).json({
      success: true,
      message: "User created successfully! Please Log in."
    })
  }
  catch(error){
    next(error)
  }
})

//login api
router.post("/login", async (req, res, next) => {
  try{
    const { email, username, password } = req.body

    if(!password || !(email || username)){
      throw new AppError("Please provide an email or username, and a password.", 400)
    }
    const foundUser = await User.findOne({
      $or : [
        {email},
        {username}
      ]
    })
    if(!foundUser){
      throw new AppError("Invalid credentials.", 401)
    }
    const isPassMatched = await bcrypt.compare(password, foundUser.password)
    if(!isPassMatched){
      throw new AppError("Invalid credentials.", 401)
    }
    const genToken = jwt.sign({id: foundUser._id}, process.env.JWT_SECRET, {expiresIn: "3h"})
    res.cookie("lg_token", genToken, {
      secure: true,
      maxAge: 3 * 60 * 60 * 1000,
      httpOnly: true,
      sameSite: "none"      
    }).status(200).json({
      success: true,
      message: "Logged In successfully!"
    })
  }
  catch(error){
    next(error)
  }
})

//logout api
router.post("/logout", async (req, res, next) => {
  try{
    res.clearCookie("lg_token", {
      secure: true,
      httpOnly: true,
      sameSite: "none"
    }).status(200).json({
      success: true,
      message: "Logged out successfully!"
    })
  }
  catch(error){
    next(error)
  }
})

//get user data (self) api
router.get("/me", isLoggedInUser, async (req, res, next) => {
  try{
    const { user } = req
    const [result, postCount] = await Promise.all([
      User.aggregate([
        { $match: { _id: user._id }},
        { $project: {
            followersCount:  { $size: { $ifNull: ["$followers", []]}},
            followingCount: { $size: { $ifNull: ["$following", []]}},
            savedPostsCount: { $size: { $ifNull: ["$savedPosts", []]}}
        }}
      ]),
      Posts.countDocuments({ authorId: user._id})
    ])
    
    const { followersCount = 0, followingCount = 0, savedPostsCount = 0 } = result[0] ?? {}    

    return res.status(200).json({
      success: true,
      data: {
        firstName: user.firstName,
        lastName: user.lastName,
        email: user.email,
        username: user.username,
        DOB: user.DOB,
        gender: user.gender,
        followersCount,
        followingCount,
        savedPostsCount,
        postCount,
        displayPicture: user.displayPicture,
        bio: user.bio,
        isProfilePublic: user.isProfilePublic,
        isProfileComplete: user.isProfileComplete,
        createdAt: user.createdAt
      }
    })
  }
  catch(error){
    next(error)
  }
})


//get user data (not self) api
router.get("/:userId", isLoggedInUser, async (req, res, next) => {
  try{
    const { userId } = req.params
    const targetId = new mongoose.Types.ObjectId(userId)

    const [result, postCount] = await Promise.all([
      User.aggregate([
        { $match: { _id: targetId }},
        { $project: {
          username: 1, firstName: 1, lastName: 1,
          displayPicture: 1, bio: 1, isProfilePublic: 1,
          followersCount: { $size: "$followers"},
          followingCount: { $size: "$following"},
          isFollowedByme: { $in: [req.user._id, { $ifNull: ["$followers", []] }] }        
        }}
      ]),
      Posts.countDocuments({ authorId: targetId})
    ])

    const profile = result[0]
    if(!profile){
      throw new AppError("User not found.", 404)
    }

    res.status(200).json({
      success: true,
      data: { ...profile, postCount }
    })
  }
  catch(error){
    next(error)
  }
})


//get all saved posts by user api
router.get("/saved", isLoggedInUser, async (req, res, next) => {
  try{
    const { page, limit, skip } = getPagination(req, 20)

    const [result] = await User.aggregate([
      { $match: { _id: req.user._id }},
      {$project: {
        savedPosts: { $slice: [{ $reverseArray: "$savedPosts" }, skip, limit + 1]}
      }}
    ])

    if(!result){
      throw new AppError("User not found.", 404)
    }
    const { items: pageOfIds, hasMore } = buildPage(result.savedPosts || [], limit, page)

    const savedPosts = await Posts.find({ _id: { $in: pageOfIds }})
      .select("media")
      .lean()
    
    const postMap = new Map(savedPosts.map(p => [p._id.toString(), p]))
    const orderedPosts = pageOfIds.map(id => postMap.get(id.toString()))
      .filter(Boolean)

    res.status(200).json({
      success: true,
      message: "Showing saved posts.",
      data: orderedPosts,
      page,
      hasMore
    })
  }
  catch(error){
    next(error)
  }
})


//search users with username api
router.get("/search", isLoggedInUser, async (req, res, next) => {
  try{
    const { q } = req.query
    if(!q || !q.trim()){
      return res.status(200).json({success: true, data: []})
    }
    const searchTerm = q
    const avoidRegex = (str) => str.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")

    const users = await User.find({
      username: { $regex: avoidRegex(searchTerm), $options: "i" },
      _id: { $ne: req.user._id }
    })
    .select("username firstName lastName displayPicture")
    .limit(20)
    .lean()

    const followingSet = new Set(
      (req.user.following || []).map(id => id.toString())
    )

    users.sort((a,b) => {
      const afollow = followingSet.has(a._id.toString()) ? 1 : 0
      const bfollow = followingSet.has(b._id.toString()) ? 1 : 0
      return bfollow - afollow
    })

    res.status(200).json({
      success: true,
      data: users
    })
  }
  catch(error){
    next(error)
  }
})


//follow a user api
router.post("/:userId/follow", isLoggedInUser, async (req, res, next) => {
  try{
    const targetId = req.params.userId
    const myId = req.user._id
    if(myId.equals(targetId)){
      throw new AppError("You cannot follow yourself.", 400)
    }
    //updating in target user's followers list
    const follow = await User.updateOne(
      { _id: targetId, followers: { $ne : myId }},
      { $addToSet: { followers: myId }}
    )
    if(follow.modifiedCount === 0) {
      const exists = await User.findOne({ _id: targetId})
      if(!exists){
        throw new AppError("User not found.", 404)
      }
      throw new AppError("Already following.", 409)
    }

    //updating in logged in user's following list
    await User.updateOne(
      { _id: myId, following: { $ne: targetId }},
      { $addToSet: { following: targetId}}
    )

    res.status(200).json({
      success: true,
      message: "Now following."
    })

  }
  catch(error){
    next(error)
  }
})


//unfollow a user api
router.delete("/:userId/unfollow", isLoggedInUser, async (req, res, next) => {
  try{
    const targetId = req.params.userId
    const myId = req.user._id
    
    if(myId.equals(targetId)){
      throw new AppError("You cannot unfollow yourself.", 400)
    }

    //updating in logged in user's following list
    const unfollow = await User.updateOne(
      { _id: targetId, followers: myId },
      { $pull: { followers: myId }}
    )
    if(unfollow.modifiedCount === 0){
      const exists = await User.exists({ _id: targetId })
      if(!exists){
        throw new AppError("User not found.", 404)
      }
      throw new AppError("Not following the user.", 409)
    }

    //updating in logged in user's following list
    await User.updateOne(
      { _id: myId },
      { $pull: { following: targetId }}
    )

    res.status(200).json({
      success: true,
      message: "Unfollowed."
    })
  }
  catch(error){
    next(error)
  }
})

//after making test data, test follow unfollow and think about if to add session transaction thing for atomocity or not


module.exports ={
  authRouter: router
}