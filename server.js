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

// API rotation counter and providers
let apiRotationCounter = 0;
const emailProviders = {
  '1secmail': {
    domains: ['1secmail.com', '1secmail.org', '1secmail.net', 'kzccv.com', 'qiott.com', 'wuuvo.com', 'icznn.com', 'vjuum.com'],
    baseUrl: 'https://www.1secmail.com/api/v1/'
  },
  'guerrillamail': {
    domains: ['guerrillamail.com', 'guerrillamail.net', 'guerrillamail.org', 'spam4.me', 'grr.la'],
    baseUrl: 'https://api.guerrillamail.com/ajax.php'
  },
  'tempmail': {
    domains: ['tempmail.org', '10minutemail.com', 'temp-mail.org'],
    baseUrl: 'https://api.temp-mail.org/request/'
  }
};

// Helper function to get next API
function getNextAPI() {
  const providers = Object.keys(emailProviders);
  const provider = providers[apiRotationCounter % providers.length];
  apiRotationCounter++;
  return provider;
}

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

    // Try multiple providers until one works
    let address, token, provider, username, domain;
    let attempts = 0;
    const maxAttempts = 3;

    while (attempts < maxAttempts) {
      try {
        provider = getNextAPI();
        const providerConfig = emailProviders[provider];
        
        if (!providerConfig) {
          attempts++;
          continue;
        }

        // Generate random username
        username = Math.random().toString(36).substring(2, 10);
        
        if (provider === '1secmail') {
          // Try to get live domains first, fallback to hardcoded ones
          let domains = providerConfig.domains;
          
          try {
            const domainRes = await fetch(`${providerConfig.baseUrl}?action=getDomainList`, {
              timeout: 2000,
              headers: {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36',
                'Accept': 'application/json',
                'Cache-Control': 'no-cache'
              }
            });

            if (domainRes.ok) {
              const apiDomains = await domainRes.json();
              if (Array.isArray(apiDomains) && apiDomains.length > 0) {
                domains = apiDomains;
                console.log(`✅ Fetched ${domains.length} domains from 1secmail API`);
              }
            }
          } catch (error) {
            console.log('⚠️  Using fallback domains for 1secmail');
          }

          domain = domains[Math.floor(Math.random() * domains.length)];
          address = `${username}@${domain}`;
          token = `1secmail:${username}:${domain}`;
          
          // Test the email by trying to fetch messages
          const testRes = await fetch(`${providerConfig.baseUrl}?action=getMessages&login=${username}&domain=${domain}`, {
            timeout: 3000,
            headers: {
              'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
              'Accept': 'application/json'
            }
          });

          if (testRes.ok) {
            console.log(`✅ Successfully created 1secmail: ${address}`);
            break;
          } else {
            console.log(`⚠️  1secmail test failed with status: ${testRes.status}`);
            throw new Error(`1secmail API returned ${testRes.status}`);
          }
        }
        
        // If we get here, the provider worked
        break;
        
      } catch (error) {
        console.log(`⚠️  Provider ${provider} failed: ${error.message}`);
        attempts++;
        
        if (attempts >= maxAttempts) {
          // Final fallback - use hardcoded domains
          provider = '1secmail';
          username = Math.random().toString(36).substring(2, 10);
          domain = 'guerrillamail.com'; // Use a reliable fallback domain
          address = `${username}@${domain}`;
          token = `fallback:${username}:${domain}`;
          console.log(`🆘 Using emergency fallback: ${address}`);
          break;
        }
      }
    }

    // Store session with size limit
    const sessionId = Math.random().toString(36).substring(2, 15);
    activeSessions.set(sessionId, { 
      address,
      username,
      domain,
      token, 
      createdAt: Date.now(),
      lastActivity: Date.now(),
      messageCount: 0
    });

    console.log(`📧 Generated email: ${address}`);

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

    // Parse token to get provider, username and domain
    const tokenParts = token.split(':');
    if (tokenParts.length < 3) {
      return res.status(400).json({ error: 'Invalid token format' });
    }

    const [provider, username, domain] = tokenParts;

    let message = null;

    if (provider === '1secmail' || provider === 'fallback') {
      // Get message from 1secmail
      const messageRes = await fetch(`https://www.1secmail.com/api/v1/?action=readMessage&login=${username}&domain=${domain}&id=${id}`, {
        timeout: 8000,
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36',
          'Accept': 'application/json',
          'Cache-Control': 'no-cache',
          'Referer': 'https://www.1secmail.com/'
        }
      });

      if (!messageRes.ok) {
        console.log(`⚠️  Failed to fetch message ${id}: ${messageRes.status}`);
        return res.status(404).json({ error: 'Message not found' });
      }

      message = await messageRes.json();
    }

    // Transform 1secmail format to match our expected format
    const transformedMessage = {
      id: message.id,
      subject: message.subject,
      from: {
        address: message.from,
        name: message.from
      },
      date: message.date,
      createdAt: message.date,
      text: message.textBody || '',
      html: message.htmlBody || message.textBody || '',
      intro: message.textBody ? message.textBody.substring(0, 100) + '...' : ''
    };

    res.json(transformedMessage);

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

    // Parse token to get provider, username and domain
    const tokenParts = token.split(':');
    if (tokenParts.length < 3) {
      return res.status(400).json({ error: 'Invalid token format' });
    }

    const [provider, username, domain] = tokenParts;

    // Update session activity
    if (sessionId && activeSessions.has(sessionId)) {
      const session = activeSessions.get(sessionId);
      session.lastActivity = Date.now();
    }

    let messages = [];

    try {
      if (provider === '1secmail' || provider === 'fallback') {
        // Get messages from 1secmail
        const messagesRes = await fetch(`https://www.1secmail.com/api/v1/?action=getMessages&login=${username}&domain=${domain}`, {
          timeout: 8000,
          headers: {
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36',
            'Accept': 'application/json',
            'Cache-Control': 'no-cache',
            'Referer': 'https://www.1secmail.com/'
          }
        });

        if (messagesRes.ok) {
          const rawMessages = await messagesRes.json();
          if (Array.isArray(rawMessages)) {
            messages = rawMessages;
            console.log(`✅ Fetched ${messages.length} messages for ${username}@${domain}`);
          }
        } else {
          console.log(`⚠️  Failed to fetch messages for ${username}@${domain}: ${messagesRes.status} ${messagesRes.statusText}`);
          
          // Try alternative approach with different headers
          const altRes = await fetch(`https://www.1secmail.com/api/v1/?action=getMessages&login=${username}&domain=${domain}`, {
            timeout: 5000,
            method: 'GET',
            headers: {
              'User-Agent': 'curl/7.68.0',
              'Accept': '*/*'
            }
          });
          
          if (altRes.ok) {
            const altMessages = await altRes.json();
            if (Array.isArray(altMessages)) {
              messages = altMessages;
              console.log(`✅ Alternative fetch successful: ${messages.length} messages`);
            }
          }
        }
      }
      // Add other providers here in the future
      
    } catch (error) {
      console.log(`⚠️  Error fetching messages: ${error.message}`);
      // Return empty array on error instead of throwing
    }

    if (!Array.isArray(messages)) {
      return res.json([]);
    }

    // Transform 1secmail format to match our expected format
    const transformedMessages = messages.map(msg => ({
      id: msg.id,
      subject: msg.subject,
      from: {
        address: msg.from,
        name: msg.from
      },
      date: msg.date,
      createdAt: msg.date,
      text: msg.textBody || '',
      intro: msg.textBody ? msg.textBody.substring(0, 100) + '...' : '',
      seen: false
    }));

    // Sort messages by date (newest first) and limit to prevent memory issues
    transformedMessages.sort((a, b) => new Date(b.date) - new Date(a.date));
    const limitedMessages = transformedMessages.slice(0, MAX_MESSAGES_PER_SESSION);

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

    // Note: 1secmail API doesn't support message deletion
    // We'll simulate success but the message won't actually be deleted from their servers
    // This is a limitation of the 1secmail API

    res.json({ 
      success: true, 
      note: '1secmail API does not support message deletion. Message will expire automatically.' 
    });

  } catch (error) {
    console.error('Error deleting message:', error);
    res.status(500).json({ error: 'Failed to delete message' });
  }
});

app.get('/api/domains', async (req, res) => {
  try {
    const domainsRes = await fetch('https://www.1secmail.com/api/v1/?action=getDomainList', {
      timeout: 5000
    });

    if (!domainsRes.ok) {
      return res.status(500).json({ error: 'Failed to fetch domains' });
    }

    const domains = await domainsRes.json();

    if (!Array.isArray(domains)) {
      return res.status(500).json({ error: 'Invalid domains response' });
    }

    // Transform to match expected format
    const transformedDomains = domains.map(domain => ({
      domain: domain,
      isActive: true,
      isPrivate: false
    }));

    res.json(transformedDomains);

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

    // Parse token to get username and domain
    const [username, domain] = token.split(':');
    if (!username || !domain) {
      return res.json({ 
        valid: false,
        timestamp: Date.now(),
        activeSessions: activeSessions.size,
        maxSessions: MAX_SESSIONS,
        error: 'Invalid token format'
      });
    }

    // Test token validity by trying to fetch messages from 1secmail
    const messagesRes = await fetch(`https://www.1secmail.com/api/v1/?action=getMessages&login=${username}&domain=${domain}`, {
      timeout: 5000
    });

    const isValid = messagesRes.ok;

    res.json({ 
      valid: isValid,
      timestamp: Date.now(),
      username: username,
      domain: domain,
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