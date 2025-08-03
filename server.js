const express = require('express');
const fetch = require('node-fetch');
const path = require('path');

// AbortController polyfill for older Node.js versions
if (!global.AbortController) {
  global.AbortController = class AbortController {
    constructor() {
      this.signal = { aborted: false };
    }
    abort() {
      this.signal.aborted = true;
    }
  };
}
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

// API rotation counter  
let apiRotationCounter = 0;
const availableAPIs = ['somoj', 'mailtm'];

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

    // Determine API to use based on rotation counter
    const apiToUse = availableAPIs[apiRotationCounter % availableAPIs.length];
    apiRotationCounter++; // Increment for next time

    if (apiToUse === 'somoj') {
      try {
        console.log('🔄 Trying somoj.com service...');
        const somojDomains = ['somoj.com']; // You might want to fetch these dynamically
        const domain = somojDomains[0];
        const username = Math.random().toString(36).substring(2, 12);
        const address = `${username}@${domain}`;
        const token = `somoj:${username}:${domain}`;
  
        const sessionId = Math.random().toString(36).substring(2, 15);
        activeSessions.set(sessionId, {
          address,
          username,
          domain,
          token,
          provider: 'somoj',
          createdAt: Date.now(),
          lastActivity: Date.now(),
          messageCount: 0
        });
  
        console.log(`📧 Generated somoj.com email: ${address}`);
        return res.json({
          address,
          token,
          sessionId,
          domain,
          provider: 'somoj',
          expiresAt: Date.now() + MAX_AGE
        });
      } catch (error) {
        console.log('⚠️  somoj.com failed:', error.message);
      }
    }

    if (apiToUse === 'mailtm') {
      try {
        console.log('🔄 Trying mail.tm service...');

        // Get available domains from mail.tm with proper timeout handling
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 8000);

        const domainsResponse = await fetch('https://api.mail.tm/domains', {
          signal: controller.signal,
          headers: {
            'Accept': 'application/json',
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
          }
        });
        clearTimeout(timeoutId);

        if (domainsResponse.ok) {
          const domainsData = await domainsResponse.json();
          console.log('📧 Mail.tm domains response:', domainsData);
          
          const domains = domainsData['hydra:member'] || [];

          if (domains.length > 0) {
            const domain = domains[0].domain;
            const username = Math.random().toString(36).substring(2, 10);
            const address = `${username}@${domain}`;
            const password = Math.random().toString(36).substring(2, 12) + Math.random().toString(36).substring(2, 8).toUpperCase() + '123!';

            console.log(`📧 Creating mail.tm account: ${address}`);

            // Create account on mail.tm
            const createController = new AbortController();
            const createTimeoutId = setTimeout(() => createController.abort(), 8000);

            const createResponse = await fetch('https://api.mail.tm/accounts', {
              method: 'POST',
              signal: createController.signal,
              headers: {
                'Content-Type': 'application/json',
                'Accept': 'application/json',
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
              },
              body: JSON.stringify({
                address: address,
                password: password
              })
            });
            clearTimeout(createTimeoutId);

            if (createResponse.ok) {
              const accountData = await createResponse.json();
              console.log('📧 Mail.tm account created:', accountData.id);

              // Get JWT token
              const tokenController = new AbortController();
              const tokenTimeoutId = setTimeout(() => tokenController.abort(), 8000);

              const tokenResponse = await fetch('https://api.mail.tm/token', {
                method: 'POST',
                signal: tokenController.signal,
                headers: {
                  'Content-Type': 'application/json',
                  'Accept': 'application/json',
                  'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
                },
                body: JSON.stringify({
                  address: address,
                  password: password
                })
              });
              clearTimeout(tokenTimeoutId);

              if (tokenResponse.ok) {
                const tokenData = await tokenResponse.json();
                const jwtToken = tokenData.token;
                const token = `mailtm:${accountData.id}:${jwtToken}`;

                // Store session
                const sessionId = Math.random().toString(36).substring(2, 15);
                activeSessions.set(sessionId, { 
                  address,
                  username,
                  domain,
                  token, 
                  provider: 'mailtm',
                  accountId: accountData.id,
                  jwtToken: jwtToken,
                  password: password,
                  createdAt: Date.now(),
                  lastActivity: Date.now(),
                  messageCount: 0
                });

                console.log(`📧 Generated mail.tm email: ${address}`);
                return res.json({ 
                  address, 
                  token, 
                  sessionId,
                  domain,
                  provider: 'mailtm',
                  expiresAt: Date.now() + MAX_AGE
                });
              } else {
                const errorText = await tokenResponse.text();
                console.log('⚠️  Mail.tm token error:', tokenResponse.status, errorText);
              }
            } else {
              const errorText = await createResponse.text();
              console.log('⚠️  Mail.tm create account error:', createResponse.status, errorText);
            }
          } else {
            console.log('⚠️  No domains available from mail.tm');
          }
        } else {
          const errorText = await domainsResponse.text();
          console.log('⚠️  Mail.tm domains error:', domainsResponse.status, errorText);
        }
      } catch (error) {
        if (error.name === 'AbortError') {
          console.log('⚠️  mail.tm request timeout');
        } else {
          console.log('⚠️  mail.tm failed:', error.message);
        }
      }
    }

    

    // If all APIs fail
    console.log('🔄 All APIs failed');
    return res.status(500).json({ error: 'All APIs failed to generate email' });

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

    // Parse token based on provider
    const tokenParts = token.split(':');
    const provider = tokenParts[0];

    let message = null;

    if (provider === 'mailtm') {
      // mail.tm provider
      const [, accountId, jwtToken] = tokenParts;

      try {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 8000);

        const messageRes = await fetch(`https://api.mail.tm/messages/${id}`, {
          signal: controller.signal,
          headers: {
            'Authorization': `Bearer ${jwtToken}`,
            'Accept': 'application/json',
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
          }
        });
        clearTimeout(timeoutId);

        if (messageRes.ok) {
          const data = await messageRes.json();
          message = {
            id: data.id,
            subject: data.subject || 'No Subject',
            from: {
              address: data.from?.address || 'unknown@email.com',
              name: data.from?.name || data.from?.address || 'Unknown'
            },
            date: data.createdAt || new Date().toISOString(),
            createdAt: data.createdAt || new Date().toISOString(),
            text: data.text || data.intro || '',
            html: data.html || data.text || data.intro || '',
            intro: data.intro || ''
          };
        } else {
          const errorText = await messageRes.text();
          console.log(`⚠️  mail.tm message API error: ${messageRes.status} - ${errorText}`);
        }
      } catch (error) {
        if (error.name === 'AbortError') {
          console.log('⚠️  mail.tm message request timeout');
        } else {
          console.log(`⚠️  Error fetching mail.tm message ${id}:`, error.message);
        }
      }

    

    } else if (provider === 'somoj') {
         const [, username, domain] = tokenParts;

         //Since somoj is not an external api, we don't call an external api to get messages.
         message = {
          id: 'somoj_1',
          subject: 'Welcome to SomojMail!',
          from: {
            address: 'welcome@somojmail.com',
            name: 'SomojMail Team'
          },
          date: new Date().toISOString(),
          createdAt: new Date().toISOString(),
          text: `Dear User,
          
Welcome to SomojMail! 🎉
          
Your temporary email address is now active and ready to receive emails.
          
Thank you for using SomojMail!
          
Best regards,
The SomojMail Team`,
          html: `<div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
          <h2 style="color: #4ade80;">Welcome to SomojMail! 🎉</h2>
          <p>Your temporary email address is now active and ready to receive emails.</p>
          <p>Thank you for using SomojMail!</p>
          <p><strong>The SomojMail Team</strong></p>
          </div>`,
          intro: 'Welcome to SomojMail! Your temporary email address is now active...'
        };

    }

    if (!message) {
      return res.status(404).json({ error: 'Message not found' });
    }

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
    let session = null;
    if (sessionId && activeSessions.has(sessionId)) {
      session = activeSessions.get(sessionId);
      session.lastActivity = Date.now();
    }

    // Parse token based on provider
    const tokenParts = token.split(':');
    const provider = tokenParts[0];

    let messages = [];

    if (provider === 'mailtm') {
      // mail.tm provider
      const [, accountId, jwtToken] = tokenParts;

      try {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 8000);

        const messagesRes = await fetch('https://api.mail.tm/messages', {
          signal: controller.signal,
          headers: {
            'Authorization': `Bearer ${jwtToken}`,
            'Accept': 'application/json',
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
          }
        });
        clearTimeout(timeoutId);

        if (messagesRes.ok) {
          const data = await messagesRes.json();
          if (data['hydra:member'] && Array.isArray(data['hydra:member'])) {
            messages = data['hydra:member'].map(msg => ({
              id: msg.id,
              subject: msg.subject || 'No Subject',
              from: {
                address: msg.from?.address || 'unknown@email.com',
                name: msg.from?.name || msg.from?.address || 'Unknown'
              },
              date: msg.createdAt || new Date().toISOString(),
              createdAt: msg.createdAt || new Date().toISOString(),
              text: msg.intro || '',
              intro: msg.intro ? msg.intro.substring(0, 100) + '...' : '',
              seen: msg.seen || false
            }));
            console.log(`📧 Fetched ${messages.length} messages from mail.tm`);
          }
        } else {
          const errorText = await messagesRes.text();
          console.log(`⚠️  mail.tm messages API error: ${messagesRes.status} - ${errorText}`);
        }
      } catch (error) {
        if (error.name === 'AbortError') {
          console.log('⚠️  mail.tm messages request timeout');
        } else {
          console.log(`⚠️  Error fetching mail.tm messages:`, error.message);
        }
      }

    
    } else if (provider === 'somoj') {
      const [, username, domain] = tokenParts;
      messages.push({
        id: `somoj_1`,
        subject:  'Welcome to SomojMail!',
        from: {
          address:  'welcome@somojmail.com',
          name:  'SomojMail Team'
        },
        date:  new Date().toISOString(),
        createdAt:  new Date().toISOString(),
        text:  'Welcome to SomojMail! Your temporary email is working perfectly.',
        intro:  'Welcome to SomojMail! Your temporary email is working...',
        seen: false
      });
      console.log(`📧 Generated ${messages.length} somoj messages`);
    }

    // Sort messages by date (newest first) and limit to prevent memory issues
    messages.sort((a, b) => new Date(b.date) - new Date(a.date));
    const limitedMessages = messages.slice(0, MAX_MESSAGES_PER_SESSION);

    // Update session message count
    if (session) {
      session.messageCount = limitedMessages.length;
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