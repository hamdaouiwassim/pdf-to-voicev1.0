/**
 * Free AI Service - Alternative to Google Gemini for QA
 * Uses Hugging Face Inference API and Microsoft Edge TTS
 */

/**
 * Generates text answer using Hugging Face Inference API (Free)
 * @param {string} question - User question
 * @param {string} systemPrompt - System instruction
 * @returns {Promise<string>} Generated answer
 */
async function generateTextWithHuggingFace(question, systemPrompt = null) {
    try {
        // Using a free model like mistralai/Mistral-7B-Instruct-v0.2 or meta-llama/Llama-2-7b-chat-hf
        // Note: You may need to sign up for free API token at https://huggingface.co/settings/tokens
        const model = process.env.HF_MODEL || "mistralai/Mistral-7B-Instruct-v0.2";
        const apiKey = process.env.HUGGINGFACE_API_KEY || "";
        
        const prompt = systemPrompt 
            ? `${systemPrompt}\n\nQuestion: ${question}\nAnswer:`
            : `Question: ${question}\nAnswer:`;

        const headers = {
            'Content-Type': 'application/json',
        };

        if (apiKey) {
            headers['Authorization'] = `Bearer ${apiKey}`;
        }

        const response = await fetch(
            `https://api-inference.huggingface.co/models/${model}`,
            {
                method: 'POST',
                headers: headers,
                body: JSON.stringify({
                    inputs: prompt,
                    parameters: {
                        max_new_tokens: 500,
                        temperature: 0.7,
                        return_full_text: false
                    }
                })
            }
        );

        if (!response.ok) {
            const error = await response.json();
            throw new Error(`Hugging Face API error: ${error.error || 'Unknown error'}`);
        }

        const result = await response.json();
        
        // Handle different response formats
        if (Array.isArray(result) && result[0]?.generated_text) {
            return result[0].generated_text.trim();
        } else if (result.generated_text) {
            return result.generated_text.trim();
        } else if (typeof result === 'string') {
            return result.trim();
        }

        throw new Error('Unexpected response format from Hugging Face');
    } catch (error) {
        console.error('[Hugging Face Error]:', error);
        throw error;
    }
}

/**
 * Generates text answer using Groq API (Free tier available)
 * @param {string} question - User question
 * @param {string} systemPrompt - System instruction
 * @returns {Promise<string>} Generated answer
 */
async function generateTextWithGroq(question, systemPrompt = null) {
    try {
        const apiKey = process.env.GROQ_API_KEY;
        if (!apiKey) {
            throw new Error('GROQ_API_KEY not set. Get free API key at https://console.groq.com');
        }

        const model = process.env.GROQ_MODEL || "llama-3.1-8b-instant";
        
        const messages = [];
        if (systemPrompt) {
            messages.push({ role: 'system', content: systemPrompt });
        }
        messages.push({ role: 'user', content: question });

        // Add timeout for slow connections (30 seconds)
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 30000);
        
        try {
            const response = await fetch('https://api.groq.com/openai/v1/chat/completions', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${apiKey}`
                },
                body: JSON.stringify({
                    model: model,
                    messages: messages,
                    max_tokens: 500,
                    temperature: 0.7
                }),
                signal: controller.signal
            });
            
            clearTimeout(timeoutId);

            if (!response.ok) {
                const error = await response.json();
                throw new Error(`Groq API error: ${error.error?.message || 'Unknown error'}`);
            }

            const result = await response.json();
            return result.choices[0]?.message?.content?.trim() || 'No response generated';
        } finally {
            clearTimeout(timeoutId);
        }
    } catch (error) {
        // Handle network/timeout errors
        if (error.name === 'AbortError' || error.code === 'ETIMEDOUT' || error.message.includes('fetch failed')) {
            throw new Error(
                'Groq API request timed out. This may be due to slow internet connection. ' +
                'Please check your network connection and try again.'
            );
        }
        console.error('[Groq Error]:', error);
        throw error;
    }
}

/**
 * Generates TTS audio using Microsoft Edge TTS (Free)
 * @param {string} text - Text to convert to speech
 * @param {string} voice - Voice name (default: 'fr-FR-DeniseNeural' for French, 'en-US-AriaNeural' for English)
 * @returns {Promise<Buffer>} Audio buffer (MP3 format)
 */
async function generateTTSWithEdge(text, voice = 'en-US-AriaNeural') {
    try {
        // Edge TTS is free and doesn't require API key
        // Get available voices: https://speech.platform.bing.com/consumer/speech/synthesize/readaloud/voices/list?trustedclienttoken=
        
        const ssml = `<speak version='1.0' xml:lang='en-US'><voice xml:lang='en-US' xml:gender='Female' name='${voice}'>${text}</voice></speak>`;
        
        // Use Edge TTS API (free, no authentication needed)
        const response = await fetch('https://speech.platform.bing.com/consumer/speech/synthesize/readaloud/voices/list?trustedclienttoken=', {
            method: 'GET'
        });

        // Alternative: Use edge-tts npm package approach
        // For now, we'll use a simple web-based TTS service
        
        // Using a free TTS service - ResponsiveVoice or Web Speech API fallback
        // Note: Edge TTS requires using the edge-tts npm package for better integration
        
        // For immediate implementation, using a free TTS API
        const ttsResponse = await fetch(`https://api.voicerss.org/?key=${process.env.VOICERSS_API_KEY || 'free'}&hl=en-us&src=${encodeURIComponent(text)}&f=48khz_16bit_mono`);
        
        if (!ttsResponse.ok) {
            // Fallback to browser-based synthesis
            throw new Error('TTS service unavailable');
        }

        const audioBuffer = await ttsResponse.arrayBuffer();
        return Buffer.from(audioBuffer);
    } catch (error) {
        console.error('[Edge TTS Error]:', error);
        // Fallback: return empty buffer or use alternative
        throw error;
    }
}

/**
 * Main function to generate QA answer using free services
 * Tries multiple free services as fallback
 */
async function generateFreeQAAnswer(question, systemPrompt = null) {
    const providers = process.env.FREE_AI_PROVIDER?.split(',') || ['groq', 'huggingface'];
    const errors = [];
    
    for (const provider of providers) {
        try {
            console.log(`[Free AI] Trying provider: ${provider}`);
            
            if (provider === 'groq') {
                return await generateTextWithGroq(question, systemPrompt);
            } else if (provider === 'huggingface') {
                return await generateTextWithHuggingFace(question, systemPrompt);
            }
        } catch (error) {
            const errorMsg = error.message || error.toString();
            console.warn(`[Free AI] Provider ${provider} failed:`, errorMsg);
            errors.push({ provider, error: errorMsg });
            
            // Check if it's a network error
            const isNetworkError = errorMsg.includes('timed out') || 
                                  errorMsg.includes('fetch failed') || 
                                  errorMsg.includes('ETIMEDOUT') ||
                                  errorMsg.includes('ENETUNREACH');
            
            if (isNetworkError) {
                console.warn(`[Free AI] Network issue detected for ${provider}. This may be due to slow internet connection.`);
            }
            continue;
        }
    }
    
    // Check if all failures were network-related
    const allNetworkErrors = errors.every(e => 
        e.error.includes('timed out') || 
        e.error.includes('fetch failed') || 
        e.error.includes('ETIMEDOUT') ||
        e.error.includes('ENETUNREACH')
    );
    
    if (allNetworkErrors) {
        throw new Error(
            'All free AI providers failed due to network connectivity issues. ' +
            'This may be caused by slow internet connection, firewall, or proxy settings. ' +
            'Please check your network connection and try again.'
        );
    }
    
    throw new Error('All free AI providers failed. Please check your API keys and network connection.');
}

module.exports = {
    generateTextWithHuggingFace,
    generateTextWithGroq,
    generateTTSWithEdge,
    generateFreeQAAnswer,
};

