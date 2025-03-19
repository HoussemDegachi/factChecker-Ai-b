// Ai/index.js
import { GoogleGenerativeAI } from "@google/generative-ai";
import { getYoutubeTranscript } from './transcriptService.js';
import { getYtMetaData } from '../utils/funcs.js';

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);

const model = genAI.getGenerativeModel({ 
    model: "gemini-1.5-pro",
    generationConfig: {
        temperature: 0.2,  // Lower temperature for more factual responses
        maxOutputTokens: 8192  // Increase token limit if available
    }
});

function safelyParseJSON(text) {
    try {
        const jsonBlockMatch = text.match(/```(?:json)?\s*\n([\s\S]*?)\n\s*```/);
        
        let jsonText = jsonBlockMatch ? jsonBlockMatch[1] : text;
        
        try {
            console.log("Attempting to parse JSON directly");
            return JSON.parse(jsonText);
        } catch (initialError) {
            console.log("Initial JSON parsing failed, attempting to fix common issues...");
            
            
            jsonText = jsonText.replace(/'([^']*)'(?=\s*:)/g, '"$1"');
            jsonText = jsonText.replace(/:\s*'([^']*)'/g, ': "$1"');
            
            jsonText = jsonText.replace(/([{,]\s*)(\w+)(\s*:)/g, '$1"$2"$3');
            
            jsonText = jsonText.replace(/,(\s*[}\]])/g, '$1');
            
            try {
                console.log("Attempting to parse fixed JSON");
                const parsedObject = JSON.parse(jsonText);
                console.log("JSON successfully parsed after fixes");
                return parsedObject;
            } catch (fixError) {
                console.log("Fixed JSON parsing failed, trying line-by-line reconstruction");
                
                try {
                    const stripped = jsonText.replace(/\s+/g, ' ').trim();
                    
                    let normalized = stripped.replace(/'/g, '"');
                    
                    normalized = normalized.replace(/([{,]\s*)([a-zA-Z0-9_]+)(\s*:)/g, '$1"$2"$3');
                    
                    normalized = normalized.replace(/,\s*([}\]])/g, '$1');
                    
                    console.log("Attempting to parse normalized JSON");
                    return JSON.parse(normalized);
                } catch (reconstructError) {
                    console.log("All JSON parsing attempts failed, creating fallback object");
                    
                    return {
                        error: "Failed to parse JSON response",
                        rawResponse: text
                    };
                }
            }
        }
    } catch (error) {
        console.error("Error in safelyParseJSON:", error);
        return {
            error: "Error parsing JSON response",
            rawResponse: text
        };
    }
}

export async function analyzeContent(title, content, originalId) {
    try {
        const prompt = `Analyze the following content for misinformation:
        Title: ${title}
        Content: ${content}
        
        Please provide a detailed analysis of video AND make SURE you go through the entire video and give a detailed analysis in the following JSON format:
        {
        "conclusion": "Brief overall conclusion about the content's accuracy",
        "percentages": {
            "overall": 0-100 (overall accuracy score),
            "falseInformation": 0-100 (percentage of false information),
            "verifiedInformation": 0-100 (percentage of verified information),
            "misleadingInformation": 0-100 (percentage of misleading information)
        },
        "generalTopic": "The general topic of the content",
        "topics": {
            "categories": [
            {
                "title": "Topic category name",
                "count": Number of mentions
            }
            ],
            "count": Total number of topics identified
        },
        "timestamps": [
            {
            "timestampInS": approximate timestamp in seconds use null in case you are talking about the title,
            "timestampInStr": "time stamp in the format hh:mm:ss where hh is not mentioned if it is 00, you are allowed to say title instead of hh:mm:ss in case you are analysing the title",
            "label": "Correct" or "False" or "Misleading",
            "claim": "The specific claim made",
            "explanation": "Explanation of why this is correct/false/misleading",
            "source": "Source that verifies or contradicts this claim",
            "validation": {
                "isValid": true/false,
                "confidence": 0-100 (confidence score),
                "explanation": "Detailed explanation with reasoning",
                "references": [
                    {
                        "title": "Title of the reference",
                        "url": "URL if applicable",
                        "author": "Author name if applicable",
                        "publisher": "Publisher name if applicable",
                        "publicationDate": "Date of publication if applicable",
                        "credibilityScore": 1-10 (credibility rating where 10 is most credible)
                    }
                ]
            }
            }
        ]
        }
        

        IMPORTANT: 
        1. Ensure you output valid JSON. All property names must be in double quotes. 
        2. All string values must be in double quotes. Do not use single quotes in the JSON structure.
        3. Ensure all percentages add up to 100% and provide specific explanations for each identified issue.
        4. For each claim, include a full validation with references from trustworthy sources only.
        5. Only include highly trustworthy references from reputable sources.
        6. For each reference, assign a credibility score from 1-10 based on source reputation, author credentials, recency, and factual accuracy.
        7. References should be specific (not just "Wikipedia" but the specific article).
        8. Prioritize academic sources, government publications, peer-reviewed research, and established news organizations known for factual reporting.
        9. avoid null values unless it is mentioned to do so
        10. dates must be provided in a way that makes them castable by Mongodb
        11. All fields are required
        12. You must at least mention one reference, the only exception is the title It can have no reference
        13. ensure that you are using correct types and values
        14. you must analyze all claims provided by the video
        15: the alphanumerique value provided after content is the youtube id of the video that should be analyzed
        16. The title can be only analyzed once
        17. IMPORTANT: Be thorough in analyzing all important claims in the video. For videos longer than 5 minutes, aim to identify at least 8-10 distinct claims with timestamps. For shorter videos, aim to identify at least 5-6 claims. Ensure you capture both correct and incorrect claims.
        18. Make sure to analyze claims throughout the entire duration of the video, not just from the beginning.
        19. Evenly distribute your analysis across the video timeline.
        20. Make sure that timestamps match what is in the video
            a. Timestamps's claim matches what was said or displayed
            b. Timestamp's timestampInS matches the correct time it was said or displayed in seconds
            c. Timestamp's timestampInS cannot be longer then the video
        
        DO NOT USE CODE BLOCKS AROUND THE JSON. RETURN ONLY THE CLEAN JSON OBJECT WITHOUT ANY FORMATTING OR CODE BLOCKS.
        `;

        const result = await model.generateContent(prompt);
        const response = await result.response;

        const text = response.text();
        let analysisData = safelyParseJSON(text);

        analysisData.originalId = originalId;

        return analysisData;

    } catch (error) {
        console.error('Error analyzing content with Gemini: ', error);
        throw new Error('Failed to analyze content: ' + error.message);
    }
}

export async function analyzeYoutubeVideo(videoId) {
    try {
        const metadata = await getYtMetaData(videoId);
        const title = metadata.title || `YouTube video ${videoId}`;
        
        console.log('Length seconds:', metadata.lengthSeconds);
        console.log('Parsed duration in seconds:', parseInt(metadata.lengthSeconds || "0"));
        
        const transcriptResult = await getYoutubeTranscript(videoId);
        const { text: transcript, isRealTranscript } = transcriptResult;
        
        const durationInSeconds = parseInt(metadata.lengthSeconds || "0");
        
        console.log('Checking batch processing conditions:');
        console.log('- isRealTranscript:', isRealTranscript);
        console.log('- durationInSeconds > 300:', durationInSeconds > 300, `(${durationInSeconds} seconds)`);
        console.log('- transcript exists:', Boolean(transcript));
        console.log(`Video length (~ ${Math.floor(durationInSeconds / 60)} minutes).`);
        
        if (isRealTranscript && durationInSeconds > 300 && transcript) {
            console.log(`Processing long video (~ ${Math.floor(durationInSeconds / 60)} minutes) with transcript in batches...`);
            return analyzeLongVideoInBatches(title, videoId, transcript, durationInSeconds);
        }
        
        if (!isRealTranscript || !transcript) {
            console.log("No transcript available, analyzing video directly");
            return analyzeVideoWithoutTranscript(title, videoId);
        }
        
        console.log("Using normal transcript analysis");
        return analyzeContent(title, transcript, videoId);
        
    } catch (error) {
        console.error('Error in video analysis:', error);
        throw error;
    }
}

async function analyzeVideoWithoutTranscript(title, videoId) {
    try {
        const customPrompt = `Analyze this YouTube video for misinformation:
        Video ID: ${videoId}
        Title: ${title}
        
        NOTE: This video does not have a transcript available. Please analyze this video directly using your knowledge of the video content.
        
        IMPORTANT: You MUST follow the exact JSON schema format below, with proper timestamps, claims, and all required fields:
        {
        "conclusion": "Brief overall conclusion about the content's accuracy",
        "percentages": {
        "overall": 0-100 (overall accuracy score),
        "falseInformation": 0-100 (percentage of false information),
        "verifiedInformation": 0-100 (percentage of verified information),
        "misleadingInformation": 0-100 (percentage of misleading information)
        },
        "generalTopic": "The general topic of the content",
        "topics": {
        "categories": [
            {
            "title": "Topic category name",
            "count": Number of mentions
            }
        ],
        "count": Total number of topics identified
        },
        "timestamps": [
        {
            "timestampInS": timestamp in seconds (null for the title analysis),
            "timestampInStr": "time stamp in the format mm:ss or title",
            "label": "Correct" or "False" or "Misleading",
            "claim": "The specific claim made",
            "explanation": "Explanation of why this is correct/false/misleading",
            "source": "Source that verifies or contradicts this claim",
            "validation": {
            "isValid": true/false,
            "confidence": 0-100 (confidence score),
            "explanation": "Detailed explanation with reasoning",
            "references": [
                {
                "title": "Title of the reference",
                "url": "URL if applicable",
                "author": "Author name if applicable",
                "publisher": "Publisher name if applicable",
                "publicationDate": "Date of publication",
                "credibilityScore": 1-10 (credibility rating)
                }
            ]
            }
        }
        ]
    }
        
        IMPORTANT: Even though there is no transcript, YOU MUST provide a thorough analysis with at least 5-10 specific claims and timestamps throughout the video. Base the timestamps on your knowledge of where key claims appear in the video. Ensure all percentages add up to 100%.
        
        DO NOT USE CODE BLOCKS AROUND THE JSON. RETURN ONLY THE CLEAN JSON OBJECT WITHOUT ANY FORMATTING OR CODE BLOCKS.`;
        
        return analyzeContent(title, customPrompt, videoId);
    } catch (error) {
        console.error('Error in no-transcript analysis:', error);
        throw error;
    }
}

export async function analyzeLongVideoInBatches(title, videoId, transcript, durationInSeconds) {
    try {        
        const segments = splitTranscriptIntoSegments(transcript, durationInSeconds);
        
        const batchResults = [];
        
        for (let i = 0; i < segments.length; i++) {
            console.log(`Processing segment ${i+1}/${segments.length} (${segments[i].startTime}-${segments[i].endTime})...`);
            
            const segmentPrompt = `Analyze this segment (${segments[i].startTime}-${segments[i].endTime}) of the video "${title}":
            
            ${segments[i].text}
            
            Focus on identifying 3-5 distinct claims made during this time segment.
            
            DO NOT USE CODE BLOCKS AROUND THE JSON. RETURN ONLY THE CLEAN JSON OBJECT WITHOUT ANY FORMATTING OR CODE BLOCKS.`;
            
            const segmentResult = await analyzeContent(
                `${title} (Segment ${i+1})`, 
                segmentPrompt, 
                videoId
            );
            
            batchResults.push(segmentResult);
        }
        
        return combineAnalysisResults(title, batchResults, videoId);
    } catch (error) {
        console.error('Error in batch video analysis:', error);
        throw error;
    }
}

function splitTranscriptIntoSegments(transcript, totalDurationInSeconds) {
    const segmentDuration = 300;
    const numSegments = Math.ceil(totalDurationInSeconds / segmentDuration);
    
    const segments = [];
    const lines = transcript.split('\n');
    
    for (let i = 0; i < numSegments; i++) {
        const startTime = i * segmentDuration;
        const endTime = Math.min((i + 1) * segmentDuration, totalDurationInSeconds);
        
        const segmentLines = lines.filter(line => {
            const timestampMatch = line.match(/\[(\d+):(\d+)\]/);
            if (timestampMatch) {
                const minutes = parseInt(timestampMatch[1]);
                const seconds = parseInt(timestampMatch[2]);
                const totalSeconds = minutes * 60 + seconds;
                return totalSeconds >= startTime && totalSeconds < endTime;
            }
            return false;
        });
        
        segments.push({
            startTime: formatTime(startTime),
            endTime: formatTime(endTime),
            text: segmentLines.join('\n')
        });
    }
    
    return segments;
}

function combineAnalysisResults(title, batchResults, videoId) {
    const combinedResult = {
        conclusion: "",
        percentages: {
            overall: 0,
            falseInformation: 0,
            verifiedInformation: 0,
            misleadingInformation: 0
        },
        generalTopic: batchResults[0].generalTopic,
        topics: {
            categories: [],
            count: 0
        },
        timestamps: [],
        originalId: videoId
    };
    
    batchResults.forEach(batch => {
        if (batch.timestamps) {
            combinedResult.timestamps = [...combinedResult.timestamps, ...batch.timestamps];
        }
    });
    
    const topicMap = new Map();
    batchResults.forEach(batch => {
        if (batch.topics && batch.topics.categories) {
            batch.topics.categories.forEach(category => {
                if (topicMap.has(category.title)) {
                    topicMap.set(category.title, topicMap.get(category.title) + category.count);
                } else {
                    topicMap.set(category.title, category.count);
                }
            });
        }
    });
    
    combinedResult.topics.categories = Array.from(topicMap.entries()).map(([title, count]) => ({
        title,
        count
    }));
    
    combinedResult.topics.count = combinedResult.topics.categories.length;
    
    let totalBatches = batchResults.length;
    batchResults.forEach(batch => {
        combinedResult.percentages.overall += batch.percentages.overall / totalBatches;
        combinedResult.percentages.falseInformation += batch.percentages.falseInformation / totalBatches;
        combinedResult.percentages.verifiedInformation += batch.percentages.verifiedInformation / totalBatches;
        combinedResult.percentages.misleadingInformation += batch.percentages.misleadingInformation / totalBatches;
    });
    
    combinedResult.percentages.overall = Math.round(combinedResult.percentages.overall);
    combinedResult.percentages.falseInformation = Math.round(combinedResult.percentages.falseInformation);
    combinedResult.percentages.verifiedInformation = Math.round(combinedResult.percentages.verifiedInformation);
    combinedResult.percentages.misleadingInformation = Math.round(combinedResult.percentages.misleadingInformation);
    
    combinedResult.conclusion = `This video about ${combinedResult.generalTopic} contains ${combinedResult.timestamps.length} notable claims. Overall, it is ${combinedResult.percentages.overall}% accurate with ${combinedResult.percentages.falseInformation}% false information and ${combinedResult.percentages.misleadingInformation}% misleading content.`;
    
    return combinedResult;
}

function formatTime(seconds) {
    const minutes = Math.floor(seconds / 60);
    const remainingSeconds = seconds % 60;
    return `${minutes.toString().padStart(2, '0')}:${remainingSeconds.toString().padStart(2, '0')}`;
}

export default {
    analyzeContent,
    analyzeYoutubeVideo,
    analyzeLongVideoInBatches
};