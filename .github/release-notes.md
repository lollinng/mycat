A pixel cat that lives on your desktop: it walks along the taskbar, naps, climbs its cat tree, plays with toys, and
keeps the answers you paste into job forms (click the cat).

## Which file
- **Windows**: `Desktop-Pet-Setup-….exe` installs it for you (no admin needed); `Desktop-Pet-…-portable.exe` runs
  without installing. The app is not signed, so Windows may say *Windows protected your PC*: click **More info**,
  then **Run anyway**.
- **macOS**: `…-mac-arm64.dmg` for Apple Silicon (M1 and later), `…-mac-x64.dmg` for Intel Macs. Drag Desktop Pet to
  Applications. Apple has not checked the app (that needs a paid developer account), so the first time macOS refuses
  to open it: open **System Settings → Privacy & Security** and click **Open Anyway**, or run
  `xattr -dr com.apple.quarantine "/Applications/Desktop Pet.app"` in Terminal. The cat lives in the menu bar, not the Dock.
- **Linux** (x64): the `.AppImage`: make it executable (`chmod +x`) and run it (Ubuntu 22.04 and later may first need
  `sudo apt install libfuse2`); or unpack the `.tar.gz` and run `desktop-pet`. The see-through window needs a desktop
  with a compositor (GNOME, KDE and most others have one).

Kitty and the Persian come with it. Last tick's white cat and kitten are not included: their licence does not allow
passing them on. The README says how to add them when you run it from source.
