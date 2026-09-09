const { isOverdue, getUrgencyLevel } = require('../lib/urgency');

test('isOverdue is true when date is before today', () => {
  expect(isOverdue('2026-09-01', '2026-09-09')).toBe(true);
});

test('isOverdue is false when date is today or future', () => {
  expect(isOverdue('2026-09-09', '2026-09-09')).toBe(false);
  expect(isOverdue('2026-09-15', '2026-09-09')).toBe(false);
});

test('isOverdue is false when date is null', () => {
  expect(isOverdue(null, '2026-09-09')).toBe(false);
});

test('getUrgencyLevel prioritizes at-risk over overdue', () => {
  const record = { 'En riesgo': true, 'Proximo seguimiento': '2026-09-01' };
  expect(getUrgencyLevel(record, '2026-09-09')).toBe('at-risk');
});

test('getUrgencyLevel returns overdue when only the date is late', () => {
  const record = { 'En riesgo': false, 'Proximo seguimiento': '2026-09-01' };
  expect(getUrgencyLevel(record, '2026-09-09')).toBe('overdue');
});

test('getUrgencyLevel returns ok otherwise', () => {
  const record = { 'En riesgo': false, 'Proximo seguimiento': '2026-09-15' };
  expect(getUrgencyLevel(record, '2026-09-09')).toBe('ok');
});
