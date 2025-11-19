const { spawn } = require('child_process');
const fs = require('fs');
const config = require('../config/config');

/**
 * Generate lip sync data using Rhubarb-Lip-Sync.
 * @param {string} audioPath - Absolute path to the source WAV file.
 * @param {string} outputPath - Absolute path for the output JSON file.
 * @returns {Promise<void>}
 */
async function generateLipSync(audioPath, outputPath) {
    return new Promise((resolve, reject) => {
        const rhubarbExecutable = config.RHUBARB_PATH;

        if (!rhubarbExecutable) {
            return reject(new Error('RHUBARB_PATH is not configured. Set the environment variable to the Rhubarb executable path.'));
        }

        if (!fs.existsSync(rhubarbExecutable)) {
            return reject(new Error(`Rhubarb executable not found at ${rhubarbExecutable}. Verify RHUBARB_PATH.`));
        }

        if (!fs.existsSync(audioPath)) {
            return reject(new Error(`Audio file not found at ${audioPath}`));
        }

        const rhubarbArgs = [
            '-f', 'json',
            '-o', outputPath,
            audioPath
        ];

        const rhubarbProcess = spawn(rhubarbExecutable, rhubarbArgs, {
            windowsHide: true,
        });

        let stderr = '';
        let stdout = '';

        rhubarbProcess.stdout.on('data', (data) => {
            stdout += data.toString();
        });

        rhubarbProcess.stderr.on('data', (data) => {
            stderr += data.toString();
        });

        rhubarbProcess.on('error', (error) => {
            reject(new Error(`Failed to start Rhubarb: ${error.message}`));
        });

        rhubarbProcess.on('close', (code) => {
            if (code !== 0) {
                return reject(new Error(`Rhubarb exited with code ${code}. ${stderr}`));
            }

            if (!fs.existsSync(outputPath)) {
                return reject(new Error('Rhubarb did not produce an output file.'));
            }

            resolve();
        });
    });
}

module.exports = {
    generateLipSync,
};


