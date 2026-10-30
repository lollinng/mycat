const test = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { Store } = require('../store');

const made = [];
const tmp = () => { const d = fs.mkdtempSync(path.join(os.tmpdir(), 'pet-store-')); made.push(d); return d; };
process.on('exit', () => { for (const d of made) fs.rmSync(d, { recursive: true, force: true }); });

test('a fresh folder gets empty starter groups and default settings', () => {
  const store = new Store(tmp());
  const groups = store.fields().groups;
  assert.deepStrictEqual(groups.map((g) => g.name), ['Contact', 'Links', 'Experience', 'Pay & start', 'Answers']);
  assert.ok(groups.every((g) => g.id && g.fields.every((f) => f.id && f.value === '')));
  assert.deepStrictEqual(store.settings().cats, ['kitty', 'persian']);
});

test('fields and notes survive a restart, with ids and a computed field kept', () => {
  const dir = tmp();
  new Store(dir).saveFields({ groups: [{ name: 'Pay', fields: [{ label: 'Notice', compute: { daysUntil: '2030-03-01' } }, { label: 'CTC', value: 25 }] }] });
  new Store(dir).saveNotes({ notes: [{ text: 'hello', created: '2026-10-29T10:00:00Z' }] });
  const again = new Store(dir);
  const [notice, ctc] = again.fields().groups[0].fields;
  assert.deepStrictEqual(notice.compute, { daysUntil: '2030-03-01' });
  assert.strictEqual(ctc.value, '25');
  assert.strictEqual(again.fields().groups[0].fields[0].id, notice.id);
  assert.strictEqual(again.notes().notes[0].text, 'hello');
});

test('an unreadable file is kept aside, not overwritten', () => {
  const dir = tmp();
  fs.writeFileSync(path.join(dir, 'notes.json'), '{oops');
  const store = new Store(dir);
  assert.deepStrictEqual(store.notes(), { notes: [] });
  assert.strictEqual(fs.readdirSync(dir).filter((f) => f.startsWith('notes.broken-')).length, 1);
});

test('settings fill in defaults, and cats that no longer exist drop out', () => {
  const store = new Store(tmp());
  store.saveSettings({ cats: ['persian'] });
  assert.deepStrictEqual({ ...store.settings() }, { name: 'Ket', cats: ['persian'], size: 'medium', startWithWindows: true,
    tree: { shown: true, x: 0.82, lift: 0 } });
  store.saveSettings({ tree: { lift: 120 } });
  assert.deepStrictEqual(store.settings().tree, { shown: true, x: 0.82, lift: 120 });
  store.saveSettings({ cats: ['bengal', 'kitty', 'kitty'] });
  assert.deepStrictEqual(store.settings().cats, ['kitty']);
  store.saveSettings({ cats: ['bengal'] });
  assert.deepStrictEqual(store.settings().cats, ['kitty', 'persian']);
});
