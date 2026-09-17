const multer = require("multer")
const AppError = require("../Utils/AppError")

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 3 * 1024 * 1024},
  fileFilter: (req, file, cb) => {
    if(!file.mimetype.startsWith("image/")){
      return cb(new AppError("File must be an image.", 400))
    }
    cb(null, true)
  }
})

const postMediaUpload = multer({
  storage: multer.memoryStorage(),
  limits: {fileSize: 30 * 1024 * 1024},
  fileFilter: (req, file, cb) => {
    if(!file.mimetype.startsWith("image/") && !file.mimetype.startsWith("video/")){
      return cb(new AppError("File must be an image or video.", 400))
    }
    cb(null, true)
  }
})

module.exports = { 
  upload,
  postMediaUpload
}