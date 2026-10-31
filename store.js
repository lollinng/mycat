// What the cat remembers, as JSON files in one folder (DesktopPet in %APPDATA% on Windows,
// ~/Library/Application Support on macOS, ~/.config on Linux):
// fields.json (the quick-copy answers), notes.json (free notes), settings.json.
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const DEFAULT_SETTINGS = {
  name: 'Ket', cats: ['kitty', 'persian'], size: 'medium', startWithWindows: true,
  tree: { shown: true, x: 0.82, lift: 0, size: 'large' },   // x: across the screen (0..1); lift: pixels above the taskbar
};
const CATS = ['kitty', 'persian', 'white', 'kitten'];

const DEFAULT_GROUPS = [
  ['Contact', ['First name', 'Last name', 'Email', 'Phone', 'City']],
  ['Links', ['LinkedIn', 'GitHub', 'Portfolio']],
  ['Experience', ['Total experience (years)', 'Current company', 'Current title']],
  ['Pay & start', ['Current CTC', 'Expected CTC', 'Notice period (days)']],
  ['Answers', []],
];

const newId = () => crypto.randomUUID().slice(0, 8);

function defaultFields() {
  return { groups: DEFAULT_GROUPS.map(([name, labels]) => ({ name, fields: labels.map((label) => ({ label, value: '' })) })) };
}

// Give every group and field an id and string values, whatever shape the file had.
function normaliseFields(doc) {
  const groups = Array.isArray(doc?.groups) ? doc.groups : [];
  return {
    groups: groups.map((g) => ({
      id: g.id || newId(),
      name: String(g.name ?? ''),
      fields: (Array.isArray(g.fields) ? g.fields : []).map((f) => ({
        id: f.id || newId(),
        label: String(f.label ?? ''),
        value: String(f.value ?? ''),
        ...(f.compute ? { compute: f.compute } : {}),
      })),
    })),
  };
}

function normaliseNotes(doc) {
  const notes = Array.isArray(doc?.notes) ? doc.notes : [];
  return { notes: notes.filter((n) => n && typeof n.text === 'string').map((n) => ({ id: n.id || newId(), ...n })) };
}

class Store {
  constructor(dir) { this.dir = dir; }

  file(name) { return path.join(this.dir, `${name}.json`); }

  read(name, fallback) {
    const file = this.file(name);
    try {
      return JSON.parse(fs.readFileSync(file, 'utf8'));
    } catch (e) {
      // An unreadable file is kept aside, never overwritten by the next save.
      if (e.code !== 'ENOENT') fs.renameSync(file, file.replace(/\.json$/, `.broken-${Date.now()}.json`));
      return fallback();
    }
  }

  write(name, data) {
    fs.mkdirSync(this.dir, { recursive: true });
    const file = this.file(name);
    fs.writeFileSync(`${file}.tmp`, JSON.stringify(data, null, 2));
    fs.renameSync(`${file}.tmp`, file);
  }

  fields() { return normaliseFields(this.read('fields', defaultFields)); }
  saveFields(doc) { const clean = normaliseFields(doc); this.write('fields', clean); return clean; }
  notes() { return normaliseNotes(this.read('notes', () => ({ notes: [] }))); }
  saveNotes(doc) { const clean = normaliseNotes(doc); this.write('notes', clean); return clean; }
  settings() {
    const s = { ...DEFAULT_SETTINGS, ...this.read('settings', () => ({})) };
    const cats = (Array.isArray(s.cats) ? s.cats : []).filter((c) => CATS.includes(c));   // cats that no longer exist drop out
    return { ...s, cats: cats.length ? [...new Set(cats)] : DEFAULT_SETTINGS.cats, tree: { ...DEFAULT_SETTINGS.tree, ...s.tree } };
  }
  saveSettings(s) { const clean = { ...DEFAULT_SETTINGS, ...s }; this.write('settings', clean); return clean; }
}

module.exports = { Store, DEFAULT_SETTINGS };
