// api/login.js
const { createSessionToken } = require('../lib/auth');

module.exports = async function handler(req, res) {
  if (req.method !== 'POST') {
    res.status(405).json({ error: 'Method not allowed' });
    return;
  }

  const { password } = req.body || {};
  if (!password || password !== process.env.DASHBOARD_PASSWORD) {
    res.status(401).json({ error: 'Password incorrecta' });
    return;
  }

  const token = createSessionToken(process.env.SESSION_SECRET);
  res.setHeader(
    'Set-Cookie',
    `session=${token}; HttpOnly; Secure; SameSite=Strict; Path=/; Max-Age=2592000`
  );
  res.status(200).json({ ok: true });
};
