const stripe = require('stripe')(process.env.STRIPE_SECRET_KEY);

// Pricing configuration
const PLANS = {
    free: { priceId: null, maxUsers: 5, name: 'Free' },
    pro: { priceId: process.env.STRIPE_PRO_PRICE_ID, maxUsers: 25, name: 'Pro' },
    business: { priceId: process.env.STRIPE_BUSINESS_PRICE_ID, maxUsers: 100, name: 'Business' },
    enterprise: { priceId: null, maxUsers: Infinity, name: 'Enterprise' }
};

export default async function handler(req, res) {
    if (req.method !== 'POST') {
        return res.status(405).json({ error: 'Method not allowed' });
    }

    try {
        const { planId, orgId, orgName } = req.body;

        if (!planId || !orgId) {
            return res.status(400).json({ error: 'Missing required fields' });
        }

        const plan = PLANS[planId];
        if (!plan || !plan.priceId) {
            return res.status(400).json({ error: 'Invalid plan' });
        }

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
            success_url: `${process.env.NEXT_PUBLIC_APP_URL}/admin?tab=billing&success=true`,
            cancel_url: `${process.env.NEXT_PUBLIC_APP_URL}/admin?tab=billing&canceled=true`,
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
        res.status(500).json({ error: error.message });
    }
}
