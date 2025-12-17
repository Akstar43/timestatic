const stripe = require('stripe')(process.env.STRIPE_SECRET_KEY);

// Pricing configuration
const PLANS = {
    free: { priceId: null, maxUsers: 5, name: 'Free' },
    pro: { priceId: process.env.STRIPE_PRO_PRICE_ID, maxUsers: 25, name: 'Pro' },
    business: { priceId: process.env.STRIPE_BUSINESS_PRICE_ID, maxUsers: 100, name: 'Business' },
    enterprise: { priceId: null, maxUsers: Infinity, name: 'Enterprise' }
};

module.exports = async function handler(req, res) {
    // Enable CORS
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

    if (req.method === 'OPTIONS') {
        return res.status(200).end();
    }

    if (req.method !== 'POST') {
        return res.status(405).json({ error: 'Method not allowed' });
    }

    try {
        const { planId, orgId, orgName } = req.body;

        console.log('Received request:', { planId, orgId, orgName });
        console.log('Environment check:', {
            hasSecretKey: !!process.env.STRIPE_SECRET_KEY,
            hasProPrice: !!process.env.STRIPE_PRO_PRICE_ID,
            hasBusinessPrice: !!process.env.STRIPE_BUSINESS_PRICE_ID,
            proPriceValue: process.env.STRIPE_PRO_PRICE_ID,
            businessPriceValue: process.env.STRIPE_BUSINESS_PRICE_ID
        });

        if (!planId || !orgId) {
            return res.status(400).json({ error: 'Missing required fields' });
        }

        const plan = PLANS[planId];
        if (!plan) {
            return res.status(400).json({ error: `Invalid plan: ${planId}` });
        }

        if (!plan.priceId) {
            return res.status(400).json({
                error: `Missing price ID for ${planId} plan. Please add STRIPE_${planId.toUpperCase()}_PRICE_ID to Vercel environment variables.`
            });
        }

        // Get the app URL from environment or request headers
        const appUrl = process.env.NEXT_PUBLIC_APP_URL ||
            process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` :
            `https://${req.headers.host}`;

        // Create Stripe Checkout Session
        const session = await stripe.checkout.sessions.create({
            payment_method_types: ['card'],
            line_items: [
                {
                    price: plan.priceId,
                    quantity: 1,
                },
            ],
            mode: 'subscription',
            success_url: `${appUrl}/admin?tab=billing&success=true`,
            cancel_url: `${appUrl}/admin?tab=billing&canceled=true`,
            client_reference_id: orgId,
            metadata: {
                orgId: orgId,
                orgName: orgName,
                planId: planId,
            },
        });

        res.status(200).json({ sessionId: session.id, url: session.url });
    } catch (error) {
        console.error('Stripe checkout error:', error);
        res.status(500).json({ error: error.message || 'Internal server error' });
    }
};
