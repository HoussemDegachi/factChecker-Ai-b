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

// Analyze content for misinformation
export async function analyzeContent(title, content, originalId) 
{
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
            "timestampInS": approximate timestamp in seconds if applicable,
            "timestampInStr": "human readable timestamp or location reference",
            "label": "Correct" or "False" or "Misleading",
            "claim": "The specific claim made",
            "explanation": "Explanation of why this is correct/false/misleading",
            "source": "Source that verifies or contradicts this claim"
            }
        ]
        }
        
        IMPORTANT: Ensure you output valid JSON. All property names must be in double quotes. 
        All string values must be in double quotes. Do not use single quotes in the JSON structure.
        Ensure all percentages add up to 100% and provide specific explanations for each identified issue.
    `;

    const result = await model.generateContent(prompt);
    const response = await result.response;

    // parse the JSON from the response text
    const text = response.text();
    
    
    let analysisData = safelyParseJSON(text);
    
    analysisData.originalId = originalId;
    analysisData.title = title;

    return analysisData;

    } catch (error) {
        console.error('Error analyzing content with Gemini: ', error);
        throw new Error('Failed to analyze content: ' + error.message);    
    }
}

// Validate a specific claim against reliable sources
export async function validateClaim(claim)
{
    try {
        const prompt = `
        Validate the following claim against reliable knowledge:
        "${claim}"
        
        Please provide an analysis in the following JSON format:
        {
        "isValid": true/false,
        "confidence": 0-100 (confidence score),
        "explanation": "Detailed explanation with reasoning",
        "possibleSources": ["Suggested reliable sources to verify this information"]
        }
        
        IMPORTANT: Ensure you output valid JSON. All property names must be in double quotes. 
        All string values must be in double quotes. Do not use single quotes in the JSON structure.
        `;

        const result = await model.generateContent(prompt);
        const response = await result.response;

        const text = response.text();
        
        return safelyParseJSON(text);
        
    } catch (error) 
    {
        console.error('Error validating claim with Gemini:', error);
        throw new Error('Failed to validate claim: ' + error.message);
    }
}

export default {
    analyzeContent,
    validateClaim
};