"""Add Last tick's white cat and white kitten, then build them.

Their terms let you use the art but not redistribute it, so they are not in this repo (README, "Running from source",
step 2). Run, from anywhere:

    uv run --no-project --with pillow python scripts/add_lasttick_cats.py

It first looks for the two free packs on this computer, by what is in them, so the names your browser gave them do
not matter ("PACK (1).zip" is fine), zipped or unzipped, in Downloads, on the Desktop, in this repo or in the current
folder. A pack it does not find it downloads from Last tick's own itch.io page, the way the page's "Download Now" →
"No thanks, just take me to the downloads" does, into skins-src/downloads/ (not committed). Give zips or folders
yourself to use only those: `... add_lasttick_cats.py D:\\stuff\\PACK.zip "D:\\stuff\\Free pack.zip"`.

It copies `PACK/cat 3 (64х64).png` (the white cat; the "х" in the pack's name is Cyrillic) to
skins-src/lasttick64/white.png and `Free pack/cat 1.9.png` (the white kitten) to skins-src/lasttick32/white.png,
checks each sheet's size, and runs scripts/build_skins.py.
"""
from __future__ import annotations

import http.cookiejar
import json
import re
import struct
import subprocess
import sys
import urllib.parse
import urllib.request
import zipfile
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
SRC = ROOT / "skins-src"
DOWNLOADS = SRC / "downloads"
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
    return [DOWNLOADS, home / "Downloads", home / "OneDrive" / "Downloads", home / "Desktop", home / "OneDrive" / "Desktop",
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


def download(sheet: dict) -> Path:
    """The pack's zip from Last tick's itch.io page, through the page's free route (Download Now → No thanks)."""
    opener = urllib.request.build_opener(urllib.request.HTTPCookieProcessor(http.cookiejar.CookieJar()))
    opener.addheaders = [("User-Agent", "Mozilla/5.0 (desktop-pet setup script)")]

    def get(url: str, form: dict | None = None) -> bytes:
        with opener.open(url, urllib.parse.urlencode(form).encode() if form is not None else None, timeout=120) as r:
            return r.read()

    def csrf(page: str) -> str:
        return re.search(r'name="csrf_token" value="([^"]+)"', page).group(1)

    page = sheet["page"]
    purchase = get(page + "/purchase?popup=1").decode("utf-8", "replace")
    listing_url = json.loads(get(page + "/download_url", {"csrf_token": csrf(purchase)}))["url"]
    listing = get(listing_url).decode("utf-8", "replace")
    # each file on the page: <a data-upload_id="…">Download</a> … <strong title="PACK.zip" class="name">
    uploads = {name: upload for upload, name in re.findall(r'data-upload_id="(\d+)".{0,400}?<strong title="([^"]+)"', listing, re.S)}
    if sheet["zip"] not in uploads:
        raise ValueError(f"{sheet['zip']} is not on the download page (it lists: {', '.join(uploads) or 'nothing'})")
    # The download page's own session (its cookie) is what lets the file out: its key stays empty, as the page sends it.
    reply = json.loads(get(f"{page}/file/{uploads[sheet['zip']]}?source=game_download&key=", {"csrf_token": csrf(listing)}))
    if "url" not in reply:
        raise ValueError(f"itch.io answered {reply}")
    file_url = reply["url"]
    data = get(file_url)
    if not data.startswith(b"PK"):
        raise ValueError("itch.io sent something other than a zip")
    DOWNLOADS.mkdir(parents=True, exist_ok=True)
    target = DOWNLOADS / sheet["zip"]
    target.write_bytes(data)
    return target


def main(given: list[str]) -> None:
    for stream in (sys.stdout, sys.stderr):   # the white cat's file name has a Cyrillic letter; a cp1252 console must not crash on it
        stream.reconfigure(errors="replace")
    looked = [p for p in dict.fromkeys(places(given)) if p.exists()]
    missing = []
    for sheet in SHEETS:
        found = find(sheet, looked)
        if not found and not given:
            print(f"{sheet['cat']}: not on this computer; downloading {sheet['zip']} from {sheet['page']} (free; "
                  "you can pay what you like on that page)", flush=True)
            try:
                found = find(sheet, [download(sheet)])
            except Exception as error:  # noqa: BLE001 - any failure means: fall back to downloading by hand
                print(f"  could not download it ({type(error).__name__}: {error})", flush=True)
        if not found:
            missing.append(sheet)
            continue
        sheet["to"].parent.mkdir(parents=True, exist_ok=True)
        sheet["to"].write_bytes(found[1])
        print(f"{sheet['cat']}: {found[0]} -> {sheet['to'].relative_to(ROOT)}", flush=True)
    if len(missing) < len(SHEETS):
        subprocess.run([sys.executable, str(ROOT / "scripts" / "build_skins.py")], check=True)
    if missing:
        # These cats are an optional extra: not getting them is a note, not a failure. The app runs with the rest.
        names = " and the ".join(sheet["cat"] for sheet in missing)
        print(f"\nSkipped the {names}: nothing is wrong with the app, which runs as it is (npm start) with "
              f"{'the other cats' if len(missing) < len(SHEETS) else 'Kitty and Persian'}. To add them later:")
        for sheet in missing:
            print(f"- open {sheet['page']}, press Download Now, then 'No thanks, just take me to the downloads', "
                  f"and download {sheet['zip']}")
        print("  then run this again: it finds the zips in Downloads, on the Desktop or in this folder"
              + (f" (it looked in {', '.join(map(str, looked))})" if given else "") + ".")


if __name__ == "__main__":
    main(sys.argv[1:])
