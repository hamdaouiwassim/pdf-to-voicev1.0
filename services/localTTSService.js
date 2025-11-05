/**
 * Local TTS Service - Uses System TTS (Windows SAPI)
 * Works offline, no internet required
 * Best for localhost development
 */

const fs = require('fs');
const fsPromises = require('fs').promises;
const path = require('path');
const { exec } = require('child_process');
const { promisify } = require('util');

const execAsync = promisify(exec);

/**
 * Cleans text for TTS conversion by removing problematic characters
 * Preserves French accented characters (é, è, ê, ç, etc.)
 * @param {string} text - Raw text to clean
 * @returns {string} Cleaned text optimized for TTS
 */
function cleanTextForTTS(text) {
    if (!text || typeof text !== 'string') {
        return '';
    }

    let cleaned = text;

    // Remove HTML tags and entities
    cleaned = cleaned.replace(/<[^>]*>/g, ' ');
    cleaned = cleaned.replace(/&nbsp;/g, ' ');
    cleaned = cleaned.replace(/&amp;/g, ' et ');
    cleaned = cleaned.replace(/&lt;/g, ' moins que ');
    cleaned = cleaned.replace(/&gt;/g, ' plus que ');
    cleaned = cleaned.replace(/&quot;/g, '"');
    cleaned = cleaned.replace(/&#39;/g, "'");
    cleaned = cleaned.replace(/&[a-z]+;/gi, ' ');

    // Remove URLs
    cleaned = cleaned.replace(/https?:\/\/[^\s]+/gi, 'lien web');
    cleaned = cleaned.replace(/www\.[^\s]+/gi, 'lien web');

    // Remove email addresses
    cleaned = cleaned.replace(/[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g, 'adresse email');

    // Replace problematic punctuation
    cleaned = cleaned.replace(/[•·▪▫]/g, ' ');
    cleaned = cleaned.replace(/[—–]/g, '-');
    cleaned = cleaned.replace(/[""]/g, '"');
    cleaned = cleaned.replace(/['']/g, "'");
    cleaned = cleaned.replace(/[…]/g, '...');

    // Normalize whitespace
    cleaned = cleaned.replace(/\r\n/g, ' ');
    cleaned = cleaned.replace(/\r/g, ' ');
    cleaned = cleaned.replace(/\n/g, ' ');
    cleaned = cleaned.replace(/\t/g, ' ');
    cleaned = cleaned.replace(/\s+/g, ' ');
    cleaned = cleaned.trim();

    // Ensure text ends with punctuation
    if (cleaned.length > 0 && !/[.!?]$/.test(cleaned)) {
        cleaned += '.';
    }

    return cleaned.trim();
}

/**
 * Generates TTS audio using Windows SAPI (System Speech API)
 * Uses PowerShell for better UTF-8 handling
 * @param {string} text - Text to convert to speech
 * @param {string} language - Language code (default: 'fr-FR')
 * @param {string} voice - Voice name (optional, Windows voice name)
 * @returns {Promise<Buffer>} Audio buffer (WAV format)
 */
async function generateTTSLocal(text, language = 'fr-FR', voice = null) {
    try {
        // Check if we're on Windows
        if (process.platform !== 'win32') {
            throw new Error('Local TTS (Windows SAPI) is only available on Windows. Use Edge TTS or Gemini TTS on other platforms.');
        }

        // Clean and limit text length
        const cleanedText = cleanTextForTTS(text);
        const maxLength = 3000;
        const textToSpeak = cleanedText.substring(0, maxLength);
        
        if (!textToSpeak || textToSpeak.trim().length === 0) {
            throw new Error('Text is empty after cleaning');
        }

        // Create temporary directory
        const tempDir = path.join(__dirname, '..', 'temp');
        if (!fs.existsSync(tempDir)) {
            fs.mkdirSync(tempDir, { recursive: true });
        }

        const timestamp = Date.now();
        const randomId = Math.random().toString(36).substring(7);
        const tempWavPath = path.join(tempDir, `tts_${timestamp}_${randomId}.wav`);
        const tempPs1Path = path.join(tempDir, `tts_${timestamp}_${randomId}.ps1`);

        // Determine voice based on language
        let sapiVoice = voice;
        if (!sapiVoice) {
            const languageMap = {
                'fr': 'Microsoft Hortense Desktop',
                'en': 'Microsoft Zira Desktop',
                'es': 'Microsoft Sabina Desktop',
                'de': 'Microsoft Hedda Desktop',
                'it': 'Microsoft Elsa Desktop',
                'pt': 'Microsoft Heloisa Desktop'
            };
            const baseLang = language.split('-')[0].toLowerCase();
            sapiVoice = languageMap[baseLang] || 'Microsoft Zira Desktop';
        }

        // Escape text and path for PowerShell
        // Use Here-String (@'...'@) for text to preserve all characters including French accents
        const escapedWavPath = tempWavPath.replace(/\\/g, '\\').replace(/"/g, '`"');
        
        // For PowerShell, we'll write the text to a temp file and read it
        // This is the most reliable way to preserve Unicode characters
        const tempTextPath = path.join(tempDir, `tts_text_${timestamp}_${randomId}.txt`);
        await fsPromises.writeFile(tempTextPath, textToSpeak, 'utf8');
        const escapedTextPath = tempTextPath.replace(/\\/g, '\\').replace(/"/g, '`"');

        // Create PowerShell script to generate TTS
        // PowerShell handles UTF-8 much better than VBScript
        const psScript = `
$ErrorActionPreference = "Stop"
Add-Type -AssemblyName System.Speech

$voice = New-Object System.Speech.Synthesis.SpeechSynthesizer

# Try to set voice if specified
$voices = $voice.GetInstalledVoices()
foreach ($v in $voices) {
    if ($v.VoiceInfo.Name -like "*${sapiVoice}*") {
        $voice.SelectVoice($v.VoiceInfo.Name)
        break
    }
}

# Set output to file
$voice.SetOutputToWaveFile("${escapedWavPath}")

# Read text from UTF-8 file (preserves French characters perfectly)
$text = Get-Content -Path "${escapedTextPath}" -Encoding UTF8 -Raw
$voice.Speak($text)

# Cleanup
$voice.Dispose()
        `.trim();

        // Write PowerShell script to temp file
        await fsPromises.writeFile(tempPs1Path, psScript, 'utf8');

        // Execute PowerShell script
        try {
            // Use UTF-8 encoding for PowerShell
            await execAsync(
                `powershell.exe -ExecutionPolicy Bypass -NoProfile -Command "& { [Console]::OutputEncoding = [System.Text.Encoding]::UTF8; & '${tempPs1Path}' }"`,
                {
                    timeout: 30000,
                    maxBuffer: 1024 * 1024,
                    encoding: 'utf8'
                }
            );
        } catch (execError) {
            // Clean up temp files
            try {
                if (fs.existsSync(tempPs1Path)) {
                    await fsPromises.unlink(tempPs1Path);
                }
                if (fs.existsSync(tempTextPath)) {
                    await fsPromises.unlink(tempTextPath);
                }
                if (fs.existsSync(tempWavPath)) {
                    await fsPromises.unlink(tempWavPath);
                }
            } catch (cleanupError) {
                // Ignore cleanup errors
            }
            throw new Error(`Windows SAPI TTS failed: ${execError.message}`);
        }

        // Clean up PowerShell script and text file
        try {
            await fsPromises.unlink(tempPs1Path);
            if (fs.existsSync(tempTextPath)) {
                await fsPromises.unlink(tempTextPath);
            }
        } catch (cleanupError) {
            console.warn('[Local TTS] Failed to clean up temp files:', cleanupError.message);
        }

        // Check if WAV file was created
        if (!fs.existsSync(tempWavPath)) {
            throw new Error('Windows SAPI TTS did not generate audio file');
        }

        // Read the generated WAV file
        const audioBuffer = await fsPromises.readFile(tempWavPath);

        // Clean up WAV file after reading
        try {
            await fsPromises.unlink(tempWavPath);
        } catch (cleanupError) {
            console.warn('[Local TTS] Failed to clean up WAV file:', cleanupError.message);
        }

        return audioBuffer;

    } catch (error) {
        console.error('[Local TTS Error]:', error);
        throw error;
    }
}

/**
 * Lists available Windows SAPI voices using PowerShell
 * @returns {Promise<Array>} List of available voices
 */
async function listVoices() {
    try {
        if (process.platform !== 'win32') {
            return [];
        }

        const tempPs1Path = path.join(__dirname, '..', 'temp', `list_voices_${Date.now()}.ps1`);
        
        const psScript = `
Add-Type -AssemblyName System.Speech
$voice = New-Object System.Speech.Synthesis.SpeechSynthesizer
$voices = $voice.GetInstalledVoices()
foreach ($v in $voices) {
    Write-Output $v.VoiceInfo.Name
}
$voice.Dispose()
        `.trim();

        await fsPromises.writeFile(tempPs1Path, psScript, 'utf8');

        try {
            const { stdout } = await execAsync(
                `powershell.exe -ExecutionPolicy Bypass -NoProfile -File "${tempPs1Path}"`,
                {
                    timeout: 10000,
                    maxBuffer: 1024 * 1024,
                    encoding: 'utf8'
                }
            );

            await fsPromises.unlink(tempPs1Path);

            return stdout.split('\n')
                .map(line => line.trim())
                .filter(line => line.length > 0)
                .map(line => ({ Name: line, Description: line }));
        } catch (error) {
            try {
                if (fs.existsSync(tempPs1Path)) {
                    await fsPromises.unlink(tempPs1Path);
                }
            } catch {}
            return [];
        }
    } catch (error) {
        console.error('[Local TTS Voices Error]:', error);
        return [];
    }
}

module.exports = {
    generateTTSLocal,
    listVoices,
};
