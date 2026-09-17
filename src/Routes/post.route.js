const express = require("express")
const router = express.Router()
const cloudinary = require("../Utils/Cloudinary")
const isLoggedInUser = require("../Middlewares/auth.middleware")
const { postMediaUpload } = require("../Middlewares/multer.middleware")
const AppError = require("../Utils/AppError")
const { Posts } = require("../Models/post.models")
const streamifier = require("streamifier")


//create post api
router.post("/create", isLoggedInUser, postMediaUpload.single("file"), async (req, res, next) => {
  let updateObj = {}
  try{
    const { caption, visibility } = req.body
    if(!req.file && !caption?.trim()){
      throw new AppError("Post cannot be empty.", 400)
    }
    const mediaStreamUpload = () => {
      return new Promise((resolve, reject) => {
        const stream = cloudinary.uploader.upload_stream(
          {resource_type: "auto"},
          (err, result) => {
            if(err) return reject(err)
            resolve(result)
          }
        )
        streamifier.createReadStream(req.file.buffer).pipe(stream)
      })
    }
    if(caption){
      if(caption.trim().length > 200){
        throw new AppError("Caption must not exceed 200 characters.", 400)
      }
      updateObj.caption = caption
    }
    if(visibility){
      if(visibility!== "public" && visibility !== "private" && visibility !== "followers"){
        throw new AppError(`${visibility} is not a valid visibility method.`, 400)
      }
      updateObj.visibility = visibility
    }
    if(req.file){
      const imageLimit = 10 * 1024 * 1024
      const videoLimit = 30 * 1024 * 1024
      const isImage = req.file.mimetype.startsWith("image/")
      const limit = isImage ? imageLimit : videoLimit
      if(req.file.size > limit){
        throw new AppError(`File exceeds size limit for ${isImage ? "images" : "videos"}.`, 400)
      }
      const result = await mediaStreamUpload()
      updateObj.media = {
        url: result.secure_url,
        publicId: result.public_id,
        resourceType: result.resource_type
      }
    }
    updateObj.authorId = req.user._id
    const newPost = await Posts.create(updateObj)
    res.status(201).json({
      success: true,
      message: "Post created successfully.",
      data: newPost
    })
  }
  catch(error){
    if(updateObj?.media?.publicId){
      try{
        await cloudinary.uploader.destroy(updateObj.media.publicId, {
          resource_type: updateObj.media.resourceType
        })
      }
      catch(cleanUpError){
        console.log("Failed to cleanup orphaned cloudinary upload", cleanUpError)
      }
    }
    next(error)
  }
})







module.exports = {
  postRouter: router
}