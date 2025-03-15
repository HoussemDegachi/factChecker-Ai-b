// tests/TestGeminiService.js
import dotenv from 'dotenv';
import fs from 'fs';
import path from 'path';
import { analyzeContent } from '../Ai/index.js'
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

async function testIntegratedAnalysis(videoIdOrUrl) {
    try {
        const videoId = extractYouTubeVideoId(videoIdOrUrl);
        
        if (!videoId) {
            throw new Error('Invalid YouTube URL or video ID');
        }
        
        console.log(`Testing integrated analysis for YouTube video ID: ${videoId}`);
        
        console.log('Fetching video metadata...');
        const metadata = await getYtMetaData(videoId);
        console.log('Video title:', metadata.title);
        console.log('Video Link:', metadata.author_url);
        
        const videoUrl = `https://www.youtube.com/watch?v=${videoId}`;
        
        console.log('Analyzing content with Gemini including integrated validation...');
        console.log('This may take a while as the model processes both analysis and validation...');
        
        const startTime = Date.now();
        const analysisResult = await analyzeContent(metadata.title, videoUrl, videoId);
        const endTime = Date.now();
        
        console.log(`Analysis completed in ${(endTime - startTime) / 1000} seconds`);
        
        console.log('\n--- Analysis Results ---');
        console.log('Conclusion:', analysisResult.conclusion);
        console.log('Overall accuracy:', analysisResult.percentages.overall + '%');
        console.log('False information:', analysisResult.percentages.falseInformation + '%');
        console.log('Verified information:', analysisResult.percentages.verifiedInformation + '%');
        console.log('Misleading information:', analysisResult.percentages.misleadingInformation + '%');
        
        console.log('\n--- Topics ---');
        if (analysisResult.generalTopic) {
            console.log('General Topic:', analysisResult.generalTopic);
        }
        console.log('Categories:');
        if (analysisResult.topics && analysisResult.topics.categories) {
            analysisResult.topics.categories.forEach((category, i) => {
                console.log(`  ${i+1}. ${category.title}: ${category.count} mentions`);
            });
        }
        
        if (analysisResult.timestamps && analysisResult.timestamps.length > 0) {
            console.log(`\n--- Claims and Validations (${analysisResult.timestamps.length} total) ---`);
            
            analysisResult.timestamps.forEach((timestamp, index) => {
                console.log(`\nClaim ${index + 1}: "${timestamp.claim}" (${timestamp.label})`);
                console.log(`Timestamp: ${timestamp.timestampInStr}`);
                
                if (timestamp.validation) {
                    console.log(`Validity: ${timestamp.validation.isValid ? 'Valid' : 'Invalid'}`);
                    console.log(`Confidence: ${timestamp.validation.confidence}%`);
                    
                    if (timestamp.validation.references && timestamp.validation.references.length > 0) {
                        console.log(`References: ${timestamp.validation.references.length}`);

                        const firstRef = timestamp.validation.references[0];
                        console.log(`  - ${firstRef.title} (Credibility: ${firstRef.credibilityScore}/10)`);
                    }
                }
            });
            
            console.log('\nTo see detailed information about a specific claim, run the script with:');
            console.log(`node tests/testIntegratedAnalysis.js ${videoId} --detail=CLAIM_NUMBER`);
        }
        
        const filePath = saveResultsToFile(analysisResult, videoId);
        console.log(`\nComplete analysis results saved to: ${filePath}`);
        
        return analysisResult;
    } catch (error) {
        console.error('Error testing YouTube analysis:', error);
        throw error;
    }
}

function showDetailedClaim(result, claimIndex) {
    if (!result.timestamps || !result.timestamps[claimIndex]) {
        console.error(`Claim #${claimIndex + 1} not found in the results`);
        return;
    }
    
    const claim = result.timestamps[claimIndex];
    
    console.log('\n=== DETAILED CLAIM INFORMATION ===');
    console.log(`Claim: "${claim.claim}"`);
    console.log(`Timestamp: ${claim.timestampInStr} (${claim.timestampInS} seconds)`);
    console.log(`Label: ${claim.label}`);
    console.log(`Explanation: ${claim.explanation}`);
    console.log(`Source: ${claim.source}`);
    
    if (claim.validation) {
        console.log('\n--- Validation Details ---');
        console.log(`Validity: ${claim.validation.isValid ? 'Valid' : 'Invalid'}`);
        console.log(`Confidence: ${claim.validation.confidence}%`);
        console.log(`Explanation: ${claim.validation.explanation}`);
        
        if (claim.validation.references && claim.validation.references.length > 0) {
            console.log('\n--- References ---');
            claim.validation.references.forEach((ref, i) => {
                console.log(`\nReference ${i+1}: ${ref.title}`);
                console.log(`Credibility Score: ${ref.credibilityScore}/10`);
                if (ref.url) console.log(`URL: ${ref.url}`);
                if (ref.author) console.log(`Author: ${ref.author}`);
                if (ref.publisher) console.log(`Publisher: ${ref.publisher}`);
                if (ref.publicationDate) console.log(`Publication Date: ${ref.publicationDate}`);
            });
        }
    }
}

const args = process.argv.slice(2);
const videoIdOrUrl = args[0];

let detailArg = args.find(arg => arg.startsWith('--detail='));
let claimIndex = null;

if (detailArg) {
    claimIndex = parseInt(detailArg.split('=')[1]) - 1;
}

if (!videoIdOrUrl) {
    console.error('Please provide a YouTube video ID or URL as a command line argument');
    console.log('Examples:');
    console.log('  node tests/testIntegratedAnalysis.js dQw4w9WgXcQ');
    console.log('  node tests/testIntegratedAnalysis.js https://www.youtube.com/watch?v=dQw4w9WgXcQ');
    console.log('  node tests/testIntegratedAnalysis.js https://youtu.be/dQw4w9WgXcQ');
    process.exit(1);
}

if (claimIndex !== null) {
    const resultsDir = path.join(process.cwd(), 'analysis_results');
    const files = fs.readdirSync(resultsDir);
    
    const videoId = extractYouTubeVideoId(videoIdOrUrl);
    const relevantFiles = files.filter(f => f.startsWith(`analysis_${videoId}_`));
    
    if (relevantFiles.length > 0) {
        relevantFiles.sort().reverse();
        const latestFile = relevantFiles[0];
        const filePath = path.join(resultsDir, latestFile);
        
        try {
            const analysisData = JSON.parse(fs.readFileSync(filePath, 'utf8'));
            showDetailedClaim(analysisData, claimIndex);
            process.exit(0);
        } catch (error) {
            console.error('Error reading analysis file, running new analysis:', error.message);
        }
    }
}

testIntegratedAnalysis(videoIdOrUrl)
    .then(result => {
        if (claimIndex !== null) {
            showDetailedClaim(result, claimIndex);
        }
        console.log('\nTest completed successfully!');
    })
    .catch(error => {
        console.error('Test failed:', error.message);
    });