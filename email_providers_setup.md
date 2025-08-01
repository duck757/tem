# Email Provider Setup Guide

## Choose Your Email Provider

### 1. Google Workspace (Recommended)
**Cost**: $6/user/month
**Best for**: Professional business email

#### DNS Configuration:
```
# MX Records
yourdomain.com.    MX    1    aspmx.l.google.com.
yourdomain.com.    MX    5    alt1.aspmx.l.google.com.
yourdomain.com.    MX    5    alt2.aspmx.l.google.com.
yourdomain.com.    MX    10   alt3.aspmx.l.google.com.
yourdomain.com.    MX    10   alt4.aspmx.l.google.com.

# SPF Record
yourdomain.com.    TXT   "v=spf1 include:_spf.google.com ~all"

# DKIM Record (provided by Google)
google._domainkey.yourdomain.com.    TXT   "v=DKIM1; k=rsa; p=YOUR_GOOGLE_DKIM_KEY"

# DMARC Record
_dmarc.yourdomain.com.    TXT   "v=DMARC1; p=quarantine; rua=mailto:admin@yourdomain.com"
```

#### Setup Steps:
1. Go to [Google Workspace](https://workspace.google.com/)
2. Sign up for your domain
3. Verify domain ownership
4. Configure DNS records above
5. Create user accounts

---

### 2. Microsoft 365
**Cost**: $6/user/month
**Best for**: Microsoft ecosystem users

#### DNS Configuration:
```
# MX Records
yourdomain.com.    MX    0    yourdomain-com.mail.protection.outlook.com.

# SPF Record
yourdomain.com.    TXT   "v=spf1 include:spf.protection.outlook.com ~all"

# DKIM Record (provided by Microsoft)
selector1._domainkey.yourdomain.com.    CNAME   selector1-yourdomain-com._domainkey.yourdomain.onmicrosoft.com.

# DMARC Record
_dmarc.yourdomain.com.    TXT   "v=DMARC1; p=quarantine; rua=mailto:admin@yourdomain.com"
```

#### Setup Steps:
1. Go to [Microsoft 365](https://www.microsoft.com/microsoft-365/)
2. Sign up for Business plan
3. Add your domain
4. Configure DNS records above
5. Create user accounts

---

### 3. Zoho Mail (Budget Option)
**Cost**: Free (5 users) or $1/user/month
**Best for**: Small businesses on budget

#### DNS Configuration:
```
# MX Records
yourdomain.com.    MX    10   mx.zoho.com.
yourdomain.com.    MX    20   mx2.zoho.com.

# SPF Record
yourdomain.com.    TXT   "v=spf1 include:zoho.com ~all"

# DKIM Record (provided by Zoho)
zoho._domainkey.yourdomain.com.    TXT   "v=DKIM1; k=rsa; p=YOUR_ZOHO_DKIM_KEY"

# DMARC Record
_dmarc.yourdomain.com.    TXT   "v=DMARC1; p=quarantine; rua=mailto:admin@yourdomain.com"
```

#### Setup Steps:
1. Go to [Zoho Mail](https://www.zoho.com/mail/)
2. Sign up for business email
3. Add your domain
4. Configure DNS records above
5. Create user accounts

---

### 4. ProtonMail Business
**Cost**: $6.99/user/month
**Best for**: Security-conscious users

#### DNS Configuration:
```
# MX Records
yourdomain.com.    MX    10   mail.protonmail.ch.

# SPF Record
yourdomain.com.    TXT   "v=spf1 include:_spf.protonmail.ch ~all"

# DKIM Record (provided by ProtonMail)
protonmail._domainkey.yourdomain.com.    TXT   "v=DKIM1; k=rsa; p=YOUR_PROTONMAIL_DKIM_KEY"

# DMARC Record
_dmarc.yourdomain.com.    TXT   "v=DMARC1; p=quarantine; rua=mailto:admin@yourdomain.com"
```

#### Setup Steps:
1. Go to [ProtonMail Business](https://protonmail.com/business/)
2. Sign up for business plan
3. Add your domain
4. Configure DNS records above
5. Create user accounts

---

### 5. Fastmail
**Cost**: $3/user/month
**Best for**: Performance-focused users

#### DNS Configuration:
```
# MX Records
yourdomain.com.    MX    10   in1-smtp.messagingengine.com.
yourdomain.com.    MX    20   in2-smtp.messagingengine.com.

# SPF Record
yourdomain.com.    TXT   "v=spf1 include:spf.messagingengine.com ~all"

# DKIM Record (provided by Fastmail)
fm1._domainkey.yourdomain.com.    TXT   "v=DKIM1; k=rsa; p=YOUR_FASTMAIL_DKIM_KEY"

# DMARC Record
_dmarc.yourdomain.com.    TXT   "v=DMARC1; p=quarantine; rua=mailto:admin@yourdomain.com"
```

#### Setup Steps:
1. Go to [Fastmail](https://www.fastmail.com/)
2. Sign up for business plan
3. Add your domain
4. Configure DNS records above
5. Create user accounts

---

## DNS Verification Commands

```bash
# Check MX records
dig MX yourdomain.com

# Check SPF record
dig TXT yourdomain.com

# Check DKIM record (replace with your provider's selector)
dig TXT google._domainkey.yourdomain.com

# Check DMARC record
dig TXT _dmarc.yourdomain.com
```

## Email Client Configuration

### Thunderbird/Outlook Settings:
- **Incoming**: IMAP (your provider's server)
- **Outgoing**: SMTP (your provider's server)
- **Port**: 993 (IMAPS) / 587 (SMTP)
- **Security**: SSL/TLS

### Mobile Settings:
- **iOS**: Add account in Settings > Mail
- **Android**: Add account in Gmail app

## Comparison Table

| Provider | Cost/Month | Storage | Features | Best For |
|----------|------------|---------|----------|----------|
| Google Workspace | $6 | 30GB | Gmail, Drive, Docs | Professional |
| Microsoft 365 | $6 | 50GB | Outlook, Office | Microsoft users |
| Zoho Mail | $1 | 5GB | Webmail, mobile | Budget-conscious |
| ProtonMail | $6.99 | 500GB | Encryption, privacy | Security-focused |
| Fastmail | $3 | 30GB | Fast, reliable | Performance |

## Recommendation

**For most users**: Google Workspace or Microsoft 365
**For budget**: Zoho Mail
**For security**: ProtonMail
**For performance**: Fastmail