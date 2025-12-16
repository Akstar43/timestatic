const SibApiV3Sdk = require('@getbrevo/brevo');

console.log("Email API loaded");

// Helper to handle CORS
const allowCors = fn => async (req, res) => {
    res.setHeader('Access-Control-Allow-Credentials', true);
    res.setHeader('Access-Control-Allow-Origin', '*');
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


    // Use environment variable
    const API_KEY = process.env.BREVO_API_KEY;

    console.log('=== BREVO API DEBUG ===');
    console.log('API Key present:', !!API_KEY);
    if (API_KEY) {
        console.log('API Key length:', API_KEY.length);
        console.log('API Key prefix:', API_KEY.substring(0, 10) + '...');
    }
    console.log('All env vars:', Object.keys(process.env).filter(k => k.includes('BREVO')));

    // Check for environment variable
    if (!API_KEY) {
        console.error('Missing BREVO_API_KEY environment variable');
        return res.status(500).json({
            success: false,
            error: 'Server configuration error: Missing BREVO_API_KEY. Please configure environment variables.',
            debug: {
                BREVO_API_KEY: false,
                envVars: Object.keys(process.env)
            }
        });
    }

    // Initialize Brevo
    const apiInstance = new SibApiV3Sdk.TransactionalEmailsApi();
    apiInstance.setApiKey(SibApiV3Sdk.TransactionalEmailsApiApiKeys.apiKey, API_KEY);


    const sendSmtpEmail = new SibApiV3Sdk.SendSmtpEmail();
    sendSmtpEmail.sender = { name: "TimeAway System", email: "akmusajee53@gmail.com" };
    sendSmtpEmail.to = [{ email: to }];
    sendSmtpEmail.subject = subject;
    sendSmtpEmail.htmlContent = html || text;
    if (text && html) {
        sendSmtpEmail.textContent = text;
    }

    try {
        const data = await apiInstance.sendTransacEmail(sendSmtpEmail);
        console.log('Email sent successfully:', data);
        res.status(200).json({ success: true, message: 'Email sent', data });
    } catch (error) {
        console.error('=== BREVO API ERROR ===');
        console.error('Error message:', error.message);
        console.error('Error response:', error.response);
        console.error('Error body:', error.response?.body);
        console.error('Status code:', error.response?.statusCode);

        res.status(500).json({
            success: false,
            error: error.message || 'Failed to send email',
            details: {
                statusCode: error.response?.statusCode,
                body: error.response?.body
            }
        });
    }
};

module.exports = allowCors(handler);
