const express = require('express');
const fetch = require('node-fetch');
const path = require('path');
const app = express();
const PORT = process.env.PORT || 3000;

app.use(express.static(__dirname));

app.get('/api/generate', async (req, res) => {
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
});

app.get('/api/messages', async (req, res) => {
  const { token } = req.query;
  const messagesRes = await fetch('https://api.mail.tm/messages', {
    headers: { Authorization: `Bearer ${token}` }
  });
  const messages = await messagesRes.json();
  res.json(messages['hydra:member'] || []);
});

app.listen(PORT, () => console.log(`Running on port ${PORT}`));