import { GoogleGenerativeAI } from "@google/generative-ai";

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);

const model = genAI.getGenerativeModel({ model: "gemini-1.5-pro" });

function safelyParseJSON(text) {
    try {
        let jsonMatch = text.match(/```json\n([\s\S]*?)\n```/) ||
            text.match(/```\n([\s\S]*?)\n```/) ||
            text.match(/{[\s\S]*?}/);

        let jsonText = jsonMatch ? (jsonMatch[1] || jsonMatch[0]) : text;

        try {
            return JSON.parse(jsonText);
        } catch (initialError) {
            console.log("Initial JSON parsing failed, attempting to fix common issues...");

            jsonText = jsonText.replace(/'([^']*)'(?=\s*:)/g, '"$1"');

            jsonText = jsonText.replace(/([{,]\s*)(\w+)(\s*:)/g, '$1"$2"$3');

            jsonText = jsonText.replace(/,(\s*[}\]])/g, '$1');

            try {
                return JSON.parse(jsonText);
            } catch (fixError) {
                console.log("Failed to fix JSON, creating fallback object");

                return {
                    error: "Failed to parse JSON response",
                    rawResponse: text
                };
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
        
        Please provide a detailed analysis in the following JSON format:
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

export default {
    analyzeContent
};