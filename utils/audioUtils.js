const { Buffer } = require('buffer');
const config = require('../config/config');

/**
 * Converts raw PCM audio data into a complete WAV file Buffer.
 * @param {Buffer} pcmData - The raw PCM audio data buffer.
 * @returns {Buffer} The complete WAV file buffer with header.
 */
function pcmToWav(pcmData) {
    const dataLength = pcmData.length;
    const totalLength = 44 + dataLength;
    const buffer = Buffer.alloc(totalLength);
    
    // RIFF header
    buffer.write('RIFF', 0);
    buffer.writeUInt32LE(totalLength - 8, 4); // File size - 8
    buffer.write('WAVE', 8);
    
    // FMT sub-chunk
    buffer.write('fmt ', 12);
    buffer.writeUInt32LE(16, 16); // Sub-chunk size (16 for PCM)
    buffer.writeUInt16LE(1, 20);  // Audio format (1 = PCM)
    buffer.writeUInt16LE(config.CHANNELS, 22);
    buffer.writeUInt32LE(config.SAMPLE_RATE, 24);
    buffer.writeUInt32LE(config.BYTE_RATE, 28);
    buffer.writeUInt16LE(config.BLOCK_ALIGN, 32);
    buffer.writeUInt16LE(config.BITS_PER_SAMPLE, 34);
    
    // Data sub-chunk
    buffer.write('data', 36);
    buffer.writeUInt32LE(dataLength, 40); // Data size
    
    // Copy PCM data
    pcmData.copy(buffer, 44);
    
    return buffer;
}

module.exports = {
    pcmToWav,
};

