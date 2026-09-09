const crypto = require('crypto');

const THIRTY_DAYS_MS = 30 * 24 * 60 * 60 * 1000;

function createSessionToken(secret, ttlMs = THIRTY_DAYS_MS) {
  const expiresAt = String(Date.now() + ttlMs);
  const hmac = crypto.createHmac('sha256', secret).update(expiresAt).digest('hex');
  return `${expiresAt}.${hmac}`;
}

function verifySessionToken(secret, token) {
  if (!token || typeof token !== 'string' || !token.includes('.')) return false;
  const [expiresAt, hmac] = token.split('.');
  if (!/^\d+$/.test(expiresAt) || !/^[0-9a-f]{64}$/.test(hmac)) return false;
  const expected = crypto.createHmac('sha256', secret).update(expiresAt).digest('hex');
  const signatureValid = crypto.timingSafeEqual(Buffer.from(hmac), Buffer.from(expected));
  return signatureValid && Number(expiresAt) > Date.now();
}

module.exports = { createSessionToken, verifySessionToken };
