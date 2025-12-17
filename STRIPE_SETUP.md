# Stripe Integration Setup Guide

## 📋 Prerequisites
- Stripe account (sign up at [stripe.com](https://stripe.com))
- Vercel account for deployment
- Firebase Admin SDK credentials

## 🔑 Step 1: Get Stripe API Keys

1. Go to [Stripe Dashboard](https://dashboard.stripe.com)
2. Click **Developers** → **API keys**
3. Copy your **Test Mode** keys:
   - `Publishable key` (starts with `pk_test_`)
   - `Secret key` (starts with `sk_test_`)

## 💳 Step 2: Create Products in Stripe

1. Go to **Products** in Stripe Dashboard
2. Create two products:

### Pro Plan
- Name: `Pro Plan`
- Price: `$29/month`
- Copy the **Price ID** (starts with `price_`)

### Business Plan  
- Name: `Business Plan`
- Price: `$99/month`
- Copy the **Price ID**

## 🔗 Step 3: Get Webhook Secret

1. Go to **Developers** → **Webhooks**
2. Click **Add endpoint**
3. URL: `https://your-app.vercel.app/api/stripe-webhook`
4. Events to listen for:
   - `checkout.session.completed`
   - `customer.subscription.updated`
   - `customer.subscription.deleted`
5. Copy the **Signing secret** (starts with `whsec_`)

## ⚙️ Step 4: Add Environment Variables to Vercel

Go to your Vercel project → **Settings** → **Environment Variables** and add:

```
STRIPE_SECRET_KEY=sk_test_xxxxx
STRIPE_PUBLISHABLE_KEY=pk_test_xxxxx
STRIPE_PRO_PRICE_ID=price_xxxxx
STRIPE_BUSINESS_PRICE_ID=price_xxxxx
STRIPE_WEBHOOK_SECRET=whsec_xxxxx

FIREBASE_PROJECT_ID=your-project-id
FIREBASE_CLIENT_EMAIL=firebase-adminsdk@xxx.iam.gserviceaccount.com
FIREBASE_PRIVATE_KEY="-----BEGIN PRIVATE KEY-----\nYOUR_KEY_HERE\n-----END PRIVATE KEY-----"

NEXT_PUBLIC_APP_URL=https://your-app.vercel.app
```

## 🚀 Step 5: Deploy

```bash
git add .
git commit -m "Add Stripe payment integration"
git push
```

Vercel will automatically deploy your changes.

## ✅ Step 6: Test the Integration

1. Go to Admin Panel → **Billing & Plans**
2. Click **Upgrade to Pro**
3. Use Stripe test card: `4242 4242 4242 4242`
4. Verify the webhook updates your organization in Firestore

## 🧪 Test Cards

| Card Number | Description |
|-------------|-------------|
| 4242 4242 4242 4242 | Success |
| 4000 0000 0000 0002 | Declined |
| 4000 0025 0000 3155 | Requires authentication |

**Expiry**: Any future date  
**CVC**: Any 3 digits  
**ZIP**: Any 5 digits

## 🔒 Security Notes

- Never commit API keys to Git
- Use Test Mode keys for development
- Switch to Live Mode keys only when ready for production
- Verify webhook signatures in production

## 📊 Monitoring

Check Stripe Dashboard → **Developers** → **Webhooks** to see webhook delivery status and debug any issues.
