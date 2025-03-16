// Ai/transcriptService.js
import axios from 'axios';
import { YoutubeTranscript } from 'youtube-transcript';
import { getYtMetaData } from '../utils/funcs.js';

export async function getYoutubeTranscript(videoId) {
    try {
        try {
            const transcript = await YoutubeTranscript.fetchTranscript(videoId);
            
            if (transcript && transcript.length > 0) {
                let formattedTranscript = '';
                transcript.forEach(entry => {
                    const minutes = Math.floor(entry.offset / 60000);
                    const seconds = Math.floor((entry.offset % 60000) / 1000);
                    const timestamp = `${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
                    
                    formattedTranscript += `[${timestamp}] ${entry.text}\n`;
                });
                
                console.log("Successfully retrieved transcript using youtube-transcript");
                return {
                    text: formattedTranscript,
                    isRealTranscript: true
                };
            }
        } catch (transcriptError) {
            console.error('Error fetching YouTube transcript:', transcriptError.message);
        }
        
        const metadata = await getYtMetaData(videoId);
        
        if (!metadata || !metadata.title) {
            throw new Error('Could not retrieve video metadata');
        }
        
        console.log("No transcript available, returning metadata only");
        return {
            text: null,
            isRealTranscript: false,
            metadata: {
                title: metadata.title,
                author: metadata.author,
                category: metadata.category,
                description: metadata.description
            }
        };
        
    } catch (error) {
        console.error('Error in transcript service:', error);
        
        console.log('Using last resort fallback, no transcript available');
        return {
            text: null,
            isRealTranscript: false,
            isMinimalData: true
        };
    }
}