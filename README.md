# Camera Capture

An Obsidian plugin: right-click in a note, choose **Take a picture**, and the photo is saved to your vault and embedded at the cursor.

- **Desktop:** opens a window with a live webcam preview. Click **Capture**, then **Retake** or **Insert**.
- **Mobile (Android/iOS):** opens your phone's camera app. The photo you take is inserted.

The same action is available as the command **Camera Capture: Take a picture**, so you can bind a hotkey or add it to the mobile toolbar.

## Install (manual)

1. `npm install && npm run build`
2. Copy `main.js`, `manifest.json` and `styles.css` into `<your vault>/.obsidian/plugins/camera-capture/`.
3. In Obsidian, go to **Settings → Community plugins**, then enable **Camera Capture**.

## Settings

- **Photo folder:** where photos are saved. Leave it empty to use Obsidian's own *Files and links → Default location for new attachments*. Missing folders are created, and name clashes get a ` 1`, ` 2`… suffix.
- **JPEG quality:** 0.5–1 (default 0.9). Applies to desktop webcam captures. Phone photos are saved unchanged.

Photos are named `Photo YYYY-MM-DD HHmmss.jpg`. The link follows your wikilink/Markdown link preference.

## Development

- `npm test`: unit tests for naming and path logic (vitest)
- `npm run build`: type-check and produce `main.js`
- `npm run e2e`: automated desktop test against the locally installed Obsidian Flatpak and your real webcam (see [e2e/README.md](e2e/README.md))

## Manual test checklist

Run these on a real device. The automated test can't cover them.

- [ ] Android: right-click (long-press) → Take a picture → the camera app opens → the photo is embedded at the cursor
- [ ] iOS: same as Android
- [ ] Mobile: cancelling in the camera app leaves the note unchanged
- [ ] Desktop: with camera permission denied at the OS level, the window shows "Camera access denied"
- [ ] With the Markdown-links preference on (Settings → Files and links → Use [[Wikilinks]] off), the embed is `![](…)`
