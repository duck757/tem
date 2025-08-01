# TempMail VPS Deployment Guide (512MB)

## 🚀 Quick VPS Setup

### 1. Server Requirements
- **RAM**: 512MB (optimized for this)
- **Storage**: 10GB minimum
- **OS**: Ubuntu 20.04/22.04 LTS recommended
- **Node.js**: Version 16+ (18+ preferred)

### 2. Initial Server Setup

```bash
# Update system
sudo apt update && sudo apt upgrade -y

# Install Node.js 18.x
curl -fsSL https://deb.nodesource.com/setup_18.x | sudo -E bash -
sudo apt-get install -y nodejs

# Install PM2 for process management
sudo npm install -g pm2

# Install nginx (optional, for reverse proxy)
sudo apt install nginx -y

# Install certbot for SSL (optional)
sudo apt install certbot python3-certbot-nginx -y
```

### 3. Application Deployment

```bash
# Create app directory
sudo mkdir -p /var/www/tempmail
sudo chown $USER:$USER /var/www/tempmail
cd /var/www/tempmail

# Clone or upload your code
# If using git:
git clone <your-repo-url> .
# Or upload files manually

# Install dependencies
npm install --production

# Test the application
npm start
```

### 4. PM2 Process Management

Create `ecosystem.config.js`:
```javascript
module.exports = {
  apps: [{
    name: 'tempmail',
    script: 'server.js',
    instances: 1,
    autorestart: true,
    watch: false,
    max_memory_restart: '400M',
    env: {
      NODE_ENV: 'production',
      PORT: 3000
    },
    error_file: './logs/err.log',
    out_file: './logs/out.log',
    log_file: './logs/combined.log',
    time: true
  }]
};
```

```bash
# Create logs directory
mkdir logs

# Start with PM2
pm2 start ecosystem.config.js

# Save PM2 configuration
pm2 save

# Setup PM2 to start on boot
pm2 startup
```

### 5. Nginx Configuration (Optional)

Create `/etc/nginx/sites-available/tempmail`:
```nginx
server {
    listen 80;
    server_name your-domain.com www.your-domain.com;

    location / {
        proxy_pass http://localhost:3000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_cache_bypass $http_upgrade;
    }
}
```

```bash
# Enable site
sudo ln -s /etc/nginx/sites-available/tempmail /etc/nginx/sites-enabled/
sudo nginx -t
sudo systemctl restart nginx
```

### 6. SSL Certificate (Optional)

```bash
# Get SSL certificate
sudo certbot --nginx -d your-domain.com -d www.your-domain.com

# Auto-renewal
sudo crontab -e
# Add: 0 12 * * * /usr/bin/certbot renew --quiet
```

## 🔧 VPS Optimizations

### Memory Management
- **Max Sessions**: 100 concurrent users
- **Session Timeout**: 2 hours (reduced from 24h)
- **Message Limit**: 50 messages per inbox
- **Cleanup Interval**: Every 30 minutes

### Performance Monitoring

```bash
# Monitor memory usage
pm2 monit

# Check logs
pm2 logs tempmail

# Monitor system resources
htop
```

### Health Check
Visit: `http://your-domain.com/api/health`

Expected response:
```json
{
  "status": "healthy",
  "uptime": 3600,
  "memory": {
    "rss": 45.2,
    "heapTotal": 20.1,
    "heapUsed": 15.3,
    "external": 2.1
  },
  "activeSessions": 5,
  "maxSessions": 100
}
```

## 📊 Resource Usage Estimates

### Memory Usage (512MB VPS)
- **Node.js Process**: ~40-60MB
- **Nginx**: ~10-15MB
- **System**: ~50-80MB
- **Available for App**: ~350-400MB

### Concurrent Users
- **Recommended**: 50-100 users
- **Peak**: 150 users (with performance impact)
- **Session Memory**: ~2KB per user

### Storage Requirements
- **Application**: ~50MB
- **Logs**: ~100MB/month
- **Node Modules**: ~100MB
- **Total**: ~250MB minimum

## 🛡️ Security Considerations

### Firewall Setup
```bash
# Install UFW
sudo apt install ufw

# Configure firewall
sudo ufw default deny incoming
sudo ufw default allow outgoing
sudo ufw allow ssh
sudo ufw allow 80
sudo ufw allow 443
sudo ufw enable
```

### Environment Variables
Create `.env` file:
```bash
NODE_ENV=production
PORT=3000
MAX_SESSIONS=100
SESSION_TIMEOUT=7200000
```

## 🔄 Maintenance

### Regular Tasks
```bash
# Update system
sudo apt update && sudo apt upgrade -y

# Update Node.js dependencies
npm update

# Restart application
pm2 restart tempmail

# Check logs
pm2 logs tempmail --lines 100

# Monitor memory
free -h
```

### Backup Strategy
```bash
# Backup application
tar -czf tempmail-backup-$(date +%Y%m%d).tar.gz /var/www/tempmail

# Backup PM2 configuration
pm2 save
cp ~/.pm2/dump.pm2 /backup/pm2-dump-$(date +%Y%m%d).pm2
```

## 🚨 Troubleshooting

### High Memory Usage
```bash
# Check memory usage
pm2 monit

# Restart if needed
pm2 restart tempmail

# Check for memory leaks
pm2 logs tempmail | grep "Memory usage"
```

### Application Not Starting
```bash
# Check logs
pm2 logs tempmail

# Check port availability
sudo netstat -tlnp | grep :3000

# Restart PM2
pm2 delete tempmail
pm2 start ecosystem.config.js
```

### Slow Performance
```bash
# Check system resources
htop

# Check disk space
df -h

# Check network
ping google.com
```

## 📈 Scaling Considerations

### For Higher Traffic
- **Upgrade VPS**: 1GB RAM for 200+ users
- **Load Balancer**: Multiple instances
- **CDN**: Cloudflare for static assets
- **Database**: Redis for session storage

### Monitoring Tools
- **PM2**: Process monitoring
- **htop**: System monitoring
- **nginx status**: Web server monitoring
- **Custom health checks**: `/api/health`

## 🎯 Performance Tips

1. **Keep PM2 running**: Ensures app restarts on crashes
2. **Monitor logs**: Check for errors regularly
3. **Regular updates**: Keep system and dependencies updated
4. **Memory limits**: Set PM2 memory limits to prevent crashes
5. **Session cleanup**: Automatic cleanup prevents memory leaks

## 📞 Support Commands

```bash
# Quick status check
pm2 status

# View real-time logs
pm2 logs tempmail -f

# Restart application
pm2 restart tempmail

# Check system resources
free -h && df -h

# Test application
curl http://localhost:3000/api/health
```

---

**Your 512MB VPS is perfectly capable of running this TempMail service efficiently!** 🚀