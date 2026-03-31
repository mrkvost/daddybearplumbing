"""
Contact form handler.
Receives POST from the website, validates Turnstile token + honeypot,
sends email via SES to the business owner.
"""
import json
import os
import urllib.request
import boto3

ses = boto3.client("ses", region_name=os.environ["SES_REGION"])

TURNSTILE_SECRET = os.environ["TURNSTILE_SECRET"]
TO_EMAIL = os.environ["TO_EMAIL"]
FROM_EMAIL = os.environ["FROM_EMAIL"]

def handler(event, context):

    try:
        body = json.loads(event.get("body", "{}"))
    except json.JSONDecodeError:
        return error(400, "Invalid JSON")

    # Honeypot check — if filled, it's a bot
    if body.get("website"):
        return success()  # Silently accept to not reveal the trap

    name = body.get("name", "").strip()
    email = body.get("email", "").strip()
    phone = body.get("phone", "").strip()
    message = body.get("message", "").strip()
    token = body.get("turnstile_token", "")

    if not name or not email or not message:
        return error(400, "Name, email, and message are required")

    # Verify Turnstile token
    if not verify_turnstile(token):
        return error(403, "Verification failed")

    # Send email
    subject = f"Contact Form: {name}"
    text_body = (
        f"Name: {name}\n"
        f"Email: {email}\n"
        f"Phone: {phone or 'Not provided'}\n"
        f"\nMessage:\n{message}"
    )
    html_body = (
        f"<h3>New Contact Form Submission</h3>"
        f"<p><strong>Name:</strong> {name}</p>"
        f"<p><strong>Email:</strong> {email}</p>"
        f"<p><strong>Phone:</strong> {phone or 'Not provided'}</p>"
        f"<hr><p>{message}</p>"
    )

    try:
        ses.send_email(
            Source=FROM_EMAIL,
            Destination={"ToAddresses": [TO_EMAIL]},
            ReplyToAddresses=[email],
            Message={
                "Subject": {"Data": subject},
                "Body": {
                    "Text": {"Data": text_body},
                    "Html": {"Data": html_body},
                },
            },
        )
    except Exception as e:
        print(f"SES error: {e}")
        return error(500, "Failed to send email. Please try again later.")

    return success()


def verify_turnstile(token):
    if not token:
        return False
    data = json.dumps({
        "secret": TURNSTILE_SECRET,
        "response": token,
    }).encode()
    req = urllib.request.Request(
        "https://challenges.cloudflare.com/turnstile/v0/siteverify",
        data=data,
        headers={"Content-Type": "application/json"},
    )
    try:
        resp = urllib.request.urlopen(req, timeout=5)
        result = json.loads(resp.read())
        return result.get("success", False)
    except Exception:
        return False


def success():
    return {
        "statusCode": 200,
        "headers": {"Content-Type": "application/json"},
        "body": json.dumps({"ok": True}),
    }


def error(code, msg):
    return {
        "statusCode": code,
        "headers": {"Content-Type": "application/json"},
        "body": json.dumps({"ok": False, "error": msg}),
    }
