const express = require("express")
const router = express.Router()
const { User } = require("../Models/user.models")
const AppError = require("../Utils/AppError")
const validator = require("validator")
const isLoggedInUser = require("../Middlewares/auth.middleware")
const upload = require("../Middlewares/multer.middleware")
const cloudinary = require("../Utils/Cloudinary")
const streamifier = require("streamifier")


//complete profile api
router.put("/complete", isLoggedInUser, async (req, res, next) => {
  try{
    const { firstName, lastName, DOB, gender, displayPicture, bio } = req.body
    if(!firstName || !lastName || !DOB || !gender){
      throw new AppError("Please fill the fields marked as required.", 400)
    }
    if(!firstName.match(/^[A-Za-z\s'-]+$/) || !lastName.match(/^[A-Za-z\s'-]+$/)){
      throw new AppError("Please enter a valid name.", 400)
    }
    const allowedGenders = new Set(["male", "female", "other"])
    if(!allowedGenders.has(gender)){
      throw new AppError("Please enter a valid gender.", 400)
    }
    if(displayPicture){
      if(typeof displayPicture !== "string" || !validator.isURL(displayPicture)){
        throw new AppError("Invalid display picture", 400)
      }
    }
    if(bio && bio.length > 300){
      throw new AppError("Bio must be at most 300 characters long.", 400)
    }
    const dobDate = new Date(DOB)
    if(isNaN(dobDate.getTime())){
      throw new AppError("Please enter a valid date of birth.", 400)
    }
    const age = (Date.now() - dobDate.getTime()) / (1000 * 60 * 60 * 24 * 365.25)
    if(age < 18){
      throw new AppError("You must be at least 18 years old.", 400)
    }
    const foundUser = await User.findByIdAndUpdate(
      req.user._id,
      {
        firstName,
        lastName,
        DOB,
        gender,
        displayPicture,
        bio,
        isProfileComplete: true
      }, {
        returnDocument: "after",
        runValidators: true
      }
    )
    res.status(200).json({
      success: true,
      message: "Completed profile successfully!",
      data: {
        email: foundUser.email,
        username: foundUser.username,
        firstName: foundUser.firstName,
        lastName: foundUser.lastName,
        DOB: foundUser.DOB,
        gender: foundUser.gender,
        followers: foundUser.followers,
        following: foundUser.following,
        posts: foundUser.posts,
        displayPicture: foundUser.displayPicture,
        bio: foundUser.bio
      }
    })
  }
  catch(error){
    next(error)
  }
})


//edit profile api
router.patch("/edit", isLoggedInUser, async (req, res, next) => {
  try{
    const { firstName, lastName, displayPicture, bio } = req.body
    const loggedInUser = req.user
    if(req.body?.email || req.body?.username || req.body?.password || req.body?.DOB || req.body?.gender){
      throw new AppError("Email, username, DOB, gender cannot be changed.", 400)
    }
    const updateData = {}

    if(firstName !== undefined){
      if(!firstName.trim() || !firstName.match(/^[A-Za-z\s'-]+$/)){
        throw new AppError("Please enter a valid first name.", 400)
      }
      updateData.firstName = firstName.trim()
    }
    if(lastName !== undefined){
      if(!lastName.trim() || !lastName.match(/^[A-Za-z\s'-]+$/)){
        throw new AppError("Please enter a valid last name.", 400)
      }
      updateData.lastName = lastName.trim()
    }
//to remove displaypicture from this api, separate api for picture change
    if(displayPicture !== undefined){
      if(typeof displayPicture !== "string" || !displayPicture.trim() || !validator.isURL(displayPicture)){
        throw new AppError("Invalid display picture.", 400)
      }
      updateData.displayPicture = displayPicture.trim()
    }

    if(bio !== undefined){
      if(bio.length > 300){
        throw new AppError("Bio must be at most 300 characters long.", 400)
      }
      updateData.bio = bio.trim()
    }
    if(Object.keys(updateData).length === 0){
      throw new AppError("No valid fields provided to update.", 400)
    }
    const updatedUser = await User.findByIdAndUpdate(
      loggedInUser._id,
      updateData,
      {runValidators: true, returnDocument: "after"}
    )
    res.status(200).json({
      success: true,
      message: "Updated profile details.",
      data: {
        email: updatedUser.email,
        username: updatedUser.username,
        firstName: updatedUser.firstName,
        lastName: updatedUser.lastName,
        DOB: updatedUser.DOB,
        gender: updatedUser.gender,
        followers: updatedUser.followers,
        following: updatedUser.following,
        posts: updatedUser.posts,
        displayPicture: updatedUser.displayPicture,
        bio: updatedUser.bio
      }
    })
  }
  catch(error){
    next(error)
  }
})


//change profile picture api
router.patch("/edit/profile-picture", isLoggedInUser, upload.single("file"), async (req, res, next) => {
  try{
    if(!req.file){
      throw new AppError("Image is required.", 400)
    }
    const streamUpload = () => {
      return new Promise((resolve, reject) => {
        const stream = cloudinary.uploader.upload_stream(
          (err, result) => {
            if(err) return reject(err)
            resolve(result)
          }
        )
        streamifier.createReadStream(req.file.buffer).pipe(stream)
      })
    } 
    const result = await streamUpload()
    const updatedUser = await User.findByIdAndUpdate(
      req.user._id,
      {displayPicture: result.secure_url},
      {runValidators: true, returnDocument: "after"}
    )
    if(!updatedUser){
      return next(new AppError("User not found!", 404))
    }
    res.status(200).json({
      success: true,
      message: "Profile picture updated.",
      data: {
        displayPicture: updatedUser.displayPicture
      }
    })
  }
  catch(error){
    next(error)
  }
})






module.exports = {
  profileRouter: router
}