require("dotenv").config()
const express = require("express")
const mongoose = require("mongoose")
const { authRouter } = require("./Routes/auth.route")
const errorHandler = require("./Middlewares/errorHandler")

const app = express()
const PORT = process.env.PORT || 8080
app.use(express.json())
app.use("/api/auth", authRouter)





app.use(errorHandler)

mongoose.connect(process.env.MONGO_URL)
.then(() => {
  console.log("Database connected successfully...")

  app.listen(PORT, () => console.log(`Server running on port ${PORT}`))
})
.catch(error => console.log("Connection error:", error))