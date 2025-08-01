# DNS Configuration for @somoj.com Email Server

## Required DNS Records

### 1. A Records
```
mail.somoj.com.    A    YOUR_VPS_IP
somoj.com.         A    YOUR_VPS_IP
```

### 2. MX Records
```
somoj.com.         MX    10    mail.somoj.com.
```

### 3. SPF Record (TXT)
```
somoj.com.         TXT   "v=spf1 mx a ip4:YOUR_VPS_IP ~all"
```

### 4. DKIM Record (After setup)
```
default._domainkey.somoj.com.    TXT    "v=DKIM1; k=rsa; p=YOUR_PUBLIC_KEY"
```

### 5. DMARC Record
```
_dmarc.somoj.com.    TXT    "v=DMARC1; p=quarantine; rua=mailto:admin@somoj.com"
```

## DNS Verification Commands

```bash
# Check MX records
dig MX somoj.com

# Check SPF record
dig TXT somoj.com

# Check DKIM record
dig TXT default._domainkey.somoj.com

# Check DMARC record
dig TXT _dmarc.somoj.com
```

## Email Testing

```bash
# Test SMTP
telnet mail.somoj.com 25

# Test IMAP
telnet mail.somoj.com 143

# Test POP3
telnet mail.somoj.com 110
```

## SSL Certificate Setup

```bash
# Install Certbot
apt install certbot

# Get SSL certificate
certbot certonly --standalone -d mail.somoj.com -d somoj.com

# Update Postfix configuration
sed -i 's|/etc/ssl/certs/ssl-cert-snakeoil.pem|/etc/letsencrypt/live/mail.somoj.com/fullchain.pem|g' /etc/postfix/main.cf
sed -i 's|/etc/ssl/private/ssl-cert-snakeoil.key|/etc/letsencrypt/live/mail.somoj.com/privkey.pem|g' /etc/postfix/main.cf

# Restart services
systemctl restart postfix dovecot
```