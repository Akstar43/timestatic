const nodemailer = require('nodemailer');

console.log("Function loaded");
console.log("GMAIL_USER present:", !!process.env.GMAIL_USER);
console.log("GMAIL_PASS present:", !!process.env.GMAIL_PASS);

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
        return res.status(400).send('Missing required fields');
    }

    // Configure Transporter (Gmail)
    const transporter = nodemailer.createTransport({
        service: 'gmail',
        auth: {
            user: process.env.GMAIL_USER, // Your Gmail
            pass: process.env.GMAIL_PASS  // Your App Password
        }
    });

    try {
        await transporter.sendMail({
            from: `"TimeAway System" <${process.env.GMAIL_USER}>`,
            to,
            subject,
            text: text || "",
            html: html || text
        });

        res.status(200).json({ success: true, message: 'Email sent' });
    } catch (error) {
        console.error('Email send error:', error);
        res.status(500).json({ success: false, error: error.message });
    }
};

module.exports = allowCors(handler);
