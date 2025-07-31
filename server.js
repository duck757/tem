const express = require('express');
const axios = require('axios');
const app = express();
app.use(express.static('public'));

let tempToken = null;
let tempEmail = null;
let tempId = null;

app.get('/api/generate', async (_, res) => {
  const domainRes = await axios.get('https://api.mail.tm/domains');
  const domain = domainRes.data['hydra:member'][0].domain;

  const random = Math.random().toString(36).substring(2, 10);
  const email = `${random}@${domain}`;
  const password = random + 'Xy!';

  await axios.post('https://api.mail.tm/accounts', { address: email, password });
  const tokenRes = await axios.post('https://api.mail.tm/token', { address: email, password });
  tempToken = tokenRes.data.token;

  const user = await axios.get('https://api.mail.tm/me', {
    headers: { Authorization: `Bearer ${tempToken}` }
  });
  tempId = user.data.id;
  tempEmail = email;

  res.json({ email, token: tempToken });
});

app.get('/api/inbox', async (req, res) => {
  const token = req.query.token || tempToken;
  const inbox = await axios.get('https://api.mail.tm/messages', {
    headers: { Authorization: `Bearer ${token}` }
  });
  res.json(inbox.data['hydra:member']);
});

app.get('/api/status', (_, res) => res.json({ status: "ok" }));

app.listen(process.env.PORT || 3000, () => {
  console.log("✅ Server is running on port " + (process.env.PORT || 3000));
});
