import { Router } from "express";
import catchAsync from "../utils/catchAsync.js"
import analysis from "../controller/Analysis.js";
import { isUrlIdValid } from "../middleware/Analysis.js";

const router = Router()

router
    .route("/*")
    .get(isUrlIdValid, catchAsync(analysis.get))

export default router