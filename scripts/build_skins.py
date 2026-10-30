"""Turn the cat art in skins-src/ into one strip per animation (assets/skins/<cat>/<anim>.png)
and pet/skins.js, which tells the app each strip's frames, speed and where the cat stands.

    uv run --no-project --with pillow python scripts/build_skins.py
"""
import json
import shutil
from pathlib import Path

from PIL import Image

ROOT = Path(__file__).resolve().parent.parent
SRC = ROOT / "skins-src"
OUT = ROOT / "assets" / "skins"


def strip(frames):
    w, h = frames[0].size
    s = Image.new("RGBA", (w * len(frames), h))
    for i, f in enumerate(frames):
        s.alpha_composite(f.convert("RGBA"), (i * w, 0))
    return s


def cut(sheet, w, h, row, count):
    return [sheet.crop((c * w, row * h, c * w + w, row * h + h)) for c in range(count)]


def split(path, w):
    im = Image.open(path).convert("RGBA")
    return [im.crop((x, 0, x + w, im.height)) for x in range(0, im.width, w)]


def box(frame):
    """The cat's own pixels in a frame: (left, top, right, bottom)."""
    return frame.getchannel("A").getbbox() or (0, 0, 1, 1)


def skin(id_, name, frames, scales):
    """frames: {anim: (list of frames, fps, extra options)}. The art faces right."""
    out = OUT / id_
    out.mkdir(parents=True, exist_ok=True)
    anims = {}
    for anim, (fs, fps, extra) in frames.items():
        strip(fs).save(out / f"{anim}.png", optimize=True)
        anims[anim] = {"file": f"{anim}.png", "frames": len(fs), "fps": fps, "boxes": [list(box(f)) for f in fs], **extra}
    w, h = frames["idle"][0][0].size
    ground = max(b[3] for a in ("idle", "walk") for b in anims[a]["boxes"])
    first = anims["idle"]["boxes"][0]
    return {"id": id_, "name": name, "frame": [w, h], "scales": scales, "ground": ground,
            "cx": (first[0] + first[2]) / 2, "anims": anims}


def build():
    shutil.rmtree(OUT, ignore_errors=True)

    # Elthen's kitty: one 32x32 sheet, a row per animation
    sheet = Image.open(SRC / "elthen" / "Cat Sprite Sheet.png").convert("RGBA")
    row = lambda r, n: cut(sheet, 32, 32, r, n)
    kitty = skin("kitty", "Kitty", {
        "idle": (row(0, 4), 5, {}), "idle2": (row(1, 4), 5, {}), "lick": (row(2, 4), 6, {}), "lick2": (row(3, 4), 6, {}),
        "run": (row(4, 8), 12, {"speed": 46}), "roll": (row(5, 8), 8, {}), "sleep": (row(6, 4), 3, {}),
        "paw": (row(7, 6), 10, {}), "jump": (row(8, 7), 10, {"byHeight": True}), "walk": (row(9, 8), 8, {"speed": 12}),
        "liedown": (row(5, 2), 6, {"once": True}), "crouch": (row(5, 2)[1:], 1, {}),
    }, [4, 5, 7])

    # LuizMelo's Persian: 50x50 frames, one file per animation
    d = SRC / "luizmelo"
    f = lambda name: split(d / f"Cat-5-{name}.png", 50)
    persian = skin("persian", "Persian", {
        "idle": (f("Idle"), 8, {}), "walk": (f("Walk"), 10, {"speed": 16}), "run": (f("Run"), 14, {"speed": 70}),
        "sit": (f("Sitting"), 1, {}), "meow": (f("Meow"), 8, {}), "liedown": (f("Laying"), 10, {"once": True}),
        "sleep": (f("Sleeping1"), 1, {}), "sleep2": (f("Sleeping2"), 1, {}), "lick": (f("Licking 1"), 8, {}),
        "lick2": (f("Licking 2"), 8, {}), "stretch": (f("Stretching"), 9, {"once": True}),
        "crouch": (f("Stretching")[1:3], 4, {}), "itch": (f("Itch"), 6, {}),
    }, [3, 4, 6])

    # Last tick's white cat: 64x64 frames, one row per animation (row numbers from the pack's labelled sheet)
    sheet = Image.open(SRC / "lasttick64" / "white.png").convert("RGBA")
    row = lambda r, n=None, pick=None: [cut(sheet, 64, 64, r, 14)[i] for i in (pick or range(n))]
    white = skin("white", "White cat", {
        "idle": (row(26, 5), 6, {}), "sit": (row(22, 5), 5, {}), "walk": (row(4, 6), 8, {"speed": 24}),
        "run": (row(10, 5), 12, {"speed": 90}), "lick": (row(12, 8), 8, {}), "lick2": (row(13, 8), 8, {}),
        "meow": (row(14, 3), 6, {}), "itch": (row(18, 8), 10, {}), "yawn": (row(43, 7), 7, {}),
        "paw": (row(35, 11), 16, {}), "lie": (row(28, 3), 4, {}), "sleep": (row(45, 2), 1.2, {}),
        "sleep2": (row(53, 2), 1.2, {}), "eat": (row(59, 10), 8, {}), "scared": (row(61, 2), 4, {}),
        "jump": (row(64, 5), 10, {"byHeight": True}), "happy": (row(65, 4), 6, {}),
        "crouch": (row(64, pick=[1]), 1, {}), "stretch": (row(6, pick=[10, 11, 12, 13, 12, 11]), 4, {"once": True}),
    }, [2, 3, 4])

    # Last tick's white kitten: 32x32 frames, same idea (its "(l)"/"(r)" labels do not always mean facing; these all face right)
    sheet = Image.open(SRC / "lasttick32" / "white.png").convert("RGBA")
    row = lambda r, n=None, pick=None: [cut(sheet, 32, 32, r, 11)[i] for i in (pick or range(n))]
    kitten = skin("kitten", "White kitten", {
        "idle": (row(1, pick=[3]), 1, {}), "sit": (row(0, pick=[3]), 1, {}), "walk": (row(6, 8), 10, {"speed": 14}),
        "lick": (row(36, 9), 8, {}), "lick2": (row(38, 7), 8, {}), "meow": (row(28, 3), 6, {}),
        "yawn": (row(32, 8), 8, {}), "itch": (row(40, 11), 12, {}), "paw": (row(47, 7), 12, {}),
        "lie": (row(3, pick=[1]), 1, {}), "sleep": (row(13, 2), 1.2, {}), "sleep2": (row(18, 2), 1.2, {}),
        "eat": (row(23, 8), 8, {}), "scared": (row(42, 2), 4, {}), "happy": (row(52, 4), 6, {}),
        "crouch": (row(2, pick=[3]), 1, {}), "stretch": (row(3, pick=[8]), 1, {}),
    }, [4, 5, 7])

    skins = [kitty, persian, white, kitten]
    js = ("// Made by scripts/build_skins.py from skins-src/. Do not edit by hand.\n"
          f"export const SKINS = {json.dumps(skins, separators=(',', ':'))};\n")
    (ROOT / "pet" / "skins.js").write_text(js, encoding="utf-8")
    # the main process only needs names for its menu
    (OUT / "skins.json").write_text(json.dumps([{k: s[k] for k in ("id", "name")} for s in skins], indent=1))
    for s in skins:
        print(f'{s["id"]:8} frame {s["frame"]} ground {s["ground"]} anims {", ".join(s["anims"])}')


if __name__ == "__main__":
    build()
