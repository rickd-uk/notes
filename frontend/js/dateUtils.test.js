// Standalone test for formatRelativeDate — run with: node frontend/js/dateUtils.test.js

function formatRelativeDate(dateString) {
  if (!dateString) return '';
  const now = new Date();
  const date = new Date(dateString);
  if (isNaN(date.getTime())) return '';
  const diff = Math.floor((now - date) / 1000); // seconds

  if (diff < 60)           return 'just now';
  if (diff < 3600)         return `${Math.floor(diff / 60)} min ago`;
  if (diff < 86400)        return `${Math.floor(diff / 3600)} hour${Math.floor(diff / 3600) === 1 ? '' : 's'} ago`;
  if (diff < 172800)       return 'yesterday';
  if (diff < 604800)       return `${Math.floor(diff / 86400)} days ago`;
  if (diff < 2592000)      return `${Math.floor(diff / 604800)} week${Math.floor(diff / 604800) === 1 ? '' : 's'} ago`;

  const opts = { month: 'short', day: 'numeric' };
  if (date.getFullYear() !== now.getFullYear()) opts.year = 'numeric';
  return date.toLocaleDateString(undefined, opts);
}

function test(label, input, expected) {
  const result = formatRelativeDate(input);
  const ok = result === expected;
  console.log(`${ok ? '✅' : '❌'} ${label}: got "${result}", expected "${expected}"`);
  if (!ok) process.exitCode = 1;
}

const now = new Date();
const ms = (s) => new Date(now - s * 1000).toISOString();

test('just now (30s)',            ms(30),          'just now');
test('just now (59s)',            ms(59),          'just now');
test('minutes ago (5m)',          ms(5 * 60),      '5 min ago');
test('1 min boundary',            ms(60),          '1 min ago');
test('hours ago (3h)',            ms(3 * 3600),    '3 hours ago');
test('1 hour boundary',           ms(3600),        '1 hour ago');
test('yesterday boundary (24h)',  ms(86400),       'yesterday');
test('yesterday (1.5 days)',      ms(1.5 * 86400), 'yesterday');
test('days ago (3 days)',         ms(3 * 86400),   '3 days ago');
test('2 day boundary',            ms(2 * 86400),   '2 days ago');
test('weeks ago (2 weeks)',       ms(14 * 86400),  '2 weeks ago');
test('7 day boundary',            ms(7 * 86400),   '1 week ago');
// For the date-format tests we check the shape rather than exact value
const oldSameYear = new Date(now.getFullYear(), now.getMonth() - 2, 1).toISOString(); // 2 months ago (always >30 days)
const oldOtherYear = new Date(2020, 0, 5).toISOString();             // Jan 5, 2020
const r1 = formatRelativeDate(oldSameYear);
const r2 = formatRelativeDate(oldOtherYear);
console.log(`${/^[A-Z][a-z]+ \d+$/.test(r1) ? '✅' : '❌'} same-year old date: got "${r1}"`);
console.log(`${/^[A-Z][a-z]+ \d+, 20\d\d$/.test(r2) ? '✅' : '❌'} other-year old date: got "${r2}"`);
test('invalid input returns empty string', 'not-a-date', '');
test('null-ish string returns empty string', '', '');
