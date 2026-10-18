const test = require('node:test');
const assert = require('node:assert/strict');
const v = require('../validation');
test('email validation',()=>{assert.equal(v.email(' Example@Domain.COM '),'example@domain.com');assert.equal(v.email('bad'), '');});
test('password enforces 10 chars including letter and digit',()=>{assert.equal(v.password('SecurePass123'),true);assert.equal(v.password('short1'),false);assert.equal(v.password('passwordonly'),false);});
test('date validation rejects invalid date',()=>{assert.equal(v.dateOnly('2026-02-31'),false);assert.equal(v.dateOnly('2026-10-18'),true);assert.equal(v.dateOnly(null),true);});
test('uuid validation',()=>{assert.equal(v.uuid('00000000-0000-4000-8000-000000000000'),true);assert.equal(v.uuid('1 OR 1=1'),false);});
