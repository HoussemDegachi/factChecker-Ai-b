import ExpressError from "./ExpressError.js"
import axios from "axios"

export const getYtMetaData = async (ytId) => {
    const url = `https://www.youtube.com/oembed?format=json&url=https://www.youtube.com/watch?v=${ytId}`
    try {
        const res = await axios.get(url)
        return res.data
    } catch (e) {
        throw new ExpressError("This video is unavailable", e.status)
    }
}

export function extractYouTubeVideoId(url) {
    if (!url) return null;
    
    if (!/[\/\.]/.test(url) && url.length > 8) {
        return url;
    }
    
    // Regular expression patterns for different YouTube URL formats
    const patterns = [
        // Standard watch URL: https://www.youtube.com/watch?v=VIDEO_ID
        /youtube\.com\/watch\?v=([^&]+)/,
        
        // Shortened URL: https://youtu.be/VIDEO_ID
        /youtu\.be\/([^?&]+)/,
        
        // Embedded URL: https://www.youtube.com/embed/VIDEO_ID
        /youtube\.com\/embed\/([^?&]+)/,
        
        // Mobile URL: https://m.youtube.com/watch?v=VIDEO_ID
        /m\.youtube\.com\/watch\?v=([^&]+)/
    ];
    
    // Try each pattern
    for (const pattern of patterns) {
        const match = url.match(pattern);
        if (match && match[1]) {
        return match[1];
        }
    }
    
    return null;
}

export default {
    getYtMetaData,
    extractYouTubeVideoId
}
