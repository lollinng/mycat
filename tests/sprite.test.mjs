// The cats' art against the floor, without a window: a pose that should stand on the floor touches it,
// and a jump is drawn only with frames whose feet are off it (Kitty once stood in mid-air while coming down).
import test from 'node:test';
import assert from 'node:assert';
import { SKINS } from '../pet/skins.js';

globalThis.Image = class { set src(_) {} };
const { SpriteCat } = await import('../pet/sprite.js');

const LIFTED = ['walk', 'run', 'jump'];   // a gait's stride and the jump are meant to leave the floor

test('every resting pose of every cat stands on the floor', () => {
  for (const skin of SKINS) {
    for (const [name, a] of Object.entries(skin.anims)) {
      if (LIFTED.includes(name)) continue;
      const lowest = Math.min(...a.boxes.map((b) => skin.ground - b[3]));
      assert.ok(lowest <= 0, `${skin.id} ${name} floats ${lowest}px above the floor`);
    }
  }
});

test('in the air a jump shows only its airborne frames, and lands with its landing frames', () => {
  for (const skin of SKINS.filter((s) => s.anims.jump)) {
    const sprite = new SpriteCat({ style: {} });
    sprite.set(skin.id, 'medium');
    sprite.play(['jump'], true);
    const seen = new Set();
    for (const progress of [null, 0, 0.1, 0.3, 0.5, 0.7, 0.9, 1, 1.4]) {
      sprite.update(1 / 30, 1, progress);
      seen.add(sprite.frame);
    }
    const [first, last] = skin.anims.jump.air;
    assert.deepStrictEqual([...seen].sort(), Array.from({ length: last - first + 1 }, (_, i) => first + i), skin.id);
    // Kitty's art lifts the feet in those frames; the white cat's one leap pose is stretched out
    if (skin.id === 'kitty') for (const f of seen) assert.ok(skin.anims.jump.boxes[f][3] < skin.ground, `kitty jump frame ${f}`);
    assert.strictEqual(sprite.play(['land', 'crouch']), 'land', `${skin.id} has landing frames`);
  }
});
