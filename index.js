require('dotenv').config();
const express = require('express');
const axios = require('axios');
const cors = require('cors');

const app = express();
app.use(cors());
app.use(express.json());

const API_BASE = process.env.MAILTM_API || 'https://api.mail.tm';

// Generate a new account
app.get('/new', async (req, res) => {
  try {
    const username = Math.random().toString(36).substring(2, 10);
    const domainData = await axios.get(`${API_BASE}/domains`);
    const domain = domainData.data['hydra:member'][0].domain;
    const email = `${username}@${domain}`;
    const password = Math.random().toString(36).substring(2, 12);
    const account = await axios.post(`${API_BASE}/accounts`, { address: email, password });
    const tokenRes = await axios.post(`${API_BASE}/token`, { address: email, password });
    const token = tokenRes.data.token;

    res.json({ email, password, token });
  } catch (err) {
    res.status(500).json({ error: 'Failed to create new inbox' });
  }
});

// Get messages for account (requires token)
app.get('/inbox/:token', async (req, res) => {
  try {
    const token = req.params.token;
    const messages = await axios.get(`${API_BASE}/messages`, {
      headers: { Authorization: `Bearer ${token}` }
    });
    res.json(messages.data);
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch inbox' });
  }
});

// Delete a message by ID
app.delete('/delete/:id/:token', async (req, res) => {
  try {
    const { id, token } = req.params;
    await axios.delete(`${API_BASE}/messages/${id}`, {
      headers: { Authorization: `Bearer ${token}` }
    });
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: 'Failed to delete message' });
  }
});

// Health check for Render
app.get('/healthz', (_, res) => res.send('OK'));

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`✅ TempMonkeyMail backend running on port ${PORT}`));