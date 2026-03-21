# OptimizerV6 - Integration Requirements

Everything needed to complete the remaining integrations. Get these and hand them over.

---

## 1. OpenAI API Key (AI Content + Image Generation)

- **What**: API key for GPT-4 (review responses, social captions) + DALL-E (image gen)
- **Where**: https://platform.openai.com/api-keys
- **Steps**: Sign up / Login > API Keys > Create new secret key
- **Cost**: Pay-as-you-go, ~$5 credit to start
- **Time**: 2 minutes
- **Unlocks**: AI review response automation, rAIS social content, image generation

---

## 2. Resend API Key (Email Provider)

- **What**: API key for sending transactional + marketing emails
- **Where**: https://resend.com/api-keys
- **Steps**: Sign up > API Keys > Create API Key
- **Cost**: Free (3,000 emails/month), paid plans available
- **Time**: 2 minutes
- **Also needed**: Verify sender domain (add DNS records for `mail.rectangled.io` or your domain)
- **Unlocks**: Review request emails, coupon delivery, notifications, digest reports

---

## 3. Razorpay Keys (Payments & Billing)

- **What**: Key ID, Key Secret, Webhook Secret
- **Where**: https://dashboard.razorpay.com/app/keys
- **Steps**:
  1. Login to Razorpay Dashboard
  2. Settings > API Keys > Generate Test Key (copy both ID and Secret)
  3. Settings > Webhooks > Create Webhook > copy the secret
- **Cost**: Free in test mode, 2% per transaction in live mode
- **Time**: 5 minutes
- **Unlocks**: Subscription billing, plan management, invoice generation

---

## 4. Wapisnap (WhatsApp Integration)

- **What**: API Key, API Base URL, API Documentation
- **Where**: Your Wapisnap account dashboard
- **Steps**: Share the API docs (PDF/link) + API key
- **Time**: Depends on your account setup
- **Unlocks**: WhatsApp review requests, coupon delivery via WhatsApp, automated follow-ups

---

## 5. Google Business Profile - Write Access

- **What**: Enable write scopes on your existing GCP project
- **Where**: https://console.cloud.google.com
- **Steps**:
  1. Go to APIs & Services > Library
  2. Enable "My Business Business Information API" (if not already)
  3. Go to OAuth consent screen > Edit > Add scope: `https://www.googleapis.com/auth/business.manage`
  4. Save
- **Cost**: Free
- **Time**: 5 minutes
- **Unlocks**: Auto-posting AI review replies to GBP, creating GBP posts

---

## 6. Meta Business API (OPTIONAL - Social Media Posting)

- **What**: App ID, App Secret, Page Access Token
- **Where**: https://developers.facebook.com
- **Steps**:
  1. Create or select your app
  2. Settings > Basic > copy App ID and App Secret
  3. Use Graph API Explorer to generate a long-lived Page Access Token
  4. Permissions needed: `pages_manage_posts`, `instagram_content_publish`
  5. Link Instagram Business Account via your Facebook Page
- **Cost**: Free
- **Time**: 15 minutes
- **Unlocks**: Auto-posting to Instagram and Facebook from rAIS

---

## Decisions Needed

| Question | Options |
|----------|---------|
| Plan pricing (INR) | Free tier limits? Pro monthly price? Enterprise price? |
| Daily AI response limit | How many auto-replies per location per day? (e.g., 10, 25, 50) |

---

## Priority Order

| Priority | Item | Time | Impact |
|----------|------|------|--------|
| 1 | OpenAI API Key | 2 min | Unlocks all AI features |
| 2 | Resend API Key | 2 min | Unlocks email system |
| 3 | Razorpay Test Keys | 5 min | Unlocks billing |
| 4 | GBP Write Access | 5 min | Unlocks review reply posting |
| 5 | Wapisnap Docs + Key | varies | Unlocks WhatsApp |
| 6 | Meta Business API | 15 min | Unlocks social posting (optional) |

---

## Where to Add Keys

Once you have the keys, add them to the `.env` file at:
`apps/api/.env`

```
# AI
OPENAI_API_KEY=sk-...

# Email
RESEND_API_KEY=re_...

# Payments
RAZORPAY_KEY_ID=rzp_test_...
RAZORPAY_KEY_SECRET=...
RAZORPAY_WEBHOOK_SECRET=...

# WhatsApp
WAPISNAP_API_KEY=...
WAPISNAP_BASE_URL=...

# Meta (optional)
META_APP_ID=...
META_APP_SECRET=...
META_PAGE_ACCESS_TOKEN=...
```
