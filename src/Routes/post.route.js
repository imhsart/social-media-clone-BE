const express = require("express")
const router = express.Router()
const cloudinary = require("../Utils/Cloudinary")
const isLoggedInUser = require("../Middlewares/auth.middleware")
const { postMediaUpload } = require("../Middlewares/multer.middleware")
const AppError = require("../Utils/AppError")
const { Posts } = require("../Models/post.models")
const { User } = require("../Models/user.models")
const streamifier = require("streamifier")
const { getPagination, buildPage } = require("../Utils/Pagination")
const mongoose = require("mongoose")


const extractTags = (inputCaption) => {
  const matches = inputCaption.match(/#[\w]+/g) || []
  return [...new Set(matches.map(tag => tag.slice(1).toLowerCase()))]
}

//pagination for feed
const getFeedPagination = (req, defaultLimit = 20, maxLimit = 30) => {
  const limit = Math.min(Math.max(parseInt(req.query.limit) || defaultLimit, 1), maxLimit)
  const cursor = req.query.cursor || null
  return { limit, cursor }
}

//Validate userId route parameter
router.param("userId" , (req, res, next, id) => {
  if(!mongoose.isValidObjectId(id)){
    return next(new AppError("Invalid user id.", 400))
  }
  next()
})

//Validate postId route parameter
router.param("postId" , (req, res, next, id) => {
  if(!mongoose.isValidObjectId(id)){
    return next(new AppError("Invalid post id.", 400))
  }
  next()
})


//create post api
router.post("/create", isLoggedInUser, postMediaUpload.single("file"), async (req, res, next) => {
  let updateObj = {}
  try{
    const { caption} = req.body
    //mentions will come parsed from frontend
    let mentioned = []
    try{
      mentioned = req.body.mentioned ? JSON.parse(req.body.mentioned) : []
    }
    catch(err){
      throw new AppError("Invalid mentions format.", 400)
    }
    if(!Array.isArray(mentioned)){
      throw new AppError("Mentions must be an array.", 400)
    }
    //if no media or text both throw error
    if(!req.file && !caption?.trim()){
      throw new AppError("Post cannot be empty.", 400)
    }
    //media upload to cloudinary function
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
    if(caption !== undefined && caption.trim().length > 250){
        throw new AppError("Caption must not exceed 200 characters.", 400)
    }

    //removing duplicates from array of IDs 
    const uniqueMentionIds = [...new Set(mentioned)].filter(Boolean)

    //validating the user ids received
    if(uniqueMentionIds.length){
      const validCount = await User.countDocuments({
        _id: { $in: uniqueMentionIds }
      });
      if(validCount !== uniqueMentionIds.length){
        return res.status(400).json({success: false, message: "One or more mentioned users do not exist."})
      }
    }

    updateObj = {
      authorId: req.user._id,
      caption: caption || "",
      hashtags: caption ? extractTags(caption) : [],
      mentions: uniqueMentionIds
    }
    //media file submission
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
    const newPost = await Posts.create(updateObj)
    res.status(201).json({
      success: true,
      message: "Post created successfully.",
      data: newPost
    })
  }
  catch(error){
    //cleaning orphaned cloudinary media
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
    const { page, limit, skip } = getPagination(req, 20)

    const targetUser = await User.findById(userId)
      .select("isProfilePublic")
      .lean()

    if(!targetUser){
      return res.status(404).json({success: false, message: "User not found."})
    }

    const isSelf = targetUser._id.equals(req.user._id)
    const isFollower = await User.exists({ _id: req.user._id, following: targetUser._id })

    if(!targetUser.isProfilePublic && !isSelf && !isFollower){
      return res.status(403).json({
        success: false,
        message: "This account is private",
        isPrivate: true
      })
    }

    const posts = await Posts.find({ authorId: userId })
      .sort({createdAt: -1, _id: -1})
      .skip(skip)
      .limit(limit + 1)
      .lean()

    const { items, hasMore } = buildPage(posts, limit, page)

    res.status(200).json({
      success: true,
      message: "Fetched all posts successfully.",
      data: items,
      page, 
      hasMore
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
    }).populate("authorId", "username displayPicture")

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


//edit post api
router.patch("/edit/:postId", isLoggedInUser, async (req, res, next) => {
  try{
    const { postId } = req.params
    const { caption, mentioned = [] } = req.body

    if(!Array.isArray(mentioned)) {
      throw new AppError("Mentions must be an array.", 400)
    }
    if(caption !== undefined && caption.trim().length > 250){
      throw new AppError("Caption must not exceed 200 characters.", 400)
    }

    const uniqueMentionIds = [...new Set(mentioned)].filter(Boolean)

    if(uniqueMentionIds.length){
      const validCount = await User.countDocuments({
        _id: { $in:uniqueMentionIds }
      });
      if(validCount !== uniqueMentionIds){
        return res.status(400).json({success: false, message: "One or more mentioned users do not exist."})
      }
    }
    const updateObj = {}
    if(caption !== undefined){
      updateObj.caption = caption
      updateObj.hashtags = caption ? extractTags(caption) : []
    }
    updateObj.mentions = uniqueMentionIds
    updateObj.isEdited = true

    const updatedPost = await Posts.findOneAndUpdate(
      { _id: postId, authorId: req.user._id },
      { $set: updateObj },
      { returnDocument: "after", runValidators: true }
    )

    if(!updatedPost){
      throw new AppError("Post not found or you're not authorized to edit it.", 404)
    }

    res.status(200).json({
      success: true,
      message: "Post edited successfully.",
      data: updatedPost
    })
  }
  catch(error){
    next(error)
  }
})


//like - unlike a post api
router.post("/:postId/like", isLoggedInUser, async (req, res, next) => {
  try{
    const { postId } = req.params
    const userId = req.user._id
    const targetPost = await Posts.findById(postId)
    if(!targetPost){
      throw new AppError("Post not found.", 404)
    }
    const alreadyLiked = targetPost.likes.some(id => id.equals(userId))

    const likedPostUpdate = alreadyLiked 
    ? { $pull: { likes: userId }}
    : { $addToSet: {likes: userId}}
    
    const updated = await Posts.findByIdAndUpdate(
      postId,
      likedPostUpdate,
      { returnDocument: "after" }
    )

    res.status(200).json({
      success: true,
      message: alreadyLiked ? "Post unliked." : "Post liked.",
      data: updated.likes.length
    })
  } 
  catch(error){
    next(error)
  }
})


//get a posts stats api
router.get("/:postId/stats", isLoggedInUser, async (req, res, next) => {
  try{
    const { postId } = req.params
    const userId = req.user._id
    const targetPost = await Posts.findById(postId)
    if(!targetPost){
      throw new AppError("Post not found.", 404)
    }
    const isLikedBySelf = targetPost.likes.some(id => id.equals(userId))
    const isSavedBySelf = Boolean(await User.exists({ _id: userId, savedPosts: postId }))
    const isOwnPost = targetPost.authorId.equals(userId)
    const postStats = {
      likesCount: targetPost.likes.length,
      // commentsCount: targetPost.comments.length, uncomment it when comments are added, and the logic will change too because it'll be a separate collection
      isLikedBySelf,
      isSavedBySelf,
      isOwnPost
    }
    res.status(200).json({
      success: true,
      message: "Retrieved stats.",
      data: postStats
    })
  }
  catch(error){
    next(error)
  }
})


//save - unsave a post api
router.post("/:postId/save", isLoggedInUser, async (req, res, next) => {
  try{
    const { postId } = req.params
    const userId = req.user._id
    const targetPost = await Posts.findById(postId)
    if(!targetPost){
      throw new AppError("Post not found.", 404)
    }
    const isAlreadySaved = Boolean(await User.exists({ _id: userId, savedPosts: postId }))
    const savedPostUpdate = isAlreadySaved
    ? { $pull : { savedPosts: postId }}
    : { $addToSet : { savedPosts: postId }}

    await User.findByIdAndUpdate(
      userId,
      savedPostUpdate,
      { returnDocument: "after" }    
    )

    res.status(200).json({
      success: true,
      message: isAlreadySaved ? "Removed from saved." : "Post saved."
    })
  }
  catch(error){
    next(error)
  }
})


//get all users who liked a post api
router.get("/liked-user/:postId", isLoggedInUser, async (req, res, next) => {
  try{
    const { postId } = req.params
    const { page, limit, skip } = getPagination(req, 30)

    const targetPost = await Posts.findById(postId)
      .select({ likes: { $slice: [skip, limit + 1] }})
      .populate("likes", "username firstName lastName displayPicture")
      .lean()

    if(!targetPost){
      throw new AppError("Post not found.", 404)
    }
    const { items, hasMore } = buildPage(targetPost.likes, limit, page)

    res.status(200).json({
      success: true,
      message: "Retrieved users",
      data: items,
      page,
      hasMore
    })
  }
  catch(error){
    next(error)
  }
})


//get followers of a user
router.get("/:userId/followers", isLoggedInUser, async (req, res, next) => {
  try{
    const { userId } = req.params
    const { page, limit, skip } = getPagination(req, 20)

    const targetUser = await User.findById(userId)
      .select({ isProfilePublic: 1, followers: { $slice: [skip, limit + 1] }})
      .populate("followers", "username firstName lastName displayPicture")
      .lean()

    if(!targetUser){
      throw new AppError("User not found.", 404)
    }

    const isUserSelf = targetUser._id.equals(req.user._id)
    const isPrivate = !targetUser.isProfilePublic
    const isFollower = await User.exists({ _id: req.user._id, following: targetUser._id })

    if(isPrivate && !isUserSelf && !isFollower){
      return res.status(403).json({ success: false, message: "This account is private." })
    }

    const { items, hasMore } = buildPage(targetUser.followers, limit, page)
    
    res.status(200).json({
      success: true,
      message: "Showing followers.",
      data: items,
      page, 
      hasMore
    })
  }
  catch(error){
    next(error)
  }
})


//get followings of a user
router.get("/:userId/following", isLoggedInUser, async (req, res, next) => {
  try{
    const { userId } = req.params
    const { page, limit, skip } = getPagination(req, 20)

    const targetUser = await User.findById(userId)
    .select({ isProfilePublic: 1, following: { $slice: [skip, limit + 1] }})
    .populate("following", "username firstName lastName displayPicture")
    .lean()

    if(!targetUser){
      throw new AppError("User not found.", 404)
    }

    const isUserSelf = targetUser._id.equals(req.user._id)
    const isPrivate = !targetUser.isProfilePublic
    const isFollowing = await User.exists({ _id: req.user._id, following: targetUser._id })

    if(isPrivate && !isUserSelf && !isFollowing){
      return res.status(403).json({ success: false, message: "This account is private." })
    }

    const { items, hasMore } = buildPage(targetUser.following, limit, page)

    res.status(200).json({
      success: true,
      message: "Showing followings.",
      data: items,
      page,
      hasMore
    })
  }
  catch(error){
    next(error)
  }
})


//get user feed api
router.get("/feed", isLoggedInUser, async (req, res, next) => {
  try{
    const userId = req.user._id
    const { limit, cursor } = getFeedPagination(req)

    const user = await User.findById(userId).select("following savedPosts").lean()
    const authorIds = [...user.following, userId]
    const savedSet = new Set(user.savedPosts.map(id => id.toString()))

    const query = { authorId: { $in: authorIds }}
    //when loading feed after the last post
    if(cursor){
      const [cursorData, cursorId] = cursor.split("_")
      query.$or = [
        { createdAt: { $lt: new Date(cursorData) }},
        { createdAt: new Date(cursorData), _id: { $lt: cursorId }}
      ]
    }

    let posts = await Posts.find(query)
      .sort({ createdAt: -1, _id: -1})
      .limit(limit + 1)
      .populate("authorId", "username firstName lastName displayPicture")
      .lean()

    const hasMore = posts.length > limit
    posts = hasMore ? posts.slice(0, limit) : posts

    const lastPost = posts[posts.length - 1]
    const nextCursor = hasMore && lastPost ? `${lastPost.createdAt.toISOString()}_${lastPost._id}` : null

    //adding stats for better frontend display
    const updated = posts.map(p => {
      const { likes, ...rest } = p
      return {
        ...rest,
        likesCount: likes.length,
        isLikedBySelf: likes.some(id => id.equals(userId)),
        isSavedBySelf: savedSet.has(p._id.toString()),
        // commentsCount: comments.length
      }
    })

    res.status(200).json({
      success: true,
      message: "Feed retrieved.",
      data: {
        posts: updated,
        nextCursor,
        hasMore
      }
    })
  }
  catch(error){
    next(error)
  }
})


module.exports = {
  postRouter: router
}