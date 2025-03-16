// controller/Analysis.js
import { analyzeYoutubeVideo } from "../Ai/index.js"
import ContentAnalysis from "../models/ContentAnalysis.js"
import { extractYouTubeVideoId } from "../utils/funcs.js"

export const get = async (req, res) => {
    try {
        const { videoUrl, videoId } = req.body;
        
        const id = videoId || (videoUrl ? extractYouTubeVideoId(videoUrl) : null);
        
        if (!id) {
            return res.status(400).json({ 
                message: "Invalid video URL or ID. Please provide a valid YouTube video URL or ID." 
            });
        }
        
        const existingAnalysis = await ContentAnalysis.findOne({ originalId: id });
        
        if (existingAnalysis) {
            console.log(`Using existing analysis for video ID: ${id}`);
            return res.status(200).json(existingAnalysis);
        }
        
        console.log(`Starting analysis for video ID: ${id}`);
        
        const analysisResult = await analyzeYoutubeVideo(id);
        
        const newContentAnalysis = new ContentAnalysis(analysisResult);
        await newContentAnalysis.save();
        
        res.status(200).json(newContentAnalysis);
    } catch (error) {
        console.error('Error in analysis controller:', error);
        res.status(500).json({ 
            message: "Failed to analyze video", 
            error: error.message 
        });
    }
}

export default {
    get
}