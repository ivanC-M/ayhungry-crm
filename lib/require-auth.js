const { verifySessionToken } = require('./auth');

function parseCookies(cookieHeader) {
  const cookies = {};
  if (!cookieHeader) return cookies;
  cookieHeader.split(';').forEach((pair) => {
    const [key, ...rest] = pair.trim().split('=');
    cookies[key] = rest.join('=');
  });
  return cookies;
}

function isAuthenticated(req) {
  const cookies = parseCookies(req.headers.cookie);
  return verifySessionToken(process.env.SESSION_SECRET, cookies.session);
}

module.exports = { parseCookies, isAuthenticated };
