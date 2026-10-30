// The cat tree: a picture the cats can stand on (branches, roofs, the nest), two houses they
// can nap in, and a toy on a string. You can drag it anywhere; it stays where you leave it.
import { TREE } from './tree-data.js';

const SCALE = { small: 2, medium: 3, large: 3 };

export class Tree {
  constructor(layer) {
    this.el = document.createElement('div');
    this.el.className = 'tree';
    this.el.innerHTML = `<div class="tree-art"></div>
      <div class="tree-toy"><div class="string"></div><div class="ball"></div></div>
      ${TREE.houses.map((h) => `<div class="eyes" data-house="${h.id}"><i></i><i></i></div>`).join('')}`;
    layer.append(this.el);
    this.toy = { angle: 0.3, speed: 0, el: this.el.querySelector('.tree-toy') };
    this.occupied = {};
    this.x = 0;
    this.lift = 0;
  }

  setSize(size) {
    this.s = SCALE[size] ?? 3;
    const s = this.s;
    Object.assign(this.el.style, { width: `${TREE.w * s}px`, height: `${TREE.h * s}px` });
    const [hx, hy] = TREE.toy;
    Object.assign(this.toy.el.style, { left: `${hx * s}px`, top: `${hy * s}px` });
    this.el.style.setProperty('--s', s);
    for (const h of TREE.houses) {
      const e = this.el.querySelector(`.eyes[data-house="${h.id}"]`);
      Object.assign(e.style, { left: `${h.door[0] * s}px`, top: `${(h.door[1] - 3) * s}px` });
    }
  }

  get width() { return TREE.w * this.s; }
  get height() { return TREE.ground * this.s; }
  get left() { return this.x - (TREE.w / 2) * this.s; }

  // height above the floor of a tree row, and page x of a tree column
  altOf(row) { return this.lift + (TREE.ground - row) * this.s; }
  xOf(col) { return this.left + col * this.s; }

  surfaces() {
    return TREE.surfaces.map((p) => ({ id: p.id, x0: this.xOf(p.x[0]), x1: this.xOf(p.x[1]), alt: this.altOf(p.y) }));
  }
  surface(id) { return this.surfaces().find((p) => p.id === id); }

  // the trunk and the houses, which a thrown toy bounces off
  walls() {
    return TREE.walls.map(([x0, y0, x1, y1]) => ({ x0: this.xOf(x0), x1: this.xOf(x1), bottom: this.altOf(y1), top: this.altOf(y0) }));
  }

  houses() {
    return TREE.houses.map((h) => ({ id: h.id, x: this.xOf(h.door[0]), alt: this.altOf(h.door[1]), busy: !!this.occupied[h.id] }));
  }

  setOccupied(id, cat) {
    this.occupied[id] = cat;
    this.el.querySelector(`.eyes[data-house="${id}"]`).classList.toggle('on', !!cat);
  }

  toyPoint() { const [hx, hy] = TREE.toy; return { x: this.xOf(hx), alt: this.altOf(hy) - 26 * this.s * 0.5 }; }
  swat(dir) { this.toy.speed += dir * (2.5 + Math.random() * 2); }

  // a point on the branches, roofs, houses, trunk or crown (for grabbing the tree)
  hit(x, y, floorY) {
    const tx = (x - this.left) / this.s;
    const ty = TREE.ground - (floorY - this.lift - y) / this.s;
    return TREE.grab.some(([x0, y0, x1, y1]) => tx >= x0 && tx <= x1 && ty >= y0 && ty <= y1);
  }
  hitToy(x, y, floorY) {
    const ball = this.toy.el.querySelector('.ball').getBoundingClientRect();
    return x >= ball.left - 6 && x <= ball.right + 6 && y >= ball.top - 6 && y <= ball.bottom + 6;
  }

  get swinging() { return Math.abs(this.toy.speed) > 0.05 || Math.abs(this.toy.angle) > 0.05; }

  update(dt) {
    const t = this.toy;
    t.speed += (-14 * Math.sin(t.angle) - 0.9 * t.speed) * dt;    // a pendulum that slowly settles
    t.angle += t.speed * dt;
    t.el.style.transform = `rotate(${t.angle}rad)`;
  }

  place(floorY) {
    this.el.style.transform = `translate(${this.left}px, ${floorY - this.lift - TREE.ground * this.s}px)`;
  }
}
