#!/bin/bash

# Email Provider Setup Tool
# Helps you choose and configure email providers

echo "=== Email Provider Setup Tool ==="
echo ""

# Get domain from user
read -p "Enter your domain (e.g., mycompany.com): " DOMAIN

if [ -z "$DOMAIN" ]; then
    echo "Error: Domain cannot be empty"
    exit 1
fi

# Convert to lowercase
DOMAIN=$(echo "$DOMAIN" | tr '[:upper:]' '[:lower:]')

# Remove http/https if present
DOMAIN=$(echo "$DOMAIN" | sed 's|^https?://||')

# Remove www. if present
DOMAIN=$(echo "$DOMAIN" | sed 's|^www\.||')

echo ""
echo "Available Email Providers:"
echo "1. Google Workspace (\$6/user/month) - Professional"
echo "2. Microsoft 365 (\$6/user/month) - Microsoft ecosystem"
echo "3. Zoho Mail (\$1/user/month) - Budget option"
echo "4. ProtonMail (\$6.99/user/month) - Security-focused"
echo "5. Fastmail (\$3/user/month) - Performance-focused"
echo ""

read -p "Choose your email provider (1-5): " CHOICE

case $CHOICE in
    1)
        PROVIDER="Google Workspace"
        COST="\$6/user/month"
        SETUP_URL="https://workspace.google.com/"
        cat > dns_google_${DOMAIN}.txt << EOF
# Google Workspace DNS Configuration for $DOMAIN

## MX Records
$DOMAIN.    MX    1    aspmx.l.google.com.
$DOMAIN.    MX    5    alt1.aspmx.l.google.com.
$DOMAIN.    MX    5    alt2.aspmx.l.google.com.
$DOMAIN.    MX    10   alt3.aspmx.l.google.com.
$DOMAIN.    MX    10   alt4.aspmx.l.google.com.

## SPF Record
$DOMAIN.    TXT   "v=spf1 include:_spf.google.com ~all"

## DKIM Record (provided by Google)
google._domainkey.$DOMAIN.    TXT   "v=DKIM1; k=rsa; p=YOUR_GOOGLE_DKIM_KEY"

## DMARC Record
_dmarc.$DOMAIN.    TXT   "v=DMARC1; p=quarantine; rua=mailto:admin@$DOMAIN"
EOF
        ;;
    2)
        PROVIDER="Microsoft 365"
        COST="\$6/user/month"
        SETUP_URL="https://www.microsoft.com/microsoft-365/"
        cat > dns_microsoft_${DOMAIN}.txt << EOF
# Microsoft 365 DNS Configuration for $DOMAIN

## MX Records
$DOMAIN.    MX    0    $DOMAIN-com.mail.protection.outlook.com.

## SPF Record
$DOMAIN.    TXT   "v=spf1 include:spf.protection.outlook.com ~all"

## DKIM Record (provided by Microsoft)
selector1._domainkey.$DOMAIN.    CNAME   selector1-$DOMAIN-com._domainkey.$DOMAIN.onmicrosoft.com.

## DMARC Record
_dmarc.$DOMAIN.    TXT   "v=DMARC1; p=quarantine; rua=mailto:admin@$DOMAIN"
EOF
        ;;
    3)
        PROVIDER="Zoho Mail"
        COST="\$1/user/month"
        SETUP_URL="https://www.zoho.com/mail/"
        cat > dns_zoho_${DOMAIN}.txt << EOF
# Zoho Mail DNS Configuration for $DOMAIN

## MX Records
$DOMAIN.    MX    10   mx.zoho.com.
$DOMAIN.    MX    20   mx2.zoho.com.

## SPF Record
$DOMAIN.    TXT   "v=spf1 include:zoho.com ~all"

## DKIM Record (provided by Zoho)
zoho._domainkey.$DOMAIN.    TXT   "v=DKIM1; k=rsa; p=YOUR_ZOHO_DKIM_KEY"

## DMARC Record
_dmarc.$DOMAIN.    TXT   "v=DMARC1; p=quarantine; rua=mailto:admin@$DOMAIN"
EOF
        ;;
    4)
        PROVIDER="ProtonMail"
        COST="\$6.99/user/month"
        SETUP_URL="https://protonmail.com/business/"
        cat > dns_protonmail_${DOMAIN}.txt << EOF
# ProtonMail DNS Configuration for $DOMAIN

## MX Records
$DOMAIN.    MX    10   mail.protonmail.ch.

## SPF Record
$DOMAIN.    TXT   "v=spf1 include:_spf.protonmail.ch ~all"

## DKIM Record (provided by ProtonMail)
protonmail._domainkey.$DOMAIN.    TXT   "v=DKIM1; k=rsa; p=YOUR_PROTONMAIL_DKIM_KEY"

## DMARC Record
_dmarc.$DOMAIN.    TXT   "v=DMARC1; p=quarantine; rua=mailto:admin@$DOMAIN"
EOF
        ;;
    5)
        PROVIDER="Fastmail"
        COST="\$3/user/month"
        SETUP_URL="https://www.fastmail.com/"
        cat > dns_fastmail_${DOMAIN}.txt << EOF
# Fastmail DNS Configuration for $DOMAIN

## MX Records
$DOMAIN.    MX    10   in1-smtp.messagingengine.com.
$DOMAIN.    MX    20   in2-smtp.messagingengine.com.

## SPF Record
$DOMAIN.    TXT   "v=spf1 include:spf.messagingengine.com ~all"

## DKIM Record (provided by Fastmail)
fm1._domainkey.$DOMAIN.    TXT   "v=DKIM1; k=rsa; p=YOUR_FASTMAIL_DKIM_KEY"

## DMARC Record
_dmarc.$DOMAIN.    TXT   "v=DMARC1; p=quarantine; rua=mailto:admin@$DOMAIN"
EOF
        ;;
    *)
        echo "Invalid choice. Please run the script again."
        exit 1
        ;;
esac

echo ""
echo "=== Configuration Complete ==="
echo "Provider: $PROVIDER"
echo "Cost: $COST"
echo "Domain: $DOMAIN"
echo ""
echo "Next steps:"
echo "1. Sign up at: $SETUP_URL"
echo "2. Add your domain: $DOMAIN"
echo "3. Configure DNS records from: dns_${PROVIDER,,}_${DOMAIN}.txt"
echo "4. Create user accounts"
echo ""
echo "DNS verification commands:"
echo "dig MX $DOMAIN"
echo "dig TXT $DOMAIN"
echo "dig TXT _dmarc.$DOMAIN"
echo ""
echo "Files created:"
echo "- dns_${PROVIDER,,}_${DOMAIN}.txt (DNS configuration)"
echo ""
echo "Your email addresses will be: username@$DOMAIN"