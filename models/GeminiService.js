import { GoogleGenerativeAI } from "@google/generative-ai";

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);

const model = genAI.getGenerativeModel({ model: "gemini-pro" });

// Analyze content for misinfomation
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
            "FalseInfromation": 0-100 (percentage of false information),
            "verifiedInformation": 0-100 (percentage of verified information),
            "missleadingInformation": 0-100 (percentage of misleading information)
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
            "timestempInStr": "human readable timestamp or location reference",
            "label": "Correct" or "False" or "Missleading",
            "claim": "The specific claim made",
            "explanation": "Explanation of why this is correct/false/misleading"
            }
        ]
        }
        Ensure all percentages add up to 100% and provide specific explanations for each identified issue.
    `;

    const result = await model.generateContent(prompt);
    const response = await result.response;

    // parse the JSOn from the response text
    const text = response.text();

    // Extract JSON from the response (in case Gemini wraps it in markdown)
    let jsonMatch = text.match(/```json\n([\s\S]*?)\n```/) || 
                    text.match(/```\n([\s\S]*?)\n```/) ||
                    text.match(/{[\s\S]*}/);
    
    let analysisData;
    if (jsonMatch)
    {
        analysisData = JSON.parse(jsonMatch[1] || jsonMatch[0]);
    } 
    else
    {
        analysisData = JSON.parse();
    }

    analysisData.originalId = originalId;
    analysisData.title = title;

    return analysisData;

    } catch (error) {
        console.error('Error analyzing content with Gemini: ', error);
        throw new Error('Failed to analyse')    
    }
}

// Validate a specific clain against reliable sources
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
        `;

        const result = await model.generateContent(prompt);
        const response = await result.response;

        const text = response.text();

        // Extract JSON from the response
        let jsonMatch = text.match(/```json\n([\s\S]*?)\n```/) || 
                        text.match(/```\n([\s\S]*?)\n```/) ||
                        text.match(/{[\s\S]*}/);
        
        if (jsonMatch) {
            return JSON.parse(jsonMatch[1] || jsonMatch[0]);
        } else {
            return JSON.parse(text);
        }
        } catch (error) 
        {
            console.error('Error validating claim with Gemini:', error);
            throw new Error('Failed to validate claim');
        }
    }
    export default {
    analyzeContent,
    validateClaim
};