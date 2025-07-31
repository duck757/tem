const express = require('express');
const path = require('path');
const fetch = require('node-fetch');
const app = express();
const PORT = process.env.PORT || 3000;

// 1. Serve static frontend from /public
app.use(express.static(path.join(__dirname, 'public')));

// 2. Serve index.html at root path "/"
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'public/index.html'));
});

// 3. API: Health check
app.get('/api/status', (req, res) => {
  res.json({ status: 'ok' });
});

// 4. API: Generate new temp email
app.get('/api/generate', async (req, res) => {
  try {
    const r = await fetch('https://api.mail.tm/domains');
    const data = await r.json();
    const domain = data['hydra:member'][0].domain;

    const username = Math.random().toString(36).substring(2, 11);
    const email = `${username}@${domain}`;
    res.json({ email });
  } catch (err) {
    res.status(500).json({ error: 'Failed to generate email' });
  }
});

// 5. API: Fetch inbox messages
app.get('/api/inbox', async (req, res) => {
  const token = req.query.token;
  if (!token) return res.status(400).json({ error: 'Token missing' });

  try {
    const r = await fetch('https://api.mail.tm/messages', {
      headers: {
        Authorization: `Bearer ${token}`
      }
    });
    const messages = await r.json();
    res.json(messages);
  } catch (err) {
    res.status(500).json({ error: 'Inbox fetch failed' });
  }
});

// Start the server
app.listen(PORT, () => {
  console.log(`✅ Server running on port ${PORT}`);
});
