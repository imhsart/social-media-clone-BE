const mongoose = require("mongoose")

const mediaSchema = new mongoose.Schema({
  url: {type: String, trim: true}, 
  publicId: {type: String, trim: true},
  resourceType: {
    type: String,
    enum: {
      values: ["image", "video"],
      message: "{VALUE} is not a valid resource type."
    },
    trim: true
  }
}, {_id: false})

const postSchema = new mongoose.Schema({
  caption: {
    type: String,
    trim: true,
    maxLength: [200, "Caption must not exceed 200 characters."]
  },
  media: mediaSchema,
  authorId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "user",
    required: true,
    immutable: true
  },
  likes: [
    // {
    //   type: mongoose.Schema.Types.ObjectId,
    //   ref: "user"
    // }
  ],
  comments: [
    // {
    //   type: mongoose.Schema.Types.ObjectId,
    //   ref: "user"
    // }
  ],
  saves: [
    // {
    //   type: mongoose.Schema.Types.ObjectId,
    //   ref: "user"
    // }
  ],
  hashtags: [
    // {
    //   type: mongoose.Schema.Types.ObjectId,
    //   ref: "user"
    // }
  ],
  mentions: [
    // {
    //   type: mongoose.Schema.Types.ObjectId,
    //   ref: "user"
    // }
  ],
  isEdited: {
    type: Boolean,
    default: false
  },
  visibility: {
    type: String,
    enum: {
      values: ["public", "private", "followers"],
      message: "{VALUE} is not a valid visibility method"
    },
    default: "public"
  }

}, {timestamps: true})

postSchema.path("media").validate(function (media){
  const hasUrl = !!media?.url
  const hasPublicId = !!media?.publicId
  const hasResourceType = !!media?.resourceType
  return (hasUrl === hasPublicId) && (hasPublicId === hasResourceType)
}, "Media must include url, publicId, and resourceType together, or none at all.")

const Posts = mongoose.model("post", postSchema)

module.exports = {
  Posts
}