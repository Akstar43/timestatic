// api/send-notification.js
// This function runs on Vercel's Serverless environment (Node.js)
const admin = require('firebase-admin');

// Prevent multiple initializations in development
if (!admin.apps.length) {
    // We need to construct the service account from Environment Variables
    // for security. On Vercel, you will paste the JSON content or individual fields.
    // simpler method for Vercel: Store the WHOLE JSON string in one env var: FIREBASE_SERVICE_ACCOUNT

    const serviceAccount = process.env.FIREBASE_SERVICE_ACCOUNT
        ? JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT)
        : null;

    if (serviceAccount) {
        admin.initializeApp({
            credential: admin.credential.cert(serviceAccount)
        });
    } else {
        console.error("FIREBASE_SERVICE_ACCOUNT environment variable is missing.");
    }
}

export default async function handler(req, res) {
    if (req.method !== 'POST') {
        return res.status(405).json({ error: 'Method Not Allowed' });
    }

    const { token, title, body } = req.body;

    if (!token || !title || !body) {
        return res.status(400).json({ error: 'Missing token, title, or body' });
    }

    try {
        if (!admin.apps.length) {
            throw new Error("Firebase Admin not initialized. Check server logs for ENV var issues.");
        }

        const message = {
            notification: {
                title: title,
                body: body,
            },
            token: token,
            // You can add data payload or android/webpush specific configs here
            webpush: {
                fcmOptions: {
                    link: '/' // Link to open when clicked
                }
            }
        };

        const response = await admin.messaging().send(message);
        console.log('Successfully sent message:', response);
        return res.status(200).json({ success: true, messageId: response });

    } catch (error) {
        console.error('Error sending message:', error);
        return res.status(500).json({ error: error.message });
    }
}
