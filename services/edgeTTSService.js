/**
 * Microsoft Edge TTS Service (Free)
 * Alternative to Google Gemini TTS
 */

/**
 * Generates TTS audio using Microsoft Edge TTS
 * @param {string} text - Text to convert to speech
 * @param {string} language - Language code (default: 'en-US')
 * @param {string} voice - Voice name (optional)
 * @returns {Promise<Buffer>} Audio buffer (MP3 or WAV format)
 */
async function generateTTSWithEdge(text, language = 'en-US', voice = null) {
    try {
        // Using edge-tts package for better integration
        // Install with: npm install edge-tts
        // Note: edge-tts is an ES module, so we use dynamic import
        let tts, getVoices;
        try {
            // Try importing from the compiled output first
            let edgeTTSModule;
            try {
                edgeTTSModule = await import('edge-tts/out/index.js');
            } catch (err1) {
                // If that fails, try the main import
                try {
                    edgeTTSModule = await import('edge-tts');
                } catch (err2) {
                    // If both fail, throw with helpful message
                    throw new Error(
                        'edge-tts package not installed or incompatible. Install with: npm install edge-tts\n' +
                        'Note: edge-tts is an ES module. If issues persist, use alternative TTS service (Gemini TTS).'
                    );
                }
            }
            
            // edge-tts exports: tts, getVoices, ttsSave, Categories, Personalities
            tts = edgeTTSModule.tts;
            getVoices = edgeTTSModule.getVoices;
            
            if (!tts || !getVoices) {
                throw new Error('edge-tts module structure not recognized. Expected tts and getVoices functions.');
            }
        } catch (importError) {
            if (importError.code === 'ERR_MODULE_NOT_FOUND' || 
                importError.message.includes('Cannot find module') || 
                importError.message.includes('Cannot use import') ||
                importError.message.includes('Unknown file extension')) {
                throw new Error(
                    'edge-tts package not installed or incompatible. Install with: npm install edge-tts\n' +
                    'Note: edge-tts is an ES module. If issues persist, use alternative TTS service (Gemini TTS).'
                );
            }
            throw importError;
        }
        
        // Get available voices if voice not specified
        // Use default voices to avoid network calls on slow connections
        if (!voice) {
            // Default voices by language (avoids network call for getVoices)
            const defaultVoices = {
                'fr': 'fr-FR-DeniseNeural',      // French female voice
                'en': 'en-US-AriaNeural',        // English female voice
                'es': 'es-ES-ElviraNeural',      // Spanish female voice
                'de': 'de-DE-KatjaNeural',       // German female voice
                'it': 'it-IT-ElsaNeural',        // Italian female voice
                'pt': 'pt-BR-FranciscaNeural'    // Portuguese female voice
            };
            
            // Extract base language code (e.g., 'fr-FR' -> 'fr')
            const baseLang = language.split('-')[0].toLowerCase();
            voice = defaultVoices[baseLang] || 'en-US-AriaNeural';
            
            // Try to get voices list if network is fast (optional, non-blocking)
            // This is done in background to improve voice selection for future requests
            getVoices().then(voices => {
                // Cache voices for future use (optional enhancement)
                // Could store in memory or cache
            }).catch(err => {
                // Silent fail - we already have default voice
                // This prevents blocking on slow connections
            });
        }

        // Generate speech using tts function with timeout
        // tts(text, { voice, rate, pitch, volume }) returns a Promise<Buffer>
        // Add timeout to prevent hanging on network issues
        const timeoutMs = 30000; // 30 seconds timeout
        const timeoutPromise = new Promise((_, reject) => {
            setTimeout(() => reject(new Error('Edge TTS request timed out after 30 seconds')), timeoutMs);
        });

        const audioBuffer = await Promise.race([
            tts(text, {
                voice: voice,
                rate: '+0%',
                pitch: '+0Hz',
                volume: '+0%'
            }),
            timeoutPromise
        ]);
        
        return audioBuffer;
    } catch (error) {
        // Categorize errors for better handling
        if (error.code === 'ERR_MODULE_NOT_FOUND' || error.message.includes('Cannot find module')) {
            throw new Error(
                'edge-tts package not installed. Install with: npm install edge-tts\n' +
                'Or use alternative TTS service.'
            );
        }
        
        // HTTP 403 Forbidden (rate limiting, IP blocking, or access denied)
        // Common on localhost - Microsoft Edge TTS often blocks localhost/127.0.0.1 connections
        if (error.message.includes('403') || 
            error.message.includes('Unexpected server response: 403') ||
            error.message.includes('Forbidden')) {
            throw new Error(
                `Edge TTS access denied (403): Microsoft Edge TTS often blocks localhost connections or ` +
                `rate limits your IP address. This is normal when running on localhost. ` +
                `Falling back to alternative TTS service (Gemini TTS).`
            );
        }
        
        // HTTP 429 Too Many Requests
        if (error.message.includes('429') || 
            error.message.includes('Too Many Requests') ||
            error.message.includes('rate limit')) {
            throw new Error(
                `Edge TTS rate limit exceeded: Too many requests to Microsoft Edge TTS servers. ` +
                `Falling back to alternative TTS service.`
            );
        }
        
        // Network/timeout errors
        if (error.code === 'ETIMEDOUT' || 
            error.code === 'ENETUNREACH' || 
            error.code === 'ECONNREFUSED' ||
            error.message.includes('timed out') ||
            error.message.includes('ETIMEDOUT')) {
            throw new Error(
                `Edge TTS network error: Cannot connect to Microsoft servers. ` +
                `This may be due to network issues, firewall, or proxy settings. ` +
                `Falling back to alternative TTS service.`
            );
        }
        
        // Aggregate errors (multiple connection attempts failed)
        // Check for AggregateError or errors array
        if (error.name === 'AggregateError' || 
            error.constructor?.name === 'AggregateError' ||
            (error.errors && Array.isArray(error.errors))) {
            // Check if any of the errors are network-related or 403
            const networkErrors = error.errors?.some(e => 
                e.code === 'ETIMEDOUT' || 
                e.code === 'ENETUNREACH' || 
                e.code === 'ECONNREFUSED' ||
                e.message?.includes('403') ||
                e.message?.includes('Forbidden')
            );
            
            if (networkErrors || error.code === 'ETIMEDOUT' || error.code === 'ENETUNREACH' || error.message.includes('403')) {
                throw new Error(
                    `Edge TTS connection failed: Unable to reach Microsoft Edge TTS servers or access denied. ` +
                    `This may be due to network connectivity issues, rate limiting, firewall, or proxy settings. ` +
                    `Falling back to alternative TTS service.`
                );
            }
        }
        
        console.error('[Edge TTS Error]:', error);
        throw error;
    }
}

/**
 * Lists available voices for a language
 * @param {string} language - Language code (e.g., 'en', 'fr')
 * @returns {Promise<Array>} List of available voices
 */
async function listVoices(language = null) {
    try {
        // Use dynamic import for ES module - try compiled output first
        let edgeTTSModule;
        try {
            edgeTTSModule = await import('edge-tts/out/index.js');
        } catch (err1) {
            edgeTTSModule = await import('edge-tts');
        }
        
        const getVoicesFunc = edgeTTSModule.getVoices;
        
        if (!getVoicesFunc) {
            throw new Error('getVoices function not found in edge-tts module');
        }
        
        const allVoices = await getVoicesFunc();
        
        if (language) {
            return allVoices.filter(v => 
                v.Locale && (
                    v.Locale.startsWith(language) || 
                    v.Locale.toLowerCase().includes(language.toLowerCase())
                )
            );
        }
        
        return allVoices;
    } catch (error) {
        console.error('[Edge TTS Voices Error]:', error);
        return [];
    }
}

module.exports = {
    generateTTSWithEdge,
    listVoices,
};

