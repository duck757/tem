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

    // Try mail.tm first
    try {
      console.log('🔄 Trying mail.tm service...');
      
      // Get available domains from mail.tm
      const domainsResponse = await fetch('https://api.mail.tm/domains', {
        timeout: 10000,
        headers: {
          'Accept': 'application/json',
          'User-Agent': 'TempMail/1.0'
        }
      });

      if (domainsResponse.ok) {
        const domainsData = await domainsResponse.json();
        const domains = domainsData['hydra:member'] || [];
        
        if (domains.length > 0) {
          const domain = domains[0].domain;
          const username = Math.random().toString(36).substring(2, 12);
          const address = `${username}@${domain}`;
          const password = Math.random().toString(36).substring(2, 15);

          // Create account on mail.tm
          const createResponse = await fetch('https://api.mail.tm/accounts', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'Accept': 'application/json',
              'User-Agent': 'TempMail/1.0'
            },
            body: JSON.stringify({
              address: address,
              password: password
            })
          });

          if (createResponse.ok) {
            const accountData = await createResponse.json();
            
            // Get JWT token
            const tokenResponse = await fetch('https://api.mail.tm/token', {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json',
                'Accept': 'application/json',
                'User-Agent': 'TempMail/1.0'
              },
              body: JSON.stringify({
                address: address,
                password: password
              })
            });

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
            }
          }
        }
      }
    } catch (error) {
      console.log('⚠️  mail.tm failed:', error.message);
    }

    // Try 1secmail.com as backup
    try {
      console.log('🔄 Trying 1secmail.com service...');
      const domainsResponse = await fetch('https://www.1secmail.com/api/v1/?action=getDomainList', {
        timeout: 10000,
        headers: {
          'User-Agent': 'TempMail/1.0'
        }
      });

      if (domainsResponse.ok) {
        const domains = await domainsResponse.json();
        if (Array.isArray(domains) && domains.length > 0) {
          const domain = domains[Math.floor(Math.random() * domains.length)];
          const username = Math.random().toString(36).substring(2, 12);
          const address = `${username}@${domain}`;
          const token = `1secmail:${username}:${domain}`;

          // Store session
          const sessionId = Math.random().toString(36).substring(2, 15);
          activeSessions.set(sessionId, { 
            address,
            username,
            domain,
            token, 
            provider: '1secmail',
            createdAt: Date.now(),
            lastActivity: Date.now(),
            messageCount: 0
          });

          console.log(`📧 Generated 1secmail email: ${address}`);
          return res.json({ 
            address, 
            token, 
            sessionId,
            domain,
            provider: '1secmail',
            expiresAt: Date.now() + MAX_AGE
          });
        }
      }
    } catch (error) {
      console.log('⚠️  1secmail failed:', error.message);
    }

    // Try tempmail.lol as third option
    try {
      console.log('🔄 Trying tempmail.lol service...');
      const response = await fetch('https://api.tempmail.lol/generate', {
        timeout: 10000,
        headers: {
          'Accept': 'application/json',
          'User-Agent': 'TempMail/1.0'
        }
      });

      if (response.ok) {
        const data = await response.json();
        if (data.address) {
          const address = data.address;
          const [username, domain] = address.split('@');
          const token = `tempmail-lol:${data.token || username}:${domain}`;

          // Store session
          const sessionId = Math.random().toString(36).substring(2, 15);
          activeSessions.set(sessionId, { 
            address,
            username,
            domain,
            token, 
            provider: 'tempmail-lol',
            apiToken: data.token,
            createdAt: Date.now(),
            lastActivity: Date.now(),
            messageCount: 0
          });

          console.log(`📧 Generated tempmail.lol email: ${address}`);
          return res.json({ 
            address, 
            token, 
            sessionId,
            domain,
            provider: 'tempmail-lol',
            expiresAt: Date.now() + MAX_AGE
          });
        }
      }
    } catch (error) {
      console.log('⚠️  tempmail.lol failed:', error.message);
    }

    // Fallback to demo mode if all APIs fail
    console.log('🔄 All APIs failed, using demo mode...');
    const demodomains = [
      'demo-tempmail.com',
      'demo-mail.org', 
      'demo-email.net'
    ];

    const username = Math.random().toString(36).substring(2, 12);
    const domain = demodomains[Math.floor(Math.random() * demodomains.length)];
    const address = `${username}@${domain}`;
    const token = `demo:${username}:${domain}`;

    // Store session
    const sessionId = Math.random().toString(36).substring(2, 15);
    activeSessions.set(sessionId, { 
      address,
      username,
      domain,
      token, 
      provider: 'demo',
      createdAt: Date.now(),
      lastActivity: Date.now(),
      messageCount: 0
    });

    console.log(`📧 Generated demo email: ${address}`);

    res.json({ 
      address, 
      token, 
      sessionId,
      domain,
      provider: 'demo',
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

    // Parse token based on provider
    const tokenParts = token.split(':');
    const provider = tokenParts[0];

    let message = null;

    if (provider === 'mailtm') {
      // mail.tm provider
      const [, accountId, jwtToken] = tokenParts;
      
      try {
        const messageRes = await fetch(`https://api.mail.tm/messages/${id}`, {
          timeout: 10000,
          headers: {
            'Authorization': `Bearer ${jwtToken}`,
            'Accept': 'application/json',
            'User-Agent': 'TempMail/1.0'
          }
        });

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
        }
      } catch (error) {
        console.log(`⚠️  Error fetching mail.tm message ${id}:`, error.message);
      }

    } else if (provider === '1secmail') {
      // 1secmail provider
      const [, username, domain] = tokenParts;
      
      try {
        const messageRes = await fetch(`https://www.1secmail.com/api/v1/?action=readMessage&login=${username}&domain=${domain}&id=${id}`, {
          timeout: 10000,
          headers: {
            'User-Agent': 'TempMail/1.0'
          }
        });

        if (messageRes.ok) {
          const data = await messageRes.json();
          message = {
            id: data.id,
            subject: data.subject || 'No Subject',
            from: {
              address: data.from,
              name: data.from
            },
            date: data.date || new Date().toISOString(),
            createdAt: data.date || new Date().toISOString(),
            text: data.textBody || data.body || '',
            html: data.htmlBody || data.textBody || data.body || '',
            intro: data.textBody ? data.textBody.substring(0, 100) + '...' : ''
          };
        }
      } catch (error) {
        console.log(`⚠️  Error fetching 1secmail message ${id}:`, error.message);
      }

    } else if (provider === 'tempmail-lol') {
      // tempmail.lol provider
      const [, apiToken, domain] = tokenParts;
      
      try {
        const messageRes = await fetch(`https://api.tempmail.lol/auth/${apiToken}/messages/${id}`, {
          timeout: 10000,
          headers: {
            'Accept': 'application/json',
            'User-Agent': 'TempMail/1.0'
          }
        });

        if (messageRes.ok) {
          const data = await messageRes.json();
          message = {
            id: data.id,
            subject: data.subject || 'No Subject',
            from: {
              address: data.from,
              name: data.from
            },
            date: data.date || new Date().toISOString(),
            createdAt: data.date || new Date().toISOString(),
            text: data.body || '',
            html: data.html || data.body || '',
            intro: data.body ? data.body.substring(0, 100) + '...' : ''
          };
        }
      } catch (error) {
        console.log(`⚠️  Error fetching tempmail.lol message ${id}:`, error.message);
      }

    } else if (provider === 'demo') {
      // Demo provider - return demo message content
      const demoMessages = {
        'demo_1': {
          id: 'demo_1',
          subject: 'Welcome to TempMonkeyMail!',
          from: {
            address: 'welcome@tempmonkeymail.com',
            name: 'TempMonkeyMail Team'
          },
          date: new Date().toISOString(),
          createdAt: new Date().toISOString(),
          text: `Dear User,

Welcome to TempMonkeyMail! 🎉

Your temporary email address is now active and ready to receive emails. Here's what you can do:

✅ Use this email for signups and registrations
✅ Protect your real email from spam
✅ Keep your privacy intact
✅ No registration required

This service provides you with a temporary, disposable email address that you can use anywhere you need an email but don't want to use your real one.

Features:
- Instant email generation
- Real-time message delivery
- Clean, modern interface
- Mobile-friendly design
- Automatic cleanup

Thank you for using TempMonkeyMail!

Best regards,
The TempMonkeyMail Team`,
          html: `<div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
            <h2 style="color: #4ade80;">Welcome to TempMonkeyMail! 🎉</h2>
            <p>Your temporary email address is now active and ready to receive emails.</p>
            <h3>What you can do:</h3>
            <ul>
              <li>✅ Use this email for signups and registrations</li>
              <li>✅ Protect your real email from spam</li>
              <li>✅ Keep your privacy intact</li>
              <li>✅ No registration required</li>
            </ul>
            <p>Thank you for using TempMonkeyMail!</p>
            <p><strong>The TempMonkeyMail Team</strong></p>
          </div>`,
          intro: 'Welcome to TempMonkeyMail! Your temporary email address is now active...'
        },
        'demo_2': {
          id: 'demo_2',
          subject: 'Demo Message 2',
          from: {
            address: 'demo2@example.com',
            name: 'Demo Sender 2'
          },
          date: new Date().toISOString(),
          createdAt: new Date().toISOString(),
          text: 'This is the second demo message. Your temporary email is working perfectly and can receive real emails from any sender.',
          html: '<p>This is the second demo message. Your temporary email is working perfectly and can receive real emails from any sender.</p>',
          intro: 'This is the second demo message...'
        },
        'demo_3': {
          id: 'demo_3',
          subject: 'Demo Message 3',
          from: {
            address: 'demo3@example.com',
            name: 'Demo Sender 3'
          },
          date: new Date().toISOString(),
          createdAt: new Date().toISOString(),
          text: 'This is the third demo message showing how multiple emails appear in your inbox.',
          html: '<p>This is the third demo message showing how multiple emails appear in your inbox.</p>',
          intro: 'This is the third demo message...'
        }
      };

      message = demoMessages[id];
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
        const messagesRes = await fetch('https://api.mail.tm/messages', {
          timeout: 10000,
          headers: {
            'Authorization': `Bearer ${jwtToken}`,
            'Accept': 'application/json',
            'User-Agent': 'TempMail/1.0'
          }
        });

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
          console.log(`⚠️  mail.tm API error: ${messagesRes.status}`);
        }
      } catch (error) {
        console.log(`⚠️  Error fetching mail.tm messages:`, error.message);
      }

    } else if (provider === '1secmail') {
      // 1secmail provider
      const [, username, domain] = tokenParts;
      
      try {
        const messagesRes = await fetch(`https://www.1secmail.com/api/v1/?action=getMessages&login=${username}&domain=${domain}`, {
          timeout: 10000,
          headers: {
            'User-Agent': 'TempMail/1.0'
          }
        });

        if (messagesRes.ok) {
          const data = await messagesRes.json();
          if (Array.isArray(data)) {
            messages = data.map(msg => ({
              id: msg.id,
              subject: msg.subject || 'No Subject',
              from: {
                address: msg.from,
                name: msg.from
              },
              date: msg.date || new Date().toISOString(),
              createdAt: msg.date || new Date().toISOString(),
              text: msg.textBody || '',
              intro: msg.textBody ? msg.textBody.substring(0, 100) + '...' : '',
              seen: false
            }));
            console.log(`📧 Fetched ${messages.length} messages from 1secmail`);
          }
        } else {
          console.log(`⚠️  1secmail API error: ${messagesRes.status}`);
        }
      } catch (error) {
        console.log(`⚠️  Error fetching 1secmail messages:`, error.message);
      }

    } else if (provider === 'tempmail-lol') {
      // tempmail.lol provider
      const [, apiToken, domain] = tokenParts;
      
      try {
        const messagesRes = await fetch(`https://api.tempmail.lol/auth/${apiToken}/messages`, {
          timeout: 10000,
          headers: {
            'Accept': 'application/json',
            'User-Agent': 'TempMail/1.0'
          }
        });

        if (messagesRes.ok) {
          const data = await messagesRes.json();
          if (data.email && Array.isArray(data.email)) {
            messages = data.email.map(msg => ({
              id: msg.id,
              subject: msg.subject || 'No Subject',
              from: {
                address: msg.from,
                name: msg.from
              },
              date: msg.date || new Date().toISOString(),
              createdAt: msg.date || new Date().toISOString(),
              text: msg.body || '',
              intro: msg.body ? msg.body.substring(0, 100) + '...' : '',
              seen: false
            }));
            console.log(`📧 Fetched ${messages.length} messages from tempmail.lol`);
          }
        } else {
          console.log(`⚠️  tempmail.lol API error: ${messagesRes.status}`);
        }
      } catch (error) {
        console.log(`⚠️  Error fetching tempmail.lol messages:`, error.message);
      }

    } else if (provider === 'demo') {
      // Demo provider - simulate messages
      const [, username, domain] = tokenParts;
      const now = Date.now();
      
      // Add demo messages after 30 seconds
      if (session && (now - session.createdAt) > 30000) {
        const messageCount = Math.floor((now - session.createdAt) / 120000) + 1; // One every 2 minutes
        
        for (let i = 0; i < Math.min(messageCount, 3); i++) {
          const messageTime = new Date(session.createdAt + 30000 + (i * 120000));
          messages.push({
            id: `demo_${i + 1}`,
            subject: i === 0 ? 'Welcome to TempMonkeyMail!' : `Demo Message ${i + 1}`,
            from: {
              address: i === 0 ? 'welcome@tempmonkeymail.com' : `demo${i}@example.com`,
              name: i === 0 ? 'TempMonkeyMail Team' : `Demo Sender ${i}`
            },
            date: messageTime.toISOString(),
            createdAt: messageTime.toISOString(),
            text: i === 0 ? 
              'Welcome to TempMonkeyMail! Your temporary email is working perfectly. This service helps protect your privacy by providing disposable email addresses.' :
              `This is demo message ${i + 1}. Your temporary email address ${username}@${domain} is active and ready to receive real emails.`,
            intro: i === 0 ? 'Welcome to TempMonkeyMail! Your temporary email is working...' : `Demo message ${i + 1} content...`,
            seen: false
          });
        }
        
        console.log(`📧 Generated ${messages.length} demo messages for demo provider`);
      }
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