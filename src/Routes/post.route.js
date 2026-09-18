const express = require("express")
const router = express.Router()
const cloudinary = require("../Utils/Cloudinary")
const isLoggedInUser = require("../Middlewares/auth.middleware")
const { postMediaUpload } = require("../Middlewares/multer.middleware")
const AppError = require("../Utils/AppError")
const { Posts } = require("../Models/post.models")
const { User } = require("../Models/user.models")
const streamifier = require("streamifier")


//create post api
router.post("/create", isLoggedInUser, postMediaUpload.single("file"), async (req, res, next) => {
  let updateObj = {}
  try{
    const { caption } = req.body
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


//get all posts api (self and other user)
router.get("/users/:userId/get-posts", isLoggedInUser, async (req, res, next) => {
  try{
    const {userId} = req.params
    const targetUser = await User.findById(userId).select("isProfilePublic followers")
    if(!targetUser){
      return res.status(404).json({success: false, message: "User not found."})
    }
    const isSelf = userId === req.user._id.toString()
    const isFollower = targetUser.followers.some(id => id.equals(req.user._id))

    if(!targetUser.isProfilePublic && !isSelf && !isFollower){
      return res.status(403).json({
        success: false,
        message: "This account is private",
        isPrivate: true
      })
    }
    const allPosts = await Posts.find({
      authorId: userId
    }).sort({createdAt: -1})
    res.status(200).json({
      success: true,
      message: "Fetched all posts successfully.",
      data: allPosts
    })
  }
  catch(error){
    next(error)
  }
})


//get single post api (self and other user)
router.get("/users/:userId/get-post/:postId", isLoggedInUser, async (req, res, next) => {
  try{
    const {userId, postId} = req.params
    const targetUser = await User.findById(userId).select("isProfilePublic followers")
    if(!targetUser){
      return res.status(404).json({success: false, message: "User not found."})
    }
    const isSelf = userId === req.user._id.toString()
    const isFollower = targetUser.followers.some(id => id.equals(req.user._id))
    
    if(!targetUser.isProfilePublic && !isSelf && !isFollower){
      return res.status(403).json({
        success: false,
        message: "This account is private",
        isPrivate: true
      })
    }

    const targetPost = await Posts.findOne({
      _id: postId,
      authorId: userId
    })
    if(!targetPost){
      return res.status(404).json({success: false, message: "Post not found."})
    }
    res.status(200).json({
      success: true,
      message: "Fetched post successfully.",
      data: targetPost
    })
  }
  catch(error){
    next(error)
  }
})


//delete post api
router.delete("/delete/:postId", isLoggedInUser, async (req, res, next) => {
  try{
    const { postId } = req.params
    const targetPost = await Posts.findOne({
      _id: postId,
      authorId: req.user._id
    }).select("media")

    if(!targetPost){
      return res.status(404).json({success: false, message: "Post not found."})
    }

    await Posts.deleteOne({ _id: postId })

    if(targetPost.media?.publicId){
      try{
        await cloudinary.uploader.destroy(targetPost.media.publicId, {
          resource_type: targetPost.media.resourceType
        })
      }
      catch(cleanUpError){
        console.log("Failed to delete cloudinary media for a deleted post.", cleanUpError)
      }
    }
    res.status(200).json({
      success: true,
      message: "Deleted post successfully."
    })
  }
  catch(error){
    next(error)
  }
})



module.exports = {
  postRouter: router
}