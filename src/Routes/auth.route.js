const express = require("express")
const { OTP } = require("../Models/otp.models")
const validator = require("validator")
const { Resend } = require("resend")
const { VerifiedMail } = require("../Models/verifiedMails.models")
const router = express.Router()
const resend = new Resend(process.env.RESEND_API_KEY)


//send otp api
router.post("/send-otp" , async (req, res) => {
  const { email } = req.body
  if(!email){
    return res.status(400).json({success: false, error: "Email is required!"})
  }
  if(!validator.isEmail(email)){
    return res.status(400).json({success: false, error: "Please enter a valid email!"})
  }
  const genOtp = Math.floor(100000 + Math.random() * 900000)
  try{
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
      return res.status(400).json({success: false, error: error.message})
    }
    
    await OTP.findOneAndUpdate({
      email
    }, {
      otp: genOtp,
      expiredAt: new Date()
    },{runValidators: true, upsert: true, returnDocument: "after"})

    res.status(201).json({success: true})
  }
  catch(error){
    if(error.code === 11000){
      return res.status(409).json({success: false, error: "OTP already sent. Please wait before requesting again."})
    }
    if(error.name === "ValidationError"){
      return res.status(400).json({success: false, error: error.message})
    }
    res.status(500).json({
      success: false, 
      error: "Something went wrong. Please try again."
    })
  }
})


//verify otp api
router.post("/verify-otp", async (req, res) => {
  const { email, otp } = req.body
  if(!email){
    return res.status(400).json({success: false, error: "Please enter a valid email."})
  }
  if(!otp){
    return res.status(400).json({success: false, error: "Please enter the OTP!"})
  }
  try{
    const foundOtp = await OTP.findOne({email, otp})
    if(!foundOtp){
      throw new Error("Invalid OTP! Please try again.")
    }
    await OTP.deleteOne({ _id: foundOtp._id})

    await VerifiedMail.findOneAndUpdate({email},{
      email
    }, {upsert: true, returnDocument: "after"})
    
    res.status(201).json({
      success: true,
      message: "Email verified! Please sign up."
    })
  }
  catch(error){
    res.status(500).json({
      success: false, 
      error: "Something went wrong. Please try again."
    })
  }
})


module.exports ={
  authRouter: router
}