# Contact Form Setup

## Overview

The contact form uses:
- **Cloudflare Turnstile** — invisible bot protection (free)
- **AWS Lambda** — receives form submissions (function URL, no API Gateway)
- **AWS SES** — sends emails from `contactform@yourdomain.com`
- **Honeypot field** — hidden field that traps bots

Visitor submits form → Turnstile validates → Lambda verifies token → SES sends email to your inbox.

---

## Step 1: Cloudflare Turnstile

1. Go to https://dash.cloudflare.com/
2. Create a free Cloudflare account if you don't have one
3. In the left sidebar, click **Turnstile**
4. Click **Add site**
5. Fill in:
   - **Site name:** Your business name (e.g. "Daddy Bear Plumbing")
   - **Domain:** your domain (e.g. `daddybearplumbing.com`)
   - **Widget type:** Managed (invisible when possible, shows challenge if suspicious)
6. Click **Create**
7. You'll see two keys:
   - **Site Key** (public) — goes in Angular `environment.ts`
   - **Secret Key** (private) — goes in `terraform.tfvars`
8. Save both keys somewhere safe

---

## Step 2: Terraform Configuration

Add to `infrastructure/terraform.tfvars`:

```hcl
contact_email    = "info+contactform@yourdomain.com"
turnstile_secret = "0x4AAAA..."  # Secret Key from Turnstile dashboard
```

**Notes on `contact_email`:**
- This is where contact form submissions land
- Use `+contactform` for easy Gmail/Workspace filtering (e.g. `info+contactform@yourdomain.com`)
- Emails to `info+anything@` arrive in the `info@` inbox — the `+tag` is ignored for delivery but preserved for filtering
- You only need one Google Workspace seat (`info@`) — no extra mailbox needed

---

## Step 3: Apply Terraform

```bash
cd infrastructure
terraform plan    # Review: SES domain identity, DNS records, Lambda function
terraform apply
```

This creates:
- SES domain identity + DKIM DNS records (Route53)
- Lambda function with function URL
- IAM role scoped to `ses:SendEmail` from `contactform@yourdomain.com` only
- Reserved concurrency = 10

Get the Lambda URL:
```bash
terraform output contact_form_url
# Example: https://abc123def456.lambda-url.eu-central-1.on.aws/
```

---

## Step 4: Angular Configuration

Edit `src/environments/environment.ts`:

```typescript
contactFormUrl: 'https://abc123def456.lambda-url.eu-central-1.on.aws/',  // from terraform output
turnstileSiteKey: '0x4AAAA...',  // Site Key from Turnstile dashboard
```

---

## Step 5: Build & Deploy

```bash
cd ..
./docker_build.sh
./deploy.sh
```

The contact form is at `/contact` (not linked in the menu until you add it).

---

## Step 6: SES Email Setup

### SES Sandbox (new accounts)

New AWS accounts start in SES **sandbox mode** — you can only send to verified email addresses. This is fine for testing.

Verify your receiving email:
```bash
aws ses verify-email-identity --email-address info@yourdomain.com
```

Check your inbox and click the confirmation link.

### Check SES Domain Verification

The Terraform apply created DNS records for SES domain verification. Check status:
```bash
aws ses get-identity-verification-attributes --identities yourdomain.com
```

Should show `"VerificationStatus": "Success"`. If still pending, wait a few minutes for DNS propagation.

### Request SES Production Access (when ready for real users)

In sandbox mode, you can only send to verified emails. To send to any visitor's email (reply-to), request production access:

1. Go to **AWS Console → SES → Account dashboard**
2. Click **Request production access**
3. Fill in:
   - **Mail type:** Transactional
   - **Website URL:** your domain
   - **Use case:** "Contact form submissions from our business website. Low volume, ~5-10 emails per day."
4. AWS typically approves within 24 hours

**Note:** Production access isn't needed if you only want to receive contact form emails at your own verified address. It's only needed if you want SES to send confirmation/reply emails to visitors.

---

## Step 7: Gmail / Google Workspace Filter (optional)

Set up a filter so contact form emails are auto-labeled:

1. In Gmail, click the search bar → **Show search options**
2. **To:** `info+contactform@yourdomain.com`
3. Click **Create filter**
4. Check:
   - **Apply the label:** → Create new label "Contact Form"
   - **Never send to Spam** (recommended)
5. Click **Create filter**

Now all contact form submissions get the "Contact Form" label automatically.

---

## How It Works

```
Visitor fills form on /contact
  ↓
Turnstile generates token (invisible, runs in background)
  ↓
Browser POSTs to Lambda function URL:
  { name, email, phone, message, website (honeypot), turnstile_token }
  ↓
Lambda checks:
  1. Honeypot field filled? → silently accept (don't reveal the trap)
  2. Turnstile token valid? → verify with Cloudflare API
  3. Required fields present? → name, email, message
  ↓
SES sends email:
  FROM:     contactform@yourdomain.com  (no mailbox needed, SES authorized via DNS)
  TO:       info+contactform@yourdomain.com  (your real inbox)
  REPLY-TO: visitor's email  (so you can reply directly)
  ↓
Business owner sees email in inbox, replies directly to visitor
```

---

## Security Layers

| Layer | What it does | Stops |
|-------|-------------|-------|
| Turnstile | Verifies human visitor | Automated bots |
| Honeypot | Hidden field bots fill in | Dumb bots |
| CORS | Only accepts requests from your domain | Casual cross-site abuse |
| Reserved concurrency (10) | Max 10 simultaneous Lambda invocations | Cost runaway |
| Frontend retry | Retries 2x on 429 with 1s delay | Transient throttling |
| IAM policy | Lambda can only send from `contactform@` | Privilege escalation |

---

## Costs

| Service | Cost |
|---------|------|
| Cloudflare Turnstile | Free (unlimited) |
| Lambda | Free tier: 1M requests/month |
| SES | Free tier: 3,000 emails/month (from AWS-hosted app) |
| **Total** | **$0** for typical plumbing company volume |
