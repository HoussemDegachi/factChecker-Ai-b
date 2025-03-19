// Ai/index.js
import { GoogleGenerativeAI } from "@google/generative-ai";
import { getYoutubeTranscript } from './transcriptService.js';
import { getYtMetaData } from '../utils/funcs.js';

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);

const model = genAI.getGenerativeModel({ 
    model: "gemini-2.0-flash",
    generationConfig: {
        temperature: 0.2,  // Lower temperature for more factual responses
        maxOutputTokens: 8192  // Increase token limit if available
    }
});

function validateAndFixTopicsCount(analysisData) {
    if (!analysisData) return analysisData;

    if (analysisData.topics && Array.isArray(analysisData.topics.categories)) {
        analysisData.topics.count = analysisData.topics.categories.length;
    }

    if (analysisData.percentages) {
        const { falseInformation, verifiedInformation, misleadingInformation } = analysisData.percentages;
        const sum = (falseInformation || 0) + (verifiedInformation || 0) + (misleadingInformation || 0);
        
        if (sum !== 100 && sum > 0) {
        const adjustment = 100 - sum;
        
        const categories = ['falseInformation', 'verifiedInformation', 'misleadingInformation'];
        let largestCategory = categories[0];
        
        categories.forEach(category => {
            if (analysisData.percentages[category] > analysisData.percentages[largestCategory]) {
            largestCategory = category;
            }
        });
        
        analysisData.percentages[largestCategory] += adjustment;
        
        analysisData.percentages.falseInformation = Math.round(analysisData.percentages.falseInformation);
        analysisData.percentages.verifiedInformation = Math.round(analysisData.percentages.verifiedInformation);
        analysisData.percentages.misleadingInformation = Math.round(analysisData.percentages.misleadingInformation);
        }
    }

    return analysisData;
}

function safelyParseJSON(text) {
        try {
        const jsonBlockMatch = text.match(/```(?:json)?\s*\n([\s\S]*?)\n\s*```/);
        
        let jsonText = jsonBlockMatch ? jsonBlockMatch[1] : text;
        
        try {
            console.log("Attempting to parse JSON directly");
            const result = JSON.parse(jsonText);
            return validateAndFixTopicsCount(result);
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
            return validateAndFixTopicsCount(parsedObject);
            } catch (fixError) {
            console.log("Fixed JSON parsing failed, trying line-by-line reconstruction");
            
            try {
                const stripped = jsonText.replace(/\s+/g, ' ').trim();
                
                let normalized = stripped.replace(/'/g, '"');
                
                normalized = normalized.replace(/([{,]\s*)([a-zA-Z0-9_]+)(\s*:)/g, '$1"$2"$3');
                
                normalized = normalized.replace(/,\s*([}\]])/g, '$1');
                
                console.log("Attempting to parse normalized JSON");
                const parsedResult = JSON.parse(normalized);
                return validateAndFixTopicsCount(parsedResult);
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

export async function printTranscriptWithTimestamps(videoId) {
    try {
        const transcriptResult = await getYoutubeTranscript(videoId);
        if (!transcriptResult || !transcriptResult.text || !transcriptResult.isRealTranscript) {
            console.log('No transcript available for this video');
            return;
        }
        
        console.log('='.repeat(50));
        console.log(`TRANSCRIPT FOR VIDEO ${videoId}`);
        console.log('='.repeat(50));
        
        const lines = transcriptResult.text.split('\n');
        
        for (const line of lines) {
            if (line.trim()) {
            console.log(line);
            }
        }
        
        console.log('='.repeat(50));
        console.log('END OF TRANSCRIPT');
        console.log('='.repeat(50));
        
        const timestamps = [];
        const timestampRegex = /\[(\d{2}):(\d{2})\]/;
        
        for (const line of lines) {
            const match = line.match(timestampRegex);
            if (match) {
            const minutes = parseInt(match[1], 10);
            const seconds = parseInt(match[2], 10);
            const timeInSeconds = minutes * 60 + seconds;
            timestamps.push({
                timestamp: `${match[1]}:${match[2]}`,
                seconds: timeInSeconds,
                text: line.replace(timestampRegex, '').trim()
            });
            }
        }
        
        console.log('\nTIMESTAMP SUMMARY:');
        console.log('-'.repeat(50));
        
        for (const entry of timestamps) {
            console.log(`${entry.timestamp} (${entry.seconds}s): ${entry.text.substring(0, 50)}${entry.text.length > 50 ? '...' : ''}`);
        }
        
        return {
            fullTranscript: transcriptResult.text,
            timestamps: timestamps
        };
        
        } catch (error) {
            console.error('Error printing transcript:', error);
    }
}

export async function validateTimestamps(analysisData, videoId) {
    try {
        const transcriptResult = await getYoutubeTranscript(videoId);
        
        if (!transcriptResult || !transcriptResult.text || !transcriptResult.isRealTranscript) {
            console.log("No usable transcript available for timestamp validation");
            return analysisData;
        }
        
        const segments = extractSegmentsFromTranscript(transcriptResult.text);
        
        if (!segments || segments.length === 0) {
            console.log("Could not extract segments from transcript");
            return analysisData;
        }
        
        console.log(`Extracted ${segments.length} timestamped segments from transcript`);
        
        if (analysisData.timestamps && analysisData.timestamps.length) {
            let correctionCount = 0;
            
            for (let i = 0; i < analysisData.timestamps.length; i++) {
                const claim = analysisData.timestamps[i];
                
                if (claim.timestampInStr === "title" || claim.timestampInS === null) {
                    continue;
                }
                
                const correctedTimestamp = findActualTimestampForClaim(
                    claim.claim,
                    segments,
                    claim.timestampInS
                );
                
                if (correctedTimestamp && 
                    Math.abs(correctedTimestamp.seconds - claim.timestampInS) > 10) { 
                    
                    console.log(`Correcting timestamp for claim: "${claim.claim.substring(0, 50)}..."`);
                    console.log(`Original: ${claim.timestampInS}s (${claim.timestampInStr})`);
                    console.log(`Corrected: ${correctedTimestamp.seconds}s (${formatTimeFromSeconds(correctedTimestamp.seconds)})`);
                    
                    claim.timestampInS = correctedTimestamp.seconds;
                    claim.timestampInStr = formatTimeFromSeconds(correctedTimestamp.seconds);
                    correctionCount++;
                }
            }
            
            console.log(`Timestamp validation complete. Corrected ${correctionCount} timestamps.`);
        }
        
        return analysisData;
    } catch (error) {
        console.error('Error validating timestamps:', error);
        return analysisData; 
    }
}

function extractSegmentsFromTranscript(transcriptText) {
    if (!transcriptText) return [];
    
    const segments = [];
    const lines = transcriptText.split('\n');
    
    const timestampRegex = /\[(\d{2}):(\d{2})\]\s*(.*)/;
    
    for (let i = 0; i < lines.length; i++) {
        const line = lines[i].trim();
        if (!line) continue;
        
        const match = line.match(timestampRegex);
        
        if (match) {
            const minutes = parseInt(match[1], 10);
            const seconds = parseInt(match[2], 10);
            const timeInSeconds = minutes * 60 + seconds;
            const text = match[3] || "";
            
            segments.push({
                start: timeInSeconds,
                end: timeInSeconds + 10, 
                text: text,
                searchText: text.toLowerCase()
            });
        }
    }
    
    for (let i = 0; i < segments.length - 1; i++) {
        segments[i].end = segments[i + 1].start;
    }
    
    return segments;
}

function formatTimeFromSeconds(totalSeconds) {
    const minutes = Math.floor(totalSeconds / 60);
    const seconds = totalSeconds % 60;
    return `${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
}

function createTranscriptTimeMap(transcript, timestamps) {
    const segments = [];
    
    for (let i = 0; i < timestamps.length; i++) {
        const start = timestamps[i].time;
        const end = (i < timestamps.length - 1) ? timestamps[i + 1].time : start + 10;
        const text = timestamps[i].text;
        
        segments.push({
            start,
            end,
            text,
            searchText: text.toLowerCase()
        });
    }
    
    return segments;
}

function findActualTimestampForClaim(claim, segments, originalTimestamp) {
    if (!claim || typeof claim !== 'string' || !segments || segments.length === 0) return null;
    
    const searchTerms = extractKeywordsFromClaim(claim);
    
    const windowSize = 120; 
    const nearbyMatches = findExactMatches(
        claim, 
        segments, 
        Math.max(0, originalTimestamp - windowSize),
        originalTimestamp + windowSize
    );
    
    if (nearbyMatches.length > 0) {
        nearbyMatches.sort((a, b) => 
            Math.abs(a.start - originalTimestamp) - Math.abs(b.start - originalTimestamp)
        );
        
        return { 
            seconds: nearbyMatches[0].start,
            confidence: 'high'
        };
    }
    
    const nearbyKeywordMatches = findKeywordMatches(
        searchTerms, 
        segments,
        Math.max(0, originalTimestamp - windowSize),
        originalTimestamp + windowSize
    );
    
    if (nearbyKeywordMatches.length > 0) {
        nearbyKeywordMatches.sort((a, b) => {
            if (Math.abs(b.score - a.score) > 0.3) {
                return b.score - a.score;
            } else {
                return Math.abs(a.start - originalTimestamp) - Math.abs(b.start - originalTimestamp);
            }
        });
        
        return {
            seconds: nearbyKeywordMatches[0].start,
            confidence: nearbyKeywordMatches[0].score > 0.7 ? 'medium' : 'low'
        };
    }
    
    const allMatches = findExactMatches(claim, segments, 0, Infinity);
    if (allMatches.length > 0) {
        return {
            seconds: allMatches[0].start,
            confidence: 'medium'
        };
    }
    
    const allKeywordMatches = findKeywordMatches(searchTerms, segments, 0, Infinity);
    if (allKeywordMatches.length > 0) {
        allKeywordMatches.sort((a, b) => b.score - a.score);
        
        return {
            seconds: allKeywordMatches[0].start,
            confidence: 'low'
        };
    }
    
    return null;
}

function extractKeywordsFromClaim(claim) {
    const text = claim.toLowerCase();
    
    const stopWords = ['the', 'a', 'an', 'and', 'or', 'but', 'in', 'on', 'at', 'to', 'for', 'is', 'are', 'was', 'were',
                    'that', 'this', 'these', 'those', 'it', 'they', 'them', 'their', 'we', 'our', 'you', 'your', 'he', 'she', 'his', 'her'];
    
    const words = text
        .replace(/[.,\/#!$%\^&\*;:{}=\-_`~()]/g, '')
        .split(' ')
        .filter(word => word.length > 3 && !stopWords.includes(word));
    
    words.sort((a, b) => b.length - a.length);
    
    return words.slice(0, 5);
}

function findExactMatches(claim, segments, startTime, endTime) {
    if (!claim || !segments || segments.length === 0) return [];
    
    const cleanClaim = claim.toLowerCase().replace(/[.,\/#!$%\^&\*;:{}=\-_`~()]/g, ' ').replace(/\s+/g, ' ').trim();
    const matches = [];
    
    for (const segment of segments) {
        if (!segment || typeof segment.start !== 'number' || !segment.searchText) continue;
        
        if (segment.start >= startTime && segment.start <= endTime) {
            const cleanSegment = segment.searchText.replace(/[.,\/#!$%\^&\*;:{}=\-_`~()]/g, ' ').replace(/\s+/g, ' ').trim();
            
            const similarity = calculateSimilarity(cleanSegment, cleanClaim);
            
            if (cleanSegment.includes(cleanClaim) || 
                cleanClaim.includes(cleanSegment) ||
                similarity > 0.6) {
                
                matches.push({
                    ...segment,
                    score: similarity
                });
            }
        }
    }
    
    return matches.sort((a, b) => b.score - a.score);
}

function findKeywordMatches(keywords, segments, startTime = 0, endTime = Infinity) {
    if (!keywords || !keywords.length || !segments || segments.length === 0) return [];
    
    const matches = [];
    
    for (const segment of segments) {
        if (!segment || typeof segment.start !== 'number' || !segment.searchText) continue;
        if (segment.start < startTime || segment.start > endTime) continue;
        
        let matchScore = 0;
        let matchedKeywords = 0;
        
        for (const keyword of keywords) {
            if (segment.searchText.includes(keyword)) {
                matchedKeywords++;
                matchScore += (keyword.length / 4) / keywords.length;
            }
        }
        
        const minMatches = keywords.length <= 2 ? 1 : 2;
        
        if (matchedKeywords >= minMatches) {
            matches.push({
                start: segment.start,
                text: segment.text,
                score: matchScore
            });
        }
    }
    
    return matches;
}

function calculateSimilarity(text1, text2) {
    if (!text1 || !text2) return 0;
    
    const words1 = text1.split(' ').filter(w => w.length > 0);
    const words2 = text2.split(' ').filter(w => w.length > 0);
    
    const set1 = new Set(words1);
    const set2 = new Set(words2);
    
    const intersection = new Set([...set1].filter(x => set2.has(x)));
    
    if (set1.size === 0 || set2.size === 0) return 0;
    
    if (intersection.size === set1.size || intersection.size === set2.size) {
        return Math.min(1.0, (intersection.size / Math.min(set1.size, set2.size)) * 1.2);
    }
    
    return intersection.size / (set1.size + set2.size - intersection.size);
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
        ],
        "educationalRecommendations": [
            {
                "title": "Title of the educational resource",
                "description": "Brief description of what this resource offers and why it's helpful",
                "url": "A valid and working URL to the resource",
                "type": One of ["Article", "Video", "Course", "Book", "Research Paper", "Website"],
                "authorOrPublisher": "Name of the author or publishing organization",
                "credibilityScore": 1-10 (credibility rating where 10 is most credible),
                "relevantTopics": ["Topic1", "Topic2"] - list of topics this resource covers
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
        9. Avoid null values unless it is mentioned to do so
        10. Dates must be provided in a way that makes them castable by MongoDB
        11. All fields are required
        12. You must at least mention one reference, the only exception is the title It can have no reference
        13. Ensure that you are using correct types and values
        14. You must analyze all claims provided by the video
        15: The alphanumeric value provided after content is the youtube id of the video that should be analyzed
        16. The title can be only analyzed once
        17. IMPORTANT: Be thorough in analyzing all important claims in the video. For videos longer than 5 minutes, aim to identify at least 8-10 distinct claims with timestamps. For shorter videos, aim to identify at least 5-6 claims. Ensure you capture both correct and incorrect claims.
        18. Make sure to analyze claims throughout the entire duration of the video, not just from the beginning.
        19. Evenly distribute your analysis across the video timeline.
        20. EDUCATIONAL RECOMMENDATIONS: Provide 3-5 high-quality educational resources relevant to the video's main topics. These should be:
           a. From reputable sources (universities, established educational platforms, government agencies, etc.)
           b. Directly relevant to the video's main topics and claims
           c. Varied in format (mix of articles, videos, courses when possible)
           d. With working, valid URLs
           e. With accurate descriptions of what the learner will gain
           f. Resources should help viewers better understand the truth about any misleading claims in the video
        
        DO NOT USE CODE BLOCKS AROUND THE JSON. RETURN ONLY THE CLEAN JSON OBJECT WITHOUT ANY FORMATTING OR CODE BLOCKS.
        `;

        const result = await model.generateContent(prompt);
        const response = await result.response;

        const text = response.text();
        let analysisData = safelyParseJSON(text);

        analysisData.originalId = originalId;

        if (!analysisData.educationalRecommendations || !Array.isArray(analysisData.educationalRecommendations) || analysisData.educationalRecommendations.length === 0) {
            console.log("No educational recommendations found in initial analysis. Generating them separately...");
            const recommendations = await generateEducationalRecommendations(analysisData);
            analysisData.educationalRecommendations = recommendations;
        }

        if (analysisData.educationalRecommendations && Array.isArray(analysisData.educationalRecommendations)) {
            analysisData.educationalRecommendations = analysisData.educationalRecommendations.filter(rec => {
                return rec.url && /^(https?:\/\/)?([\da-z.-]+)\.([a-z.]{2,6})([/\w .-]*)*\/?$/.test(rec.url);
            });
        }

        return analysisData;

    } catch (error) {
        console.error('Error analyzing content with Gemini: ', error);
        throw new Error('Failed to analyze content: ' + error.message);
    }
}

async function generateEducationalRecommendations(analysisData) {
    try {
        const generalTopic = analysisData.generalTopic || '';
        
        const subtopics = analysisData.topics && analysisData.topics.categories 
            ? analysisData.topics.categories.map(cat => cat.title).join(', ')
            : '';
        
        const keyClaims = analysisData.timestamps 
            ? analysisData.timestamps
                .filter(ts => ts.label === 'False' || ts.label === 'Misleading')
                .map(ts => ts.claim)
                .join('; ')
            : '';
            
        const prompt = `Generate 3-5 high-quality educational recommendations for someone who wants to learn more about "${generalTopic}".
        
        Subtopics mentioned: ${subtopics}
        
        Key claims that need educational context: ${keyClaims}
        
        Return the recommendations in this JSON format:
        [
            {
                "title": "Title of the educational resource",
                "description": "Brief description of what this resource offers and why it's helpful",
                "url": "A valid and working URL to the resource",
                "type": One of ["Article", "Video", "Course", "Book", "Research Paper", "Website"],
                "authorOrPublisher": "Name of the author or publishing organization",
                "credibilityScore": 1-10 (credibility rating where 10 is most credible),
                "relevantTopics": ["Topic1", "Topic2"] - list of topics this resource covers
            }
        ]
        
        IMPORTANT:
        1. Only include REAL resources with VALID URLs from reputable sources
        2. Focus on educational resources from universities, established educational platforms, government agencies, etc.
        3. Include a mix of resource types (articles, videos, courses, etc.)
        4. Make sure URLs are correct and working
        5. Make descriptions specific about what the learner will gain
        6. Ensure high relevance to the topic and especially to correct misconceptions from the video
        7. Do not include resources that might spread misinformation
        8. Only assign high credibility scores (8-10) to resources from the most authoritative sources
        
        Return ONLY the JSON array with no explanatory text, markdown formatting, or code blocks.`;
        
        const result = await model.generateContent(prompt);
        const response = await result.response;
        const text = response.text();
        
        try {
            return JSON.parse(text);
        } catch (error) {
            const jsonMatch = text.match(/```(?:json)?\s*\n([\s\S]*?)\n\s*```/);
            if (jsonMatch && jsonMatch[1]) {
                return JSON.parse(jsonMatch[1]);
            }
            
            console.error('Failed to parse educational recommendations:', error);
            return createDefaultRecommendations(generalTopic);
        }
    } catch (error) {
        console.error('Error generating educational recommendations:', error);
        return createDefaultRecommendations(analysisData.generalTopic || '');
    }
}

function createDefaultRecommendations(topic) {
    const sanitizedTopic = topic.replace(/[^\w\s]/gi, '').trim() || 'General Knowledge';
    
    return [
        {
            title: `${sanitizedTopic} - Khan Academy`,
            description: `Khan Academy's comprehensive resources on ${sanitizedTopic} with structured lessons and practice exercises.`,
            url: "https://www.khanacademy.org/",
            type: "Course",
            authorOrPublisher: "Khan Academy",
            credibilityScore: 9,
            relevantTopics: [sanitizedTopic, "Education", "Online Learning"]
        },
        {
            title: `${sanitizedTopic} on MIT OpenCourseWare`,
            description: `Free course materials from MIT professors on topics related to ${sanitizedTopic}.`,
            url: "https://ocw.mit.edu/",
            type: "Course",
            authorOrPublisher: "Massachusetts Institute of Technology",
            credibilityScore: 10,
            relevantTopics: [sanitizedTopic, "Academic Research", "Higher Education"]
        },
        {
            title: `${sanitizedTopic} Research - Google Scholar`,
            description: `Find peer-reviewed papers and scholarly articles about ${sanitizedTopic} for in-depth understanding.`,
            url: "https://scholar.google.com/",
            type: "Research Paper",
            authorOrPublisher: "Google Scholar",
            credibilityScore: 8,
            relevantTopics: [sanitizedTopic, "Academic Research", "Scholarly Articles"]
        }
    ];
}

export async function analyzeYoutubeVideo(videoId) {
    try {
        const metadata = await getYtMetaData(videoId);
        const title = metadata.title || `YouTube video ${videoId}`;
        
        console.log('Length seconds:', metadata.lengthSeconds);
        console.log('Parsed duration in seconds:', parseInt(metadata.lengthSeconds || "0"));
        
        const transcriptResult = await getYoutubeTranscript(videoId);

        // const { text: transcript, isRealTranscript } = transcriptResult;
        const { text: transcript, isRealTranscript } = transcriptResult || { text: null, isRealTranscript: false };
        await printTranscriptWithTimestamps(videoId);

        const durationInSeconds = parseInt(metadata.lengthSeconds || "0");
        
        console.log('Checking batch processing conditions:');
        console.log('- isRealTranscript:', isRealTranscript);
        console.log('- durationInSeconds > 300:', durationInSeconds > 300, `(${durationInSeconds} seconds)`);
        console.log('- transcript exists:', Boolean(transcript));
        console.log(`Video length (~ ${Math.floor(durationInSeconds / 60)} minutes).`);
        
        let analysisData;

        if (isRealTranscript && durationInSeconds > 300 && transcript) {
            console.log(`Processing long video (~ ${Math.floor(durationInSeconds / 60)} minutes) with transcript in batches...`);
            analysisData = await analyzeLongVideoInBatches(title, videoId, transcript, durationInSeconds);
        }
        
        else if (!isRealTranscript || !transcript) {
            console.log("No transcript available, analyzing video directly");
            analysisData = await analyzeVideoWithoutTranscript(title, videoId);
        }
        else {
            console.log("Using normal transcript analysis");
            analysisData = await analyzeContent(title, transcript, videoId);
        }

        if (analysisData && analysisData.timestamps && analysisData.timestamps.length > 0) {
            try {
                if (transcriptResult && transcriptResult.isRealTranscript && transcriptResult.text) {
                    console.log("Running timestamp validation...");
                    analysisData = await validateTimestamps(analysisData, videoId);
                } else {
                    console.log("Skipping timestamp validation - no transcript available");
                }
            } catch (validationError) {
                console.error('Failed to validate timestamps, continuing with original analysis:', validationError);
            }
        }

        return analysisData;

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
        ],
        "educationalRecommendations": [
        {
            "title": "Title of the educational resource",
            "description": "Brief description of what this resource offers and why it's helpful",
            "url": "A valid and working URL to the resource",
            "type": One of ["Article", "Video", "Course", "Book", "Research Paper", "Website"],
            "authorOrPublisher": "Name of the author or publishing organization",
            "credibilityScore": 1-10 (credibility rating where 10 is most credible),
            "relevantTopics": ["Topic1", "Topic2"] - list of topics this resource covers
        }
        ]
    }
        
        IMPORTANT: Even though there is no transcript, YOU MUST provide a thorough analysis with at least 5-10 specific claims and timestamps throughout the video. Base the timestamps on your knowledge of where key claims appear in the video. Ensure all percentages add up to 100%. Include 3-5 high-quality educational recommendations from reputable sources that are directly relevant to the video's topic.
        
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
    // Initialize combined result structure
    const combinedResult = {
        conclusion: "",
        percentages: {
            overall: 0,
            falseInformation: 0,
            verifiedInformation: 0,
            misleadingInformation: 0
        },
        generalTopic: determineMainTopic(batchResults),
        topics: {
            categories: [],
            count: 0
        },
        timestamps: [],
        originalId: videoId,
        educationalRecommendations: []
    };
    
    // Merge timestamps from all batches
    combinedResult.timestamps = batchResults.flatMap(batch => 
        batch.timestamps ? batch.timestamps : []
    );
    
    // Handle duplicate title entries
    const titleEntries = combinedResult.timestamps.filter(
        entry => entry.timestampInStr === "title"
    );
    
    // If multiple title entries exist, keep only the most comprehensive one
    if (titleEntries.length > 1) {
        // Remove all title entries
        combinedResult.timestamps = combinedResult.timestamps.filter(
            entry => entry.timestampInStr !== "title"
        );
        
        // Find the most detailed title entry (one with longest explanation)
        const mostDetailedEntry = titleEntries.reduce((best, current) => {
            const bestLength = best.explanation ? best.explanation.length : 0;
            const currentLength = current.explanation ? current.explanation.length : 0;
            return currentLength > bestLength ? current : best;
        }, titleEntries[0]);
        
        // Add the most comprehensive title entry at the beginning
        combinedResult.timestamps.unshift(mostDetailedEntry);
    }
    
    // Process and combine topics
    const topicMap = new Map();
    
    batchResults.forEach(batch => {
        // Ensure each batch has correct topic count before combining
        batch = validateAndFixTopicsCount(batch);
        
        if (batch.topics && batch.topics.categories) {
            batch.topics.categories.forEach(category => {
                const count = Number(category.count) || 0;
                
                if (topicMap.has(category.title)) {
                    topicMap.set(category.title, topicMap.get(category.title) + count);
                } else {
                    topicMap.set(category.title, count);
                }
            });
        }
    });
    
    // Convert topic map to array and sort by count (descending)
    combinedResult.topics.categories = Array.from(topicMap.entries())
        .map(([title, count]) => ({ title, count }))
        .sort((a, b) => b.count - a.count);
    
    // Set the count as the number of unique categories
    combinedResult.topics.count = combinedResult.topics.categories.length;
    
    // Calculate combined percentages
    let totalBatches = batchResults.length;
    batchResults.forEach(batch => {
        if (batch.percentages) {
            combinedResult.percentages.overall += (batch.percentages.overall || 0) / totalBatches;
            combinedResult.percentages.falseInformation += (batch.percentages.falseInformation || 0) / totalBatches;
            combinedResult.percentages.verifiedInformation += (batch.percentages.verifiedInformation || 0) / totalBatches;
            combinedResult.percentages.misleadingInformation += (batch.percentages.misleadingInformation || 0) / totalBatches;
        }
    });
    
    // Round percentages
    combinedResult.percentages.overall = Math.round(combinedResult.percentages.overall);
    combinedResult.percentages.falseInformation = Math.round(combinedResult.percentages.falseInformation);
    combinedResult.percentages.verifiedInformation = Math.round(combinedResult.percentages.verifiedInformation);
    combinedResult.percentages.misleadingInformation = Math.round(combinedResult.percentages.misleadingInformation);
    
    // Ensure percentages (excluding overall) sum to 100%
    const sum = combinedResult.percentages.falseInformation + 
                combinedResult.percentages.verifiedInformation + 
                combinedResult.percentages.misleadingInformation;
    
    if (sum !== 100) {
        // Adjust the largest value to make the sum 100%
        const diff = 100 - sum;
        const categories = ['falseInformation', 'verifiedInformation', 'misleadingInformation'];
        const largestCategory = categories.reduce((a, b) => 
            combinedResult.percentages[a] > combinedResult.percentages[b] ? a : b
        );
        combinedResult.percentages[largestCategory] += diff;
    }
    
    // Combine educational recommendations from all segments
    // Use a map to deduplicate by URL
    const recommendationsMap = new Map();
    
    batchResults.forEach(batch => {
        if (batch.educationalRecommendations && Array.isArray(batch.educationalRecommendations)) {
            batch.educationalRecommendations.forEach(rec => {
                if (rec.url && !recommendationsMap.has(rec.url)) {
                    recommendationsMap.set(rec.url, rec);
                }
            });
        }
    });
    
    // Convert recommendationsMap to array and take the top 5 recommendations
    const allRecommendations = Array.from(recommendationsMap.values());
    // Sort by credibility score (descending)
    allRecommendations.sort((a, b) => (b.credibilityScore || 0) - (a.credibilityScore || 0));
    
    // Take up to 5 recommendations
    combinedResult.educationalRecommendations = allRecommendations.slice(0, 5);
    
    // If we have too few recommendations, generate more based on the combined topic
    if (combinedResult.educationalRecommendations.length < 3) {
        // Use the generateEducationalRecommendations function to get more recommendations
        generateEducationalRecommendations(combinedResult)
            .then(newRecommendations => {
                // Add unique new recommendations
                if (Array.isArray(newRecommendations)) {
                    newRecommendations.forEach(rec => {
                        if (rec.url && !recommendationsMap.has(rec.url)) {
                            recommendationsMap.set(rec.url, rec);
                            combinedResult.educationalRecommendations.push(rec);
                        }
                    });
                    
                    // Limit to 5 recommendations total
                    combinedResult.educationalRecommendations = combinedResult.educationalRecommendations.slice(0, 5);
                }
            });
    }
    
    // Generate a conclusion
    combinedResult.conclusion = generateConclusion(combinedResult);
    
    // Final validation to ensure everything is properly formatted
    return validateAndFixTopicsCount(combinedResult);
}

function validateEducationalRecommendations(recommendations) {
    if (!recommendations || !Array.isArray(recommendations)) {
        return [];
    }
    
    return recommendations.filter(rec => {
        if (!rec.title || !rec.description || !rec.url || !rec.type || !rec.authorOrPublisher) {
            return false;
        }
        
        const urlPattern = /^(https?:\/\/)?([\da-z.-]+)\.([a-z.]{2,6})([/\w .-]*)*\/?$/;
        if (!urlPattern.test(rec.url)) {
            return false;
        }
        
        if (typeof rec.credibilityScore !== 'number' || rec.credibilityScore < 1 || rec.credibilityScore > 10) {
            rec.credibilityScore = 7; 
        }
        
        if (!Array.isArray(rec.relevantTopics) || rec.relevantTopics.length === 0) {
            rec.relevantTopics = ["General Knowledge"];
        }
        
        return true;
    });
}

function determineMainTopic(batchResults) {
    const topicFrequency = new Map();
    
    batchResults.forEach(batch => {
        if (batch.generalTopic) {
            const count = topicFrequency.get(batch.generalTopic) || 0;
            topicFrequency.set(batch.generalTopic, count + 1);
        }
    });
    
    let maxCount = 0;
    let mainTopic = batchResults[0]?.generalTopic || "Unknown Topic";
    
    for (const [topic, count] of topicFrequency.entries()) {
        if (count > maxCount) {
            maxCount = count;
            mainTopic = topic;
        }
    }
    
    return mainTopic;
}


function prioritizeEducationalTopics(analysisData) {
    const topics = new Set([analysisData.generalTopic]);
    
    if (analysisData.topics && analysisData.topics.categories) {
        analysisData.topics.categories.forEach(category => {
            topics.add(category.title);
        });
    }
    
    if (analysisData.timestamps) {
        analysisData.timestamps
            .filter(ts => ts.label === 'False' || ts.label === 'Misleading')
            .forEach(ts => {
                const text = `${ts.claim} ${ts.explanation}`;
                const words = text.split(/\s+/);
                
                for (let i = 0; i < words.length - 1; i++) {
                    if (/^[A-Z]/.test(words[i]) && /^[A-Z]/.test(words[i+1])) {
                        topics.add(`${words[i]} ${words[i+1]}`);
                    }
                }
                
                words.forEach(word => {
                    if (/^[A-Z][a-z]{3,}$/.test(word)) {
                        topics.add(word);
                    }
                });
            });
    }
    
    return Array.from(topics);
}

function generateConclusion(result) {
    const claimCounts = {
        correct: 0,
        false: 0,
        misleading: 0
    };
    
    result.timestamps.forEach(item => {
        if (item.label === "Correct") claimCounts.correct++;
        else if (item.label === "False") claimCounts.false++;
        else if (item.label === "Misleading") claimCounts.misleading++;
    });
    
    const totalClaims = claimCounts.correct + claimCounts.false + claimCounts.misleading;
    
    return `This video about ${result.generalTopic} contains ${totalClaims} notable claims. Overall, it is ${result.percentages.overall}% accurate with ${result.percentages.falseInformation}% false information and ${result.percentages.misleadingInformation}% misleading content.`;
}

function formatTime(seconds) {
    const minutes = Math.floor(seconds / 60);
    const remainingSeconds = seconds % 60;
    return `${minutes.toString().padStart(2, '0')}:${remainingSeconds.toString().padStart(2, '0')}`;
}

export default {
    analyzeContent,
    analyzeYoutubeVideo,
    analyzeLongVideoInBatches,
    validateAndFixTopicsCount,
    combineAnalysisResults,
    generateEducationalRecommendations,
    validateEducationalRecommendations
};