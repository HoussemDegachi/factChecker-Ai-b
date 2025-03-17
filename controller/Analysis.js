// controller/Analysis.js
import { analyzeYoutubeVideo } from "../Ai/index.js"
import ContentAnalysis from "../models/ContentAnalysis.js"

export const get = async (req, res) => {

    const { id } = req.body

    const analysis = await ContentAnalysis.findOne({ originalId: id })

    // if analysis already exist for this video
    if (analysis) return res.status(200).json(analysis)

    // else create new analysis
    const analysisResult = await analyzeYoutubeVideo(id);
    console.log(analysisResult)
    const newContentAnalysis = new ContentAnalysis(analysisResult)
    await newContentAnalysis.save()
    res.status(200).json(newContentAnalysis)
}

export default {
    get
}
