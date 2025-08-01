# TempMail Deployment Guide for 512MB VPS

## 🚀 Quick Start

### 1. Install Dependencies
```bash
npm install
```

### 2. Start the Server
```bash
# Option 1: Use the optimized startup script
./start.sh

# Option 2: Start directly with memory limits
NODE_OPTIONS="--max-old-space-size=400 --expose-gc" node server.js

# Option 3: With PM2 (recommended for production)
npm install -g pm2
pm2 start server.js --name "tempmail" --max-memory-restart 450M
```

## 📊 Memory Optimization Features

### Automatic Memory Management
- **Session Limit**: 50 concurrent sessions (reduced from 100)
- **Session Timeout**: 1 hour (reduced from 2 hours)
- **Message Limit**: 25 messages per session (reduced from 50)
- **Memory Threshold**: 400MB (triggers emergency cleanup)
- **Cleanup Interval**: Every 15 minutes (increased frequency)

### Emergency Cleanup
When memory usage exceeds 400MB:
- Removes sessions older than 30 minutes
- Forces garbage collection
- Rejects new requests until memory normalizes

## 🔍 Monitoring

### Real-time Monitoring
```bash
# Start the monitoring script
node monitor.js

# Or monitor a remote server
BASE_URL=https://your-domain.com node monitor.js
```

### Health Check Endpoints
- `/api/health` - Server health and memory status
- `/api/memory` - Detailed memory usage
- `/api/status` - Session and token status

## 🛠️ Production Setup

### 1. Install PM2 (Recommended)
```bash
npm install -g pm2
```

### 2. Create PM2 Ecosystem File
```bash
pm2 ecosystem
```

Edit `ecosystem.config.js`:
```javascript
module.exports = {
  apps: [{
    name: 'tempmail',
    script: 'server.js',
    instances: 1,
    max_memory_restart: '450M',
    node_args: '--max-old-space-size=400 --expose-gc',
    env: {
      NODE_ENV: 'production',
      PORT: 3000
    }
  }]
}
```

### 3. Start with PM2
```bash
pm2 start ecosystem.config.js
pm2 save
pm2 startup
```

## 🔧 System Optimizations

### 1. Increase Swap (if needed)
```bash
# Check current swap
free -h

# Create swap file (if needed)
sudo fallocate -l 1G /swapfile
sudo chmod 600 /swapfile
sudo mkswap /swapfile
sudo swapon /swapfile
```

### 2. Optimize Node.js
```bash
# Set Node.js memory limits
export NODE_OPTIONS="--max-old-space-size=400 --expose-gc"

# Enable garbage collection
node --expose-gc server.js
```

### 3. System Monitoring
```bash
# Monitor system resources
htop

# Monitor disk usage
df -h

# Monitor memory usage
free -h
```

## 📈 Performance Tips

### 1. Memory Management
- Sessions are automatically cleaned up every 15 minutes
- Emergency cleanup triggers at 400MB memory usage
- Maximum 50 concurrent sessions
- Each session limited to 25 messages

### 2. Network Optimization
- Reduced timeout to 5 seconds for all API calls
- Request size limited to 512KB
- Automatic session cleanup prevents memory leaks

### 3. Monitoring
- Use the included `monitor.js` script for real-time monitoring
- Check `/api/health` endpoint for server status
- Monitor memory usage with `/api/memory` endpoint

## 🚨 Troubleshooting

### High Memory Usage
1. Check current memory: `curl http://localhost:3000/api/memory`
2. Restart server: `pm2 restart tempmail`
3. Check for memory leaks in logs

### Server Not Responding
1. Check if port is in use: `lsof -i :3000`
2. Check server logs: `pm2 logs tempmail`
3. Restart with memory limits: `NODE_OPTIONS="--max-old-space-size=400" node server.js`

### Performance Issues
1. Reduce session timeout in `server.js`
2. Lower `MAX_SESSIONS` value
3. Increase cleanup frequency
4. Monitor with `node monitor.js`

## 📊 Expected Performance

### Memory Usage
- **Idle**: ~50-100MB
- **Normal Load**: ~150-250MB
- **High Load**: ~300-400MB
- **Emergency**: >400MB (triggers cleanup)

### Concurrent Users
- **Recommended**: 20-30 concurrent users
- **Maximum**: 50 concurrent sessions
- **Optimal**: 10-15 active sessions

### Response Times
- **Email Generation**: <2 seconds
- **Message Fetching**: <1 second
- **Health Checks**: <100ms

## 🔒 Security Considerations

### Rate Limiting
Consider adding rate limiting for production:
```bash
npm install express-rate-limit
```

### HTTPS
For production, use a reverse proxy (nginx) with SSL:
```nginx
server {
    listen 443 ssl;
    server_name your-domain.com;
    
    location / {
        proxy_pass http://localhost:3000;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
    }
}
```

## 📝 Logs

### PM2 Logs
```bash
pm2 logs tempmail
pm2 logs tempmail --lines 100
```

### Application Logs
The server logs memory usage and cleanup activities:
- Session cleanup events
- Memory usage warnings
- Emergency cleanup triggers
- API request errors

## 🎯 Success Metrics

### Healthy Server Indicators
- Memory usage < 400MB
- Active sessions < 50
- Response times < 2 seconds
- Uptime > 99%

### Warning Signs
- Memory usage > 350MB
- Active sessions > 40
- Response times > 5 seconds
- Frequent emergency cleanups