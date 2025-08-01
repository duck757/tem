const express = require('express');
const fetch = require('node-fetch');
const path = require('path');
const app = express();
const PORT = process.env.PORT || 3000;

// Memory optimization: Limit request size and add rate limiting
app.use(express.json({ limit: '1mb' }));
app.use(express.urlencoded({ limit: '1mb', extended: true }));
app.use(express.static(__dirname));

// Simple in-memory rate limiting (lightweight for 512MB)
const requestCounts = new Map();
const RATE_LIMIT = 10; // requests per minute
const RATE_WINDOW = 60000; // 1 minute

function rateLimit(req, res, next) {
  const ip = req.ip;
  const now = Date.now();
  
  if (!requestCounts.has(ip)) {
    requestCounts.set(ip, { count: 1, resetTime: now + RATE_WINDOW });
  } else {
    const userData = requestCounts.get(ip);
    if (now > userData.resetTime) {
      userData.count = 1;
      userData.resetTime = now + RATE_WINDOW;
    } else {
      userData.count++;
    }
    
    if (userData.count > RATE_LIMIT) {
      return res.status(429).json({ error: 'Rate limit exceeded' });
    }
  }
  
  // Clean up old entries to prevent memory leaks
  if (requestCounts.size > 1000) {
    for (const [key, value] of requestCounts.entries()) {
      if (now > value.resetTime) {
        requestCounts.delete(key);
      }
    }
  }
  
  next();
}

app.get('/api/generate', rateLimit, async (req, res) => {
  try {
    const domain = await fetch('https://api.mail.tm/domains').then(r => r.json());
    const address = `${Math.random().toString(36).substring(2, 10)}@${domain['hydra:member'][0].domain}`;
    const password = 'TempMonkey123';
    
    await fetch('https://api.mail.tm/accounts', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ address, password })
    });
    
    const tokenRes = await fetch('https://api.mail.tm/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ address, password })
    });
    
    const token = await tokenRes.json();
    res.json({ address, token: token.token });
  } catch (error) {
    console.error('Generate error:', error.message);
    res.status(500).json({ error: 'Failed to generate email' });
  }
});

app.get('/api/messages', rateLimit, async (req, res) => {
  try {
    const { token } = req.query;
    if (!token) {
      return res.status(400).json({ error: 'Token required' });
    }
    
    const messagesRes = await fetch('https://api.mail.tm/messages', {
      headers: { Authorization: `Bearer ${token}` }
    });
    
    if (!messagesRes.ok) {
      return res.status(401).json({ error: 'Invalid token' });
    }
    
    const messages = await messagesRes.json();
    res.json(messages['hydra:member'] || []);
  } catch (error) {
    console.error('Messages error:', error.message);
    res.status(500).json({ error: 'Failed to fetch messages' });
  }
});

// Memory monitoring endpoint (for debugging)
app.get('/api/status', (req, res) => {
  const memUsage = process.memoryUsage();
  res.json({
    memory: {
      rss: Math.round(memUsage.rss / 1024 / 1024) + 'MB',
      heapUsed: Math.round(memUsage.heapUsed / 1024 / 1024) + 'MB',
      heapTotal: Math.round(memUsage.heapTotal / 1024 / 1024) + 'MB'
    },
    uptime: Math.round(process.uptime()) + 's',
    rateLimitEntries: requestCounts.size
  });
});

app.listen(PORT, () => {
  console.log(`TempMonkeyMail running on port ${PORT}`);
  console.log(`Memory limit: 512MB`);
  console.log(`Rate limit: ${RATE_LIMIT} requests/minute`);
});