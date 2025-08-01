#!/bin/bash

# 1secmail.com API Test Tool
# Helps debug email content issues

echo "=== 1secmail.com API Test Tool ==="
echo ""

# Get username from user
read -p "Enter your 1secmail.com username: " USERNAME

if [ -z "$USERNAME" ]; then
    echo "Error: Username cannot be empty"
    exit 1
fi

# Convert to lowercase
USERNAME=$(echo "$USERNAME" | tr '[:upper:]' '[:lower:]')

echo ""
echo "Testing API for: $USERNAME@1secmail.com"
echo ""

# Test 1: Check if we can connect to the API
echo "1. Testing API connection..."
RESPONSE=$(curl -s "https://www.1secmail.com/api/v1/?action=getMessages&login=$USERNAME&domain=1secmail.com")

if [ $? -eq 0 ]; then
    echo "✅ API connection successful"
else
    echo "❌ API connection failed"
    exit 1
fi

# Test 2: Check response format
echo ""
echo "2. Checking response format..."
if [ "$RESPONSE" = "[]" ]; then
    echo "✅ API responding correctly (no emails)"
    echo "Response: $RESPONSE"
elif echo "$RESPONSE" | jq . >/dev/null 2>&1; then
    echo "✅ API response is valid JSON"
    EMAIL_COUNT=$(echo "$RESPONSE" | jq length)
    echo "Found $EMAIL_COUNT email(s)"
else
    echo "❌ API response is not valid JSON"
    echo "Response: $RESPONSE"
    exit 1
fi

# Test 3: Get detailed email information
if [ "$RESPONSE" != "[]" ]; then
    echo ""
    echo "3. Analyzing email structure..."
    echo "$RESPONSE" | jq '.[0]' > /tmp/email_sample.json
    echo "✅ Sample email saved to /tmp/email_sample.json"
    
    echo ""
    echo "Email fields found:"
    echo "$RESPONSE" | jq '.[0] | keys' 2>/dev/null || echo "Could not parse email structure"
    
    echo ""
    echo "First email details:"
    echo "$RESPONSE" | jq '.[0] | {id, from, subject, date, seen}' 2>/dev/null || echo "Could not parse email details"
fi

# Test 4: Test reading specific email
if [ "$RESPONSE" != "[]" ]; then
    echo ""
    echo "4. Testing email content retrieval..."
    FIRST_EMAIL_ID=$(echo "$RESPONSE" | jq -r '.[0].id')
    
    if [ "$FIRST_EMAIL_ID" != "null" ] && [ "$FIRST_EMAIL_ID" != "" ]; then
        echo "Testing with email ID: $FIRST_EMAIL_ID"
        
        EMAIL_CONTENT=$(curl -s "https://www.1secmail.com/api/v1/?action=readMessage&login=$USERNAME&domain=1secmail.com&id=$FIRST_EMAIL_ID")
        
        if echo "$EMAIL_CONTENT" | jq . >/dev/null 2>&1; then
            echo "✅ Email content retrieved successfully"
            echo "Content fields:"
            echo "$EMAIL_CONTENT" | jq 'keys' 2>/dev/null || echo "Could not parse content structure"
            
            # Save full email content
            echo "$EMAIL_CONTENT" | jq . > /tmp/email_content.json
            echo "✅ Full email content saved to /tmp/email_content.json"
            
            # Show email body preview
            echo ""
            echo "Email body preview:"
            echo "$EMAIL_CONTENT" | jq -r '.body // .textBody // "(No body found)"' | head -10
        else
            echo "❌ Failed to retrieve email content"
            echo "Response: $EMAIL_CONTENT"
        fi
    else
        echo "❌ Could not get email ID for testing"
    fi
fi

# Test 5: Generate test email
echo ""
echo "5. Testing email generation..."
echo "You can send a test email to $USERNAME@1secmail.com"
echo "Then run this script again to see if it appears."

# Test 6: Show web interface URLs
echo ""
echo "6. Web interface URLs:"
echo "Official 1secmail.com: https://1secmail.com/en/?login=$USERNAME"
echo "API endpoint: https://www.1secmail.com/api/v1/?action=getMessages&login=$USERNAME&domain=1secmail.com"

# Test 7: Create a simple HTML test page
echo ""
echo "7. Creating test HTML page..."
cat > test_email_$USERNAME.html << EOF
<!DOCTYPE html>
<html>
<head>
    <title>Email Test for $USERNAME</title>
    <style>
        body { font-family: Arial, sans-serif; margin: 20px; }
        .email { border: 1px solid #ccc; padding: 10px; margin: 10px 0; }
        .error { color: red; }
        .success { color: green; }
        pre { background: #f5f5f5; padding: 10px; overflow-x: auto; }
    </style>
</head>
<body>
    <h1>Email Test for $USERNAME@1secmail.com</h1>
    <button onclick="testAPI()">Test API</button>
    <div id="result"></div>

    <script>
        async function testAPI() {
            const resultDiv = document.getElementById('result');
            resultDiv.innerHTML = 'Testing...';
            
            try {
                const response = await fetch('https://www.1secmail.com/api/v1/?action=getMessages&login=$USERNAME&domain=1secmail.com');
                const emails = await response.json();
                
                if (emails.length === 0) {
                    resultDiv.innerHTML = '<div class="success">No emails found</div>';
                } else {
                    let html = '<h3>Emails found:</h3>';
                    emails.forEach(email => {
                        html += \`
                            <div class="email">
                                <strong>From:</strong> \${email.from}<br>
                                <strong>Subject:</strong> \${email.subject || '(No Subject)'}<br>
                                <strong>Date:</strong> \${email.date}<br>
                                <strong>ID:</strong> \${email.id}<br>
                                <strong>Seen:</strong> \${email.seen ? 'Yes' : 'No'}
                            </div>
                        \`;
                    });
                    resultDiv.innerHTML = html;
                }
            } catch (error) {
                resultDiv.innerHTML = '<div class="error">Error: ' + error.message + '</div>';
            }
        }
        
        // Test on page load
        window.onload = testAPI;
    </script>
</body>
</html>
EOF

echo "✅ Test HTML page created: test_email_$USERNAME.html"
echo "Open this file in your browser to test the API"

echo ""
echo "=== Test Complete ==="
echo ""
echo "Files created:"
echo "- /tmp/email_sample.json (sample email structure)"
echo "- /tmp/email_content.json (full email content)"
echo "- test_email_$USERNAME.html (test web page)"
echo ""
echo "If you're having issues with email content:"
echo "1. Check the JSON files for the actual data structure"
echo "2. Open the test HTML page in your browser"
echo "3. Compare with the official 1secmail.com interface"