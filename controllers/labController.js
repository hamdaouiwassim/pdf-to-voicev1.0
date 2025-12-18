const { spawn } = require('child_process');
const crypto = require('crypto');
const config = require('../config/config');
const constants = require('../utils/constants');
const geminiService = require('../services/geminiService');
const localTTSService = require('../services/localTTSService');
const audioUtils = require('../utils/audioUtils');
const fileUtils = require('../utils/fileUtils');
const lipSyncService = require('../services/lipSyncService');

const PY_STDIO_LIMIT = config.PYTHON_MAX_STDIO_LENGTH;

function truncateOutput(value = '') {
    if (!value) {
        return { text: '', truncated: false };
    }
    if (value.length <= PY_STDIO_LIMIT) {
        return { text: value, truncated: false };
    }
    return {
        text: `${value.slice(0, PY_STDIO_LIMIT)}\n...[sortie tronquée]`,
        truncated: true,
    };
}

async function spawnPythonProcess(binary, code, stdin = '') {
    return new Promise((resolve, reject) => {
        const start = Date.now();
        const child = spawn(binary, ['-I', '-u', '-c', code], {
            env: {
                ...process.env,
                PYTHONUNBUFFERED: '1',
            },
            stdio: 'pipe',
            windowsHide: true,
        });

        let stdout = '';
        let stderr = '';
        let timedOut = false;
        const timeout = setTimeout(() => {
            timedOut = true;
            child.kill('SIGTERM');
            setTimeout(() => child.kill('SIGKILL'), 250);
        }, config.PYTHON_TIMEOUT_MS);

        child.stdout.on('data', (chunk) => {
            stdout += chunk.toString();
            if (stdout.length > PY_STDIO_LIMIT) {
                stdout = stdout.slice(0, PY_STDIO_LIMIT);
            }
        });

        child.stderr.on('data', (chunk) => {
            stderr += chunk.toString();
            if (stderr.length > PY_STDIO_LIMIT) {
                stderr = stderr.slice(0, PY_STDIO_LIMIT);
            }
        });

        child.on('error', (error) => {
            clearTimeout(timeout);
            reject(error);
        });

        child.on('close', (code, signal) => {
            clearTimeout(timeout);
            resolve({
                stdout,
                stderr,
                exitCode: timedOut ? null : code,
                signal: timedOut ? 'SIGTERM' : signal,
                timedOut,
                durationMs: Date.now() - start,
            });
        });

        if (stdin && stdin.length > 0) {
            child.stdin.write(stdin);
        }
        child.stdin.end();
    });
}

async function executePython(code, stdin = '') {
    let lastError;
    const binaries = config.PYTHON_BINARIES.length > 0
        ? config.PYTHON_BINARIES
        : ['python', 'py'];

    for (const binary of binaries) {
        try {
            return await spawnPythonProcess(binary, code, stdin);
        } catch (error) {
            lastError = error;
            if (error.code === 'ENOENT') {
                continue;
            }
            throw error;
        }
    }

    throw lastError || new Error("Aucun interpréteur Python n'a été trouvé sur le serveur.");
}

async function generateMentorFeedback({ code, stdout, stderr, exitCode, timedOut, instructions, statementId, statementTitle }) {
    const systemPrompt = `Tu es Titan, mentor Python de Titan Academy. 
Ton rôle :
- encourager l'apprenant
- expliquer clairement ce que fait son code
- corriger les erreurs en proposant une version améliorée si nécessaire
- répondre en ${config.LAB_FEEDBACK_LANGUAGE} avec des sections courtes (max 4 lignes chacune), et terminer par un verdict explicite.

Structure attendue :
1. 🔎 Observation générale
2. ✅ Résultat obtenu (ou échec)
3. 🛠️ Conseil / correction
4. 🚀 Petite mission pour progresser
5. 🔐 Verdict (commence impérativement par "VERDICT: SUCCÈS" ou "VERDICT: ÉCHEC")`;

    const evalPrompt = `
Consigne personnelle: ${instructions || 'Aider l’apprenant à comprendre son résultat.'}

Identifiant exercice: ${statementId || 'N/A'}
Titre exercice: ${statementTitle || 'Non spécifié'}

Code de l'apprenant:
\`\`\`python
${code}
\`\`\`

Sortie standard:
${stdout || '(aucune)'}

Erreurs:
${stderr || '(aucune)'}

Statut: ${timedOut ? 'temps dépassé' : `exit code ${exitCode}`}
`;

    try {
        return await geminiService.generateText(evalPrompt, systemPrompt, false);
    } catch (error) {
        console.warn('[Lab] Gemini feedback failed:', error.message);
        return "Je n'ai pas pu générer un retour automatique, mais tu peux déjà analyser la sortie et relancer l'exécution.";
    }
}

async function synthesizeFeedbackAudio(text) {
    if (!text || !text.trim()) {
        return null;
    }

    // Try local TTS first (best quality offline)
    try {
        const audioBuffer = await localTTSService.generateTTSLocal(text, config.LAB_TTS_LANGUAGE);
        return { audioBuffer, mimeType: 'audio/wav' };
    } catch (error) {
        console.warn('[Lab] Local TTS unavailable:', error.message);
    }

    // Fallback to Gemini TTS
    try {
        const { pcmBuffer } = await geminiService.generateTTS(text, config.TTS_VOICE_QA);
        const audioBuffer = audioUtils.pcmToWav(pcmBuffer);
        return { audioBuffer, mimeType: 'audio/wav' };
    } catch (error) {
        console.warn('[Lab] Gemini TTS unavailable:', error.message);
    }

    return null;
}

async function attachLipSync(audioId) {
    const audioPath = fileUtils.getAudioFilePath(audioId);
    const lipSyncPath = fileUtils.getLipSyncFilePath(audioId);

    try {
        await lipSyncService.generateLipSync(audioPath, lipSyncPath);
        return true;
    } catch (error) {
        console.warn('[Lab] Lip sync generation failed:', error.message);
        return false;
    }
}

async function runPythonLab(req, res) {
    try {
        const {
            code,
            instructions = '',
            stdin = '',
            docId = null,
            statementId = null,
            statementTitle = null
        } = req.body;

        const runResult = await executePython(code.trim(), stdin);
        const stdoutResult = truncateOutput(runResult.stdout);
        const stderrResult = truncateOutput(runResult.stderr);
        const passedExecution = !runResult.timedOut && runResult.exitCode === 0;
        const evaluation = {
            status: passedExecution ? 'success' : 'failure',
            message: passedExecution
                ? 'Le script s’est exécuté sans erreur.'
                : runResult.timedOut
                    ? 'Temps d’exécution dépassé.'
                    : stderrResult.text
                        ? 'Des erreurs ont été détectées dans le code.'
                        : 'Le script ne répond pas encore aux attentes.'
        };

        const feedbackText = await generateMentorFeedback({
            code,
            stdout: stdoutResult.text,
            stderr: stderrResult.text,
            exitCode: runResult.exitCode,
            timedOut: runResult.timedOut,
            instructions: instructions?.trim(),
            statementId,
            statementTitle
        });

        let feedbackAudio = null;
        let audioId = null;
        let lipSyncReady = false;

        try {
            feedbackAudio = await synthesizeFeedbackAudio(feedbackText);

            if (feedbackAudio?.audioBuffer) {
                audioId = `${constants.AUDIO_PREFIXES.LAB}${crypto.randomUUID()}`;
                await fileUtils.saveAudioFile(audioId, feedbackAudio.audioBuffer);
                lipSyncReady = await attachLipSync(audioId);
            }
        } catch (audioError) {
            console.warn('[Lab] Failed to prepare avatar audio:', audioError.message);
        }

        res.json({
            run: {
                stdout: stdoutResult.text,
                stdoutTruncated: stdoutResult.truncated,
                stderr: stderrResult.text,
                stderrTruncated: stderrResult.truncated,
                exitCode: runResult.exitCode,
                timedOut: runResult.timedOut,
                durationMs: runResult.durationMs,
            },
            evaluation,
            feedback: {
                text: feedbackText,
                mood: runResult.exitCode === 0 && !runResult.timedOut ? 'smile' : 'concerned',
                audioUrl: audioId ? `/api/audio/${audioId}` : null,
                audioId,
                lipSyncUrl: lipSyncReady ? `/audios/${audioId}.json` : null,
            },
            metadata: {
                instructions,
                docId,
                statementId,
                statementTitle,
                createdAt: new Date().toISOString(),
            },
        });
    } catch (error) {
        console.error('[Lab] Execution failed:', error);
        res.status(500).json({
            error: 'Impossible de lancer le laboratoire Python.',
            details: error.message,
        });
    }
}


async function getFeedbackAudio(req, res) {
    try {
        const { type } = req.body;
        let textToSpeak = "";

        if (type === 'empty_input') {
            textToSpeak = "La zone d'interprétation est vide. Écris quelques lignes de code Python pour que je puisse t'aider !";
        } else {
            return res.status(400).json({ error: "Type de feedback inconnu." });
        }

        let audioId = null;
        let lipSyncReady = false;

        try {
            // Check cache first? For now, we generate fresh or rely on fileUtils cache if we used consistent IDs
            // But here we'll just generate.

            // To avoid re-generating the same static audio every time, we could use a static ID for this type
            // But for simplicity and consistency with existing flow, we generate new one or handle it dynamically
            const feedbackAudio = await synthesizeFeedbackAudio(textToSpeak);

            if (feedbackAudio?.audioBuffer) {
                audioId = `${constants.AUDIO_PREFIXES.LAB}${crypto.randomUUID()}`;
                await fileUtils.saveAudioFile(audioId, feedbackAudio.audioBuffer);
                lipSyncReady = await attachLipSync(audioId);
            }
        } catch (audioError) {
            console.warn('[Lab] Failed to prepare feedback audio:', audioError.message);
            return res.status(500).json({ error: "Erreur de génération audio." });
        }

        res.json({
            feedback: {
                text: textToSpeak,
                audioUrl: audioId ? `/api/audio/${audioId}` : null,
                audioId,
                lipSyncUrl: lipSyncReady ? `/audios/${audioId}.json` : null,
            }
        });

    } catch (error) {
        console.error('[Lab] Feedback generation failed:', error);
        res.status(500).json({ error: "Impossible de générer le feedback." });
    }
}

module.exports = {
    runPythonLab,
    getFeedbackAudio
};

