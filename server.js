const express = require('express');
const fetch = require('node-fetch');
const path = require('path');
const app = express();
const PORT = process.env.PORT || 3000;

app.use(express.static(__dirname));
app.use(express.json());

// Store active sessions
const activeSessions = new Map();

app.get('/api/generate', async (req, res) => {
  try {
    // Get available domains
    const domainRes = await fetch('https://api.mail.tm/domains');
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
      body: JSON.stringify({ address, password })
    });
    
    if (!accountRes.ok) {
      const error = await accountRes.json();
      return res.status(400).json({ error: 'Failed to create account', details: error });
    }
    
    // Get authentication token
    const tokenRes = await fetch('https://api.mail.tm/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ address, password })
    });
    
    if (!tokenRes.ok) {
      return res.status(400).json({ error: 'Failed to authenticate' });
    }
    
    const tokenData = await tokenRes.json();
    const token = tokenData.token;
    
    // Store session
    const sessionId = Math.random().toString(36).substring(2, 15);
    activeSessions.set(sessionId, { address, token, createdAt: Date.now() });
    
    res.json({ 
      address, 
      token, 
      sessionId,
      domain,
      expiresAt: Date.now() + (24 * 60 * 60 * 1000) // 24 hours
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
    
    const messagesRes = await fetch('https://api.mail.tm/messages', {
      headers: { Authorization: `Bearer ${token}` }
    });
    
    if (!messagesRes.ok) {
      return res.status(401).json({ error: 'Invalid token' });
    }
    
    const messagesData = await messagesRes.json();
    const messages = messagesData['hydra:member'] || [];
    
    // Sort messages by date (newest first)
    messages.sort((a, b) => new Date(b.date) - new Date(a.date));
    
    res.json(messages);
    
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
      headers: { Authorization: `Bearer ${token}` }
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
      headers: { Authorization: `Bearer ${token}` }
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
    const domainsRes = await fetch('https://api.mail.tm/domains');
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
      headers: { Authorization: `Bearer ${token}` }
    });
    
    const isValid = messagesRes.ok;
    
    res.json({ 
      valid: isValid,
      timestamp: Date.now()
    });
    
  } catch (error) {
    console.error('Error checking status:', error);
    res.status(500).json({ error: 'Failed to check status' });
  }
});

// Clean up old sessions periodically
setInterval(() => {
  const now = Date.now();
  const maxAge = 24 * 60 * 60 * 1000; // 24 hours
  
  for (const [sessionId, session] of activeSessions.entries()) {
    if (now - session.createdAt > maxAge) {
      activeSessions.delete(sessionId);
    }
  }
}, 60 * 60 * 1000); // Clean up every hour

app.listen(PORT, () => {
  console.log(`TempMail server running on port ${PORT}`);
  console.log(`Visit http://localhost:${PORT} to use the service`);
});