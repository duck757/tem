#!/bin/bash

# 1secmail.com Setup Script for 512MB VPS
# This script sets up email handling using 1secmail.com

echo "=== 1secmail.com Email Setup ==="
echo ""

# Get username from user
read -p "Enter your 1secmail.com username (e.g., myproject): " EMAIL_USER

if [ -z "$EMAIL_USER" ]; then
    echo "Error: Username cannot be empty"
    exit 1
fi

# Convert to lowercase
EMAIL_USER=$(echo "$EMAIL_USER" | tr '[:upper:]' '[:lower:]')

EMAIL_ADDRESS="${EMAIL_USER}@1secmail.com"

echo ""
echo "Setting up email for: $EMAIL_ADDRESS"
echo ""

# Create email handler script
cat > email_handler.sh << EOF
#!/bin/bash

# 1secmail.com Email Handler
# Monitors emails and processes them

EMAIL_USER="$EMAIL_USER"
DOMAIN="1secmail.com"
LOG_FILE="/var/log/email_handler.log"
WEBHOOK_URL=""

# Create log file if it doesn't exist
touch \$LOG_FILE

echo "\$(date): Starting email handler for \$EMAIL_USER@\$DOMAIN" >> \$LOG_FILE

while true; do
    # Get new messages
    NEW_MESSAGES=\$(curl -s "https://www.1secmail.com/api/v1/?action=getMessages&login=\$EMAIL_USER&domain=\$DOMAIN" | jq '.[] | select(.seen == 0)')
    
    if [ ! -z "\$NEW_MESSAGES" ] && [ "\$NEW_MESSAGES" != "null" ]; then
        echo "\$(date): New emails found" >> \$LOG_FILE
        
        # Process each new message
        echo "\$NEW_MESSAGES" | jq -c '.[]' | while read -r message; do
            MESSAGE_ID=\$(echo "\$message" | jq -r '.id')
            SENDER=\$(echo "\$message" | jq -r '.from')
            SUBJECT=\$(echo "\$message" | jq -r '.subject')
            
            echo "\$(date): Processing email ID: \$MESSAGE_ID from \$SENDER" >> \$LOG_FILE
            
            # Get full message content
            MESSAGE_CONTENT=\$(curl -s "https://www.1secmail.com/api/v1/?action=readMessage&login=\$EMAIL_USER&domain=\$DOMAIN&id=\$MESSAGE_ID")
            
            # Log the email
            echo "\$(date): Email from \$SENDER - Subject: \$SUBJECT" >> \$LOG_FILE
            
            # Send to webhook if configured
            if [ ! -z "\$WEBHOOK_URL" ]; then
                curl -X POST "\$WEBHOOK_URL" \\
                    -H "Content-Type: application/json" \\
                    -d "\$MESSAGE_CONTENT" \\
                    >> \$LOG_FILE 2>&1
            fi
            
            # You can add custom processing here
            # For example, save to file, send notifications, etc.
            
        done
    fi
    
    sleep 60  # Check every minute
done
EOF

# Create monitoring script
cat > email_monitor.sh << EOF
#!/bin/bash

# 1secmail.com Email Monitor

EMAIL_USER="$EMAIL_USER"
DOMAIN="1secmail.com"

echo "=== 1secmail.com Email Monitor ==="
echo "Email: \$EMAIL_USER@\$DOMAIN"
echo "Time: \$(date)"
echo ""

# Get recent messages
MESSAGES=\$(curl -s "https://www.1secmail.com/api/v1/?action=getMessages&login=\$EMAIL_USER&domain=\$DOMAIN")

if [ "\$MESSAGES" = "[]" ] || [ "\$MESSAGES" = "null" ]; then
    echo "No emails found"
else
    echo "Recent emails:"
    echo "\$MESSAGES" | jq -r '.[] | "\\(.date) - \\(.from): \\(.subject)"' 2>/dev/null || echo "Error parsing emails"
fi

echo ""
echo "Web interface: https://1secmail.com/en/?login=\$EMAIL_USER"
echo "API endpoint: https://www.1secmail.com/api/v1/?action=getMessages&login=\$EMAIL_USER&domain=\$DOMAIN"
EOF

# Create web interface
cat > email_web.html << EOF
<!DOCTYPE html>
<html>
<head>
    <title>1secmail.com Email Checker</title>
    <style>
        body { font-family: Arial, sans-serif; margin: 20px; }
        .email { border: 1px solid #ddd; padding: 10px; margin: 5px 0; border-radius: 5px; }
        .email.unread { background-color: #f0f8ff; }
        .email.read { background-color: #f9f9f9; }
        button { padding: 10px 20px; background: #007cba; color: white; border: none; border-radius: 5px; cursor: pointer; }
        input { padding: 8px; width: 200px; margin-right: 10px; }
        .status { margin: 10px 0; padding: 10px; border-radius: 5px; }
        .status.success { background-color: #d4edda; color: #155724; }
        .status.error { background-color: #f8d7da; color: #721c24; }
    </style>
</head>
<body>
    <h1>1secmail.com Email Checker</h1>
    
    <div>
        <input type="text" id="username" placeholder="Username" value="$EMAIL_USER">
        <button onclick="checkEmails()">Check Emails</button>
        <button onclick="startAutoCheck()">Auto Check (30s)</button>
        <button onclick="stopAutoCheck()">Stop Auto Check</button>
    </div>
    
    <div id="status"></div>
    <div id="emails"></div>

    <script>
        let autoCheckInterval;
        
        async function checkEmails() {
            const username = document.getElementById('username').value;
            const statusDiv = document.getElementById('status');
            const emailsDiv = document.getElementById('emails');
            
            if (!username) {
                statusDiv.innerHTML = '<div class="status error">Please enter a username</div>';
                return;
            }
            
            try {
                statusDiv.innerHTML = '<div class="status success">Checking emails...</div>';
                
                const response = await fetch(\`https://www.1secmail.com/api/v1/?action=getMessages&login=\${username}&domain=1secmail.com\`);
                const emails = await response.json();
                
                if (emails.length === 0) {
                    emailsDiv.innerHTML = '<div class="email">No emails found</div>';
                    statusDiv.innerHTML = '<div class="status success">No new emails</div>';
                } else {
                    emailsDiv.innerHTML = emails.map(email => 
                        \`<div class="email \${email.seen ? 'read' : 'unread'}">
                            <strong>\${email.from}</strong><br>
                            <strong>Subject:</strong> \${email.subject}<br>
                            <strong>Date:</strong> \${email.date}<br>
                            <strong>ID:</strong> \${email.id}
                        </div>\`
                    ).join('');
                    
                    statusDiv.innerHTML = \`<div class="status success">Found \${emails.length} email(s)</div>\`;
                }
            } catch (error) {
                statusDiv.innerHTML = '<div class="status error">Error checking emails: ' + error.message + '</div>';
            }
        }
        
        function startAutoCheck() {
            if (autoCheckInterval) {
                clearInterval(autoCheckInterval);
            }
            autoCheckInterval = setInterval(checkEmails, 30000); // 30 seconds
            checkEmails(); // Check immediately
        }
        
        function stopAutoCheck() {
            if (autoCheckInterval) {
                clearInterval(autoCheckInterval);
                autoCheckInterval = null;
            }
        }
        
        // Check emails on page load
        window.onload = function() {
            if (document.getElementById('username').value) {
                checkEmails();
            }
        };
    </script>
</body>
</html>
EOF

# Create systemd service file
cat > /etc/systemd/system/email-handler.service << EOF
[Unit]
Description=1secmail.com Email Handler
After=network.target

[Service]
Type=simple
User=root
WorkingDirectory=/root
ExecStart=/root/email_handler.sh
Restart=always
RestartSec=10

[Install]
WantedBy=multi-user.target
EOF

# Make scripts executable
chmod +x email_handler.sh email_monitor.sh

# Install required packages
apt update
apt install -y curl jq

echo ""
echo "=== Setup Complete ==="
echo "Email address: $EMAIL_ADDRESS"
echo ""
echo "Files created:"
echo "- email_handler.sh (background email processor)"
echo "- email_monitor.sh (email monitoring script)"
echo "- email_web.html (web interface)"
echo "- /etc/systemd/system/email-handler.service (system service)"
echo ""
echo "Commands:"
echo "- Start email handler: sudo systemctl start email-handler"
echo "- Enable auto-start: sudo systemctl enable email-handler"
echo "- Check status: sudo systemctl status email-handler"
echo "- Monitor emails: ./email_monitor.sh"
echo "- Web interface: Open email_web.html in browser"
echo ""
echo "Web interface URLs:"
echo "- Local: file://$(pwd)/email_web.html"
echo "- 1secmail.com: https://1secmail.com/en/?login=$EMAIL_USER"
echo ""
echo "API endpoints:"
echo "- Check emails: https://www.1secmail.com/api/v1/?action=getMessages&login=$EMAIL_USER&domain=1secmail.com"
echo "- Read message: https://www.1secmail.com/api/v1/?action=readMessage&login=$EMAIL_USER&domain=1secmail.com&id=MESSAGE_ID"