const express = require('express');
const fetch = require('node-fetch');
const path = require('path');
const app = express();
const PORT = process.env.PORT || 3000;

// Memory optimization for VPS
const MAX_SESSIONS = 100; // Limit concurrent sessions
const SESSION_CLEANUP_INTERVAL = 30 * 60 * 1000; // 30 minutes
const MAX_AGE = 2 * 60 * 60 * 1000; // 2 hours (reduced from 24h for VPS)

app.use(express.static(__dirname));
app.use(express.json({ limit: '1mb' })); // Limit request size

// Store active sessions with size limit
const activeSessions = new Map();

// Memory monitoring
const getMemoryUsage = () => {
  const usage = process.memoryUsage();
  return {
    rss: Math.round(usage.rss / 1024 / 1024 * 100) / 100, // MB
    heapTotal: Math.round(usage.heapTotal / 1024 / 1024 * 100) / 100, // MB
    heapUsed: Math.round(usage.heapUsed / 1024 / 1024 * 100) / 100, // MB
    external: Math.round(usage.external / 1024 / 1024 * 100) / 100 // MB
  };
};

// Clean up old sessions
const cleanupSessions = () => {
  const now = Date.now();
  let cleaned = 0;
  
  for (const [sessionId, session] of activeSessions.entries()) {
    if (now - session.createdAt > MAX_AGE) {
      activeSessions.delete(sessionId);
      cleaned++;
    }
  }
  
  // If we have too many sessions, remove oldest ones
  if (activeSessions.size > MAX_SESSIONS) {
    const sessions = Array.from(activeSessions.entries())
      .sort((a, b) => a[1].createdAt - b[1].createdAt);
    
    const toRemove = sessions.slice(0, activeSessions.size - MAX_SESSIONS);
    toRemove.forEach(([sessionId]) => activeSessions.delete(sessionId));
    cleaned += toRemove.length;
  }
  
  if (cleaned > 0) {
    console.log(`Cleaned up ${cleaned} sessions. Active sessions: ${activeSessions.size}`);
  }
  
  // Log memory usage
  const mem = getMemoryUsage();
  console.log(`Memory usage: RSS: ${mem.rss}MB, Heap: ${mem.heapUsed}/${mem.heapTotal}MB`);
};

// Set up periodic cleanup
setInterval(cleanupSessions, SESSION_CLEANUP_INTERVAL);

app.get('/api/generate', async (req, res) => {
  try {
    // Check if we're at capacity
    if (activeSessions.size >= MAX_SESSIONS) {
      return res.status(503).json({ 
        error: 'Service temporarily at capacity. Please try again in a few minutes.' 
      });
    }
    
    // Get available domains
    const domainRes = await fetch('https://api.mail.tm/domains', {
      timeout: 10000 // 10 second timeout
    });
    const domainData = await domainRes.json();
    
    if (!domainData['hydra:member'] || domainData['hydra:member'].length === 0) {
      return res.status(500).json({ error: 'No domains available' });
    }
    
    const domain = domainData['hydra:member'][0].domain;
    const username = Math.random().toString(36).substring(2, 10);
    const address = `${username}@${domain}`;
    const password = 'TempMail123';
    
    // Create account
    const accountRes = await fetch('https://api.mail.tm/accounts', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ address, password }),
      timeout: 10000
    });
    
    if (!accountRes.ok) {
      const error = await accountRes.json();
      return res.status(400).json({ error: 'Failed to create account', details: error });
    }
    
    // Get authentication token
    const tokenRes = await fetch('https://api.mail.tm/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ address, password }),
      timeout: 10000
    });
    
    if (!tokenRes.ok) {
      return res.status(400).json({ error: 'Failed to authenticate' });
    }
    
    const tokenData = await tokenRes.json();
    const token = tokenData.token;
    
    // Store session with size limit
    const sessionId = Math.random().toString(36).substring(2, 15);
    activeSessions.set(sessionId, { 
      address, 
      token, 
      createdAt: Date.now(),
      lastActivity: Date.now()
    });
    
    res.json({ 
      address, 
      token, 
      sessionId,
      domain,
      expiresAt: Date.now() + MAX_AGE
    });
    
  } catch (error) {
    console.error('Error generating email:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

app.get('/api/messages', async (req, res) => {
  try {
    const { token, sessionId } = req.query;
    
    if (!token) {
      return res.status(400).json({ error: 'Token required' });
    }
    
    // Update session activity
    if (sessionId && activeSessions.has(sessionId)) {
      activeSessions.get(sessionId).lastActivity = Date.now();
    }
    
    const messagesRes = await fetch('https://api.mail.tm/messages', {
      headers: { Authorization: `Bearer ${token}` },
      timeout: 10000
    });
    
    if (!messagesRes.ok) {
      return res.status(401).json({ error: 'Invalid token' });
    }
    
    const messagesData = await messagesRes.json();
    const messages = messagesData['hydra:member'] || [];
    
    // Sort messages by date (newest first) and limit to prevent memory issues
    messages.sort((a, b) => new Date(b.date) - new Date(a.date));
    const limitedMessages = messages.slice(0, 50); // Limit to 50 messages
    
    res.json(limitedMessages);
    
  } catch (error) {
    console.error('Error fetching messages:', error);
    res.status(500).json({ error: 'Failed to fetch messages' });
  }
});

app.get('/api/message/:id', async (req, res) => {
  try {
    const { token } = req.query;
    const { id } = req.params;
    
    if (!token) {
      return res.status(400).json({ error: 'Token required' });
    }
    
    const messageRes = await fetch(`https://api.mail.tm/messages/${id}`, {
      headers: { Authorization: `Bearer ${token}` },
      timeout: 10000
    });
    
    if (!messageRes.ok) {
      return res.status(404).json({ error: 'Message not found' });
    }
    
    const message = await messageRes.json();
    res.json(message);
    
  } catch (error) {
    console.error('Error fetching message:', error);
    res.status(500).json({ error: 'Failed to fetch message' });
  }
});

app.delete('/api/message/:id', async (req, res) => {
  try {
    const { token } = req.query;
    const { id } = req.params;
    
    if (!token) {
      return res.status(400).json({ error: 'Token required' });
    }
    
    const deleteRes = await fetch(`https://api.mail.tm/messages/${id}`, {
      method: 'DELETE',
      headers: { Authorization: `Bearer ${token}` },
      timeout: 10000
    });
    
    if (!deleteRes.ok) {
      return res.status(400).json({ error: 'Failed to delete message' });
    }
    
    res.json({ success: true });
    
  } catch (error) {
    console.error('Error deleting message:', error);
    res.status(500).json({ error: 'Failed to delete message' });
  }
});

app.get('/api/domains', async (req, res) => {
  try {
    const domainsRes = await fetch('https://api.mail.tm/domains', {
      timeout: 10000
    });
    const domainsData = await domainsRes.json();
    
    if (!domainsRes.ok) {
      return res.status(500).json({ error: 'Failed to fetch domains' });
    }
    
    const domains = domainsData['hydra:member'] || [];
    res.json(domains);
    
  } catch (error) {
    console.error('Error fetching domains:', error);
    res.status(500).json({ error: 'Failed to fetch domains' });
  }
});

app.get('/api/status', async (req, res) => {
  try {
    const { token } = req.query;
    
    if (!token) {
      return res.status(400).json({ error: 'Token required' });
    }
    
    // Test token validity by trying to fetch messages
    const messagesRes = await fetch('https://api.mail.tm/messages', {
      headers: { Authorization: `Bearer ${token}` },
      timeout: 10000
    });
    
    const isValid = messagesRes.ok;
    
    res.json({ 
      valid: isValid,
      timestamp: Date.now(),
      activeSessions: activeSessions.size,
      maxSessions: MAX_SESSIONS
    });
    
  } catch (error) {
    console.error('Error checking status:', error);
    res.status(500).json({ error: 'Failed to check status' });
  }
});

// Health check endpoint
app.get('/api/health', (req, res) => {
  const mem = getMemoryUsage();
  res.json({
    status: 'healthy',
    uptime: process.uptime(),
    memory: mem,
    activeSessions: activeSessions.size,
    maxSessions: MAX_SESSIONS
  });
});

// Graceful shutdown
process.on('SIGTERM', () => {
  console.log('SIGTERM received, shutting down gracefully');
  cleanupSessions();
  process.exit(0);
});

process.on('SIGINT', () => {
  console.log('SIGINT received, shutting down gracefully');
  cleanupSessions();
  process.exit(0);
});

app.listen(PORT, () => {
  console.log(`TempMail server running on port ${PORT}`);
  console.log(`Memory limit: ~512MB VPS optimized`);
  console.log(`Max sessions: ${MAX_SESSIONS}`);
  console.log(`Session timeout: ${MAX_AGE / 1000 / 60} minutes`);
  console.log(`Visit http://localhost:${PORT} to use the service`);
});