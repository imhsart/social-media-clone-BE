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
      {email},
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
    //after creating the user, delete the entry from verifiedMail, to avoid 
    // unverified signups if the user ever deletes the account
    // await VerifiedMail.deleteOne({email})

    res.status(201).json({
      success: true,
      message: "User created successfully! Please Log in."
    })
  }
  catch(error){
    next(error)
  }
})


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

module.exports ={
  authRouter: router
}