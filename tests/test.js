// tests/test.js
import dotenv from 'dotenv';
import fs from 'fs';
import path from 'path';
import { analyzeYoutubeVideo } from '../Ai/index.js';
import { extractYouTubeVideoId } from '../utils/funcs.js';

dotenv.config();

if (!process.env.GEMINI_API_KEY) {
    console.error('Error: GEMINI_API_KEY environment variable is not set');
    process.exit(1);
}

function saveResultsToFile(data, videoId) {
    const timestamp = new Date().toISOString().replace(/:/g, '-').replace(/\./g, '-');
    const filename = `analysis_${videoId}_${timestamp}.json`;
    
    const resultsDir = path.join(process.cwd(), 'analysis_results');
    if (!fs.existsSync(resultsDir)) {
        fs.mkdirSync(resultsDir, { recursive: true });
    }
    
    const filePath = path.join(resultsDir, filename);
    fs.writeFileSync(filePath, JSON.stringify(data, null, 2), 'utf8');
    
    return filePath;
}

async function analyzeVideo(videoIdOrUrl) {
    try {
        const videoId = extractYouTubeVideoId(videoIdOrUrl);
        
        if (!videoId) {
            throw new Error('Invalid YouTube URL or video ID');
        }
        
        console.log(`Analyzing YouTube video: ${videoId}`);
        
        const analysisResult = await analyzeYoutubeVideo(videoId);
        
        const filePath = saveResultsToFile(analysisResult, videoId);
        console.log(`Analysis complete! Results saved to: ${filePath}`);
        
        return analysisResult;
    } catch (error) {
        console.error('Analysis failed:', error.message);
        throw error;
    }
}

async function main() {
    const args = process.argv.slice(2);
    const videoIdOrUrl = args[0];
    
    if (!videoIdOrUrl) {
        console.error('Please provide a YouTube video ID or URL as a command line argument');
        console.log('Examples:');
        console.log('  node tests/TestGeminiService.js dQw4w9WgXcQ');
        console.log('  node tests/TestGeminiService.js https://www.youtube.com/watch?v=dQw4w9WgXcQ');
        process.exit(1);
    }
    
    try {
        await analyzeVideo(videoIdOrUrl);
        console.log('Test completed successfully!');
    } catch (error) {
        console.error('Test failed:', error);
        process.exit(1);
    }
}

main();