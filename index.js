import express from "express"
import mongoose from "mongoose"
import analysisRoutes from "./routes/Analysis.js"
import cors from "cors"

const app = express()

mongoose.connect(process.env.DB_URL).then(() => console.log("Connected to DB successfully"))


// config
app.use(express.json())
app.use(cors())
app.use((req, res, next) => {
    res.header("Access-Control-Allow-Origin", "*");
    res.header(
        "Access-Control-Allow-Headers",
        "Origin, X-Requested-With, Content-Type, Accept"
    );
    next();
});

// routes
app.use("/analysis", analysisRoutes)

app.all("*", (req, res) => {
    res.status(404).json({
        message: "Route wasn't found"
    })
})


// error handeling
app.use((err, req, res, next) => {
    console.log(err.stack)
    if (!err.message) err.title = "An error occured"
    if (!err.status) err.status = 500
    res.status(err.status).json({
        message: err.message,
    })
    return next()
})


// run server
app.listen(process.env.PORT, () => {
    console.log(`App listening on port ${process.env.PORT}`)
})