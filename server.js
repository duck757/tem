const express = require('express');
const fetch = require('node-fetch');
const path = require('path');
const app = express();
const PORT = process.env.PORT || 5000;

// Memory optimization for 512MB VPS
const MAX_SESSIONS = 50; // Reduced from 100 for 512MB VPS
const SESSION_CLEANUP_INTERVAL = 15 * 60 * 1000; // 15 minutes (more frequent cleanup)
const MAX_AGE = 60 * 60 * 1000; // 1 hour (reduced from 2h for 512MB VPS)
const MAX_MESSAGES_PER_SESSION = 25; // Limit messages per session
const MEMORY_THRESHOLD = 400; // MB - trigger cleanup if memory usage exceeds this

app.use(express.static(__dirname));
app.use(express.json({ limit: '512kb' })); // Reduced from 1mb for 512MB VPS

// Store active sessions with size limit
const activeSessions = new Map();

// Memory monitoring with alerts
const getMemoryUsage = () => {
  const usage = process.memoryUsage();
  return {
    rss: Math.round(usage.rss / 1024 / 1024 * 100) / 100, // MB
    heapTotal: Math.round(usage.heapTotal / 1024 / 1024 * 100) / 100, // MB
    heapUsed: Math.round(usage.heapUsed / 1024 / 1024 * 100) / 100, // MB
    external: Math.round(usage.external / 1024 / 1024 * 100) / 100 // MB
  };
};

// Aggressive cleanup for 512MB VPS
const cleanupSessions = () => {
  const now = Date.now();
  let cleaned = 0;
  const mem = getMemoryUsage();

  // Emergency cleanup if memory usage is high
  if (mem.rss > MEMORY_THRESHOLD) {
    console.log(`⚠️  High memory usage detected: ${mem.rss}MB. Performing emergency cleanup...`);

    // Remove all sessions older than 30 minutes
    for (const [sessionId, session] of activeSessions.entries()) {
      if (now - session.createdAt > 30 * 60 * 1000) {
        activeSessions.delete(sessionId);
        cleaned++;
      }
    }

    // Force garbage collection if available
    if (global.gc) {
      global.gc();
      console.log('🧹 Forced garbage collection');
    }
  }

  // Regular cleanup
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
    console.log(`🧹 Cleaned up ${cleaned} sessions. Active sessions: ${activeSessions.size}`);
  }

  // Log memory usage
  const newMem = getMemoryUsage();
  console.log(`📊 Memory usage: RSS: ${newMem.rss}MB, Heap: ${newMem.heapUsed}/${newMem.heapTotal}MB`);

  // Warning if still high
  if (newMem.rss > MEMORY_THRESHOLD * 0.8) {
    console.log(`⚠️  Memory usage still high: ${newMem.rss}MB`);
  }
};

// Set up periodic cleanup
setInterval(cleanupSessions, SESSION_CLEANUP_INTERVAL);

// Add memory monitoring endpoint
app.get('/api/memory', (req, res) => {
  const mem = getMemoryUsage();
  res.json({
    memory: mem,
    activeSessions: activeSessions.size,
    maxSessions: MAX_SESSIONS,
    threshold: MEMORY_THRESHOLD,
    isHigh: mem.rss > MEMORY_THRESHOLD
  });
});

app.get('/api/generate', async (req, res) => {
  try {
    // Check memory usage first
    const mem = getMemoryUsage();
    if (mem.rss > MEMORY_THRESHOLD) {
      console.log(`⚠️  Rejecting request due to high memory: ${mem.rss}MB`);
      return res.status(503).json({ 
        error: 'Service temporarily overloaded. Please try again in a few minutes.' 
      });
    }

    // Check if we're at capacity
    if (activeSessions.size >= MAX_SESSIONS) {
      return res.status(503).json({ 
        error: 'Service temporarily at capacity. Please try again in a few minutes.' 
      });
    }

    // Get available domains
    const domainRes = await fetch('https://api.mail.tm/domains', {
      timeout: 5000 // Reduced timeout for 512MB VPS
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
      timeout: 5000
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
      timeout: 5000
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
      lastActivity: Date.now(),
      messageCount: 0 // Track message count per session
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

// Get individual message content
app.get('/api/messages/:id', async (req, res) => {
  try {
    const { token } = req.query;
    const { id } = req.params;

    if (!token) {
      return res.status(400).json({ error: 'Token required' });
    }

    const messageRes = await fetch(`https://api.mail.tm/messages/${id}`, {
      headers: { Authorization: `Bearer ${token}` },
      timeout: 5000
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

// Get messages for a session
app.get('/api/messages', async (req, res) => {
  try {
    const { token, sessionId } = req.query;

    if (!token) {
      return res.status(400).json({ error: 'Token required' });
    }

    // Update session activity
    if (sessionId && activeSessions.has(sessionId)) {
      const session = activeSessions.get(sessionId);
      session.lastActivity = Date.now();
    }

    const messagesRes = await fetch('https://api.mail.tm/messages', {
      headers: { Authorization: `Bearer ${token}` },
      timeout: 5000
    });

    if (!messagesRes.ok) {
      return res.status(401).json({ error: 'Invalid token' });
    }

    const messagesData = await messagesRes.json();
    const messages = messagesData['hydra:member'] || [];

    // Sort messages by date (newest first) and limit to prevent memory issues
    messages.sort((a, b) => new Date(b.date) - new Date(a.date));
    const limitedMessages = messages.slice(0, MAX_MESSAGES_PER_SESSION); // Limit to 25 messages

    // Update session message count
    if (sessionId && activeSessions.has(sessionId)) {
      activeSessions.get(sessionId).messageCount = limitedMessages.length;
    }

    res.json(limitedMessages);

  } catch (error) {
    console.error('Error fetching messages:', error);
    res.status(500).json({ error: 'Failed to fetch messages' });
  }
});

app.delete('/api/messages/:id', async (req, res) => {
  try {
    const { token } = req.query;
    const { id } = req.params;

    if (!token) {
      return res.status(400).json({ error: 'Token required' });
    }

    const deleteRes = await fetch(`https://api.mail.tm/messages/${id}`, {
      method: 'Delete',
      headers: { Authorization: `Bearer ${token}` },
      timeout: 5000
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
      timeout: 5000
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
      timeout: 5000
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
    status: mem.rss > MEMORY_THRESHOLD ? 'warning' : 'healthy',
    uptime: process.uptime(),
    memory: mem,
    activeSessions: activeSessions.size,
    maxSessions: MAX_SESSIONS,
    threshold: MEMORY_THRESHOLD,
    isHigh: mem.rss > MEMORY_THRESHOLD
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
  console.log(`🚀 TempMail server running on port ${PORT}`);
  console.log(`💾 Optimized for 512MB VPS`);
  console.log(`👥 Max sessions: ${MAX_SESSIONS}`);
  console.log(`⏰ Session timeout: ${MAX_AGE / 1000 / 60} minutes`);
  console.log(`🧹 Cleanup interval: ${SESSION_CLEANUP_INTERVAL / 1000 / 60} minutes`);
  console.log(`📊 Memory threshold: ${MEMORY_THRESHOLD}MB`);
  console.log(`📧 Max messages per session: ${MAX_MESSAGES_PER_SESSION}`);
  console.log(`🌐 Visit http://localhost:${PORT} to use the service`);
});