require("dotenv").config()
const express = require("express")
const app = express()
const mongoose = require("mongoose")
const { authRouter } = require("./Routes/auth.route")
const { profileRouter } = require("./Routes/profile.route")
const errorHandler = require("./Middlewares/error.middleware")
const cp = require("cookie-parser")
const cors = require("cors")


app.use(cors({
  methods: ["GET", "POST", "PUT", "PATCH", "DELETE"],
  origin: "http://localhost:5173"
}))
const PORT = process.env.PORT || 8080
app.use(express.json())
app.use(cp())
app.use("/api/auth", authRouter)
app.use("/api/profile", profileRouter)





app.use(errorHandler)

mongoose.connect(process.env.MONGO_URL)
.then(() => {
  console.log("Database connected successfully...")

  app.listen(PORT, () => console.log(`Server running on port ${PORT}`))
})
.catch(error => console.log("Connection error:", error))