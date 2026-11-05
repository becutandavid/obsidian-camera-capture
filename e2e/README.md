# End-to-end tests and screenshots

These scripts drive the locally installed **Obsidian Flatpak** (`md.obsidian.Obsidian`) over the Chrome DevTools Protocol with Playwright. Each run uses a throwaway vault and a separate Obsidian profile under `.e2e/`. Your own profile and vaults are never touched, and an Obsidian you already have open isn't affected.

## `npm run e2e`

Builds the plugin and runs these cases with your real webcam:

1. Right-click mid-line → Take a picture → Capture → Insert. The embed lands at the exact cursor column, and the file goes to Obsidian's attachment location.
2. Right-click on a selection. The selected text is kept and one embed is added.
3. Photo folder set to `A/B` (doesn't exist yet), triggered from the command. The photo lands in `A/B` and is linked.
4. Another note is opened in the same tab while the camera window is up. The photo is saved, but neither note is edited.
5. Open the window, then press Esc immediately. Every camera track ends and the note is unchanged.
6. Settings tab shows both settings, and changing the folder saves it. Obsidian 1.15 opens settings in a popout window.

`.e2e/modal.png` is a screenshot of the review step. Failing cases also leave a `fail-*.png`.

## `npm run screenshots`

Regenerates `assets/menu.png`, `assets/camera.png` and `assets/result.png` for the README. Chromium's fake camera (`--use-fake-device-for-media-stream`) supplies a test pattern, so it works in any lighting and doesn't show you. Remove that flag in `screenshots.mjs` to use your webcam.

## Requirements and caveats

- Port 9222 must be free.
- The Flatpak's default permissions don't include the webcam (`devices=dri`). The scripts pass `--device=all` **for that run only**, and your saved Flatpak permissions stay the same.
- The test vault is under the repo (inside `$HOME`) because the Flatpak can't see `/tmp`.
- The plugin is installed only after the vault is open. A vault that already contains plugins on first open shows a "Do you trust the author of this vault?" dialog, which blocks every later modal.
- An Obsidian window opens and, for `npm run e2e`, the webcam light turns on.
