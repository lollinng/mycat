// Draws a cat from its skin (see skins.js): the current animation's strip as a CSS background,
// one frame at a time. The art faces right; the page flips it to walk left.
import { SKINS } from './skins.js';

export const skinById = (id) => SKINS.find((s) => s.id === id) || SKINS[0];
const SIZE_INDEX = { small: 0, medium: 1, large: 2 };

export class SpriteCat {
  constructor(el) { this.el = el; }

  set(skinId, size) {
    this.skin = skinById(skinId);
    this.s = this.skin.scales[SIZE_INDEX[size] ?? 1];
    const [w, h] = this.skin.frame;
    this.w = Math.round(w * this.s);
    this.h = Math.round(h * this.s);
    Object.assign(this.el.style, {
      width: `${this.w}px`, height: `${this.h}px`, transformOrigin: `${this.skin.cx * this.s}px 0`,
    });
    for (const a of Object.values(this.skin.anims)) new Image().src = this.url(a);   // load every strip up front
    const idle = this.skin.anims.idle.boxes[0];
    this.halfWidth = (Math.max(this.skin.cx - idle[0], idle[2] - this.skin.cx)) * this.s;
    this.height = (this.skin.ground - idle[1]) * this.s;
    this.anim = null;
    this.play(['idle']);
  }

  url(a) { return `../assets/skins/${this.skin.id}/${a.file}`; }
  has(name) { return !!this.skin.anims[name]; }
  pick(names) { return names.find((n) => this.skin.anims[n]) || 'idle'; }
  length(names) { const a = this.skin.anims[this.pick(names)]; return a.frames / a.fps; }
  speed(gait) { return (this.skin.anims[gait]?.speed ?? this.skin.anims.walk.speed * (gait === 'run' ? 3 : 1)) * this.s; }

  // Play the first of `names` this cat has. Returns the one chosen.
  play(names, restart = false) {
    const name = this.pick(names);
    if (name !== this.anim || restart) {
      const a = this.skin.anims[name];
      this.anim = name;
      this.t = 0;
      this.frame = -1;
      this.el.style.backgroundImage = `url("${this.url(a)}")`;
      this.el.style.backgroundSize = `${a.frames * this.w}px ${this.h}px`;
    }
    return name;
  }

  // progress: for a jump drawn frame by frame, how far through it the cat is (0..1)
  update(dt, rate = 1, progress = null) {
    const a = this.skin.anims[this.anim];
    let f;
    if (a.byHeight && progress !== null) f = Math.max(0, Math.min(a.frames - 1, Math.round(progress * (a.frames - 1))));
    else {
      this.t += dt * rate;
      f = Math.floor(this.t * a.fps);
      f = a.once ? Math.min(f, a.frames - 1) : f % a.frames;
    }
    if (f !== this.frame) {
      this.frame = f;
      this.el.style.backgroundPosition = `${-f * this.w}px 0`;
    }
  }

  // Where the cat's own pixels are in this frame, in page pixels from the spot it stands on
  // (x grows towards its face, y downwards).
  box() {
    const a = this.skin.anims[this.anim];
    const b = a.boxes[Math.max(0, this.frame)] || a.boxes[0];
    const { cx, ground } = this.skin;
    return { back: (b[0] - cx) * this.s, front: (b[2] - cx) * this.s, top: (b[1] - ground) * this.s, bottom: (b[3] - ground) * this.s };
  }

  place(x, floorY, facing, extra = '') {
    const left = x - this.skin.cx * this.s;
    const top = floorY - this.skin.ground * this.s;
    const flip = facing < 0 ? ' scaleX(-1)' : '';
    this.el.style.transform = `translate(${left}px, ${top}px)${flip}${extra}`;
  }
}
