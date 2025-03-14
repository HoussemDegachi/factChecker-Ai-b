import express from "express"
import mongoose from "mongoose"
import cors from "cors"

const app = express()

mongoose.connect(process.env.DB_URL).then(() => console.log("Connected to DB successfully"))


// config
app.use(express.json())
app.use(cors)
app.use((req, res, next) => {
    res.header("Access-Control-Allow-Origin", "*");
    res.header(
        "Access-Control-Allow-Headers",
        "Origin, X-Requested-With, Content-Type, Accept"
    );
    next();
});

// routes

// error handeling

// run server
app.listen(process.env.PORT, () => {
    console.log(`App listening on port ${process.env.PORT}`)
})