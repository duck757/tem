const express = require('express');
const fetch = require('node-fetch');
const cors = require('cors');
const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(express.json());

let domainCache = null;

// 1. Generate new email
app.get('/api/generate', async (req, res) => {
  try {
    if (!domainCache) {
      const domainsRes = await fetch('https://api.mail.tm/domains');
      const domains = await domainsRes.json();
      domainCache = domains['hydra:member'][0].domain;
    }

    const random = Math.random().toString(36).substring(2, 10);
    const address = `${random}@${domainCache}`;
    const password = 'tempmail123';

    const registerRes = await fetch('https://api.mail.tm/accounts', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ address, password })
    });

    if (!registerRes.ok) throw new Error('Account creation failed');
    await registerRes.json();

    const tokenRes = await fetch('https://api.mail.tm/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ address, password })
    });

    const tokenData = await tokenRes.json();
    res.json({ address, token: tokenData.token });
  } catch (err) {
    res.status(500).json({ error: 'Failed to generate email' });
  }
});

// 2. Fetch messages
app.get('/api/messages', async (req, res) => {
  const { email, token } = req.query;
  try {
    const msgRes = await fetch('https://api.mail.tm/messages', {
      headers: { Authorization: `Bearer ${token}` }
    });
    const msgData = await msgRes.json();
    res.json(msgData['hydra:member']);
  } catch (err) {
    res.status(500).json({ error: 'Failed to load messages' });
  }
});

app.listen(PORT, () => console.log(`Server running on port ${PORT}`));
