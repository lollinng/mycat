"""Add Last tick's white cat and white kitten from the two free packs you downloaded from itch.io, then build them.

Their terms let you use the art but not redistribute it, so they are not in this repo (README, "Setting it up",
step 2). Give it the two zips as downloaded:

    uv run --no-project --with pillow python scripts/add_lasttick_cats.py PACK.zip "Free pack.zip"

It copies `PACK/cat 3 (64х64).png` (the white cat; the "х" in the pack's name is Cyrillic) to
skins-src/lasttick64/white.png and `Free pack/cat 1.9.png` (the white kitten) to skins-src/lasttick32/white.png,
checks each sheet's size, and runs scripts/build_skins.py.
"""
import re
import struct
import subprocess
import sys
import zipfile
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
SRC = ROOT / "skins-src"
# (where it goes, how its name looks inside the zip, the sheet's size in pixels, the zip it comes in, its file)
SHEETS = [
    (SRC / "lasttick64" / "white.png", re.compile(r"(^|/)cat 3 \(64.64\)\.png$", re.I), (896, 4608), "PACK.zip", "PACK/cat 3 (64x64).png"),
    (SRC / "lasttick32" / "white.png", re.compile(r"(^|/)cat 1\.9\.png$", re.I), (352, 1696), "Free pack.zip", "Free pack/cat 1.9.png"),
]


def png_size(data: bytes) -> tuple[int, int]:
    return struct.unpack(">II", data[16:24]) if data[:8] == b"\x89PNG\r\n\x1a\n" else (0, 0)


def main(zips: list[str]) -> None:
    if not zips:
        sys.exit(__doc__)
    members = []
    for name in zips:
        z = zipfile.ZipFile(name)
        members += [(z, m) for m in z.namelist()]
    for target, pattern, size, pack, file in SHEETS:
        found = [(z, m) for z, m in members if pattern.search(m)]
        if not found:
            sys.exit(f"No {file} in the zips given: add {pack} (README, \"Setting it up\", step 2).")
        z, member = found[0]
        data = z.read(member)
        if png_size(data) != size:
            sys.exit(f"{member} is {png_size(data)}, expected {size}: not the sheet this app was built for.")
        target.parent.mkdir(parents=True, exist_ok=True)
        target.write_bytes(data)
        print(f"{member} -> {target.relative_to(ROOT)}")
    subprocess.run([sys.executable, str(ROOT / "scripts" / "build_skins.py")], check=True)


if __name__ == "__main__":
    main(sys.argv[1:])
