const { createSessionToken } = require('../lib/auth');
const { parseCookies, isAuthenticated } = require('../lib/require-auth');

test('parseCookies splits a cookie header into a map', () => {
  expect(parseCookies('session=abc; other=xyz')).toEqual({ session: 'abc', other: 'xyz' });
});

test('parseCookies returns empty object for missing header', () => {
  expect(parseCookies(undefined)).toEqual({});
});

test('isAuthenticated is true with a valid session cookie', () => {
  process.env.SESSION_SECRET = 'test-secret';
  const token = createSessionToken('test-secret');
  const req = { headers: { cookie: `session=${token}` } };
  expect(isAuthenticated(req)).toBe(true);
});

test('isAuthenticated is false with no cookie', () => {
  process.env.SESSION_SECRET = 'test-secret';
  expect(isAuthenticated({ headers: {} })).toBe(false);
});
