"""Draw the cat tree in pixel art (assets/tree/tree.png) and write pet/tree-data.js:
where its branches, roofs and nest are (the places a cat can stand), its house doors and
the hook the dangling toy hangs from. Coordinates are tree pixels, y down, ground at the bottom.

    uv run --no-project --with pillow python scripts/build_tree.py
"""
import json
import math
import random
from pathlib import Path

from PIL import Image

ROOT = Path(__file__).resolve().parent.parent
W, H = 124, 204
GROUND = H - 2

OUTLINE = (45, 29, 20, 255)
BARK, BARK_LIGHT, BARK_DARK = (124, 82, 48, 255), (152, 104, 62, 255), (92, 58, 33, 255)
LEAF, LEAF_LIGHT, LEAF_DARK = (86, 160, 76, 255), (126, 196, 104, 255), (58, 118, 58, 255)
BLOSSOM = (247, 176, 196, 255)
WALL, WALL_LIGHT, WALL_DARK = (214, 160, 98, 255), (234, 190, 130, 255), (176, 124, 70, 255)
ROOF, ROOF_LIGHT, ROOF_DARK = (196, 86, 70, 255), (222, 120, 98, 255), (150, 60, 50, 255)
DOOR, DOOR_RIM = (38, 24, 18, 255), (120, 80, 50, 255)
NEST, NEST_DARK, CUSHION = (170, 118, 66, 255), (128, 84, 44, 255), (244, 196, 206, 255)
GRASS, GRASS_LIGHT = (96, 168, 80, 255), (132, 200, 104, 255)

random.seed(7)
img = Image.new("RGBA", (W, H))
px = img.load()


def put(x, y, c):
    if 0 <= x < W and 0 <= y < H:
        px[x, y] = c


def rect(x0, y0, x1, y1, c):
    for y in range(y0, y1):
        for x in range(x0, x1):
            put(x, y, c)


def disc(cx, cy, r, c):
    for y in range(int(cy - r), int(cy + r) + 1):
        for x in range(int(cx - r), int(cx + r) + 1):
            if (x - cx) ** 2 + (y - cy) ** 2 <= r * r:
                put(x, y, c)


def leaves(cx, cy, r, blossoms=2):
    """A round tuft: dark underside, mid body, light speckles up and left."""
    disc(cx, cy + 1, r, LEAF_DARK)
    disc(cx, cy, r - 0.6, LEAF)
    for _ in range(int(r * r * 0.5)):
        a, d = random.uniform(0, math.tau), random.uniform(0, r - 1)
        x, y = int(cx + d * math.cos(a)), int(cy + d * math.sin(a))
        if (x - cx) + (y - cy) < -r * 0.3:
            put(x, y, LEAF_LIGHT)
    for _ in range(blossoms):
        a, d = random.uniform(0, math.tau), random.uniform(1, r - 2)
        x, y = int(cx + d * math.cos(a)), int(cy + d * math.sin(a))
        put(x, y, BLOSSOM)
        put(x + 1, y, BLOSSOM)


def branch(x0, x1, y, thick=5):
    """A flat-topped branch whose top row is y; it tapers towards the end away from the trunk."""
    toward_left = x0 < 60
    for x in range(x0, x1):
        t = (x - x0) / max(1, x1 - x0 - 1)
        end = t if not toward_left else 1 - t     # 0 at the trunk, 1 at the tip
        h = max(3, round(thick - 2 * end))
        for k in range(h):
            put(x, y + k, BARK_LIGHT if k == 0 else BARK_DARK if k == h - 1 else BARK)


def house(x0, x1, top, bottom):
    """A little wooden house standing on a branch: plank walls, a flat red roof, a round door."""
    rect(x0, top, x1, bottom, WALL)
    for y in range(top + 3, bottom, 4):
        for x in range(x0, x1):
            put(x, y, WALL_DARK)
    rect(x0, top, x0 + 1, bottom, WALL_LIGHT)
    rect(x1 - 1, top, x1, bottom, WALL_DARK)
    rx0, rx1, ry = x0 - 4, x1 + 4, top - 5             # roof slab, overhanging both sides
    rect(rx0, ry, rx1, top, ROOF)
    rect(rx0, ry, rx1, ry + 1, ROOF_LIGHT)
    rect(rx0, top - 1, rx1, top, ROOF_DARK)
    for x in range(rx0 + 1, rx1, 3):
        put(x, ry + 2, ROOF_DARK)
    dx, dy = (x0 + x1) // 2, bottom - 8
    disc(dx, dy, 6, DOOR_RIM)
    disc(dx, dy, 5, DOOR)
    rect(dx - 5, dy, dx + 6, bottom, DOOR)
    rect(dx - 6, dy, dx - 5, bottom, DOOR_RIM)
    rect(dx + 6, dy, dx + 7, bottom, DOOR_RIM)
    return {"roof": [rx0, rx1, ry], "door": [dx, dy + 2], "box": [x0, top, x1, bottom]}


def outline():
    """Every empty pixel touching the drawing becomes outline, like the cats'."""
    solid = [[px[x, y][3] > 0 for y in range(H)] for x in range(W)]
    for x in range(W):
        for y in range(H):
            if solid[x][y]:
                continue
            for dx, dy in ((1, 0), (-1, 0), (0, 1), (0, -1)):
                nx, ny = x + dx, y + dy
                if 0 <= nx < W and 0 <= ny < H and solid[nx][ny]:
                    px[x, y] = OUTLINE
                    break


# crown behind everything
for cx, cy, r in ((40, 30, 15), (62, 22, 18), (86, 30, 15), (50, 40, 12), (76, 42, 12)):
    leaves(cx, cy, r, blossoms=3)

# trunk, wider at the foot, with bark grain and a knot
for y in range(34, GROUND):
    flare = max(0, (y - (GROUND - 18)) // 3)
    x0, x1 = 55 - flare, 69 + flare
    for x in range(x0, x1):
        put(x, y, BARK)
    put(x0, y, BARK_LIGHT)
    put(x0 + 1, y, BARK_LIGHT)
    put(x1 - 1, y, BARK_DARK)
    put(x1 - 2, y, BARK_DARK)
for _ in range(70):
    x, y = random.randint(58, 66), random.randint(40, GROUND - 2)
    put(x, y, BARK_DARK)
    put(x, y + 1, BARK_DARK)
disc(62, 140, 2, BARK_DARK)
put(62, 140, OUTLINE)

# grass mound at the foot
for x in range(30, 95):
    h = int(5 - abs(x - 62) / 8)
    for y in range(GROUND - max(1, h), GROUND):
        put(x, y, GRASS)
    if x % 4 == 0:
        put(x, GROUND - max(1, h) - 1, GRASS_LIGHT)

# branches: (from, to, top row)
low_left = (6, 55, 152)
low_right = (69, 120, 124)
mid_left = (4, 55, 92)
high_right = (69, 120, 56)
for b in (low_left, low_right, mid_left, high_right):
    branch(*b)

# houses on two branches
house_right = house(80, 112, 101, low_right[2])
house_left = house(10, 42, 69, mid_left[2])

# leaf tufts at the branch tips
leaves(8, low_left[2] + 6, 6)
leaves(120, high_right[2] + 6, 6)
leaves(117, low_right[2] + 7, 5, blossoms=1)

# nest on top of the crown
NEST_Y = 24
for x in range(42, 84):
    t = abs(x - 63) / 21
    depth = int(8 - 5 * t * t)
    for k in range(depth):
        put(x, NEST_Y + k, NEST if (x + k) % 3 else NEST_DARK)
for x in range(46, 80):
    put(x, NEST_Y - 1, CUSHION)
    put(x, NEST_Y - 2, CUSHION if 48 <= x < 78 else (0, 0, 0, 0))

outline()

# where a cat can stand: [left, right, top row]
surfaces = [
    {"id": "low-left", "x": [low_left[0] + 4, low_left[1] - 2], "y": low_left[2]},
    {"id": "right-roof", "x": house_right["roof"][:2], "y": house_right["roof"][2]},
    {"id": "left-roof", "x": house_left["roof"][:2], "y": house_left["roof"][2]},
    {"id": "high-right", "x": [high_right[0] + 2, high_right[1] - 6], "y": high_right[2]},
    {"id": "nest", "x": [46, 80], "y": NEST_Y - 2},
]
houses = [
    {"id": "right", "door": house_right["door"], "below": "low-left"},
    {"id": "left", "door": house_left["door"], "below": "low-left"},
]
# rough boxes for grabbing the tree: trunk, branches, houses, crown
grab = [[52, 34, 72, GROUND], [*house_right["box"]], [*house_left["box"]], [4, 50, 124, 60], [4, 86, 56, 98],
        [69, 118, 124, 130], [4, 146, 56, 158], [24, 6, 104, 56]]
# what a thrown toy bounces off: the trunk and the two houses (branches, roofs and the nest it lands on)
walls = [[54, 34, 70, GROUND], [*house_right["box"]], [*house_left["box"]]]
data = {"w": W, "h": H, "ground": GROUND, "surfaces": surfaces, "houses": houses,
        "toy": [108, high_right[2] + 5], "grab": grab, "walls": walls}

out = ROOT / "assets" / "tree"
out.mkdir(parents=True, exist_ok=True)
img.save(out / "tree.png", optimize=True)
(ROOT / "pet" / "tree-data.js").write_text(
    "// Made by scripts/build_tree.py. Do not edit by hand.\n"
    f"export const TREE = {json.dumps(data, separators=(',', ':'))};\n", encoding="utf-8")
print("tree", W, H, "surfaces", [(s["id"], s["y"]) for s in surfaces])
