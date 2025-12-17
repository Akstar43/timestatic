const stripe = require('stripe')(process.env.STRIPE_SECRET_KEY);
const admin = require('firebase-admin');

// Initialize Firebase Admin (only once)
if (!admin.apps.length) {
    admin.initializeApp({
        credential: admin.credential.cert({
            projectId: process.env.FIREBASE_PROJECT_ID,
            clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
            privateKey: process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, '\n'),
        }),
    });
}

const db = admin.firestore();

export default async function handler(req, res) {
    if (req.method !== 'POST') {
        return res.status(405).json({ error: 'Method not allowed' });
    }

    const sig = req.headers['stripe-signature'];
    const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;

    let event;

    try {
        event = stripe.webhooks.constructEvent(req.body, sig, webhookSecret);
    } catch (err) {
        console.error('Webhook signature verification failed:', err.message);
        return res.status(400).send(`Webhook Error: ${err.message}`);
    }

    // Handle the event
    switch (event.type) {
        case 'checkout.session.completed':
            const session = event.data.object;
            await handleCheckoutComplete(session);
            break;

        case 'customer.subscription.updated':
        case 'customer.subscription.deleted':
            const subscription = event.data.object;
            await handleSubscriptionChange(subscription);
            break;

        default:
            console.log(`Unhandled event type ${event.type}`);
    }

    res.json({ received: true });
}

async function handleCheckoutComplete(session) {
    const { orgId, planId } = session.metadata;

    if (!orgId || !planId) {
        console.error('Missing metadata in checkout session');
        return;
    }

    const maxUsers = {
        pro: 25,
        business: 100,
        enterprise: Infinity
    }[planId] || 5;

    try {
        await db.collection('organizations').doc(orgId).update({
            subscriptionPlan: planId,
            subscriptionStatus: 'active',
            maxUsers: maxUsers,
            stripeCustomerId: session.customer,
            stripeSubscriptionId: session.subscription,
            updatedAt: admin.firestore.FieldValue.serverTimestamp(),
        });

        console.log(`Updated org ${orgId} to ${planId} plan`);
    } catch (error) {
        console.error('Error updating organization:', error);
    }
}

async function handleSubscriptionChange(subscription) {
    const customerId = subscription.customer;

    try {
        // Find org by customer ID
        const orgsSnapshot = await db.collection('organizations')
            .where('stripeCustomerId', '==', customerId)
            .limit(1)
            .get();

        if (orgsSnapshot.empty) {
            console.error('No organization found for customer:', customerId);
            return;
        }

        const orgDoc = orgsSnapshot.docs[0];
        const status = subscription.status; // active, past_due, canceled, etc.

        await orgDoc.ref.update({
            subscriptionStatus: status,
            updatedAt: admin.firestore.FieldValue.serverTimestamp(),
        });

        console.log(`Updated subscription status for org ${orgDoc.id}: ${status}`);
    } catch (error) {
        console.error('Error handling subscription change:', error);
    }
}

// Disable body parsing, need raw body for signature verification
export const config = {
    api: {
        bodyParser: false,
    },
};
