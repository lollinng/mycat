// The cats' world: one transparent window over the bottom of the screen. It lets clicks through
// everywhere except on the cats and their toys (the main process flips that as the mouse moves).
import { SpriteCat } from './sprite.js';
import { Toy, Laser, GRAVITY } from './toys.js';
import { Tree } from './tree.js';

const api = window.pet;
const catLayer = document.getElementById('cats');
const toyLayer = document.getElementById('toys');
const fxLayer = document.getElementById('fx');

let settings = await api.settings();
let W = innerWidth;
let H = innerHeight;

const rand = (a, b) => a + Math.random() * (b - a);
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const pick = (weights) => {
  let r = Math.random() * Object.values(weights).reduce((a, b) => a + b, 0);
  for (const [k, w] of Object.entries(weights)) if ((r -= w) <= 0) return k;
  return Object.keys(weights)[0];
};

// The window is a strip above the taskbar, as tall as the cat tree when it is out, and the
// whole screen only while something is up in the air (dragging, the laser, a big jump).
const STRIP = 440;
let winHeight = STRIP;   // 0 = the whole screen
let lowSince = 0;
function setHeight(h) { if (h !== winHeight) { winHeight = h; api.setHeight(h); } }
function goFull() { lowSince = clock; setHeight(0); }

const toys = [];
let laser = null;
let clock = 0;
const mouse = { x: W / 2, y: H / 2 };
let drag = null;
const toyById = (id) => toys.find((t) => t.id === id);
const toyOf = (kind) => toys.find((t) => t.kind === kind);

const tree = new Tree(document.getElementById('trees'));
const treeOn = () => !!settings.tree?.shown;
function applyTree() {
  const was = tree.s && { left: tree.left, s: tree.s, lift: tree.lift };
  tree.setSize(settings.tree?.size);
  tree.el.style.display = treeOn() ? '' : 'none';
  tree.x = clamp((settings.tree?.x ?? 0.82) * W, tree.width / 2, W - tree.width / 2);
  tree.lift = settings.tree?.lift ?? 0;
  tree.place(H);
  if (!was) return;
  // a new size or place: the cats and toys up on the tree keep their spot on it, not on the screen
  const across = (x) => tree.left + ((x - was.left) / was.s) * tree.s;
  for (const c of cats) if (c.surface || c.hidden) c.x = across(c.x);   // their height follows the branch
  for (const t of toys) if (t.on) { t.x = across(t.x); t.alt = tree.lift + ((t.alt - was.lift) / was.s) * tree.s; }
}
applyTree();
const jumpReach = () => 80 * tree.s;   // the highest a cat jumps from one place on the tree to the next

// ---- effects ------------------------------------------------------------------------

const HEART = `<svg viewBox="0 0 24 22"><path d="M12 21C5 15 1 11 1 6.5 1 3.4 3.5 1 6.5 1c2.3 0 4.3 1.3 5.5 3.2C13.2 2.3 15.2 1 17.5 1 20.5 1 23 3.4 23 6.5 23 11 19 15 12 21z" fill="#ff6b8b" stroke="#c43c5c" stroke-width="1.5"/></svg>`;

function spawn(cls, html, x, y, life = 1600) {
  const el = document.createElement('div');
  el.className = `fx ${cls}`;
  el.innerHTML = html;
  el.style.left = `${x}px`;
  el.style.top = `${y}px`;
  fxLayer.append(el);
  setTimeout(() => el.remove(), life);
  return el;
}
function say(text, at, life = 1600) {
  for (const b of fxLayer.querySelectorAll('.bubble')) if (b.dataset.at === at.key) b.remove();
  const el = spawn('bubble', text, clamp(at.x, 80, W - 80), at.y - 34, life);
  el.dataset.at = at.key;
}

// ---- what a cat can do -----------------------------------------------------------------
// anim: the animations to play, best first (a cat without the first falls back to the next).

const AIRBORNE = ['held', 'fall', 'pounce', 'leap', 'hop', 'jumpto', 'inhouse'];
const GAIT = { walk: ['walk'], creep: ['walk'], run: ['run', 'walk'] };

const ACTS = {
  idle: { anim: ['idle'], dur: [3, 7], update: (c, a, dt) => c.lookAround(a, dt) },
  sit: { anim: ['sit', 'idle2', 'idle'], dur: [4, 9] },
  watch: { anim: ['idle', 'sit'], dur: [3, 7], update: (c) => c.faceTowards(mouse.x) },
  walk: {
    anim: ['idle'],
    enter: (c, a) => { const [lo, hi] = c.range(); a.target ??= rand(lo, hi); },
    update: (c, a, dt) => { if (c.moveToward(a.target, 'walk', dt)) a.dur = 0; },
  },
  zoomies: {
    anim: ['run'],
    enter: (c, a) => { a.legs = 3; a.target = c.x < W / 2 ? W - c.margin : c.margin; },
    update: (c, a, dt) => {
      if (c.moveToward(a.target, 'run', dt)) {
        if (--a.legs <= 0) a.dur = 0; else a.target = c.x < W / 2 ? W - c.margin : c.margin;
      }
    },
  },
  groom: { anim: ['lick', 'lick2', 'idle'], dur: [3, 5.5] },
  groom2: { anim: ['lick2', 'lick', 'idle'], dur: [3, 5] },
  itch: { anim: ['itch', 'lick', 'idle'], dur: [1.4, 2.4] },
  stretch: { anim: ['stretch', 'idle'], dur: [1.6, 1.6], next: 'idle',
    enter: (c, a) => { a.dur = Math.max(1, c.sprite.length(['stretch', 'idle']) + 0.3); } },
  yawn: { anim: ['yawn', 'meow', 'idle'], dur: [1.4, 1.4], next: 'idle',
    enter: (c, a) => { a.dur = Math.max(1, c.sprite.length(['yawn', 'meow'])); } },
  meow: { anim: ['meow', 'idle'], dur: [1.3, 1.3], next: 'idle',
    enter: (c) => { c.faceTowards(mouse.x); setTimeout(() => say(Math.random() < 0.5 ? 'Meow!' : 'Mrrp?', c.head()), 150); } },
  loaf: { anim: ['lie', 'liedown', 'sleep'], dur: [6, 12],
    exit: (c, a) => { if (Math.random() < 0.5) a.next = 'sleep'; } },
  sleep: { anim: ['sleep', 'sleep2', 'liedown'], dur: [20, 50], next: 'stretch',
    enter: (c) => { c.awake = 0; c.zzz = 0; },
    update: (c, a, dt) => {
      c.zzz -= dt;
      if (c.zzz <= 0) { c.zzz = 1.4; const h = c.head(); spawn('zzz', 'z', h.x + c.facing * 10, h.y - 6, 2400); }
    } },
  happy: { anim: ['roll', 'happy', 'meow', 'idle'], dur: [2.4, 3.2],
    enter: (c) => { c.hearts(3); if (Math.random() < 0.5) setTimeout(() => say('purr~', c.head(), 1300), 300); } },
  hop: { anim: ['jump', 'idle'],
    enter: (c) => { c.vy = c.vy0 = 380; c.vx = 0; c.surface = null; c.hearts(1); },
    update: (c, a, dt) => { if (c.fall(dt)) c.start('land'); } },
  held: { anim: ['scared', 'jump', 'idle'],
    update: (c) => { c.extra = ` rotate(${-6 + 4 * Math.sin(clock * 3)}deg)`; c.progress = 0.35; } },
  fall: { anim: ['jump', 'scared', 'idle'], update: (c, a, dt) => { if (c.fall(dt)) c.start('land'); } },
  land: { anim: ['land', 'crouch', 'idle'], dur: [0.3, 0.3], next: 'idle',
    enter: (c) => { if (Math.random() < 0.3) setTimeout(() => say('hmph', c.head(), 1100), 150); } },

  // ---- play ----
  chase: { anim: ['idle'],
    update: (c, a, dt) => {
      const toy = toyById(a.toy);
      if (!toy) { a.dur = 0; return; }
      a.played = (a.played ?? 0) + dt;
      if (toy.alt > toy.groundAlt + 4 || toy.vy !== 0) { c.faceTowards(toy.x); return; }   // still flying
      if (c.reach(toy.on, 'chase', { toy: toy.id, played: a.played, bats: a.bats })) return;   // up the tree or down after it
      const reach = c.sprite.box().front + toy.r;
      const dx = toy.x - c.x;
      if (Math.abs(dx) > reach + 8 || Math.sign(dx) !== c.facing) c.moveToward(toy.x - Math.sign(dx) * reach, Math.abs(dx) > 260 ? 'run' : 'walk', dt);
      else if (Math.abs(toy.vx) < 260) c.start('bat', { toy: toy.id, played: a.played, bats: a.bats ?? 0 });
    } },
  bat: { anim: ['paw', 'crouch', 'idle'], dur: [0.45, 0.45],
    update: (c, a) => {
      const toy = toyById(a.toy);
      c.extra = ` translateX(${6 * Math.sin(Math.min(1, a.t / 0.3) * Math.PI)}px)`;
      if (!a.hit && a.t > 0.18 && toy) {
        a.hit = true;
        if (Math.abs(toy.x - c.x) < c.sprite.box().front + toy.r + 30) { toy.vx = c.facing * rand(330, 640); toy.vy = rand(220, 520); toy.alt += 1; }
      }
    },
    exit: (c, a) => {
      const bats = (a.bats ?? 0) + 1;
      if (bats >= 4 + Math.floor(Math.random() * 6) || (a.played ?? 0) > 35) {
        c.boredUntil = clock + rand(20, 40);
        a.next = pick({ groom: 1, idle: 1 });
      } else c.start('chase', { toy: a.toy, played: (a.played ?? 0) + 0.45, bats });
    } },
  hunt: { anim: ['idle'],
    update: (c, a, dt) => {
      const m = toyById(a.toy);
      if (!m) { a.dur = 0; return; }
      a.played = (a.played ?? 0) + dt;
      if ((m.on ?? null) !== (c.surface ?? null)) { c.faceTowards(m.x); return; }   // on another level: watch it
      const dx = m.x - c.x;
      if (Math.abs(dx) > 300) c.moveToward(m.x - Math.sign(dx) * 200, 'walk', dt);
      else if (Math.abs(dx) > 150) c.moveToward(m.x - Math.sign(dx) * 130, 'creep', dt);
      else { c.faceTowards(m.x); c.start('wiggle', { toy: a.toy, played: a.played, catches: a.catches }); }
    } },
  wiggle: { anim: ['crouch', 'idle'], dur: [0.8, 1.5],
    update: (c, a) => { const m = toyById(a.toy); if (m) c.faceTowards(m.x); c.extra = ` translateX(${2 * Math.sin(a.t * 24)}px)`; },
    exit: (c, a) => {
      const m = toyById(a.toy);
      if (m) c.start('pounce', { toy: a.toy, played: a.played, catches: a.catches, aim: m.x + m.vx * 0.35 });
      else a.next = 'idle';
    } },
  pounce: { anim: ['jump', 'run', 'idle'],
    enter: (c, a) => {
      const tAir = 0.5;
      c.vy = c.vy0 = (GRAVITY * tAir) / 2; c.vx = (a.aim - c.x) / tAir; c.facing = Math.sign(c.vx) || c.facing; c.surface = null;
    },
    update: (c, a, dt) => {
      if (!c.fall(dt)) return;
      const m = toyById(a.toy);
      const caught = m && Math.abs(m.x - (c.x + c.facing * c.sprite.box().front * 0.6)) < 55;
      if (caught) {
        m.stunned = 1.3; m.vx = 0;
        say('squeak!', { x: m.x, y: m.bottom - 10, key: `toy${m.id}` }, 1100);
        c.start('pin', { toy: a.toy, played: a.played, catches: (a.catches ?? 0) + 1 });
      } else c.start('land', { next: m ? 'hunt' : 'idle', carry: { toy: a.toy, played: a.played, catches: a.catches } });
    } },
  pin: { anim: ['paw', 'crouch', 'idle'], dur: [1.2, 1.2],
    exit: (c, a) => {
      if ((a.catches ?? 0) >= 3 || (a.played ?? 0) > 45) { c.boredUntil = clock + rand(25, 45); c.start('happy'); }
      else c.start('hunt', { toy: a.toy, played: a.played, catches: a.catches });
    } },
  eat: { anim: ['eat', 'lick', 'idle'],
    update: (c, a, dt) => {
      const bowl = toyById(a.toy);
      if (!bowl) { a.dur = 0; return; }
      if (!a.eating && c.reach(bowl.on, 'eat', { toy: bowl.id })) return;
      const spot = c.sprite.box().front + 18;
      const side = Math.sign(c.x - bowl.x) || 1;
      if (!a.eating && Math.abs(c.x - (bowl.x + side * spot)) > 6) { c.moveToward(bowl.x + side * spot, 'walk', dt); return; }
      a.eating = true;
      c.faceTowards(bowl.x);
      bowl.food = Math.max(0, bowl.food - dt / 6);
      if (bowl.food <= 0) { bowl.emptyAt = clock; c.start('happy', { next: 'groom' }); }
    } },
  laser: { anim: ['crouch', 'idle'],
    update: (c, a, dt) => {
      if (!laser) { a.dur = 0; return; }
      const above = H - laser.y;
      const dx = laser.x - c.x;
      a.cool = (a.cool ?? 0) - dt;
      if (above < 130 && Math.abs(dx) > 40) c.moveToward(laser.x - Math.sign(dx) * 25, Math.abs(dx) > 220 ? 'run' : 'walk', dt);
      else if (above < 360 && Math.abs(dx) < 140 && a.cool <= 0) {
        a.cool = 1.1;
        c.vy = c.vy0 = Math.sqrt(2 * GRAVITY * Math.max(40, above - c.sprite.height / 2));
        c.vx = dx / ((c.vy / GRAVITY) * 1.6);
        c.facing = Math.sign(dx) || c.facing;
        c.start('leap');
      } else c.faceTowards(laser.x);
    } },
  // a jump leaves the branch it started from: fall() puts it back on whatever it comes down on
  leap: { anim: ['jump', 'run', 'idle'],
    enter: (c) => { c.surface = null; },
    update: (c, a, dt) => { if (c.fall(dt)) c.start('land', { next: laser ? 'laser' : 'idle' }); } },

  // ---- the cat tree ----
  // climb: hop up the tree, one branch or roof at a time, until reaching a.goal
  // (a.then: what to do on arriving, with a.thenCarry)
  climb: { anim: ['idle'],
    update: (c, a, dt) => {
      const goal = treeOn() && tree.surface(a.goal);
      if (!goal) { a.dur = 0; return; }
      const onward = { goal: a.goal, then: a.then, thenCarry: a.thenCarry };
      if (c.surface === a.goal) return c.start(a.then || 'sit', a.thenCarry || {});
      const here = c.groundAlt();
      if (goal.alt < here - 5) return c.start('godown', { next: 'climb', carry: onward });   // it is lower down: down first
      const hops = tree.surfaces().filter((p) => p.alt > here + 5 && p.alt - here <= jumpReach() && p.alt <= goal.alt + 1);
      if (!hops.length) { c.boredUntil = clock + 20; a.dur = 0; return; }
      const hop = hops.sort((p, q) => q.alt - p.alt)[0];
      if (!c.moveToward(clamp(c.x, hop.x0 - 60, hop.x1 + 60), 'walk', dt)) return;
      const last = hop.id === a.goal;
      c.start('jumpto', { x: clamp(c.x, hop.x0 + 12, hop.x1 - 12), alt: hop.alt,
        next: last ? a.then || 'sit' : 'climb', carry: last ? a.thenCarry : onward });
    } },
  // jumpto: one jump to a.x at height a.alt (a branch, a roof, the floor, or a house door)
  jumpto: { anim: ['jump', 'run', 'idle'],
    enter: (c, a) => {
      const apex = Math.max(c.alt, a.alt) + 30 + Math.abs(a.alt - c.alt) * 0.12;
      const up = Math.sqrt(2 * GRAVITY * Math.max(1, apex - c.alt));
      const down = Math.sqrt((2 * Math.max(1, apex - a.alt)) / GRAVITY);
      c.vy = c.vy0 = up;
      c.vx = (a.x - c.x) / (up / GRAVITY + down);
      c.facing = Math.sign(c.vx) || c.facing;
      c.surface = null;
      c.alt += 1;
    },
    update: (c, a, dt) => {
      if (a.house && c.vy < 0 && c.alt <= a.alt + 4) return c.start('inhouse', { house: a.house });
      if (c.fall(dt)) c.start('land', { next: a.next ?? 'idle', carry: a.carry });
    } },
  godown: { anim: ['idle'],
    enter: (c, a) => {
      const p = treeOn() && tree.surface(c.surface);
      const out = p ? (c.x > (p.x0 + p.x1) / 2 ? p.x1 + 70 : p.x0 - 70) : c.x + c.facing * 60;
      c.start('jumpto', { x: clamp(out, c.margin, W - c.margin), alt: 0, next: a.next, carry: a.carry });
    } },
  enterhouse: { anim: ['idle'],
    enter: (c, a) => {
      const h = tree.houses().find((x) => x.id === a.house);
      if (!h || h.busy) return c.start('sit');
      c.start('jumpto', { x: h.x, alt: h.alt, house: a.house });
    } },
  // inside a house: only its eyes show in the doorway
  inhouse: { anim: ['sleep', 'idle'], dur: [15, 45],
    enter: (c, a) => { c.hidden = true; c.vx = c.vy = 0; c.awake = 0; c.zzz = 2; tree.setOccupied(a.house, c); },
    update: (c, a, dt) => {
      const h = treeOn() && tree.houses().find((x) => x.id === a.house);
      if (!h) { a.dur = 0; return; }
      c.x = h.x; c.alt = h.alt;
      c.zzz -= dt;
      if (c.zzz <= 0) { c.zzz = 2.2; spawn('zzz', 'z', h.x + 10, H - h.alt - 30, 2400); }
    },
    exit: (c, a) => { c.hidden = false; tree.setOccupied(a.house, null); c.surface = null; a.next = 'godown'; } },
  // bat the toy hanging over the right roof
  swat: { anim: ['paw', 'crouch', 'idle'], dur: [0.6, 0.6],
    enter: (c) => c.faceTowards(tree.toyPoint().x),
    update: (c, a) => { if (!a.hit && a.t > 0.25) { a.hit = true; tree.swat(c.facing); } },
    exit: (c, a) => { if (Math.random() < 0.6) a.next = 'swat'; } },
};

class Cat {
  constructor(skinId, x) {
    this.skinId = skinId;
    this.el = document.createElement('div');
    this.el.className = 'cat';
    catLayer.append(this.el);
    this.sprite = new SpriteCat(this.el);
    this.sprite.set(skinId, settings.size);
    Object.assign(this, { x, alt: 0, vx: 0, vy: 0, vy0: 1, facing: Math.random() < 0.5 ? -1 : 1, awake: 0, boredUntil: 0, hunting: false });
    this.surface = null;     // the branch, roof or nest it stands on; null = the floor
    this.hidden = false;     // inside a house
    this.history = [];
    this.strokes = { dir: 0, lastX: null, flips: [] };
    this.start('idle');
  }

  get margin() { return this.sprite.halfWidth + 6; }

  // the height it stands at, and how far it can walk without stepping off
  groundAlt() {
    if (this.surface) {
      const p = treeOn() && tree.surface(this.surface);
      if (p) return p.alt;
      this.surface = null;
    }
    return 0;
  }
  range() {
    const p = this.surface && treeOn() && tree.surface(this.surface);
    return p ? [p.x0 + 8, p.x1 - 8] : [this.margin, W - this.margin];
  }

  start(name, opts = {}) {
    const def = ACTS[name];
    this.history.push(name);
    if (this.history.length > 12) this.history.shift();
    this.act = { name, t: 0, next: def.next, ...opts };
    this.act.dur = opts.dur ?? (def.dur ? rand(...def.dur) : Infinity);
    this.sprite.play(def.anim, true);
    def.enter?.(this, this.act);
  }

  finish() {
    const cur = this.act;
    ACTS[cur.name].exit?.(this, cur);
    if (this.act !== cur) return;                   // exit already started something else
    if (cur.next) this.start(cur.next, cur.carry || {}); else this.chooseNext();
  }

  chooseNext() {
    // toys are on the floor: come down from the tree first
    const go = (name, carry = {}) => (this.surface ? this.start('godown', { next: name, carry }) : this.start(name, carry));
    if (laser) return go('laser');
    const bowl = toys.find((t) => t.kind === 'bowl' && t.food > 0);
    if (bowl) return go('eat', { toy: bowl.id });
    const fresh = (t) => t && clock - t.addedAt < 20;   // a toy you just gave it always gets played with
    const m = toyOf('mouse');
    if (m && (fresh(m) || (clock > this.boredUntil && Math.random() < 0.8))) return go('hunt', { toy: m.id });
    const y = toyOf('yarn');
    if (y && (fresh(y) || (clock > this.boredUntil && Math.random() < 0.7))) return go('chase', { toy: y.id });
    const sleepy = Math.min(14, 2 + this.awake / 50);
    if (treeOn() && this.surface) return this.onTree(sleepy);
    if (treeOn() && Math.random() < 0.4) return this.start('climb', { goal: this.pickPlace() });
    this.start(pick({ idle: 18, sit: 12, walk: 26, watch: 8, groom: 9, groom2: 4, itch: 2, loaf: 7, sleep: sleepy, stretch: 5, yawn: 3, meow: 3, zoomies: 2 }));
  }

  // somewhere on the tree to go: the nest and the roofs are favourites
  pickPlace() {
    const taken = new Set(cats.filter((c) => c !== this && c.surface).map((c) => c.surface));
    const places = { nest: 5, 'right-roof': 4, 'left-roof': 4, 'high-right': 3, 'low-left': 2 };
    for (const id of taken) places[id] *= 0.2;
    delete places[this.surface];
    return pick(places);
  }

  // up on the tree it lounges, naps, visits a house, bats the toy, moves up or comes down
  onTree(sleepy) {
    const here = tree.surface(this.surface);
    const house = tree.houses().find((h) => !h.busy && Math.abs(h.alt - this.alt) < jumpReach()
      && !(h.alt < here.alt && h.x >= here.x0 && h.x <= here.x1));   // not the door under its own feet
    const nearToy = this.surface === 'right-roof';
    const next = pick({ sit: 18, idle: 10, groom: 10, groom2: 4, loaf: 12, sleep: sleepy * 1.5, watch: 6, yawn: 3, meow: 2,
      stretch: 3, itch: 2, walk: 5, climb: 9, godown: 6, enterhouse: house ? 7 : 0, swat: nearToy ? 10 : 0 });
    if (next === 'climb') return this.start('climb', { goal: this.pickPlace() });
    if (next === 'enterhouse') return this.start('enterhouse', { house: house.id });
    this.start(next);
  }

  moveToward(tx, gait, dt) {
    const [lo, hi] = this.range();
    tx = clamp(tx, lo, hi);
    const dx = tx - this.x;
    if (Math.abs(dx) < 3) return true;
    this.facing = Math.sign(dx);
    const speed = this.sprite.speed(gait === 'creep' ? 'walk' : gait) * (gait === 'creep' ? 0.55 : 1);
    this.x += this.facing * Math.min(Math.abs(dx), speed * dt);
    this.gait = gait;
    return false;
  }

  faceTowards(x) { if (Math.abs(x - this.x) > 30) this.facing = Math.sign(x - this.x); }

  // Get to the floor (level null) or a place on the tree, then do `then`. False when already there.
  reach(level, then, carry) {
    if ((level ?? null) === (this.surface ?? null)) return false;
    if (level && !(treeOn() && tree.surface(level))) return false;
    if (!level) this.start('godown', { next: then, carry });
    else this.start('climb', { goal: level, then, thenCarry: carry });
    return true;
  }

  lookAround(a, dt) {
    a.nextLook = (a.nextLook ?? rand(2, 5)) - dt;
    if (a.nextLook <= 0) { if (Math.random() < 0.3) this.facing = -this.facing; a.nextLook = rand(2.5, 6); }
  }

  // gravity; true once it lands, on the floor or on anything of the tree it comes down onto
  fall(dt) {
    const before = this.alt;
    this.vy -= GRAVITY * dt;
    this.alt += this.vy * dt;
    this.x += this.vx * dt;
    if (this.x < this.margin) { this.x = this.margin; this.vx = Math.abs(this.vx) * 0.4; }
    if (this.x > W - this.margin) { this.x = W - this.margin; this.vx = -Math.abs(this.vx) * 0.4; }
    this.progress = clamp(0.5 - this.vy / (2 * Math.max(1, this.vy0)), 0, 1);
    if (this.vy <= 0 && treeOn()) {
      const under = tree.surfaces().filter((p) => before >= p.alt - 1 && this.alt <= p.alt && this.x >= p.x0 && this.x <= p.x1);
      if (under.length) {
        const p = under.sort((a, b) => b.alt - a.alt)[0];
        Object.assign(this, { alt: p.alt, surface: p.id, vy: 0, vx: 0 });
        return true;
      }
    }
    if (this.alt <= 0) { Object.assign(this, { alt: 0, surface: null, vy: 0, vx: 0 }); return true; }
    return false;
  }

  // the top of the cat, near its face: where bubbles, hearts and z's start
  head() {
    const b = this.sprite.box();
    return { x: this.x + this.facing * b.front * 0.55, y: H - this.alt + b.top, key: this.skinId };
  }

  hearts(n) {
    const h = this.head();
    for (let i = 0; i < n; i++) setTimeout(() => spawn('heart', HEART, h.x + rand(-22, 22), h.y - 10), i * 220);
  }

  hit(x, y) {
    if (this.hidden) return false;
    const b = this.sprite.box();
    const lx = (x - this.x) * this.facing;
    const ly = y - (H - this.alt);
    return lx >= b.back - 4 && lx <= b.front + 4 && ly >= b.top - 6 && ly <= b.bottom + 2;
  }

  petting(x) {
    if (AIRBORNE.includes(this.act.name) || ['happy', 'sleep'].includes(this.act.name)) return;
    const s = this.strokes;
    if (s.lastX !== null) {
      const d = Math.sign(x - s.lastX);
      if (d && Math.abs(x - s.lastX) > 2 && d !== s.dir) {
        s.dir = d;
        s.flips = s.flips.filter((t) => clock - t < 1.6).concat(clock);
        if (s.flips.length >= 4) { s.flips = []; this.start('happy'); }
      }
    }
    s.lastX = x;
  }

  update(dt) {
    this.gait = null;
    this.extra = '';
    this.progress = null;
    this.awake += dt;
    if (this.surface && !AIRBORNE.includes(this.act.name)) this.alt = this.groundAlt();   // the tree may have moved
    ACTS[this.act.name].update?.(this, this.act, dt);
    this.act.t += dt;
    if (this.act.t >= this.act.dur) this.finish();
    if (this.alt > this.groundAlt() + 0.5 && !AIRBORNE.includes(this.act.name)) this.start('fall');   // interrupted mid-air
    this.hunting = this.gait === 'run';
    this.el.style.display = this.hidden ? 'none' : '';
    this.sprite.play(this.gait ? GAIT[this.gait] : ACTS[this.act.name].anim);
    this.sprite.update(dt, this.gait === 'creep' ? 0.6 : 1, this.progress);
    this.sprite.place(this.x, H - this.alt, this.facing, this.extra);
  }

  remove() {
    if (this.act?.name === 'inhouse') tree.setOccupied(this.act.house, null);
    this.el.remove();
  }
}

// ---- the cats on screen ------------------------------------------------------------------

let cats = [];
function syncCats() {
  const want = settings.cats;
  for (const c of cats.filter((c) => !want.includes(c.skinId))) c.remove();
  cats = cats.filter((c) => want.includes(c.skinId));
  want.forEach((id, i) => {
    const c = cats.find((x) => x.skinId === id);
    if (c) c.sprite.set(id, settings.size);
    else cats.push(new Cat(id, clamp((W * (0.5 + 0.2 * i)) % W, 150, W - 150)));
  });
}
syncCats();

// ---- toys ---------------------------------------------------------------------------

function addToy(kind) {
  if (kind === 'laser') return startLaser();
  if (kind === 'away') { for (const t of toys.splice(0)) t.remove(); stopLaser(); return; }
  const old = toyOf(kind);
  if (old) { old.remove(); toys.splice(toys.indexOf(old), 1); }
  const near = cats[0];
  const x = clamp(near.x + near.facing * 190, 60, W - 60);
  const toy = new Toy(kind, toyLayer, x, H);
  toy.addedAt = clock;
  if (kind === 'yarn') { toy.alt = 260; toy.vx = near.facing * 60; }
  toys.push(toy);
  for (const c of cats) c.boredUntil = 0;
  if (kind === 'bowl') say('Food!', near.head(), 1200);
  setTimeout(() => { for (const c of cats) if (!AIRBORNE.includes(c.act.name)) c.chooseNext(); }, 400);
}

function startLaser() {
  if (laser) return;
  laser = new Laser(fxLayer);
  laser.move(mouse.x, mouse.y);
  document.body.classList.add('laser-on');
  goFull();
  setInteractive(true);
  say('Click anywhere to stop the laser', { x: W / 2, y: H - 40, key: 'laser' }, 2600);
  for (const c of cats) if (!AIRBORNE.includes(c.act.name)) c.start('laser');
}
function stopLaser() {
  if (!laser) return;
  laser.remove();
  laser = null;
  document.body.classList.remove('laser-on');
  setInteractive(false);
}

// ---- mouse --------------------------------------------------------------------------

let interactive = false;
function setInteractive(on) { if (on !== interactive) { interactive = on; api.setInteractive(on); } }

// What is under the pointer: a toy, a cat (roughly its own pixels), the tree's toy, the tree, or nothing.
function hit(x, y) {
  const toyEl = document.elementFromPoint(x, y)?.closest('[data-hit="toy"]');
  if (toyEl) return { kind: 'toy', thing: toyById(+toyEl.dataset.id) };
  for (let i = cats.length - 1; i >= 0; i--) if (cats[i].hit(x, y)) return { kind: 'cat', thing: cats[i] };
  if (treeOn() && tree.hitToy(x, y)) return { kind: 'treetoy', thing: tree };
  if (treeOn() && tree.hit(x, y, H)) return { kind: 'tree', thing: tree };
  return null;
}

// Take the clicks only while the pointer is on something of ours.
function hover(x, y) {
  const h = hit(x, y);
  setInteractive(!!h);
  document.body.classList.toggle('over-cat', !!h && h.kind !== 'toy');
  return h;
}

addEventListener('mousemove', (e) => {
  mouse.x = e.clientX; mouse.y = e.clientY;
  if (laser) { laser.move(e.clientX, e.clientY); return; }
  if (drag) return dragMove(e);
  const h = hover(e.clientX, e.clientY);
  for (const c of cats) if (h?.thing === c) c.petting(e.clientX); else c.strokes.lastX = null;
});

// Linux: the page hears nothing while clicks go through, so the main process says where the pointer is.
api.on('pointer', ({ x, y }) => {
  if (drag || laser) return;
  mouse.x = x; mouse.y = y;
  hover(x, y);
});

addEventListener('mousedown', (e) => {
  if (laser) { stopLaser(); for (const c of cats) if (!AIRBORNE.includes(c.act.name)) c.start('idle'); return; }
  if (e.button !== 0) return;
  const h = hit(e.clientX, e.clientY);
  if (!h?.thing) return;
  if (h.kind === 'treetoy') { tree.swat(Math.random() < 0.5 ? -1 : 1); return; }
  const t = h.thing;
  const alt = h.kind === 'tree' ? t.lift : t.alt;
  drag = { ...h, sx: e.clientX, sy: e.clientY, ox: e.clientX - t.x, oy: e.clientY - (H - alt), moved: false, hist: [] };
});

// Moving the tree carries the cats on it (and in its houses) along.
function moveTree(e) {
  const dx = clamp(e.clientX - drag.ox, tree.width / 2, W - tree.width / 2) - tree.x;
  const fullHeight = screen.availHeight;
  const lift = clamp(H - (e.clientY - drag.oy), 0, Math.max(0, fullHeight - tree.height - 120));
  const dl = lift - tree.lift;
  for (const c of cats) if (c.surface || c.hidden) { c.x += dx; c.alt += dl; }
  for (const t of toys) if (t.on) { t.x += dx; t.alt += dl; }
  tree.x += dx;
  tree.lift = lift;
  tree.place(H);
}

function dragMove(e) {
  if (!drag.moved && Math.hypot(e.clientX - drag.sx, e.clientY - drag.sy) < 6) return;
  if (!drag.moved) {
    drag.moved = true;
    goFull();
    if (drag.kind === 'cat') { drag.thing.surface = null; drag.thing.start('held'); }
    else if (drag.kind === 'toy') drag.thing.held = true;
  }
  if (drag.kind === 'tree') return moveTree(e);
  const t = drag.thing;
  t.x = clamp(e.clientX - drag.ox, 30, W - 30);
  t.alt = clamp(H - (e.clientY - drag.oy), 0, H - 40);
  drag.hist.push({ x: e.clientX, y: e.clientY, t: performance.now() });
  if (drag.hist.length > 6) drag.hist.shift();
}

addEventListener('mouseup', (e) => {
  if (!drag) return;
  const d = drag;
  drag = null;
  if (d.kind === 'tree') {
    if (d.moved) api.saveTree({ x: tree.x / W, lift: Math.round(tree.lift) });
    return;
  }
  if (!d.moved) {
    if (d.kind === 'cat') {
      const c = d.thing;
      api.clicked({ x: window.screenX + c.x, top: window.screenY + H - c.alt + c.sprite.box().top });
      if (['sleep', 'loaf'].includes(c.act.name)) c.start('stretch');
      else if (!AIRBORNE.includes(c.act.name)) { c.faceTowards(mouse.x); c.start('watch', { dur: 2.5 }); }
    }
    return;
  }
  const [a, b] = [d.hist[0], d.hist[d.hist.length - 1]];
  const dt = a && b ? Math.max(16, b.t - a.t) / 1000 : 1;
  const vx = a && b ? clamp((b.x - a.x) / dt, -1800, 1800) : 0;
  const vy = a && b ? clamp(-(b.y - a.y) / dt, -1800, 1800) : 0;
  if (d.kind === 'cat') { const c = d.thing; c.vx = vx * 0.7; c.vy = vy * 0.7; c.vy0 = Math.max(300, Math.abs(c.vy)); c.start('fall'); }
  else { d.thing.held = false; d.thing.throwFrom(vx, vy); for (const c of cats) c.boredUntil = 0; }
  if (!hit(e.clientX, e.clientY)) setInteractive(false);
});

addEventListener('contextmenu', (e) => {
  e.preventDefault();
  const h = hit(e.clientX, e.clientY);
  if (h?.kind === 'cat' || h?.kind === 'tree') api.menu();
  else if (h?.kind === 'toy' && h.thing) {
    h.thing.remove();
    toys.splice(toys.indexOf(h.thing), 1);
    setInteractive(false);
  }
});

// ---- messages from the main process ---------------------------------------------------

api.on('toy', addToy);
api.on('react', (what) => {
  if (what !== 'copied') return;
  const c = cats.find((x) => ['idle', 'sit', 'watch', 'walk', 'groom', 'groom2'].includes(x.act.name));
  c?.start('hop');
});
// Nap, Wake up and Meow from the menu: a cat in mid-air lands first and carries on
api.on('command', (cmd) => {
  const down = cats.filter((c) => !AIRBORNE.includes(c.act.name));
  for (const c of down) {
    if (cmd === 'nap') c.start('sleep');
    if (cmd === 'wake') c.start('stretch');
  }
  if (cmd === 'meow' && down.length) down[Math.floor(Math.random() * down.length)].start('meow');
});
api.on('settings', (s) => { settings = s; syncCats(); applyTree(); });

addEventListener('resize', () => {
  W = innerWidth; H = innerHeight;
  for (const t of toys) { t.floorY = H; t.render(); }
  for (const c of cats) c.sprite.place(c.x, H - c.alt, c.facing);   // no frame drawn with the old height
  tree.place(H);
});

// ---- frame loop ---------------------------------------------------------------------

const CALM = ['idle', 'sit', 'watch', 'groom', 'groom2', 'itch', 'loaf', 'sleep', 'meow', 'happy', 'eat', 'stretch'];

// Frames per second: smooth while you drag or play with the laser, lower when the cats are
// just sitting, lowest when they all sleep. Fewer frames is what keeps the CPU near idle.
function fps() {
  if (drag || laser) return 60;
  const still = toys.every((t) => t.kind === 'bowl' || t.resting);
  if (!still || tree.swinging || cats.some((c) => !CALM.includes(c.act.name) || c.gait)) return 30;
  return cats.every((c) => ['sleep', 'inhouse'].includes(c.act.name)) ? 6 : 15;
}

let last = performance.now();
function frame(now) {
  if (now - last < 1000 / fps() - 4) { requestAnimationFrame(frame); return; }
  const dt = Math.min(0.05, (now - last) / 1000);
  last = now;
  clock += dt;
  for (const c of cats) c.update(dt);
  if (treeOn()) tree.update(dt);
  const threat = cats.find((c) => c.hunting) || cats[0];
  const world = treeOn() ? { surfaces: tree.surfaces(), walls: tree.walls() } : null;
  for (const t of toys) { t.update(dt, W, threat, world); t.render(); }
  const bowl = toyOf('bowl');
  if (bowl && bowl.food <= 0 && bowl.emptyAt && clock - bowl.emptyAt > 25) { bowl.remove(); toys.splice(toys.indexOf(bowl), 1); }
  const need = treeOn() ? Math.max(STRIP, Math.ceil(tree.lift + tree.height + 170)) : STRIP;
  const up = drag || laser || cats.some((c) => c.alt + c.sprite.height > need - 40) || toys.some((t) => t.alt > need - 90);
  if (up) goFull(); else if (winHeight !== need && clock - lowSince > 1) setHeight(need);
  requestAnimationFrame(frame);
}

// for the tests
window.__pet = {
  toys,
  get cats() { return cats; },
  get cat() { return cats[0]; },
  get act() { return cats[0].act.name; },
  get laser() { return !!laser; },
  hold: (name, opts) => { for (const c of cats) c.start(name, { dur: 1e9, ...opts }); },
  sit: () => { for (const c of cats) c.start('idle', { dur: 6 }); },
  tree,
};

setTimeout(() => say('Hi! Click me for your answers', cats[0].head(), 2600), 900);
requestAnimationFrame(frame);
