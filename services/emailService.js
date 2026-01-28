const nodemailer = require('nodemailer');

let cachedTransporter = null;

function getTransporter() {
    if (cachedTransporter) {
        return cachedTransporter;
    }

    const host = process.env.SMTP_HOST;
    const port = parseInt(process.env.SMTP_PORT || '0', 10);
    const user = process.env.SMTP_USER;
    const pass = process.env.SMTP_PASS;
    const secure = String(process.env.SMTP_SECURE || 'false').toLowerCase() === 'true';

    if (!host || !port || !user || !pass) {
        throw new Error('SMTP configuration is incomplete');
    }

    cachedTransporter = nodemailer.createTransport({
        host,
        port,
        secure,
        auth: { user, pass }
    });

    return cachedTransporter;
}

function buildResetLink(token) {
    const explicitUrl = process.env.RESET_PASSWORD_URL;
    const frontendUrl = process.env.FRONTEND_URL;
    let baseUrl = null;

    if (explicitUrl) {
        baseUrl = explicitUrl;
    } else if (frontendUrl) {
        baseUrl = `${frontendUrl.replace(/\/$/, '')}/reset-password`;
    }

    if (!baseUrl) {
        throw new Error('RESET_PASSWORD_URL or FRONTEND_URL is required');
    }

    const separator = baseUrl.includes('?') ? '&' : '?';
    return `${baseUrl}${separator}token=${encodeURIComponent(token)}`;
}

async function sendPasswordResetEmail(toEmail, token) {
    const transporter = getTransporter();
    const from = process.env.SMTP_FROM || process.env.SMTP_USER;
    const resetLink = buildResetLink(token);

    const subject = 'Réinitialisation du mot de passe';
    const text = [
        'Vous avez demandé une réinitialisation de mot de passe.',
        `Lien: ${resetLink}`,
        'Si vous n\'êtes pas à l\'origine de cette demande, ignorez cet email.'
    ].join('\n');

    const html = `
        <p>Vous avez demandé une réinitialisation de mot de passe.</p>
        <p><a href="${resetLink}">Cliquez ici pour définir un nouveau mot de passe</a></p>
        <p>Si vous n'êtes pas à l'origine de cette demande, ignorez cet email.</p>
    `;

    await transporter.sendMail({
        from,
        to: toEmail,
        subject,
        text,
        html
    });

    return { resetLink };
}

module.exports = {
    sendPasswordResetEmail
};
