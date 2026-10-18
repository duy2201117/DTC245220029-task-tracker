'use strict';
function text(value, max = 160) {
  return typeof value === 'string' ? value.trim().slice(0, max) : '';
}
function email(value) {
  const v = text(value, 254).toLowerCase();
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v) ? v : '';
}
function password(value) {
  return typeof value === 'string' && value.length >= 10 && value.length <= 128 && /[A-Za-z]/.test(value) && /\d/.test(value);
}
function uuid(value) {
  return typeof value === 'string' && /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value);
}
function dateOnly(value) {
  return value === null || value === '' || (typeof value === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(value) && !Number.isNaN(Date.parse(value + 'T00:00:00Z')) && new Date(value+'T00:00:00Z').toISOString().startsWith(value));
}
function oneOf(v, choices) { return choices.includes(v); }
module.exports = { text, email, password, uuid, dateOnly, oneOf };
