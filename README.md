# Desktop pet

A cat that lives on your desktop (Windows, macOS, Linux). It walks along the taskbar, sits, grooms, stretches, yawns,
meows, loafs and naps, climbs its cat tree, plays with toys, and keeps the answers you paste into job forms
(LinkedIn Easy Apply and the like).

## Download
Get it from [Releases](https://github.com/lollinng/mycat/releases/latest): the installer or the portable `.exe` for
Windows, the `.dmg` for macOS (arm64 = Apple Silicon, x64 = Intel), the `.AppImage` or `.tar.gz` for Linux. The release
page says how to get past Windows' and macOS' warnings about an unsigned app.

## The answers panel
Click the cat. Each row is one answer: **click it to copy, then press Ctrl+V in the form.** The panel never takes the
keyboard from the form unless you type in it, so you can click Email, Ctrl+V, click Phone, Ctrl+V, without clicking
back into the form each time.

- **Search**: type a word or two (`notice`, `ctc expected`); **Enter** copies the first match.
- **Edit**: hover a row and press the pencil; **+ Add** on a group's header adds a field.
- A field can work its value out: `Notice period (days)` counts the days left until a date (0 once it has passed).
- **Notes** tab: free notes; click one to copy all of it.

Everything is kept in a `DesktopPet` folder (`fields.json`, `notes.json`, `settings.json`), not with the app:
`%APPDATA%\DesktopPet\` on Windows, `~/Library/Application Support/DesktopPet/` on macOS, `~/.config/DesktopPet/` on Linux.
Running from source and the installed app share it.

## The cat
- **Drag** it anywhere and let go: it falls and lands on its feet. Throw it if you like.
- **Stroke** it: move the mouse back and forth over it a few times.
- **Right-click** it (or the tray / menu bar icon) for: Toys (yarn ball, wind-up mouse, laser pointer, food bowl), Meow,
  Nap, Wake up, Cats (which cats are out), Cat tree, Tree size, Cat size, Hide for 1 hour, Start with Windows (Open at
  login on macOS, Start at login on Linux), Quit.
- **The cat tree**: drag it anywhere; it stays where you leave it. *Tree size* makes it smaller or bigger (the cats on
  it stay where they are on it).
- Toys can be dragged and thrown too; right-click a toy to put it away. The laser follows the mouse until you click.

Clicks go through to whatever is underneath everywhere except on the cat and its toys.

## Running from source
1. `npm install`.
2. Optional: the **white cat** and **white kitten**. Skip this and the app still runs, with Kitty and Persian. They
   are Last tick's, whose terms let you use them but not pass them on, so they are not in this repo. One command
   fetches them for you, free, from Last tick's own itch.io pages and adds them:
   ```
   pip install pillow
   python scripts/add_lasttick_cats.py
   ```
   (or `uv run --no-project --with pillow python scripts/add_lasttick_cats.py`). If the download ever fails, get the
   two packs by hand and run the same command again: it finds them in Downloads, on the Desktop or in this folder,
   under any name, zipped or not.
   - [64x64 FREE Pixel Cats](https://last-tick.itch.io/animated-pixel-cats-64x64): **Download Now**, then
     **No thanks, just take me to the downloads**, then **PACK.zip**.
   - [32x32 Pixel kittens](https://last-tick.itch.io/animated-pixel-kittens-cats-32x32): the same, then
     **Free pack.zip** (not the winter or 14 feb ones).
3. `npm start`. On Windows it adds **Desktop Pet** to the Start menu and, while *Start with Windows* is ticked, to
   `shell:startup`. Starting it a second time brings the cat back if it was hidden and opens the answers panel,
   instead of a second cat.

## Building the apps
`npm run dist` builds for the computer you are on, into `dist/`: an installer and a portable `.exe` on Windows, a
`.dmg` on a Mac (only a Mac can build one), an `.AppImage` and a `.tar.gz` on Linux. Last tick's cats are left out
of every build (their licence). The GitHub workflow (`.github/workflows/build.yml`) builds all three on GitHub's
machines, starts each one to check a cat comes out (`DESKTOP_PET_SMOKE=1`), and for a version tag publishes a
release: bump `version` in `package.json`, then `git tag v<version> && git push origin v<version>`.
The apps are not signed with a paid certificate: Windows SmartScreen and macOS Gatekeeper warn the first time.

## How it is made
`main.js` makes two windows: the cat's (transparent, covering the work area, clicks pass through except on the cat)
and the answers panel (not focusable until you type in it). On Linux, where a window cannot let clicks through and
still hear the mouse, the main process tells the cats' page where the pointer is. `pet/sprite.js` draws a cat from its pixel-art strips
(`pet/skins.js`, built by `scripts/build_skins.py`); `pet/pet.js` decides what it does; `pet/toys.js` holds the toys;
`pet/tree.js` the cat tree; `panel/` is the answers panel; `store.js` reads and writes the JSON files.

## The cats and their licences
The code is MIT. The art keeps its artists' terms (details in `skins-src/SOURCES.md`):
- **Kitty**: [2D Pixel Art Cat Sprites](https://elthen.itch.io/2d-pixel-art-cat-sprites) by Elthen, free to use in projects. Included.
- **Persian**: [Pet Cats Pack](https://luizmelo.itch.io/pet-cat-pack) by LuizMelo, CC0. Included.
- **White cat** and **White kitten**: from Last tick's free packs, free to use but not to "resell or redistribute the
  assets, free or paid, as files", so they are **not in this repo**: step 2 of *Running from source* adds them.

## Tests
- `npm test`: the data files, the panel's value rules, toy physics, and the cats' art (resting poses stand on the
  floor; a jump is drawn in the air only with its airborne frames).
- `npm run test:app` (needs the white kitten: step 2 of *Running from source*): drives the real app with synthetic clicks (your mouse does not move) in its own data folder:
  open the panel, copy, search, edit, notes, every toy, dragging and stroking. Set `PET_SHOTS=<folder>` for screenshots.
- `npm run preview`: draws every pose and coat into `preview.png`.
