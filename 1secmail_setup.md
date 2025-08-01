# 1secmail.com Email Setup Guide

## About 1secmail.com

1secmail.com is a free, temporary email service that provides:
- **Free email addresses** with @1secmail.com domain
- **Temporary/disposable emails** for testing
- **No registration required** - just choose a username
- **Web interface** for checking emails
- **API access** for programmatic email handling

## How to Use 1secmail.com

### 1. Get a Free Email Address

**Option A: Web Interface**
1. Go to [1secmail.com](https://1secmail.com)
2. Choose a username (e.g., `myproject`)
3. Your email will be: `myproject@1secmail.com`
4. Check emails at: `https://1secmail.com/en/?login=myproject`

**Option B: API Method**
```bash
# Generate random email
curl "https://www.1secmail.com/api/v1/?action=genRandomMailbox&count=1"

# Check emails for specific address
curl "https://www.1secmail.com/api/v1/?action=getMessages&login=myproject&domain=1secmail.com"
```

### 2. Email Client Configuration

Since 1secmail.com is primarily for temporary emails, it doesn't support standard IMAP/SMTP. However, you can:

#### Web Interface
- **URL**: https://1secmail.com/en/
- **Login**: Your chosen username
- **No password required**

#### API Access
```bash
# Get all messages
curl "https://www.1secmail.com/api/v1/?action=getMessages&login=USERNAME&domain=1secmail.com"

# Get specific message
curl "https://www.1secmail.com/api/v1/?action=readMessage&login=USERNAME&domain=1secmail.com&id=MESSAGE_ID"
```

### 3. For Your Domain (Custom Domain Setup)

If you want to use 1secmail.com with your own domain, you'll need to:

#### Option A: Forward Emails
1. Set up email forwarding from your domain to 1secmail.com
2. Configure your domain's DNS to forward emails

#### Option B: Use 1secmail.com API
Create a script to handle emails programmatically:

```bash
#!/bin/bash
# Email handler script for your domain

DOMAIN="yourdomain.com"
EMAIL_USER="your_username@1secmail.com"

# Check for new emails
curl "https://www.1secmail.com/api/v1/?action=getMessages&login=your_username&domain=1secmail.com" | jq '.[] | select(.seen == 0)'
```

### 4. Integration with Your 512MB VPS

#### Simple Email Handler Script
```bash
#!/bin/bash
# 1secmail.com integration for your VPS

EMAIL_USER="your_username"
DOMAIN="1secmail.com"
WEBHOOK_URL="https://yourdomain.com/webhook"

# Check for new emails every 5 minutes
while true; do
    # Get new messages
    NEW_MESSAGES=$(curl -s "https://www.1secmail.com/api/v1/?action=getMessages&login=$EMAIL_USER&domain=$DOMAIN" | jq '.[] | select(.seen == 0)')
    
    if [ ! -z "$NEW_MESSAGES" ]; then
        echo "New email received: $NEW_MESSAGES"
        
        # Process each new message
        echo "$NEW_MESSAGES" | jq -c '.[]' | while read -r message; do
            MESSAGE_ID=$(echo "$message" | jq -r '.id')
            
            # Get full message content
            MESSAGE_CONTENT=$(curl -s "https://www.1secmail.com/api/v1/?action=readMessage&login=$EMAIL_USER&domain=$DOMAIN&id=$MESSAGE_ID")
            
            # Process the email (your custom logic here)
            echo "Processing email ID: $MESSAGE_ID"
            
            # Send to webhook if needed
            curl -X POST "$WEBHOOK_URL" \
                -H "Content-Type: application/json" \
                -d "$MESSAGE_CONTENT"
        done
    fi
    
    sleep 300  # Wait 5 minutes
done
```

### 5. Web Interface Setup

Create a simple web interface to check emails:

```html
<!DOCTYPE html>
<html>
<head>
    <title>Email Checker</title>
</head>
<body>
    <h1>Email Checker</h1>
    <input type="text" id="username" placeholder="Username">
    <button onclick="checkEmails()">Check Emails</button>
    <div id="emails"></div>

    <script>
        async function checkEmails() {
            const username = document.getElementById('username').value;
            const response = await fetch(`https://www.1secmail.com/api/v1/?action=getMessages&login=${username}&domain=1secmail.com`);
            const emails = await response.json();
            
            const emailsDiv = document.getElementById('emails');
            emailsDiv.innerHTML = emails.map(email => 
                `<div><strong>${email.from}</strong>: ${email.subject}</div>`
            ).join('');
        }
    </script>
</body>
</html>
```

### 6. Docker Setup for Email Handler

```dockerfile
FROM alpine:latest

RUN apk add --no-cache curl jq

COPY email_handler.sh /app/email_handler.sh
RUN chmod +x /app/email_handler.sh

WORKDIR /app
CMD ["./email_handler.sh"]
```

### 7. Environment Variables

Create `.env` file:
```bash
EMAIL_USER=your_username
EMAIL_DOMAIN=1secmail.com
WEBHOOK_URL=https://yourdomain.com/webhook
CHECK_INTERVAL=300
```

### 8. Monitoring Script

```bash
#!/bin/bash
# Monitor 1secmail.com emails

EMAIL_USER="your_username"
DOMAIN="1secmail.com"

echo "=== 1secmail.com Email Monitor ==="
echo "Email: $EMAIL_USER@$DOMAIN"
echo "Time: $(date)"
echo ""

# Get recent messages
MESSAGES=$(curl -s "https://www.1secmail.com/api/v1/?action=getMessages&login=$EMAIL_USER&domain=$DOMAIN")

if [ "$MESSAGES" = "[]" ]; then
    echo "No emails found"
else
    echo "Recent emails:"
    echo "$MESSAGES" | jq -r '.[] | "\(.date) - \(.from): \(.subject)"'
fi

echo ""
echo "Web interface: https://1secmail.com/en/?login=$EMAIL_USER"
```

## Advantages of 1secmail.com

✅ **Free** - No cost involved  
✅ **No registration** - Instant email addresses  
✅ **API access** - Programmatic email handling  
✅ **Temporary** - Perfect for testing  
✅ **Simple** - No complex setup required  

## Limitations

❌ **Temporary** - Emails may be deleted after time  
❌ **No IMAP/SMTP** - Web/API only  
❌ **No custom domain** - Must use @1secmail.com  
❌ **Limited storage** - Not for long-term storage  

## Best Use Cases

- **Testing applications** that send emails
- **Temporary email addresses** for signups
- **Development environments** where you need email
- **Quick email verification** without setup

## For Your 512MB VPS

This is perfect for your VPS because:
- **No email server resources** needed
- **Lightweight** - just API calls
- **Free** - no additional costs
- **Simple** - minimal configuration required