import ExpressError from "./ExpressError.js"
import axios from "axios"

// Updated getYtMetaData function for utils/funcs.js

export async function getYtMetaData(videoId) {

    // First try the existing oEmbed approach to get basic metadata
    const oembedUrl = `https://www.youtube.com/oembed?url=https://www.youtube.com/watch?v=${videoId}&format=json`;
    const oembedResponse = await axios.get(oembedUrl);
    const basicMetadata = oembedResponse.data;

    // Then use YouTube Data API to get duration and additional details
    const apiKey = process.env.YOUTUBE_API_KEY;
    if (!apiKey) {
        console.warn('YouTube API key not found. Using basic metadata only.');
        return basicMetadata;
    }

    const apiUrl = `https://www.googleapis.com/youtube/v3/videos?id=${videoId}&part=contentDetails,statistics,snippet&key=${apiKey}`;

    const apiResponse = await axios.get(apiUrl).catch((err) => console.error(err.message));

    if (apiResponse.data.items && apiResponse.data.items.length > 0) {
        const videoData = apiResponse.data.items[0];

        // Extract duration in ISO 8601 format (PT1H2M3S) and convert to seconds
        const isoDuration = videoData.contentDetails.duration;
        const lengthSeconds = isoDurationToSeconds(isoDuration);

        // Combine with basic metadata
        return {
            ...basicMetadata,
            lengthSeconds,
            viewCount: videoData.statistics.viewCount,
            likeCount: videoData.statistics.likeCount,
            description: videoData.snippet.description,
            publishedAt: videoData.snippet.publishedAt,
            channelId: videoData.snippet.channelId,
            categoryId: videoData.snippet.categoryId
        };
    }


    return basicMetadata;

}

function isoDurationToSeconds(isoDuration) {
    const match = isoDuration.match(/PT(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?/);

    if (!match) return 0;

    const hours = parseInt(match[1] || 0);
    const minutes = parseInt(match[2] || 0);
    const seconds = parseInt(match[3] || 0);

    return hours * 3600 + minutes * 60 + seconds;
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
