// tests/automated-test.js
import dotenv from 'dotenv';
import fs from 'fs';
import path from 'path';
import { analyzeYoutubeVideo } from '../Ai/index.js';

dotenv.config();

if (!process.env.GEMINI_API_KEY) {
    console.error('Error: GEMINI_API_KEY environment variable is not set');
    process.exit(1);
}

// Video IDs to test
const TEST_VIDEOS = {
    long: [
        { id: 'h4ENHlCTSTQ', duration: '8min' },
        { id: 'XQeKBLRPpxA', duration: '10min' },
        { id: 'dUaaTnlgxCg', duration: '16min' },
        { id: 'cQWqUeK8S7k', duration: '25min' }
    ],
    short: [
        { id: 'w2PLGDMbbnU', duration: '1min' },
        { id: 'nL_gB3MOaHM', duration: '3min' },
        { id: '_D2fK-HhTvo', duration: '3min' },
        { id: 'PQ2WjtaPfXU', duration: '4min' }
    ]
};

function saveResultsToFile(data, videoId, category) {
    const timestamp = new Date().toISOString().replace(/:/g, '-').replace(/\./g, '-');
    const filename = `analysis_${category}_${videoId}_${timestamp}.json`;
    
    const resultsDir = path.join(process.cwd(), 'analysis_results');
    if (!fs.existsSync(resultsDir)) {
        fs.mkdirSync(resultsDir, { recursive: true });
    }
    
    const filePath = path.join(resultsDir, filename);
    fs.writeFileSync(filePath, JSON.stringify(data, null, 2), 'utf8');
    
    return filePath;
}

function validateEducationalRecommendations(recommendations) {
    if (!recommendations || !Array.isArray(recommendations)) {
        return { valid: false, message: "Educational recommendations missing or not an array" };
    }
    
    if (recommendations.length < 3) {
        return { valid: false, message: `Only ${recommendations.length} educational recommendations found, minimum 3 required` };
    }
    
    const errors = [];
    
    recommendations.forEach((rec, index) => {
        if (!rec.title) errors.push(`Recommendation ${index + 1} missing title`);
        if (!rec.description) errors.push(`Recommendation ${index + 1} missing description`);
        if (!rec.url) errors.push(`Recommendation ${index + 1} missing URL`);
        if (!rec.type) errors.push(`Recommendation ${index + 1} missing type`);
        if (!rec.authorOrPublisher) errors.push(`Recommendation ${index + 1} missing author/publisher`);
        
        if (rec.url) {
            // Very basic URL validation
            const urlPattern = /^(https?:\/\/)?([\da-z.-]+)\.([a-z.]{2,6})([/\w .-]*)*\/?$/;
            if (!urlPattern.test(rec.url)) {
                errors.push(`Recommendation ${index + 1} has invalid URL format: ${rec.url}`);
            }
        }
        
        if (rec.credibilityScore === undefined || rec.credibilityScore < 1 || rec.credibilityScore > 10) {
            errors.push(`Recommendation ${index + 1} has invalid credibility score: ${rec.credibilityScore}`);
        }
        
        if (!rec.relevantTopics || !Array.isArray(rec.relevantTopics) || rec.relevantTopics.length === 0) {
            errors.push(`Recommendation ${index + 1} missing relevant topics`);
        }
    });
    
    return {
        valid: errors.length === 0,
        message: errors.length === 0 ? "All educational recommendations are valid" : errors.join("; ")
    };
}

async function analyzeVideo(videoId, category, duration) {
    try {
        console.log(`\n======================================`);
        console.log(`Analyzing ${category} video (${duration}): ${videoId}`);
        console.log(`======================================`);
        console.log(`${new Date().toISOString()} - Analysis started`);
        
        const startTime = Date.now();
        
        const analysisResult = await analyzeYoutubeVideo(videoId);
        console.log(`${new Date().toISOString()} - Analysis computation completed`);
        
        if (!analysisResult) {
            throw new Error('Analysis returned null or undefined result');
        }
        
        // Validate educational recommendations
        const educationalValidation = validateEducationalRecommendations(analysisResult.educationalRecommendations);
        console.log(`Educational recommendations validation: ${educationalValidation.valid ? 'PASSED' : 'FAILED'}`);
        if (!educationalValidation.valid) {
            console.log(`- Validation message: ${educationalValidation.message}`);
        } else {
            console.log(`- Found ${analysisResult.educationalRecommendations.length} valid educational recommendations`);
        }
        
        console.log(`${new Date().toISOString()} - Saving analysis results to file...`);
        const filePath = saveResultsToFile(analysisResult, videoId, category);
        console.log(`${new Date().toISOString()} - Results successfully saved to file`);
        
        const endTime = Date.now();
        const processingTime = (endTime - startTime) / 1000;
        
        const claimCount = analysisResult.timestamps ? analysisResult.timestamps.length : 0;
        const topicCount = analysisResult.topics ? analysisResult.topics.count : 0;
        const recCount = analysisResult.educationalRecommendations ? analysisResult.educationalRecommendations.length : 0;
        
        console.log(`\nAnalysis complete for ${videoId}!`);
        console.log(`- Processing time: ${processingTime.toFixed(2)} seconds`);
        console.log(`- Claims identified: ${claimCount}`);
        console.log(`- Topics identified: ${topicCount}`);
        console.log(`- Educational recommendations: ${recCount}`);
        console.log(`- Results saved to: ${filePath}`);
        
        if (!fs.existsSync(filePath)) {
            throw new Error(`Failed to verify saved file at ${filePath}`);
        }
        
        return {
            videoId,
            category,
            duration,
            processingTime,
            claimCount,
            topicCount,
            recCount,
            educationalValid: educationalValidation.valid,
            percentages: analysisResult.percentages,
            filePath,
            timestamp: new Date().toISOString(),
            success: true
        };
    } catch (error) {
        console.error(`Analysis failed for ${videoId}:`, error.message);
        console.error(`${new Date().toISOString()} - Error stack:`, error.stack);
        
        const errorLogDir = path.join(process.cwd(), 'analysis_results', 'errors');
        if (!fs.existsSync(errorLogDir)) {
            fs.mkdirSync(errorLogDir, { recursive: true });
        }
        
        const errorLogPath = path.join(errorLogDir, `error_${videoId}_${new Date().toISOString().replace(/:/g, '-')}.log`);
        fs.writeFileSync(errorLogPath, JSON.stringify({
            videoId,
            category,
            duration,
            error: error.message,
            stack: error.stack,
            timestamp: new Date().toISOString()
        }, null, 2), 'utf8');
        
        console.error(`Error details saved to: ${errorLogPath}`);
        
        return {
            videoId,
            category,
            duration,
            error: error.message,
            errorLogPath,
            timestamp: new Date().toISOString(),
            success: false
        };
    }
}

async function runBatchTests() {
    const summary = {
        total: 0,
        successful: 0,
        failed: 0,
        results: []
    };
    
    // Test short videos 
    console.log('\n=== TESTING SHORT VIDEOS ===');
    for (const video of TEST_VIDEOS.short) {
        try {
            const result = await analyzeVideo(video.id, 'short', video.duration);
            summary.total++;
            summary.results.push(result);
            result.success ? summary.successful++ : summary.failed++;
            
            console.log(`\nCompleted analysis of short video ${video.id} (${video.duration})`);
            console.log('Waiting 10 seconds before proceeding to next video...');
            await new Promise(resolve => setTimeout(resolve, 10000));
        } catch (error) {
            console.error(`Fatal error analyzing video ${video.id}:`, error);
            summary.total++;
            summary.failed++;
            summary.results.push({
                videoId: video.id,
                category: 'short',
                duration: video.duration,
                error: error.message,
                success: false
            });
        }
    }

    console.log('\n=== TESTING LONG VIDEOS ===');
    for (const video of TEST_VIDEOS.long) {
        try {
            const result = await analyzeVideo(video.id, 'long', video.duration);
            summary.total++;
            summary.results.push(result);
            result.success ? summary.successful++ : summary.failed++;
            
            console.log(`\nCompleted analysis of long video ${video.id} (${video.duration})`);
            console.log('Waiting 10 seconds before proceeding to next video...');
            await new Promise(resolve => setTimeout(resolve, 10000));
        } catch (error) {
            console.error(`Fatal error analyzing video ${video.id}:`, error);
            summary.total++;
            summary.failed++;
            summary.results.push({
                videoId: video.id,
                category: 'long',
                duration: video.duration,
                error: error.message,
                success: false
            });
        }
    }
    
    return summary;
}

async function main() {
    const startTime = Date.now();
    console.log('Starting batch video analysis test...');
    
    try {
        const summary = await runBatchTests();
        
        const endTime = Date.now();
        const totalTime = (endTime - startTime) / 1000 / 60;
        
        console.log('\n======================================');
        console.log('           TEST SUMMARY               ');
        console.log('======================================');
        console.log(`Total time: ${totalTime.toFixed(2)} minutes`);
        console.log(`Total videos tested: ${summary.total}`);
        console.log(`Successful analyses: ${summary.successful}`);
        console.log(`Failed analyses: ${summary.failed}`);
        
        const successfulResults = summary.results.filter(r => r.success);
        
        if (successfulResults.length > 0) {
            const avgProcessingTime = successfulResults.reduce((sum, r) => sum + r.processingTime, 0) / successfulResults.length;
            const avgClaimCount = successfulResults.reduce((sum, r) => sum + r.claimCount, 0) / successfulResults.length;
            const avgTopicCount = successfulResults.reduce((sum, r) => sum + r.topicCount, 0) / successfulResults.length;
            const avgRecCount = successfulResults.reduce((sum, r) => sum + (r.recCount || 0), 0) / successfulResults.length;
            const validEducationalCount = successfulResults.filter(r => r.educationalValid).length;
            
            console.log(`\nAverages for successful analyses:`);
            console.log(`- Avg. processing time: ${avgProcessingTime.toFixed(2)} seconds`);
            console.log(`- Avg. claims identified: ${avgClaimCount.toFixed(2)}`);
            console.log(`- Avg. topics identified: ${avgTopicCount.toFixed(2)}`);
            console.log(`- Avg. educational recommendations: ${avgRecCount.toFixed(2)}`);
            console.log(`- Valid educational recommendations: ${validEducationalCount}/${successfulResults.length} (${(validEducationalCount/successfulResults.length*100).toFixed(1)}%)`);
        }
        
        const timestamp = new Date().toISOString().replace(/:/g, '-').replace(/\./g, '-');
        const summaryFilePath = path.join(process.cwd(), 'analysis_results', `test_summary_${timestamp}.json`);
        fs.writeFileSync(summaryFilePath, JSON.stringify(summary, null, 2), 'utf8');
        console.log(`\nDetailed summary saved to: ${summaryFilePath}`);
        
        if (successfulResults.length > 0) {
            const longResults = successfulResults.filter(r => r.category === 'long');
            const shortResults = successfulResults.filter(r => r.category === 'short');
            
            if (longResults.length > 0 && shortResults.length > 0) {
                const longAvgTime = longResults.reduce((sum, r) => sum + r.processingTime, 0) / longResults.length;
                const shortAvgTime = shortResults.reduce((sum, r) => sum + r.processingTime, 0) / shortResults.length;
                const longAvgClaims = longResults.reduce((sum, r) => sum + r.claimCount, 0) / longResults.length;
                const shortAvgClaims = shortResults.reduce((sum, r) => sum + r.claimCount, 0) / shortResults.length;
                const longAvgRecs = longResults.reduce((sum, r) => sum + (r.recCount || 0), 0) / longResults.length;
                const shortAvgRecs = shortResults.reduce((sum, r) => sum + (r.recCount || 0), 0) / shortResults.length;
                
                console.log('\nLong vs Short Video Comparison:');
                console.log(`- Long videos avg. processing time: ${longAvgTime.toFixed(2)} seconds`);
                console.log(`- Short videos avg. processing time: ${shortAvgTime.toFixed(2)} seconds`);
                console.log(`- Long videos avg. claims: ${longAvgClaims.toFixed(2)}`);
                console.log(`- Short videos avg. claims: ${shortAvgClaims.toFixed(2)}`);
                console.log(`- Long videos avg. recommendations: ${longAvgRecs.toFixed(2)}`);
                console.log(`- Short videos avg. recommendations: ${shortAvgRecs.toFixed(2)}`);
                
                console.log('\nProcessing efficiency:');
                longResults.forEach(r => {
                    const durationMinutes = parseInt(r.duration.replace('min', ''));
                    console.log(`- ${r.videoId} (${r.duration}): ${(r.processingTime / 60 / durationMinutes).toFixed(2)} processing minutes per video minute`);
                });
                shortResults.forEach(r => {
                    const durationMinutes = parseInt(r.duration.replace('min', ''));
                    console.log(`- ${r.videoId} (${r.duration}): ${(r.processingTime / 60 / durationMinutes).toFixed(2)} processing minutes per video minute`);
                });
            }
        }
        
        console.log('\nBatch test completed successfully!');
        
        process.exit(summary.failed > 0 ? 1 : 0);
    } catch (error) {
        console.error('Batch test failed with error:', error);
        process.exit(1);
    }
}

main();