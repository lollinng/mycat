import test from 'node:test';
import assert from 'node:assert';
import { valueOf, matches, titleOf } from '../panel/values.js';

test('a days-until field counts down and stops at zero', () => {
  const f = { label: 'Notice period (days)', compute: { daysUntil: '2030-03-01' } };
  assert.strictEqual(valueOf(f, new Date(2030, 1, 26, 23, 30)), '3');
  assert.strictEqual(valueOf(f, new Date(2030, 2, 1, 9)), '0');
  assert.strictEqual(valueOf(f, new Date(2030, 3, 5)), '0');
  assert.strictEqual(valueOf({ value: 'x' }), 'x');
});

test('search needs every word, in any order and case', () => {
  assert.ok(matches('Pay & start Expected CTC 20 LPA', 'ctc expected'));
  assert.ok(!matches('Contact Email', 'email phone'));
  assert.ok(matches('anything', '   '));
});

test('a note is titled by its first non-empty line', () => {
  assert.strictEqual(titleOf('\n  Acme round\nTuesday'), 'Acme round');
  assert.strictEqual(titleOf('   '), 'Empty note');
});
