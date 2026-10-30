# Desktop pet

A cat that lives on the Windows desktop. It walks along the taskbar, sits, grooms, stretches, yawns, meows, loafs and
naps, plays with toys, and keeps the answers you paste into job forms (LinkedIn Easy Apply and the like).

## The answers panel
Click the cat. Each row is one answer: **click it to copy, then press Ctrl+V in the form.** The panel never takes the
keyboard from the form unless you type in it, so you can click Email, Ctrl+V, click Phone, Ctrl+V, without clicking
back into the form each time.

- **Search**: type a word or two (`notice`, `ctc expected`); **Enter** copies the first match.
- **Edit**: hover a row and press the pencil; **+ Add** on a group's header adds a field.
- A field can work its value out: `Notice period (days)` counts the days left until a date (0 once it has passed).
- **Notes** tab: free notes; click one to copy all of it.

Everything is kept in `%APPDATA%\DesktopPet\` (`fields.json`, `notes.json`, `settings.json`), not in this folder.

## The cat
- **Drag** it anywhere and let go: it falls and lands on its feet. Throw it if you like.
- **Stroke** it: move the mouse back and forth over it a few times.
- **Right-click** it (or the tray icon) for: Toys (yarn ball, wind-up mouse, laser pointer, food bowl), Meow, Nap,
  Wake up, Cats (which cats are out), Cat tree, Size, Hide for 1 hour, Start with Windows, Quit.
- Toys can be dragged and thrown too; right-click a toy to put it away. The laser follows the mouse until you click.

Clicks go through to whatever is underneath everywhere except on the cat and its toys.

## Running it
`npm install`, then `npm start`. It adds **Desktop Pet** to the Start menu and, while *Start with Windows* is ticked,
to `shell:startup`. Starting it a second time opens the answers panel instead of a second cat.

## How it is made
`main.js` makes two windows: the cat's (transparent, covering the work area, clicks pass through except on the cat)
and the answers panel (not focusable until you type in it). `pet/sprite.js` draws a cat from its pixel-art strips
(`pet/skins.js`, built by `scripts/build_skins.py`); `pet/pet.js` decides what it does; `pet/toys.js` holds the toys;
`pet/tree.js` the cat tree; `panel/` is the answers panel; `store.js` reads and writes the JSON files.

## The cats and their licences
The code is MIT. The art keeps its artists' terms (details in `skins-src/SOURCES.md`):
- **Kitty**: [2D Pixel Art Cat Sprites](https://elthen.itch.io/2d-pixel-art-cat-sprites) by Elthen, free to use in projects. Included.
- **Persian**: [Pet Cats Pack](https://luizmelo.itch.io/pet-cat-pack) by LuizMelo, CC0. Included.
- **White cat** and **White kitten**: Last tick's free packs, which may be used but "may not be redistributed", so they
  are **not in this repo**. To add them, download [64x64 Pixel Cats](https://last-tick.itch.io/animated-pixel-cats-64x64)
  and [32x32 Pixel kittens](https://last-tick.itch.io/animated-pixel-kittens-cats-32x32), save the white cat's sheet as
  `skins-src/lasttick64/white.png` and the white kitten's as `skins-src/lasttick32/white.png`, then run
  `python scripts/build_skins.py` (needs Pillow). Without them the Cats menu offers Kitty and Persian only.

## Tests
- `npm test`: the data files and the panel's value rules.
- `npm run test:app` (needs the white kitten, see above): drives the real app with synthetic clicks (your mouse does not move) in its own data folder:
  open the panel, copy, search, edit, notes, every toy, dragging and stroking. Set `PET_SHOTS=<folder>` for screenshots.
- `npm run preview`: draws every pose and coat into `preview.png`.
