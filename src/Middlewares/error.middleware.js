const errorHandler = (err, req, res, next) => {
  //mongo duplicate key error
  if(err.code === 11000){
    const field = Object.keys(err.keyValue)[0]
    const value = err.keyValue[field]
    return res.status(409).json({
      success: false,
      message: `${field} "${value}" already exists.`
    })
  }

  //mongoose validation error
  if(err.name === "ValidationError"){
    const messages = Object.values(err.errors).map(e => e.message)
    return res.status(400).json({
      success: false,
      message: messages.join(" ")
    })
  }

  //mongoose invalid ID
  if(err.name === "CastError"){
    return res.status(400).json({
      success: false,
      message: "Invalid ID"
    })
  }

  //jwt token error
  if(err.name === "TokenExpiredError" || err.name === "JsonWebTokenError"){
    return res.status(401).json({
      success: false,
      message: "Session expired. Please login again."
    })
  }

  // multer error handling
  if (err.name === "MulterError") {
    if (err.code === "LIMIT_FILE_SIZE") {
      return res.status(400).json({ 
        success: false, 
        message: "File size must be 3MB or less."
      });
    }
    return res.status(400).json({ 
      success: false, 
      message: "File upload error." 
    });
  }

  const statusCode = err.statusCode || 500
  return res.status(statusCode).json({
    success: false,
    message: err.message || "Something went wrong."
  })
}

module.exports = errorHandler