"""Add Last tick's white cat and white kitten from the two free packs you downloaded from itch.io, then build them.

Their terms let you use the art but not redistribute it, so they are not in this repo (README, "Setting it up",
step 2). Download the two packs, then run, from anywhere:

    uv run --no-project --with pillow python scripts/add_lasttick_cats.py

It finds the packs by what is in them, so the names your browser gave them do not matter ("PACK (1).zip" is fine),
zipped or already unzipped, in Downloads, on the Desktop, in this repo or in the current folder. Or give the zips or
folders yourself: `... add_lasttick_cats.py D:\\stuff\\PACK.zip "D:\\stuff\\Free pack.zip"`.

It copies `PACK/cat 3 (64х64).png` (the white cat; the "х" in the pack's name is Cyrillic) to
skins-src/lasttick64/white.png and `Free pack/cat 1.9.png` (the white kitten) to skins-src/lasttick32/white.png,
checks each sheet's size, and runs scripts/build_skins.py.
"""
from __future__ import annotations

import re
import struct
import subprocess
import sys
import zipfile
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
SRC = ROOT / "skins-src"
SHEETS = [
    {"cat": "white cat", "to": SRC / "lasttick64" / "white.png", "name": re.compile(r"(^|/)cat 3 \(64.64\)\.png$", re.I),
     "size": (896, 4608), "file": "cat 3 (64x64).png", "zip": "PACK.zip",
     "page": "https://last-tick.itch.io/animated-pixel-cats-64x64"},
    {"cat": "white kitten", "to": SRC / "lasttick32" / "white.png", "name": re.compile(r"(^|/)cat 1\.9\.png$", re.I),
     "size": (352, 1696), "file": "cat 1.9.png", "zip": "Free pack.zip",
     "page": "https://last-tick.itch.io/animated-pixel-kittens-cats-32x32"},
]


def png_size(data: bytes) -> tuple[int, int]:
    return struct.unpack(">II", data[16:24]) if data[:8] == b"\x89PNG\r\n\x1a\n" else (0, 0)


def places(given: list[str]) -> list[Path]:
    if given:
        return [Path(p).expanduser() for p in given]
    home = Path.home()
    return [home / "Downloads", home / "OneDrive" / "Downloads", home / "Desktop", home / "OneDrive" / "Desktop",
            ROOT, Path.cwd()]


def files(place: Path):
    """Zips and PNGs at the place itself and up to two folders down (an unzipped pack is a folder or two deep)."""
    if place.is_file():
        yield place
    elif place.is_dir():
        for depth in ("", "*/", "*/*/"):
            for pattern in ("*.zip", "*.png"):
                yield from place.glob(depth + pattern)


def sheets_in(path: Path):
    """(where, bytes) for every file inside this zip, or the PNG itself."""
    if path.suffix.lower() == ".png":
        yield str(path), lambda: path.read_bytes()
        return
    try:
        z = zipfile.ZipFile(path)
    except (zipfile.BadZipFile, OSError):
        return
    for member in z.namelist():
        yield f"{path} > {member}", (lambda m=member: z.read(m))


def find(sheet: dict, looked: list[Path]) -> tuple[str, bytes] | None:
    for place in looked:
        for path in files(place):
            for where, read in sheets_in(path):
                if sheet["name"].search(where.replace("\\", "/")):
                    data = read()
                    if png_size(data) == sheet["size"]:
                        return where, data
    return None


def main(given: list[str]) -> None:
    for stream in (sys.stdout, sys.stderr):   # the white cat's file name has a Cyrillic letter; a cp1252 console must not crash on it
        stream.reconfigure(errors="replace")
    looked =[p for p in dict.fromkeys(places(given)) if p.exists()]
    missing = []
    for sheet in SHEETS:
        found = find(sheet, looked)
        if not found:
            missing.append(sheet)
            continue
        sheet["to"].parent.mkdir(parents=True, exist_ok=True)
        sheet["to"].write_bytes(found[1])
        print(f"{sheet['cat']}: {found[0]} -> {sheet['to'].relative_to(ROOT)}", flush=True)
    if len(missing) < len(SHEETS):
        subprocess.run([sys.executable, str(ROOT / "scripts" / "build_skins.py")], check=True)
    if missing:
        print("\nNot found:" if len(missing) < len(SHEETS) else "Found neither pack.", file=sys.stderr)
        for sheet in missing:
            print(f"- the {sheet['cat']} ({sheet['file']}, in {sheet['zip']}): open {sheet['page']}, press Download Now, "
                  f"then 'No thanks, just take me to the downloads', and download {sheet['zip']}.", file=sys.stderr)
        print("Then run this again. Looked in: " + (", ".join(map(str, looked)) or "nowhere that exists")
              + ". If the zips are elsewhere, give their paths.", file=sys.stderr)
        sys.exit(1)


if __name__ == "__main__":
    main(sys.argv[1:])
