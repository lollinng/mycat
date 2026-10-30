// Drives the real app with synthetic input (the real mouse cursor never moves):
//   node tests/app.e2e.mjs [path to electron.exe]
// It uses its own data folder and puts the clipboard back as it found it.
import { _electron as electron } from 'playwright-core';
import assert from 'node:assert';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const exe = process.argv[2] || path.join(root, 'node_modules', 'electron', 'dist', 'electron.exe');
const shots = process.env.PET_SHOTS;      // folder to save screenshots in, if set
const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'pet-e2e-'));
fs.writeFileSync(path.join(dir, 'settings.json'), JSON.stringify({ cats: ['kitten'], size: 'medium', tree: { shown: false } }));
fs.writeFileSync(path.join(dir, 'fields.json'), JSON.stringify({ groups: [
  { name: 'Contact', fields: [{ label: 'Email', value: 'sam@example.com' }, { label: 'Phone', value: '+91 90000 00000' }] },
  { name: 'Pay & start', fields: [{ label: 'Notice period (days)', compute: { daysUntil: '2999-01-01' } }, { label: 'Expected CTC', value: '20 LPA' }] },
  { name: 'Answers', fields: [{ label: 'Reason for leaving', value: 'A long answer that runs on for more than one line so the row shows two lines of it and copies all of it.' }] },
] }));

const app = await electron.launch({ executablePath: exe, args: [root], env: { ...process.env, DESKTOP_PET_DIR: dir } });
const clipboardBefore = await app.evaluate(({ clipboard }) => clipboard.readText());
const errors = [];
const results = [];
const check = async (name, fn) => {
  try { await fn(); results.push(`ok   ${name}`); } catch (e) { results.push(`FAIL ${name}: ${e.message.split('\n')[0]}`); }
};
// Playwright's waitForFunction evaluates a string, which the pages' security policy refuses.
async function until(page, fn, arg, { timeout = 5000 } = {}) {
  const end = Date.now() + timeout;
  for (;;) {
    if (await page.evaluate(fn, arg)) return;
    if (Date.now() > end) throw new Error(`timed out waiting for ${fn.toString().slice(0, 90)}`);
    await new Promise((r) => setTimeout(r, 60));
  }
}

try {
  const pet = await app.firstWindow();
  pet.on('pageerror', (e) => errors.push(`pet: ${e.message}`));
  pet.on('console', (m) => m.type() === 'error' && errors.push(`pet: ${m.text()}`));
  await until(pet, () => window.__pet?.cats?.length === 1);
  const send = (channel, value) => app.evaluate(({ BrowserWindow }, [c, v]) => BrowserWindow.getAllWindows()
    .find((w) => w.webContents.getURL().includes('/pet/')).webContents.send(c, v), [channel, value]);
  // the middle of the cat's own pixels, in page coordinates
  const catPoint = () => pet.evaluate(() => {
    const c = window.__pet.cat;
    const b = c.sprite.box();
    return { x: c.x + (c.facing * (b.front + b.back)) / 2, y: innerHeight - c.alt + (b.top + b.bottom) / 2 };
  });
  const state = () => pet.evaluate(() => ({ act: window.__pet.act, alt: window.__pet.cat.alt, surface: window.__pet.cat.surface, laser: window.__pet.laser }));
  const settle = async () => {
    await until(pet, () => window.__pet.cat.alt === 0 && !['fall', 'land', 'leap', 'pounce', 'hop', 'jumpto'].includes(window.__pet.act), null, { timeout: 6000 });
    await pet.evaluate(() => { window.__pet.cat.x = innerWidth / 2; window.__pet.sit(); });
    await pet.waitForTimeout(300);
  };

  await check('the cat is drawn and stands on the floor', async () => {
    await settle();
    const s = await state();
    assert.strictEqual(s.alt, 0);
    assert.ok(await pet.evaluate(() => getComputedStyle(window.__pet.cat.el).backgroundImage.includes('kitten')));
  });

  let panel;
  await check('clicking the cat opens the answers panel', async () => {
    await settle();
    const { x, y } = await catPoint();
    const opened = app.waitForEvent('window');
    await pet.mouse.move(x, y);
    await pet.mouse.down();
    await pet.mouse.up();
    panel = await opened;
    panel.on('pageerror', (e) => errors.push(`panel: ${e.message}`));
    await panel.waitForSelector('.row');
  });

  await check('clicking a row copies its value', async () => {
    await panel.locator('.row', { hasText: 'Email' }).click();
    assert.strictEqual(await app.evaluate(({ clipboard }) => clipboard.readText()), 'sam@example.com');
    await panel.waitForSelector('.row.flash');
  });

  await check('a long answer copies whole', async () => {
    await panel.locator('.row', { hasText: 'Reason for leaving' }).click();
    assert.match(await app.evaluate(({ clipboard }) => clipboard.readText()), /copies all of it\.$/);
  });

  await check('search narrows the list and Enter copies the first match', async () => {
    await panel.fill('#q', 'notice');
    assert.strictEqual(await panel.locator('.row').count(), 1);
    await panel.press('#q', 'Enter');
    await panel.waitForTimeout(150);
    assert.match(await app.evaluate(({ clipboard }) => clipboard.readText()), /^\d+$/);
    await panel.fill('#q', '');
  });

  await check('a field can be edited and is saved to disk', async () => {
    await panel.locator('.row', { hasText: 'Expected CTC' }).hover();
    await panel.locator('.row', { hasText: 'Expected CTC' }).locator('.acts button').click();
    await panel.fill('.f-value', '22 LPA');
    await panel.click('.save');
    await panel.waitForSelector('.row:has-text("22 LPA")');
    assert.match(fs.readFileSync(path.join(dir, 'fields.json'), 'utf8'), /22 LPA/);
  });

  await check('a note can be written and copied', async () => {
    await panel.click('.tabs button[data-tab="notes"]');
    await panel.fill('.composer textarea', 'Acme round\nTuesday 11:15 pm');
    await panel.click('.composer .save');
    await panel.waitForSelector('.note h4:has-text("Acme round")');
    await panel.click('.note');
    assert.strictEqual(await app.evaluate(({ clipboard }) => clipboard.readText()), 'Acme round\nTuesday 11:15 pm');
    assert.match(fs.readFileSync(path.join(dir, 'notes.json'), 'utf8'), /Acme round/);
    await panel.click('.tabs button[data-tab="fields"]');
  });

  if (shots && panel) await panel.screenshot({ path: path.join(shots, 'panel.png') });

  await check('a yarn ball drops in and the cat goes to play with it', async () => {
    await send('toy', 'yarn');
    await until(pet, () => window.__pet.toys.some((t) => t.kind === 'yarn'));
    await until(pet, () => window.__pet.act === 'bat', null, { timeout: 15000 });
  });

  await check('the wind-up mouse gets hunted', async () => {
    await send('toy', 'away');
    await send('toy', 'mouse');
    await until(pet, () => ['hunt', 'wiggle', 'pounce', 'pin', 'land'].includes(window.__pet.act), null, { timeout: 8000 });
  });

  await check('the food bowl gets eaten', async () => {
    await send('toy', 'away');
    await send('toy', 'bowl');
    await until(pet, () => window.__pet.act === 'eat', null, { timeout: 8000 });
  });

  await check('the laser takes the mouse and a click ends it', async () => {
    await send('toy', 'away');
    await send('toy', 'laser');
    await until(pet, () => window.__pet.laser && document.body.classList.contains('laser-on'));
    await pet.mouse.move(300, 100);
    await pet.mouse.down();
    await pet.mouse.up();
    await until(pet, () => !window.__pet.laser);
  });

  await check('dragging the cat lifts it and letting go drops it to the floor', async () => {
    await settle();
    const { x, y } = await catPoint();
    await pet.mouse.move(x, y);
    await pet.mouse.down();
    await pet.mouse.move(x + 10, y - 30, { steps: 4 });
    // the window grows to the whole screen once a drag starts: aim from the cat's new place
    await pet.waitForTimeout(200);
    const p = await catPoint();
    await pet.mouse.move(p.x + 20, p.y - 250, { steps: 6 });
    const held = await state();
    assert.strictEqual(held.act, 'held');
    assert.ok(held.alt > 150, `alt ${held.alt}`);
    await pet.mouse.up();
    await until(pet, () => window.__pet.cat.alt === 0 && window.__pet.act !== 'fall', null, { timeout: 5000 });
  });

  await check('stroking the cat back and forth makes it happy', async () => {
    await settle();
    const { x, y } = await catPoint();
    for (let i = 0; i < 6; i++) await pet.mouse.move(x + (i % 2 ? 14 : -14), y, { steps: 4 });
    await until(pet, () => window.__pet.act === 'happy', null, { timeout: 3000 });
  });

  // ---- the cat tree ----
  const treeOn = async (on) => {
    const s = { name: 'Ket', cats: ['kitten'], size: 'medium', startWithWindows: true, tree: { shown: on, x: 0.5, lift: 0 } };
    await send('settings', s);
  };

  await check('with the tree out, the cat climbs to the nest one branch at a time', async () => {
    await treeOn(true);
    await settle();
    await pet.evaluate(() => window.__pet.cat.start('climb', { goal: 'nest' }));
    try {
      await until(pet, () => window.__pet.cat.surface === 'nest', null, { timeout: 20000 });
    } catch (e) {
      throw new Error(`${e.message} ${JSON.stringify(await pet.evaluate(() => ({ s: window.__pet.cat.surface, alt: window.__pet.cat.alt, x: window.__pet.cat.x, act: window.__pet.act, h: window.__pet.cat.history.join('>'), surfaces: window.__pet.tree.surfaces().map((p) => [p.id, Math.round(p.x0), Math.round(p.x1), Math.round(p.alt)]), W: innerWidth })))}`);
    }
    const hops = await pet.evaluate(() => window.__pet.cat.history.filter((h) => h === 'jumpto').length);
    assert.ok(hops >= 2, `${hops} jumps`);
  });

  await check('it naps in a house with only its eyes showing', async () => {
    await pet.evaluate(() => window.__pet.cat.start('enterhouse', { house: 'left' }));
    await until(pet, () => window.__pet.cat.hidden && document.querySelector('.eyes[data-house="left"]').classList.contains('on'), null, { timeout: 8000 });
    await pet.evaluate(() => window.__pet.cat.finish());
    await until(pet, () => !window.__pet.cat.hidden && !document.querySelector('.eyes.on'));
  });

  await check('dragging the tree moves it, carries the cat on it, and saves where it was left', async () => {
    await pet.evaluate(() => window.__pet.cat.start('climb', { goal: 'low-left' }));
    await until(pet, () => window.__pet.cat.surface === 'low-left' && window.__pet.act !== 'jumpto', null, { timeout: 20000 });
    await pet.evaluate(() => window.__pet.cat.start('sit', { dur: 30 }));
    const before = await pet.evaluate(() => ({ x: window.__pet.tree.x, lift: window.__pet.tree.lift, cx: window.__pet.cat.x }));
    const H = await pet.evaluate(() => innerHeight);
    await pet.mouse.move(before.x, H - 40);                 // the trunk, just above the grass
    await pet.mouse.down();
    await pet.mouse.move(before.x + 20, H - 50, { steps: 3 });
    await pet.waitForTimeout(200);
    const H2 = await pet.evaluate(() => innerHeight);       // the window is now the whole screen
    await pet.mouse.move(before.x + 120, H2 - 140, { steps: 6 });
    await pet.mouse.up();
    await pet.waitForTimeout(300);
    const after = await pet.evaluate(() => ({ x: window.__pet.tree.x, lift: window.__pet.tree.lift, cx: window.__pet.cat.x, s: window.__pet.cat.surface }));
    assert.ok(Math.abs(after.x - before.x - 120) < 4, JSON.stringify({ before, after }));
    assert.ok(after.lift > 60, `lift ${after.lift}`);
    assert.ok(Math.abs(after.cx - before.cx - 120) < 4 && after.s === 'low-left', JSON.stringify({ before, after }));
    const saved = JSON.parse(fs.readFileSync(path.join(dir, 'settings.json'), 'utf8')).tree;
    assert.ok(saved.lift === Math.round(after.lift), JSON.stringify(saved));
  });

  await check('putting the tree away brings the cat down', async () => {
    await treeOn(false);
    await until(pet, () => window.__pet.cat.alt === 0 && !window.__pet.cat.surface, null, { timeout: 5000 });
  });
} finally {
  await app.evaluate(({ clipboard }, text) => clipboard.writeText(text), clipboardBefore).catch(() => {});
  await app.close();
  fs.rmSync(dir, { recursive: true, force: true });
}

console.log(results.join('\n'));
if (errors.length) console.log(`page errors:\n${errors.join('\n')}`);
process.exit(results.some((r) => r.startsWith('FAIL')) || errors.length ? 1 : 0);
