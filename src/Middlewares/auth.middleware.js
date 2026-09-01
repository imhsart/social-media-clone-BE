const { User } = require("../Models/user.models")
const AppError = require("../Utils/AppError")
const jwt = require("jsonwebtoken")

const isLoggedInUser = async (req, res, next) => {
  try{
    const { lg_token } = req.cookies
    if(!lg_token){
      throw new AppError("Please login again.", 401)
    }
    const verifyJwt = jwt.verify(lg_token, process.env.JWT_SECRET)
    const loggedInUser = await User.findById(verifyJwt.id)
    if(!loggedInUser){
      throw new AppError("Please login again.", 401)
    }
    req.user = loggedInUser
    next()
  }
  catch(error){
    next(error)
  }
}

module.exports = isLoggedInUser