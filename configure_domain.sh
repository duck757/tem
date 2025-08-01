#!/bin/bash

# Domain Configuration Tool for Email Server
# This script helps you set up email for your domain

echo "=== Email Server Domain Configuration ==="
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
echo "Configuring email server for domain: $DOMAIN"
echo "Mail host will be: mail.$DOMAIN"
echo "Admin email will be: admin@$DOMAIN"
echo ""

# Create customized setup script
cat > email_setup_${DOMAIN}.sh << EOF
#!/bin/bash

# Email Server Setup for 512MB VPS
# Configured for domain: $DOMAIN

# Configuration
DOMAIN="$DOMAIN"
MAIL_HOST="mail.\$DOMAIN"
ADMIN_EMAIL="admin@\$DOMAIN"

echo "Setting up lightweight email server for @\$DOMAIN..."
echo "Mail host: \$MAIL_HOST"
echo "Admin email: \$ADMIN_EMAIL"
echo ""

# Update system
apt update && apt upgrade -y

# Install essential packages
apt install -y postfix dovecot-core dovecot-imapd dovecot-pop3d \\
    dovecot-mysql dovecot-sieve opendkim opendkim-tools \\
    fail2ban ufw

# Configure Postfix
cat > /etc/postfix/main.cf << 'POSTFIX_EOF'
# Basic Settings
myhostname = \$MAIL_HOST
mydomain = \$DOMAIN
myorigin = \\\$mydomain
inet_interfaces = all
inet_protocols = ipv4
mydestination = \\\$myhostname, localhost.\\\$mydomain, localhost, \\\$mydomain
mynetworks = 127.0.0.0/8, 10.0.0.0/8, 172.16.0.0/12, 192.168.0.0/16
home_mailbox = Maildir/

# Performance optimizations for 512MB VPS
smtpd_tls_security_level = may
smtpd_tls_cert_file = /etc/ssl/certs/ssl-cert-snakeoil.pem
smtpd_tls_key_file = /etc/ssl/private/ssl-cert-snakeoil.key
smtpd_use_tls = yes
smtpd_tls_session_cache_database = btree:\\\${data_directory}/smtpd_scache
smtp_tls_session_cache_database = btree:\\\${data_directory}/smtp_scache

# Resource limits
smtpd_client_restrictions = permit_mynetworks, reject
smtpd_helo_restrictions = permit_mynetworks, reject_invalid_helo_hostname, reject_non_fqdn_helo_hostname
smtpd_sender_restrictions = permit_mynetworks, reject_non_fqdn_sender, reject_unknown_sender_domain
smtpd_recipient_restrictions = permit_mynetworks, reject_unauth_destination, reject_invalid_hostname, reject_non_fqdn_hostname, reject_non_fqdn_recipient

# Memory optimizations
smtpd_process_limit = 10
smtpd_client_connection_limit = 5
smtpd_client_message_rate_limit = 30
smtpd_client_recipient_rate_limit = 30
smtpd_client_connection_rate_limit = 30
POSTFIX_EOF

# Configure Dovecot
cat > /etc/dovecot/conf.d/10-mail.conf << 'DOVECOT_MAIL_EOF'
mail_location = maildir:~/Maildir
namespace inbox {
  inbox = yes
}
DOVECOT_MAIL_EOF

cat > /etc/dovecot/conf.d/10-auth.conf << 'DOVECOT_AUTH_EOF'
disable_plaintext_auth = no
auth_mechanisms = plain login
DOVECOT_AUTH_EOF

cat > /etc/dovecot/conf.d/10-master.conf << 'DOVECOT_MASTER_EOF'
service imap-login {
  inet_listener imap {
    port = 143
  }
  inet_listener imaps {
    port = 993
    ssl = yes
  }
}

service pop3-login {
  inet_listener pop3 {
    port = 110
  }
  inet_listener pop3s {
    port = 995
    ssl = yes
  }
}

service lmtp {
  unix_listener lmtp {
    mode = 0666
  }
}

service auth {
  unix_listener auth-userdb {
    mode = 0666
    user = postfix
    group = postfix
  }
  unix_listener /var/spool/postfix/private/auth {
    mode = 0666
    user = postfix
    group = postfix
  }
}
DOVECOT_MASTER_EOF

# Create user for email
useradd -m -s /bin/bash \$ADMIN_EMAIL
echo "\$ADMIN_EMAIL:your_secure_password" | chpasswd

# Set up Maildir
mkdir -p /home/\$ADMIN_EMAIL/Maildir
chown -R \$ADMIN_EMAIL:\$ADMIN_EMAIL /home/\$ADMIN_EMAIL/Maildir

# Configure firewall
ufw allow 25/tcp   # SMTP
ufw allow 587/tcp  # SMTP submission
ufw allow 465/tcp  # SMTPS
ufw allow 143/tcp  # IMAP
ufw allow 993/tcp  # IMAPS
ufw allow 110/tcp  # POP3
ufw allow 995/tcp  # POP3S
ufw allow 80/tcp   # HTTP
ufw allow 443/tcp  # HTTPS
ufw allow 22/tcp   # SSH

# Start services
systemctl enable postfix dovecot
systemctl restart postfix dovecot

echo "Email server setup complete!"
echo "Domain: @\$DOMAIN"
echo "Admin email: \$ADMIN_EMAIL"
echo "Mail host: \$MAIL_HOST"
echo "Ports: 25(SMTP), 587(Submission), 143(IMAP), 993(IMAPS)"
echo ""
echo "Next steps:"
echo "1. Configure DNS records for \$DOMAIN"
echo "2. Set up SSL certificates"
echo "3. Configure SPF, DKIM, and DMARC"
echo "4. Test email delivery"
echo ""
echo "DNS Records needed:"
echo "A Record: \$MAIL_HOST -> YOUR_VPS_IP"
echo "MX Record: \$DOMAIN -> \$MAIL_HOST"
echo "SPF Record: \$DOMAIN -> v=spf1 mx a ip4:YOUR_VPS_IP ~all"
EOF

# Make the script executable
chmod +x email_setup_${DOMAIN}.sh

# Create DNS configuration file
cat > dns_setup_${DOMAIN}.md << EOF
# DNS Configuration for @$DOMAIN Email Server

## Required DNS Records

### 1. A Records
\`\`\`
mail.$DOMAIN.    A    YOUR_VPS_IP
$DOMAIN.         A    YOUR_VPS_IP
\`\`\`

### 2. MX Records
\`\`\`
$DOMAIN.         MX    10    mail.$DOMAIN.
\`\`\`

### 3. SPF Record (TXT)
\`\`\`
$DOMAIN.         TXT   "v=spf1 mx a ip4:YOUR_VPS_IP ~all"
\`\`\`

### 4. DKIM Record (After setup)
\`\`\`
default._domainkey.$DOMAIN.    TXT    "v=DKIM1; k=rsa; p=YOUR_PUBLIC_KEY"
\`\`\`

### 5. DMARC Record
\`\`\`
_dmarc.$DOMAIN.    TXT    "v=DMARC1; p=quarantine; rua=mailto:admin@$DOMAIN"
\`\`\`

## DNS Verification Commands

\`\`\`bash
# Check MX records
dig MX $DOMAIN

# Check SPF record
dig TXT $DOMAIN

# Check DKIM record
dig TXT default._domainkey.$DOMAIN

# Check DMARC record
dig TXT _dmarc.$DOMAIN
\`\`\`

## Email Testing

\`\`\`bash
# Test SMTP
telnet mail.$DOMAIN 25

# Test IMAP
telnet mail.$DOMAIN 143

# Test POP3
telnet mail.$DOMAIN 110
\`\`\`

## SSL Certificate Setup

\`\`\`bash
# Install Certbot
apt install certbot

# Get SSL certificate
certbot certonly --standalone -d mail.$DOMAIN -d $DOMAIN

# Update Postfix configuration
sed -i 's|/etc/ssl/certs/ssl-cert-snakeoil.pem|/etc/letsencrypt/live/mail.$DOMAIN/fullchain.pem|g' /etc/postfix/main.cf
sed -i 's|/etc/ssl/private/ssl-cert-snakeoil.key|/etc/letsencrypt/live/mail.$DOMAIN/privkey.pem|g' /etc/postfix/main.cf

# Restart services
systemctl restart postfix dovecot
\`\`\`
EOF

echo "Configuration complete!"
echo ""
echo "Files created:"
echo "- email_setup_${DOMAIN}.sh (run this to set up your email server)"
echo "- dns_setup_${DOMAIN}.md (DNS configuration guide)"
echo ""
echo "To set up your email server, run:"
echo "sudo ./email_setup_${DOMAIN}.sh"
echo ""
echo "Then configure your DNS records as described in dns_setup_${DOMAIN}.md"