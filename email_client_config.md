# Email Client Configuration for @somoj.com

## Server Settings

### Incoming Mail (IMAP)
- **Server**: mail.somoj.com
- **Port**: 143 (IMAP) or 993 (IMAPS)
- **Security**: STARTTLS or SSL/TLS
- **Username**: your_email@somoj.com
- **Password**: your_password

### Outgoing Mail (SMTP)
- **Server**: mail.somoj.com
- **Port**: 587 (SMTP) or 465 (SMTPS)
- **Security**: STARTTLS or SSL/TLS
- **Username**: your_email@somoj.com
- **Password**: your_password

## Popular Email Clients

### Thunderbird Configuration
1. Open Thunderbird
2. Go to Account Settings
3. Add new email account
4. Enter: your_email@somoj.com
5. Choose "IMAP (remote folders)"
6. Enter password
7. Manual configuration:
   - Incoming: mail.somoj.com, port 143, IMAP
   - Outgoing: mail.somoj.com, port 587, SMTP

### Outlook Configuration
1. Open Outlook
2. Add Account
3. Enter: your_email@somoj.com
4. Choose "IMAP/SMTP"
5. Server settings:
   - Incoming: mail.somoj.com:143
   - Outgoing: mail.somoj.com:587

### Gmail Configuration
1. Add account to Gmail
2. Use IMAP settings above
3. Enable "Less secure app access" or use App passwords

### Mobile Configuration
#### iOS Mail App
1. Settings > Mail > Accounts > Add Account
2. Choose "Other"
3. Enter IMAP settings above

#### Android Gmail App
1. Add account
2. Choose "Personal (IMAP)"
3. Enter server settings above

## Webmail Access

### Roundcube Webmail (Optional)
```bash
# Install Roundcube
apt install roundcube roundcube-mysql

# Configure Apache
a2enmod ssl
a2ensite default-ssl

# Access at: https://mail.somoj.com/roundcube
```

### SquirrelMail (Lightweight Alternative)
```bash
# Install SquirrelMail
apt install squirrelmail

# Configure
squirrelmail-configure

# Access at: http://mail.somoj.com/squirrelmail
```

## Troubleshooting

### Common Issues
1. **Connection Refused**: Check firewall settings
2. **Authentication Failed**: Verify username/password
3. **SSL Errors**: Check certificate configuration
4. **Port Blocked**: Verify ISP allows email ports

### Test Commands
```bash
# Test SMTP
telnet mail.somoj.com 25

# Test IMAP
telnet mail.somoj.com 143

# Test SSL
openssl s_client -connect mail.somoj.com:993
```

## Security Recommendations

1. **Use SSL/TLS**: Always enable encryption
2. **Strong Passwords**: Use complex passwords
3. **Regular Updates**: Keep system updated
4. **Fail2ban**: Monitor for brute force attacks
5. **Backup**: Regular email backups