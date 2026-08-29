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

  const statusCode = err.statusCode || 500
  return res.status(statusCode).json({
    success: false,
    message: err.message || "Something went wrong."
  })
}

module.exports = errorHandler