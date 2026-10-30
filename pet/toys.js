// Toys: a yarn ball and a wind-up mouse that roll, bounce and can be thrown,
// a food bowl, and the laser dot. Positions are in page pixels; `alt` is height above the floor.

export const GRAVITY = 2200;

const YARN = `
<svg viewBox="-20 -20 40 40" class="toy-svg">
  <path d="M 12 8 C 22 14 26 4 34 10" fill="none" stroke="#c23e6b" stroke-width="2" stroke-linecap="round"/>
  <circle r="15" fill="#ef6f9b" stroke="#8e2a4c" stroke-width="2"/>
  <g fill="none" stroke="#c23e6b" stroke-width="1.8" stroke-linecap="round">
    <path d="M -13 -6 Q 0 -16 12 -9"/><path d="M -14 1 Q 0 -10 14 -2"/><path d="M -12 8 Q 1 -3 13 5"/>
    <path d="M -6 13 Q -12 0 -4 -14"/><path d="M 3 14 Q -4 0 5 -14"/>
  </g>
  <circle cx="-5" cy="-7" r="3" fill="#fff" opacity=".35"/>
</svg>`;

const MOUSE = `
<svg viewBox="-26 -16 52 28" class="toy-svg">
  <path d="M -16 4 C -24 4 -26 -6 -20 -8" fill="none" stroke="#c98a9a" stroke-width="2" stroke-linecap="round"/>
  <path d="M -16 8 C -16 -6 0 -12 14 2 C 18 6 16 9 12 9 L -12 9 C -15 9 -16 9 -16 8 Z" fill="#b9bcc6" stroke="#4a4d56" stroke-width="1.8" stroke-linejoin="round"/>
  <circle cx="2" cy="-6" r="5.2" fill="#e9a8b6" stroke="#4a4d56" stroke-width="1.6"/>
  <circle cx="8.5" cy="0" r="1.6" fill="#22252b"/>
  <circle cx="16" cy="6.5" r="2" fill="#f28da0"/>
  <path d="M -6 -9 L -6 -14 M -9 -14 L -3 -14" stroke="#d1a24a" stroke-width="2.2" stroke-linecap="round"/>
</svg>`;

const BOWL = `
<svg viewBox="-34 -22 68 34" class="toy-svg">
  <g class="food"><circle cx="-12" cy="-5" r="6" fill="#b5713b"/><circle cx="-2" cy="-8" r="6.5" fill="#c98446"/>
    <circle cx="9" cy="-6" r="6" fill="#a8652f"/><circle cx="17" cy="-3" r="5" fill="#c98446"/><circle cx="-19" cy="-2" r="4.5" fill="#a8652f"/></g>
  <path d="M -30 -2 L 30 -2 L 24 10 L -24 10 Z" fill="#5b8def" stroke="#2c4f9e" stroke-width="2" stroke-linejoin="round"/>
  <path d="M -32 -4 L 32 -4" stroke="#2c4f9e" stroke-width="4" stroke-linecap="round"/>
  <path d="M -10 4 c 3 -3 6 -3 8 0 c 2 3 5 3 8 0" fill="none" stroke="#fff" stroke-width="1.6" opacity=".8"/>
</svg>`;

let nextId = 1;

export class Toy {
  constructor(kind, layer, x, floorY) {
    this.id = nextId++;
    this.kind = kind;
    this.x = x;
    this.alt = 0;
    this.vx = 0;
    this.vy = 0;
    this.angle = 0;
    this.facing = 1;
    this.held = false;
    this.r = { yarn: 15, mouse: 13, bowl: 30 }[kind];
    this.w = { yarn: 40, mouse: 52, bowl: 68 }[kind];
    this.h = { yarn: 40, mouse: 28, bowl: 34 }[kind];
    this.food = kind === 'bowl' ? 1 : 0;
    this.on = null;          // the part of the cat tree it rests on, if any
    this.groundAlt = 0;
    this.floorY = floorY;
    this.el = document.createElement('div');
    this.el.className = `toy toy-${kind}`;
    this.el.dataset.hit = 'toy';
    this.el.dataset.id = this.id;
    this.el.innerHTML = { yarn: YARN, mouse: MOUSE, bowl: BOWL }[kind];
    this.el.style.width = `${this.w}px`;
    this.el.style.height = `${this.h}px`;
    layer.appendChild(this.el);
    // the wind-up mouse runs about by itself
    this.run = { left: 0, pause: 1 + Math.random() };
    this.stunned = 0;
  }

  get bottom() { return this.floorY - this.alt; }
  get resting() { return !this.held && this.vy === 0 && Math.abs(this.vx) < 1 && !(this.run?.left > 0) && this.alt === this.groundAlt; }

  throwFrom(vx, vy) { this.vx = vx; this.vy = vy; this.on = null; }

  // world: what of the cat tree a toy can land on (surfaces) and bounce off (walls); null without the tree
  update(dt, width, cat, world = null) {
    if (this.held) return;
    const surfaces = world?.surfaces ?? [];
    // rolled off the end of a branch, or the tree went away: fall
    const on = this.on && surfaces.find((p) => p.id === this.on);
    if (this.on && (!on || this.x < on.x0 || this.x > on.x1)) this.on = null;
    this.groundAlt = this.on ? on.alt : 0;
    if (this.kind === 'mouse') this.scurry(dt, width, cat);
    const before = { x: this.x, alt: this.alt };
    if (this.alt > this.groundAlt || this.vy > 0) {
      if (this.vy > 0) this.on = null;
      this.vy -= GRAVITY * dt;
      this.alt += this.vy * dt;
      let land = null;
      if (this.vy < 0) {                       // coming down onto a branch, a roof or the nest
        land = surfaces.filter((p) => before.alt >= p.alt - 1 && this.alt <= p.alt && this.x >= p.x0 && this.x <= p.x1)
          .sort((a, b) => b.alt - a.alt)[0];
      }
      if (land || this.alt <= 0) {
        this.on = land?.id ?? null;
        this.groundAlt = land?.alt ?? 0;
        this.alt = this.groundAlt;
        this.vy = Math.abs(this.vy) > 160 ? -this.vy * 0.45 : 0;
        this.vx *= 0.8;
      }
    }
    this.x += this.vx * dt;
    const grounded = this.alt === this.groundAlt && this.vy === 0;
    if (grounded && this.kind !== 'mouse') this.vx *= Math.exp(-1.6 * dt);
    if (Math.abs(this.vx) < 4 && grounded && this.kind !== 'mouse') this.vx = 0;
    const half = this.w / 2;
    for (const w of world?.walls ?? []) {     // the trunk and the houses
      if (this.alt + this.h <= w.bottom || this.alt >= w.top) continue;
      if (this.x + half <= w.x0 || this.x - half >= w.x1) continue;
      if (before.x <= (w.x0 + w.x1) / 2) { this.x = w.x0 - half; this.vx = -Math.abs(this.vx) * 0.6; }
      else { this.x = w.x1 + half; this.vx = Math.abs(this.vx) * 0.6; }
      if (this.kind === 'mouse') this.run.left = 0;
    }
    if (this.x < half) { this.x = half; this.vx = Math.abs(this.vx) * 0.6; }
    if (this.x > width - half) { this.x = width - half; this.vx = -Math.abs(this.vx) * 0.6; }
    if (this.kind === 'yarn') this.angle += (this.vx * dt) / this.r;
    if (this.kind === 'mouse' && Math.abs(this.vx) > 5) this.facing = Math.sign(this.vx);
  }

  scurry(dt, width, cat) {
    if (this.stunned > 0) { this.stunned -= dt; this.vx = 0; return; }
    if (this.alt > this.groundAlt) return;
    const fromCat = this.x - cat.x;
    if (Math.abs(fromCat) < 150 && cat.hunting) {        // run away from a hunting cat
      this.vx = Math.sign(fromCat || 1) * 300;
      if (this.x < 60 || this.x > width - 60) this.vx = -this.vx;
      return;
    }
    if (this.run.left > 0) {
      this.run.left -= dt;
      if (this.run.left <= 0) { this.vx = 0; this.run.pause = 0.5 + Math.random() * 1.8; }
    } else {
      this.run.pause -= dt;
      if (this.run.pause <= 0) {
        this.run.left = 0.5 + Math.random() * 1.1;
        this.vx = (Math.random() < 0.5 ? -1 : 1) * (150 + Math.random() * 90);
      }
    }
  }

  render() {
    const top = this.floorY - this.alt - this.h;
    const flip = this.kind === 'mouse' && this.facing < 0 ? ' scaleX(-1)' : '';
    const spin = this.kind === 'yarn' ? ` rotate(${this.angle}rad)` : '';
    this.el.style.transform = `translate(${this.x - this.w / 2}px, ${top}px)${flip}${spin}`;
    if (this.kind === 'bowl') {
      const food = this.el.querySelector('.food');
      food.style.opacity = this.food > 0.02 ? 1 : 0;
      food.style.transform = `translateY(${(1 - this.food) * 8}px)`;
    }
  }

  remove() { this.el.remove(); }
}

export class Laser {
  constructor(layer) {
    this.el = document.createElement('div');
    this.el.className = 'laser-dot';
    layer.appendChild(this.el);
    this.x = -100;
    this.y = -100;
    this.lastMove = performance.now();
  }
  move(x, y) { this.x = x; this.y = y; this.lastMove = performance.now(); this.el.style.transform = `translate(${x - 6}px, ${y - 6}px)`; }
  remove() { this.el.remove(); }
}
