// Desktop pet: a cat that lives on the Windows desktop, plays with toys and keeps the
// answers you paste into job forms. Two windows: the cat's (transparent, over the whole
// work area, clicks pass through except on the cat and its toys) and the answers panel.
const { app, BrowserWindow, ipcMain, screen, Tray, Menu, clipboard, shell, nativeImage } = require('electron');
const fs = require('fs');
const path = require('path');
const { Store } = require('./store');

const DIR = process.env.DESKTOP_PET_DIR || path.join(app.getPath('appData'), 'DesktopPet');
const ICON = path.join(__dirname, 'assets', 'icon.png');
// Only the cats whose sprites are here: Last tick's two are not in the repo (their terms forbid redistribution).
const SKINS = JSON.parse(fs.readFileSync(path.join(__dirname, 'assets', 'skins', 'skins.json'), 'utf8'))
  .filter((s) => fs.existsSync(path.join(__dirname, 'assets', 'skins', s.id)));
const SIZES = { small: 'Small', medium: 'Medium', large: 'Large' };
const PROGRAMS = path.join(app.getPath('appData'), 'Microsoft', 'Windows', 'Start Menu', 'Programs');
const SHORTCUTS = { menu: path.join(PROGRAMS, 'Desktop Pet.lnk'), startup: path.join(PROGRAMS, 'Startup', 'Desktop Pet.lnk') };
const TESTING = !!process.env.DESKTOP_PET_DIR;   // tests use their own folder and leave Windows alone
const NO_SHORTCUTS = TESTING || !!process.env.PET_NO_SHORTCUTS;

const store = new Store(DIR);
// The cats' window is a strip above the taskbar, as tall as the cat tree needs, and the whole work
// area only while something is up in the air (dragging, the laser). A smaller window is cheaper to redraw.
let height = 440;   // 0 = the whole work area
let settings;
let pet;
let panel;
let tray;

const clamp = (v, a, b) => Math.max(a, Math.min(b, v));

if (process.env.PET_NO_GPU) app.disableHardwareAcceleration();
if (TESTING) app.setPath('userData', path.join(DIR, 'electron'));   // its own single-instance lock
if (!app.requestSingleInstanceLock()) app.quit();
app.on('second-instance', () => showPanel());

function petBounds() {
  const wa = screen.getPrimaryDisplay().workArea;
  const h = height ? Math.min(height, wa.height) : wa.height;
  return { x: wa.x, y: wa.y + wa.height - h, width: wa.width, height: h };
}

function createPet() {
  pet = new BrowserWindow({
    ...petBounds(), transparent: true, frame: false, resizable: false, movable: false, minimizable: false, maximizable: false,
    alwaysOnTop: true, skipTaskbar: true, focusable: false, hasShadow: false, show: false, backgroundColor: '#00000000',
    webPreferences: { preload: path.join(__dirname, 'preload.js'), backgroundThrottling: false },
  });
  pet.setIgnoreMouseEvents(true, { forward: true });
  pet.loadFile(path.join(__dirname, 'pet', 'index.html'));
  pet.once('ready-to-show', () => pet.showInactive());
  pet.on('closed', () => app.quit());
}

function fitPet() {
  if (pet) pet.setBounds(petBounds());
}

function createPanel() {
  panel = new BrowserWindow({
    width: 404, height: 640, frame: false, transparent: true, resizable: false, maximizable: false, minimizable: false,
    alwaysOnTop: true, skipTaskbar: true, show: false, hasShadow: false, backgroundColor: '#00000000',
    // Not focusable: clicking a row copies it while the job form keeps the keyboard, so Ctrl+V goes straight in.
    focusable: false,
    webPreferences: { preload: path.join(__dirname, 'preload.js') },
  });
  panel.loadFile(path.join(__dirname, 'panel', 'index.html'));
  panel.on('closed', () => { panel = null; });
}

function showPanel(at) {
  if (!panel) createPanel();
  const wa = screen.getPrimaryDisplay().workArea;
  const [w, h] = panel.getSize();
  const ax = at?.x ?? wa.x + wa.width - w / 2 - 24;
  const top = at?.top ?? wa.y + wa.height - 120;
  panel.setPosition(
    Math.round(clamp(ax - w / 2, wa.x + 8, wa.x + wa.width - w - 8)),
    Math.round(clamp(top - h + 24, wa.y + 8, wa.y + wa.height - h)),
  );
  panel.webContents.send('shown');
  panel.showInactive();
}

function togglePanel(at) {
  if (panel?.isVisible()) panel.hide(); else showPanel(at);
}

// ---- menu (right-click the cat, or the tray icon) -----------------------------------

const toy = (kind) => pet?.webContents.send('toy', kind);
const command = (cmd) => pet?.webContents.send('command', cmd);

function setSetting(key, value) {
  settings = store.saveSettings({ ...settings, [key]: value });
  pet?.webContents.send('settings', settings);
  if (key === 'startWithWindows') writeShortcuts();
  refreshTray();
}

function showCat() {
  pet.showInactive();
  refreshTray();
}

function hideForAnHour() {
  pet.hide();
  panel?.hide();
  refreshTray();
  setTimeout(showCat, 60 * 60 * 1000);
}

// Either cat or both; the last one cannot be taken away.
function catsMenu() {
  return SKINS.map((s) => {
    const on = settings.cats.includes(s.id);
    return { label: s.name, type: 'checkbox', checked: on, enabled: !(on && settings.cats.length === 1),
      click: () => setSetting('cats', on ? settings.cats.filter((c) => c !== s.id) : [...settings.cats, s.id]) };
  });
}

function menuTemplate() {
  return [
    { label: 'Open answers', click: () => showPanel() },
    { type: 'separator' },
    { label: 'Toys', submenu: [
      { label: 'Yarn ball', click: () => toy('yarn') },
      { label: 'Wind-up mouse', click: () => toy('mouse') },
      { label: 'Laser pointer', click: () => toy('laser') },
      { label: 'Food bowl', click: () => toy('bowl') },
      { type: 'separator' },
      { label: 'Put toys away', click: () => toy('away') },
    ] },
    { label: 'Meow', click: () => command('meow') },
    { label: 'Nap', click: () => command('nap') },
    { label: 'Wake up', click: () => command('wake') },
    { type: 'separator' },
    { label: 'Cats', submenu: catsMenu() },
    { label: 'Cat tree', type: 'checkbox', checked: settings.tree.shown,
      click: (item) => setSetting('tree', { ...settings.tree, shown: item.checked }) },
    { label: 'Put the tree on the floor', visible: settings.tree.shown && settings.tree.lift > 0,
      click: () => setSetting('tree', { ...settings.tree, lift: 0 }) },
    { label: 'Size', submenu: Object.entries(SIZES).map(([k, label]) => ({
      label, type: 'radio', checked: settings.size === k, click: () => setSetting('size', k) })) },
    { type: 'separator' },
    { label: 'Show the cat', visible: !pet?.isVisible(), click: showCat },
    { label: 'Hide for 1 hour', visible: !!pet?.isVisible(), click: hideForAnHour },
    { label: 'Start with Windows', type: 'checkbox', checked: settings.startWithWindows,
      click: (item) => setSetting('startWithWindows', item.checked) },
    { label: 'Quit', click: () => app.quit() },
  ];
}

function refreshTray() {
  tray?.setContextMenu(Menu.buildFromTemplate(menuTemplate()));
}

function createTray() {
  tray = new Tray(nativeImage.createFromPath(ICON).resize({ width: 16, height: 16 }));
  tray.setToolTip(`${settings.name} the cat`);
  tray.on('click', () => togglePanel());
  refreshTray();
}

// Start menu entry always; the Startup one only while "Start with Windows" is on.
function writeShortcuts() {
  if (NO_SHORTCUTS || process.platform !== 'win32') return;
  const link = {
    target: process.execPath, args: `"${app.getAppPath()}"`, cwd: app.getAppPath(),
    icon: path.join(__dirname, 'assets', 'icon.ico'), iconIndex: 0, description: 'A cat that keeps your answers',
  };
  shell.writeShortcutLink(SHORTCUTS.menu, 'replace', link) || shell.writeShortcutLink(SHORTCUTS.menu, 'create', link);
  if (settings.startWithWindows) {
    shell.writeShortcutLink(SHORTCUTS.startup, 'replace', link) || shell.writeShortcutLink(SHORTCUTS.startup, 'create', link);
  } else if (fs.existsSync(SHORTCUTS.startup)) {
    fs.unlinkSync(SHORTCUTS.startup);
  }
}

// ---- messages from the windows --------------------------------------------------------

ipcMain.handle('settings', () => settings);
ipcMain.on('set-interactive', (_e, on) => pet?.setIgnoreMouseEvents(!on, { forward: true }));
ipcMain.on('set-height', (_e, h) => { height = h; fitPet(); });
ipcMain.on('save-tree', (_e, t) => { settings = store.saveSettings({ ...settings, tree: { ...settings.tree, ...t } }); refreshTray(); });
ipcMain.on('clicked', (_e, at) => togglePanel(at));
ipcMain.on('menu', () => Menu.buildFromTemplate(menuTemplate()).popup({ window: pet }));
ipcMain.handle('data', () => ({ fields: store.fields(), notes: store.notes(), settings, dir: DIR }));
ipcMain.handle('save-fields', (_e, doc) => store.saveFields(doc));
ipcMain.handle('save-notes', (_e, doc) => store.saveNotes(doc));
ipcMain.handle('copy', (_e, text) => {
  clipboard.writeText(String(text));
  pet?.webContents.send('react', 'copied');
});
ipcMain.handle('panel-focus', (_e, on) => {
  if (!panel) return;
  panel.setFocusable(on);
  if (on) panel.focus(); else panel.blur();
});
ipcMain.on('panel-hide', () => panel?.hide());

app.whenReady().then(() => {
  settings = store.settings();
  createPet();
  createTray();
  writeShortcuts();
  screen.on('display-metrics-changed', fitPet);
  screen.on('display-added', fitPet);
  screen.on('display-removed', fitPet);
});
