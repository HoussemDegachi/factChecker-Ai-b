// tests/testGeminiService.js
import dotenv from 'dotenv';
import fs from 'fs';
import path from 'path';
import { analyzeContent, validateClaim } from '../models/GeminiService.js';
import { getYtMetaData, extractYouTubeVideoId } from '../utils/funcs.js';

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

// Function to test the YouTube analysis
async function testYouTubeAnalysis(videoIdOrUrl) {
    try {
    const videoId = extractYouTubeVideoId(videoIdOrUrl);
    
    if (!videoId) {
        throw new Error('Invalid YouTube URL or video ID');
    }
    
    console.log(`Testing analysis for YouTube video ID: ${videoId}`);
    
    console.log('Fetching video metadata...');
    const metadata = await getYtMetaData(videoId);
    console.log('Video title:', metadata.title);
    console.log('Video Link:', metadata.author_url);
    
    // Use the video URL for analysis
    const videoUrl = `https://www.youtube.com/watch?v=${videoId}`;
    
    // Analyze the content
    console.log('Analyzing content with Gemini...');
    const analysisResult = await analyzeContent(metadata.title, videoUrl, videoId);
    
    // Display a summary of the results
    console.log('\n--- Analysis Results ---');
    console.log('Conclusion:', analysisResult.conclusion);
    console.log('Overall accuracy:', analysisResult.percentages.overall + '%');
    console.log('False information:', analysisResult.percentages.falseInformation + '%');
    console.log('Verified information:', analysisResult.percentages.verifiedInformation + '%');
    console.log('Misleading information:', analysisResult.percentages.misleadingInformation + '%');
    
    console.log('\n--- Topics ---');
    console.log('General Topic:', analysisResult.generalTopic);
    console.log('Categories:');
    if (analysisResult.topics && analysisResult.topics.categories) {
      analysisResult.topics.categories.forEach((category, i) => {
        console.log(`  ${i+1}. ${category.title}: ${category.count} mentions`);
        });
    }
    
    // Validate a claim if timestamps exist
    if (analysisResult.timestamps && analysisResult.timestamps.length > 0) {
        const firstClaim = analysisResult.timestamps[0].claim;
        console.log('\n--- Testing Claim Validation ---');
        console.log('Validating claim:', firstClaim);
        
        const validationResult = await validateClaim(firstClaim);
        console.log('Validation result:', JSON.stringify(validationResult, null, 2));
        
        analysisResult.claimValidation = validationResult;
        }
        
        // Save the results to a file
        const filePath = saveResultsToFile(analysisResult, videoId);
        console.log(`\nComplete analysis results saved to: ${filePath}`);
        
        return analysisResult;
    } catch (error) {
        console.error('Error testing YouTube analysis:', error);
        throw error;
    }
}

const videoIdOrUrl = process.argv[2];

if (!videoIdOrUrl) {
    console.error('Please provide a YouTube video ID or URL as a command line argument');
    console.log('Examples:');
    console.log('  node tests/testGeminiService.js dQw4w9WgXcQ');
    console.log('  node tests/testGeminiService.js https://www.youtube.com/watch?v=dQw4w9WgXcQ');
    console.log('  node tests/testGeminiService.js https://youtu.be/dQw4w9WgXcQ');
    process.exit(1);
}

testYouTubeAnalysis(videoIdOrUrl)
    .then(result => {
        console.log('\nTest completed successfully!');
    })
    .catch(error => {
        console.error('Test failed:', error.message);
    });