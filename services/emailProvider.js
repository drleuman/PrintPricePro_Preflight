// services/emailProvider.js
const nodemailer = require('nodemailer');

class NotifierEmailProvider {
    constructor() {
        this.transporter = null;
        this.from = process.env.SMTP_FROM || 'noreply@printprice.pro';
    }

    async init() {
        if (this.transporter) return;

        console.log('[EMAIL-PROVIDER] Initializing SMTP transporter...');
        this.transporter = nodemailer.createTransport({
            host: process.env.SMTP_HOST,
            port: parseInt(process.env.SMTP_PORT || '587', 10),
            secure: process.env.SMTP_PORT === '465',
            auth: {
                user: process.env.SMTP_USER,
                pass: process.env.SMTP_PASS
            },
            connectionTimeout: 10000, // 10s
        });

        try {
            await this.transporter.verify();
            console.log('[EMAIL-PROVIDER] SMTP connection verified.');
        } catch (err) {
            console.error('[EMAIL-PROVIDER] SMTP verification failed:', err.message);
            this.transporter = null;
            throw err;
        }
    }

    /**
     * Send an email notification.
     */
    async sendEmail({ to, subject, text, html, metadata = {} }) {
        if (!this.transporter) {
            await this.init();
        }

        const info = await this.transporter.sendMail({
            from: this.from,
            to,
            subject,
            text,
            html
        });

        console.log(`[EMAIL-PROVIDER] Email sent to ${to}: ${info.messageId}`);
        return {
            success: true,
            messageId: info.messageId,
            response: info.response
        };
    }
}

module.exports = new NotifierEmailProvider();
