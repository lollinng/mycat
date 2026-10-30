// The answers panel: groups of fields to copy into job forms (click = copy), and free notes.
// The window does not take the keyboard unless you type in it, so after a click the form
// you were filling still has focus and Ctrl+V pastes straight in.
import { valueOf, matches, titleOf, ago } from './values.js';
import { skinById } from '../pet/sprite.js';

const api = window.pet;
const $ = (s) => document.querySelector(s);
const list = $('#list');
const q = $('#q');
const newId = () => crypto.randomUUID().slice(0, 8);

let data = await api.data();
let tab = 'fields';
let query = '';
let editing = null;     // id of the field or note being edited

const ICONS = {
  edit: '<svg viewBox="0 0 16 16"><path d="M10.5 2.5l3 3L6 13H3v-3z"/></svg>',
  trash: '<svg viewBox="0 0 16 16"><path d="M3 4.5h10M6.5 4.5V3h3v1.5M4.5 4.5l.7 8.5h5.6l.7-8.5"/></svg>',
  copy: '<svg viewBox="0 0 16 16"><rect x="5.5" y="5.5" width="8" height="8" rx="1.5"/><path d="M10.5 5.5V3.5a1 1 0 0 0-1-1h-6a1 1 0 0 0-1 1v6a1 1 0 0 0 1 1h2"/></svg>',
};

function el(tag, cls, html) {
  const e = document.createElement(tag);
  if (cls) e.className = cls;
  if (html !== undefined) e.innerHTML = html;
  return e;
}
const esc = (s) => s.replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));

function toast(text) {
  const t = $('#toast');
  t.textContent = text;
  t.classList.add('show');
  clearTimeout(toast.timer);
  toast.timer = setTimeout(() => t.classList.remove('show'), 1400);
}

// ---- the cat in the corner ---------------------------------------------------------------

// The first cat's standing frame, fitted into the avatar square.
function drawAvatar(settings) {
  const skin = skinById(settings.cats?.[0]);
  const a = skin.anims.idle;
  const [x0, y0, x1, y1] = a.boxes[0];
  const k = Math.min(36 / (x1 - x0), 36 / (y1 - y0));
  Object.assign($('#avatar').style, {
    backgroundImage: `url("../assets/skins/${skin.id}/${a.file}")`,
    backgroundSize: `${a.frames * skin.frame[0] * k}px ${skin.frame[1] * k}px`,
    backgroundPosition: `${20 - ((x0 + x1) / 2) * k}px ${20 - ((y0 + y1) / 2) * k}px`,
    backgroundRepeat: 'no-repeat',
    imageRendering: 'pixelated',
  });
}
drawAvatar(data.settings);
$('#name').textContent = data.settings.name;

// ---- keyboard: only while typing in the panel ----------------------------------------------

async function takeKeyboard(input) {
  await api.focusPanel(true);
  input.focus();
}
function giveBackKeyboard() {
  document.activeElement?.blur();
  api.focusPanel(false);
}

// ---- copying -------------------------------------------------------------------------------

async function copy(text, node) {
  await api.copy(text);
  node.classList.add('flash');
  setTimeout(() => node.classList.remove('flash'), 1000);
}

// ---- Easy Apply fields ---------------------------------------------------------------------

async function saveFields() {
  data.fields = await api.saveFields(data.fields);
}

function fieldRow(group, f) {
  if (editing === f.id) return fieldForm(group, f);
  const value = valueOf(f);
  const row = el('div', `row${value.length > 70 || value.includes('\n') ? ' long' : ''}`);
  row.innerHTML = `
    <div class="text">
      <div class="label">${esc(f.label || 'Untitled')}${f.compute ? '<span class="auto">auto</span>' : ''}</div>
      <div class="value${value ? '' : ' unset'}">${value ? esc(value) : 'Not set yet. Click to add it'}</div>
    </div>
    <div class="acts"><button class="icon" title="Edit">${ICONS.edit}</button></div>
    <div class="copied">Copied</div>`;
  row.addEventListener('click', (e) => {
    if (e.target.closest('.acts') || !value) { editing = f.id; render(); return; }
    copy(value, row);
  });
  row.copyNow = () => value && copy(value, row);
  return row;
}

function fieldForm(group, f) {
  const form = el('div', 'edit-form');
  const date = f.compute?.daysUntil;
  form.innerHTML = `
    <div class="lbl">Label</div>
    <input class="f-label" value="${esc(f.label)}" placeholder="e.g. Notice period (days)">
    <div class="lbl">${date ? 'Count the days until' : 'Value'}</div>
    ${date ? `<input class="f-date" type="date" value="${date}"><div class="hint">Copies the number of days left until this date (0 after it).</div>`
           : `<textarea class="f-value" rows="${Math.min(8, Math.max(2, Math.ceil(f.value.length / 42)))}" placeholder="What to paste">${esc(f.value)}</textarea>`}
    <div class="buttons">
      <button class="btn danger del">Delete</button><span class="grow"></span>
      <button class="btn cancel">Cancel</button><button class="btn primary save">Save</button>
    </div>`;
  const close = () => { editing = null; giveBackKeyboard(); render(); };
  const save = async () => {
    f.label = form.querySelector('.f-label').value.trim() || 'Untitled';
    if (date) f.compute = { daysUntil: form.querySelector('.f-date').value || date };
    else f.value = form.querySelector('.f-value').value;
    await saveFields();
    toast('Saved');
    close();
  };
  form.querySelector('.save').onclick = save;
  form.querySelector('.cancel').onclick = () => {
    if (!f.label && !f.value) group.fields.splice(group.fields.indexOf(f), 1);  // an added field left empty
    close();
  };
  form.querySelector('.del').onclick = async () => {
    group.fields.splice(group.fields.indexOf(f), 1);
    await saveFields();
    toast('Deleted');
    close();
  };
  form.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' && (e.ctrlKey || e.target.tagName === 'INPUT')) { e.preventDefault(); save(); }
    if (e.key === 'Escape') { e.stopPropagation(); form.querySelector('.cancel').click(); }
  });
  setTimeout(() => takeKeyboard(form.querySelector(f.label ? '.f-value, .f-date' : '.f-label')), 0);
  return form;
}

function renderFields() {
  let shown = 0;
  for (const group of data.fields.groups) {
    const rows = group.fields.filter((f) => editing === f.id || !query || matches(`${group.name} ${f.label} ${valueOf(f)}`, query));
    if (query && !rows.length) continue;
    const section = el('section', 'group');
    const head = el('h3', '', `<span>${esc(group.name)}</span>`);
    if (!query) {
      const add = el('button', 'add', '+ Add');
      add.title = `Add a field to ${group.name}`;
      add.onclick = () => { const f = { id: newId(), label: '', value: '' }; group.fields.push(f); editing = f.id; render(); };
      head.append(add);
    }
    section.append(head);
    for (const f of rows) { section.append(fieldRow(group, f)); shown++; }
    list.append(section);
  }
  if (!shown && query) list.append(el('div', 'empty', `Nothing matches “${esc(query)}”.`));
}

// ---- notes ---------------------------------------------------------------------------------

async function saveNotes() {
  data.notes = await api.saveNotes(data.notes);
}

function composer() {
  const box = el('div', 'composer');
  box.innerHTML = `<textarea rows="1" placeholder="Write a note… (Ctrl+Enter saves)"></textarea>
    <div class="buttons"><span class="grow"></span><button class="btn cancel">Clear</button><button class="btn primary save">Save note</button></div>`;
  const ta = box.querySelector('textarea');
  const grow = () => { ta.style.height = 'auto'; ta.style.height = `${ta.scrollHeight + 2}px`; box.classList.toggle('typing', !!ta.value.trim()); };
  ta.addEventListener('input', grow);
  ta.addEventListener('pointerdown', () => takeKeyboard(ta));
  const save = async () => {
    const text = ta.value.trim();
    if (!text) return;
    const now = new Date().toISOString();
    data.notes.notes.unshift({ id: newId(), text, created: now, updated: now });
    await saveNotes();
    toast('Note saved');
    giveBackKeyboard();
    render();
  };
  ta.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' && e.ctrlKey) { e.preventDefault(); save(); }
    if (e.key === 'Escape') { e.stopPropagation(); ta.value = ''; grow(); giveBackKeyboard(); }
  });
  box.querySelector('.save').onclick = save;
  box.querySelector('.cancel').onclick = () => { ta.value = ''; grow(); giveBackKeyboard(); };
  return box;
}

function noteCard(n) {
  if (editing === n.id) return noteForm(n);
  const card = el('div', 'note');
  const [, ...rest] = n.text.split('\n');
  card.innerHTML = `
    <h4>${esc(titleOf(n.text))}</h4>
    ${rest.join('\n').trim() ? `<p>${esc(rest.join('\n').trim())}</p>` : ''}
    <time>${ago(n.updated || n.created)}</time>
    <div class="acts">
      <button class="icon edit" title="Edit">${ICONS.edit}</button>
      <button class="icon del" title="Delete">${ICONS.trash}</button>
    </div>
    <div class="copied">Copied</div>`;
  card.addEventListener('click', async (e) => {
    if (e.target.closest('.edit')) { editing = n.id; render(); return; }
    if (e.target.closest('.del')) {
      data.notes.notes = data.notes.notes.filter((x) => x.id !== n.id);
      await saveNotes();
      toast('Note deleted');
      render();
      return;
    }
    copy(n.text, card);
  });
  card.copyNow = () => copy(n.text, card);
  return card;
}

function noteForm(n) {
  const form = el('div', 'edit-form');
  form.innerHTML = `<textarea rows="${Math.min(12, n.text.split('\n').length + 2)}">${esc(n.text)}</textarea>
    <div class="buttons"><span class="grow"></span><button class="btn cancel">Cancel</button><button class="btn primary save">Save</button></div>`;
  const close = () => { editing = null; giveBackKeyboard(); render(); };
  const save = async () => {
    n.text = form.querySelector('textarea').value;
    n.updated = new Date().toISOString();
    await saveNotes();
    toast('Saved');
    close();
  };
  form.querySelector('.save').onclick = save;
  form.querySelector('.cancel').onclick = close;
  form.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' && e.ctrlKey) { e.preventDefault(); save(); }
    if (e.key === 'Escape') { e.stopPropagation(); close(); }
  });
  setTimeout(() => takeKeyboard(form.querySelector('textarea')), 0);
  return form;
}

function renderNotes() {
  if (!query) list.append(composer());
  const notes = [...data.notes.notes]
    .filter((n) => editing === n.id || !query || matches(n.text, query))
    .sort((a, b) => (b.updated || b.created).localeCompare(a.updated || a.created));
  for (const n of notes) list.append(noteCard(n));
  if (!notes.length) list.append(el('div', 'empty', query ? `No note matches “${esc(query)}”.` : 'Notes you write here stay with the cat.'));
}

// ---- frame ---------------------------------------------------------------------------------

function render() {
  list.replaceChildren();
  document.querySelectorAll('.tabs button').forEach((b) => b.classList.toggle('on', b.dataset.tab === tab));
  $('.search').classList.toggle('has-query', !!query);
  if (tab === 'fields') renderFields(); else renderNotes();
}

document.querySelectorAll('.tabs button').forEach((b) => b.addEventListener('click', () => {
  tab = b.dataset.tab;
  editing = null;
  render();
}));

q.addEventListener('pointerdown', () => takeKeyboard(q));
q.addEventListener('input', () => { query = q.value.trim(); render(); });
q.addEventListener('keydown', (e) => {
  if (e.key === 'Enter') {
    const first = list.querySelector('.row, .note');
    if (first?.copyNow) { first.copyNow(); setTimeout(giveBackKeyboard, 350); }
  }
  if (e.key === 'Escape') {
    e.stopPropagation();
    if (q.value) { q.value = ''; query = ''; render(); } else giveBackKeyboard();
  }
});

$('#close').onclick = () => { giveBackKeyboard(); api.hidePanel(); };
addEventListener('keydown', (e) => { if (e.key === 'Escape' && !editing) { giveBackKeyboard(); api.hidePanel(); } });

api.on('shown', async () => {
  data = await api.data();
  drawAvatar(data.settings);
  editing = null;
  q.value = '';
  query = '';
  render();
  list.scrollTop = 0;
});

render();
