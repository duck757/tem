#!/bin/bash

# Email Server Monitor for 512MB VPS
# Monitors Postfix, Dovecot, and system resources

echo "=== Email Server Monitor for @somoj.com ==="
echo "Date: $(date)"
echo ""

# System Resources
echo "=== System Resources ==="
echo "Memory Usage:"
free -h
echo ""
echo "Disk Usage:"
df -h
echo ""
echo "CPU Load:"
uptime
echo ""

# Email Services Status
echo "=== Email Services Status ==="
echo "Postfix Status:"
systemctl is-active postfix
echo "Dovecot Status:"
systemctl is-active dovecot
echo ""

# Email Queue
echo "=== Email Queue ==="
mailq | head -10
echo ""

# Active Connections
echo "=== Active Connections ==="
echo "SMTP Connections:"
netstat -an | grep :25 | wc -l
echo "IMAP Connections:"
netstat -an | grep :143 | wc -l
echo "IMAPS Connections:"
netstat -an | grep :993 | wc -l
echo ""

# Mail Logs (Last 10 entries)
echo "=== Recent Mail Logs ==="
tail -10 /var/log/mail.log
echo ""

# User Mailbox Sizes
echo "=== Mailbox Sizes ==="
du -sh /home/*/Maildir 2>/dev/null || echo "No mailboxes found"
echo ""

# DNS Records Check
echo "=== DNS Records Check ==="
echo "MX Record:"
dig MX somoj.com +short
echo "SPF Record:"
dig TXT somoj.com +short
echo ""

# SSL Certificate Status
echo "=== SSL Certificate Status ==="
if [ -f /etc/letsencrypt/live/mail.somoj.com/fullchain.pem ]; then
    echo "SSL Certificate: Valid"
    openssl x509 -in /etc/letsencrypt/live/mail.somoj.com/fullchain.pem -text -noout | grep "Not After"
else
    echo "SSL Certificate: Not configured"
fi
echo ""

# Performance Metrics
echo "=== Performance Metrics ==="
echo "Postfix Process Count:"
ps aux | grep postfix | grep -v grep | wc -l
echo "Dovecot Process Count:"
ps aux | grep dovecot | grep -v grep | wc -l
echo ""

# Memory Usage by Email Services
echo "=== Memory Usage by Email Services ==="
ps aux | grep -E "(postfix|dovecot)" | grep -v grep | awk '{print $2, $3, $4, $11}' | head -5
echo ""

echo "=== End of Report ==="