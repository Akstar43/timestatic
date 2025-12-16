const { Resend } = require('resend');

console.log("Email API loaded");
console.log("RESEND_API_KEY present:", !!process.env.RESEND_API_KEY);

// Helper to handle CORS
const allowCors = fn => async (req, res) => {
    res.setHeader('Access-Control-Allow-Credentials', true);
    res.setHeader('Access-Control-Allow-Origin', '*'); // Adjust this in production if needed
    res.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS,PATCH,DELETE,POST,PUT');
    res.setHeader(
        'Access-Control-Allow-Headers',
        'X-CSRF-Token, X-Requested-With, Accept, Accept-Version, Content-Length, Content-MD5, Content-Type, Date, X-Api-Version'
    );
    if (req.method === 'OPTIONS') {
        res.status(200).end();
        return;
    }
    return await fn(req, res);
};

const handler = async (req, res) => {
    if (req.method !== 'POST') {
        return res.status(405).send('Method Not Allowed');
    }

    const { to, subject, html, text } = req.body;

    if (!to || !subject || (!html && !text)) {
        return res.status(400).json({
            success: false,
            error: 'Missing required fields: to, subject, and html/text are required'
        });
    }

    // Check for environment variable
    if (!process.env.RESEND_API_KEY) {
        console.error('Missing RESEND_API_KEY environment variable');
        return res.status(500).json({
            success: false,
            error: 'Server configuration error: Missing RESEND_API_KEY. Please configure environment variables.',
            debug: {
                RESEND_API_KEY: false
            }
        });
    }

    // Initialize Resend
    const resend = new Resend(process.env.RESEND_API_KEY);

    try {
        const { data, error } = await resend.emails.send({
            from: 'TimeAway System <onboarding@resend.dev>', // Use onboarding domain for testing
            to,
            subject,
            html: html || text,
            text: text || undefined
        });

        if (error) {
            console.error('Resend API error:', error);
            return res.status(500).json({
                success: false,
                error: error.message || 'Failed to send email'
            });
        }

        console.log('Email sent successfully:', data);
        res.status(200).json({ success: true, message: 'Email sent', data });
    } catch (error) {
        console.error('Email send error:', error);
        res.status(500).json({
            success: false,
            error: error.message || 'Unknown error occurred'
        });
    }
};

module.exports = allowCors(handler);

