// Toy physics against the cat tree, without a window: a minimal stand-in for the page.
import test from 'node:test';
import assert from 'node:assert';
import { TREE } from '../pet/tree-data.js';

const el = () => ({ style: {}, dataset: {}, innerHTML: '', querySelector: () => el(), remove() {} });
globalThis.document = { createElement: el };
const { Toy } = await import('../pet/toys.js');

// the tree at scale 1, standing on the floor with its left edge 300 px in from the screen's
const alt = (row) => TREE.ground - row;
const X = 300;
const world = {
  surfaces: TREE.surfaces.map((p) => ({ id: p.id, x0: X + p.x[0], x1: X + p.x[1], alt: alt(p.y) })),
  walls: TREE.walls.map(([x0, y0, x1, y1]) => ({ x0: X + x0, x1: X + x1, bottom: alt(y1), top: alt(y0) })),
};
const layer = { appendChild() {} };
const nest = world.surfaces.find((p) => p.id === 'nest');
const lowLeft = world.surfaces.find((p) => p.id === 'low-left');
const trunk = world.walls[0];
const cat = { x: -1000, hunting: false };

function run(toy, seconds) {
  for (let t = 0; t < seconds; t += 1 / 60) toy.update(1 / 60, 2000, cat, world);
}

test('a ball dropped over the nest lands in it and stays', () => {
  const ball = new Toy('yarn', layer, (nest.x0 + nest.x1) / 2, 1000);
  ball.alt = nest.alt + 80;
  run(ball, 3);
  assert.strictEqual(ball.on, 'nest');
  assert.strictEqual(ball.alt, nest.alt);
  assert.ok(ball.resting);
});

test('a ball thrown at the trunk bounces back off it', () => {
  const ball = new Toy('yarn', layer, trunk.x0 - 60, 1000);
  ball.alt = 20;
  ball.throwFrom(500, 0);
  run(ball, 1);
  assert.ok(ball.x + ball.w / 2 <= trunk.x0 + 0.01, `x ${ball.x}`);
  assert.ok(ball.vx <= 0 || ball.resting);
});

test('a ball rolled along a branch drops off its end to the floor', () => {
  const ball = new Toy('yarn', layer, lowLeft.x0 + 30, 1000);
  ball.alt = lowLeft.alt;
  ball.on = 'low-left';
  ball.vx = -120;                       // towards the tip of the branch
  run(ball, 4);
  assert.strictEqual(ball.on, null);
  assert.strictEqual(ball.alt, 0);
});

test('without the tree a ball just lands on the floor', () => {
  const ball = new Toy('yarn', layer, (nest.x0 + nest.x1) / 2, 1000);
  ball.alt = nest.alt + 80;
  for (let t = 0; t < 3; t += 1 / 60) ball.update(1 / 60, 2000, cat, null);
  assert.strictEqual(ball.alt, 0);
  assert.strictEqual(ball.on, null);
});
