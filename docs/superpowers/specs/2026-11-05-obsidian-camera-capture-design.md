# Camera Capture — Obsidian plugin design

Date: 2026-11-05
Status: Approved design, pending spec review

## Goal

Right-click in a note, choose **Take a picture**, take a photo with the device camera, and have the image saved to the vault and embedded at the cursor position where the menu was opened.

## Requirements (from the user)

- Platforms: desktop (Windows/macOS/Linux) **and** mobile (Android/iOS).
- Save location: Obsidian's own attachment setting by default, with an optional plugin setting to override the folder.
- Desktop flow: live preview → Capture → review still → **Retake** or **Insert**.

## Assumptions

- Plugin id `camera-capture`, display name "Camera Capture" (Obsidian guidelines forbid "obsidian" in the id).
- `minAppVersion` 1.5.7: the first version with public `FileManager.getAvailablePathForAttachment`.
- One camera on desktop (the system default). No camera picker (YAGNI, can be added later).
- Photos only, no video.

## Approach

Hybrid capture, chosen per platform via `Platform.isMobileApp`:

- **Desktop:** `navigator.mediaDevices.getUserMedia` in a modal (Electron/Chromium handles this reliably).
- **Mobile:** a hidden `<input type="file" accept="image/*" capture="environment">`, which opens the native camera app. `getUserMedia` is unreliable in the Capacitor WebView that Obsidian mobile uses.

Rejected alternatives: using `getUserMedia` everywhere (risky on iOS and some Android builds), and using `<input capture>` everywhere (on desktop it opens a file picker, not a webcam).

## Architecture

| File | Responsibility |
|---|---|
| `src/main.ts` | Plugin entry. Registers the `editor-menu` item and a "Take a picture" command (hotkey and mobile toolbar). Captures `editor`, cursor and source file **before** opening any UI, picks the capture path, and passes the resulting blob to `savePhoto`. |
| `src/capture/desktop.ts` | `CameraModal` and `captureViaWebcam(app): Promise<Blob \| null>`. Live `<video>` preview, Capture → still on a `<canvas>`, Retake / Insert buttons. Encodes JPEG at the configured quality. Stops all `MediaStream` tracks on close. |
| `src/capture/mobile.ts` | `captureViaNativeCamera(): Promise<Blob \| null>`. Hidden file input; resolves the file on `change`, or `null` on `cancel`. |
| `src/insert.ts` | `savePhoto(app, settings, blob, sourceFile)` resolves the path, creates the folder if needed, writes with `vault.createBinary`, and returns the `TFile`. Also `insertLink(app, editor, file, sourcePath, cursor)` uses `fileManager.generateMarkdownLink` (follows the user's wikilink/markdown preference) and inserts with `editor.replaceRange` at the saved cursor, prefixed with `!`. |
| `src/naming.ts` | Pure functions: `photoFilename(date, ext)` → `Photo YYYY-MM-DD HHmmss.<ext>`; `extensionForMime(mime)`; `resolveTargetPath(override, filename)` (returns the override path or `null` for "use attachment setting"). No Obsidian runtime imports. |
| `src/settings.ts` | Settings `{ folderOverride: string; jpegQuality: number }` (defaults `""`, `0.9`) and a `PluginSettingTab`. |

### Data flow

1. The user right-clicks in the editor. The `editor-menu` handler adds **Take a picture** (icon `camera`).
2. On click: snapshot `editor`, `editor.getCursor()` and `view.file`.
3. Capture: desktop → `captureViaWebcam`; mobile → `captureViaNativeCamera`. `null` → stop silently.
4. `savePhoto`: if `folderOverride` is set, the path is `<override>/<filename>` (de-duplicated with a ` 1`, ` 2`… suffix if it already exists). Otherwise use `fileManager.getAvailablePathForAttachment(filename, sourceFile.path)`. Then `vault.createBinary(path, await blob.arrayBuffer())`.
5. `insertLink` at the snapshotted cursor.

## Error handling

- `getUserMedia` rejects: the modal shows a message mapped from the error name (`NotAllowedError` → "Camera access denied", `NotFoundError` → "No camera found", `NotReadableError` → "Camera is in use by another app", otherwise the error message). The Capture button is disabled.
- Cancel (modal closed / native camera cancelled) → `null`, nothing written.
- Missing override folder → `vault.createFolder` first.
- Write failure → `Notice` with the error and nothing inserted.
- Insert failure after a successful write → `Notice` that names the saved file path.
- Mobile photo is saved as-is (extension from MIME, falling back to `jpg`). `jpegQuality` applies only to desktop canvas encoding.

## Testing

- **Unit (vitest):** `naming.ts` (filename format, MIME → extension, override path resolution and de-duplication).
- **Build:** `tsc --noEmit` and the esbuild production build produce `main.js`.
- **Automated desktop E2E (this machine):** throwaway vault in the session scratchpad. Launch the installed Flatpak Obsidian 1.15.0 with `--remote-debugging-port`, enable the plugin, and drive it over CDP: right-click in a note → Take a picture → Capture → Insert. Assert the note contains the embed at the cursor and the image file exists in the expected folder. Run with the override both off and on. Screenshot the modal with a real webcam frame. Caveat: the Flatpak sandbox may block the camera or the debug port. If it does, report it rather than work around it.
- **Manual (user):** mobile (Android/iOS) via a synced vault. Desktop permission-denied path.

## Project scaffold

Based on `obsidianmd/obsidian-sample-plugin`: `manifest.json`, `package.json`, `tsconfig.json`, `esbuild.config.mjs`, `versions.json`, `styles.css` (modal layout), `README.md`.

## Out of scope

Camera picker, video, image compression for mobile photos, community-store submission.
