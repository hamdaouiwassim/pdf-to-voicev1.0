const fileUtils = require('../utils/fileUtils');

/**
 * Serve audio file by ID
 * GET /api/audio/:audioId
 */
async function getAudio(req, res) {
    try {
        const { audioId } = req.params;

        if (!audioId) {
            return res.status(400).json({ error: 'Audio ID is required' });
        }

        // Security: Prevent directory traversal
        if (audioId.includes('..') || audioId.includes('/') || audioId.includes('\\')) {
            return res.status(400).json({ error: 'Invalid audio ID' });
        }

        if (!fileUtils.audioFileExists(audioId)) {
            return res.status(404).json({ error: 'Audio file not found' });
        }

        const audioBuffer = await fileUtils.readAudioFile(audioId);
        
        res.setHeader('Content-Type', 'audio/wav');
        res.setHeader('Content-Length', audioBuffer.length);
        res.send(audioBuffer);
    } catch (error) {
        console.error("[Audio Error]:", error);
        res.status(500).json({ 
            error: 'Failed to retrieve audio file.',
            details: error.message 
        });
    }
}

module.exports = {
    getAudio,
};

