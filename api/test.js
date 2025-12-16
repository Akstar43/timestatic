const SibApiV3Sdk = require('@getbrevo/brevo');

// Diagnostic endpoint to test Brevo API setup
module.exports = async (req, res) => {
    // Set CORS headers
    res.setHeader('Access-Control-Allow-Credentials', true);
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS');

    if (req.method === 'OPTIONS') {
        res.status(200).end();
        return;
    }

    const diagnostics = {
        timestamp: new Date().toISOString(),
        environment: {
            BREVO_API_KEY_EXISTS: !!process.env.BREVO_API_KEY,
            BREVO_API_KEY_LENGTH: process.env.BREVO_API_KEY ? process.env.BREVO_API_KEY.length : 0,
            BREVO_API_KEY_PREFIX: process.env.BREVO_API_KEY ? process.env.BREVO_API_KEY.substring(0, 15) + '...' : 'NOT SET',
            NODE_ENV: process.env.NODE_ENV
        },
        brevoSdkVersion: require('@getbrevo/brevo/package.json').version
    };

    // Test API connection if key exists
    if (process.env.BREVO_API_KEY) {
        try {
            const apiInstance = new SibApiV3Sdk.AccountApi();
            apiInstance.setApiKey(SibApiV3Sdk.AccountApiApiKeys.apiKey, process.env.BREVO_API_KEY);

            const accountInfo = await apiInstance.getAccount();
            diagnostics.apiTest = {
                success: true,
                accountEmail: accountInfo.email,
                accountPlan: accountInfo.plan?.type || 'unknown'
            };
        } catch (error) {
            diagnostics.apiTest = {
                success: false,
                error: error.message,
                errorCode: error.response?.statusCode || 'unknown',
                errorBody: error.response?.body || null
            };
        }
    } else {
        diagnostics.apiTest = {
            success: false,
            error: 'BREVO_API_KEY environment variable not set'
        };
    }

    res.status(200).json(diagnostics);
};
