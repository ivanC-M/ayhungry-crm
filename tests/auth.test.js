const { createSessionToken, verifySessionToken } = require('../lib/auth');

test('a freshly created token is valid', () => {
  const token = createSessionToken('secret-1');
  expect(verifySessionToken('secret-1', token)).toBe(true);
});

test('a token signed with a different secret is invalid', () => {
  const token = createSessionToken('secret-1');
  expect(verifySessionToken('secret-2', token)).toBe(false);
});

test('an expired token is invalid', () => {
  const token = createSessionToken('secret-1', -1000);
  expect(verifySessionToken('secret-1', token)).toBe(false);
});

test('a tampered token is invalid', () => {
  const token = createSessionToken('secret-1');
  const tampered = token.slice(0, -1) + (token.endsWith('a') ? 'b' : 'a');
  expect(verifySessionToken('secret-1', tampered)).toBe(false);
});

test('malformed or missing tokens are invalid', () => {
  expect(verifySessionToken('secret-1', undefined)).toBe(false);
  expect(verifySessionToken('secret-1', '')).toBe(false);
  expect(verifySessionToken('secret-1', 'not-a-real-token')).toBe(false);
});

test('missing or empty secret is invalid', () => {
  const token = createSessionToken('secret-1');
  expect(verifySessionToken(undefined, token)).toBe(false);
  expect(verifySessionToken('', token)).toBe(false);
});
