# Camera Capture Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** An Obsidian plugin whose editor context menu item "Take a picture" captures a photo (webcam on desktop, native camera on mobile), saves it to the vault, and embeds it at the cursor.

**Architecture:** A thin plugin entry wires the `editor-menu` item and a command to one of two capture functions (selected by `Platform.isMobileApp`). Both return a `Blob | null` that a shared save/insert module writes and links. Naming and path logic are pure functions, unit-tested with vitest. Everything that touches Obsidian is verified by a CDP-driven end-to-end run against the locally installed Obsidian.

**Tech Stack:** TypeScript, `obsidian` API typings (1.14.x), esbuild (sample-plugin config), vitest, playwright-core (E2E over CDP only).

**Spec:** `docs/superpowers/specs/2026-11-05-obsidian-camera-capture-design.md`

## Global Constraints

- Plugin id `camera-capture`, name `Camera Capture`, `minAppVersion` `1.5.7`, `isDesktopOnly: false`.
- Menu item and command title: exactly `Take a picture`, icon `camera`. Command id `take-picture`.
- Filename format: `Photo YYYY-MM-DD HHmmss.<ext>` (local time, zero-padded).
- Settings: `{ folderOverride: string; jpegQuality: number }`, defaults `""` and `0.9`.
- Desktop encodes JPEG with `canvas.toBlob(cb, "image/jpeg", jpegQuality)`. Mobile blobs are saved unchanged.
- No imports from `obsidian` in `src/naming.ts` (it must run under vitest).
- **Commit locally only, never push.** Each "Stage the files" step means `git add` the task's files and make a local commit.
- E2E artifacts (test vault, Electron user-data dir, screenshots) live under `.e2e/`, which is git-ignored. Never touch the user's real Obsidian config or vaults.

## Review Focus

1. **Text selected when right-clicking.** The embed is inserted at the cursor and the selected text is not deleted. Pinned by an E2E case in Task 4.
2. **Cursor mid-line.** The embed is inserted exactly at the cursor column, with surrounding text intact. Pinned by an E2E case in Task 4.
3. **Override folder written as `Camera/`, `/Camera/`, or a missing nested path like `A/B`.** The path is normalized, folders are created, and the photo lands there. Pinned by `resolveTargetPath` unit tests (Task 1) and an E2E case with `A/B` (Task 4).
4. **Two captures in the same second into the override folder.** The second file is named `Photo … 1.jpg`, and nothing is overwritten. Pinned by the `dedupePath` unit test (Task 1).
5. **Modal closed (Esc) before or while the webcam stream starts.** No camera track is left running. Pinned by an E2E case that wraps `getUserMedia` and asserts that every track has `readyState === "ended"` after close (Task 4).

---

### Task 1: Scaffold and pure naming module

**Files:**
- Create: `package.json`, `tsconfig.json`, `esbuild.config.mjs`, `manifest.json`, `versions.json`, `.gitignore`, `src/main.ts` (empty `Plugin` subclass for now), `styles.css` (empty)
- Create: `src/naming.ts`
- Test: `tests/naming.test.ts`

**Interfaces:**
- Produces:
  - `photoFilename(date: Date, ext: string): string`
  - `extensionForMime(mime: string): string`
  - `resolveTargetPath(folderOverride: string, filename: string): string | null` returns `null` when the override is blank or whitespace. Otherwise returns `"<normalized folder>/<filename>"`, with leading and trailing slashes trimmed and repeated slashes collapsed.
  - `dedupePath(path: string, exists: (p: string) => boolean): string`

- [ ] **Step 1: Scaffold.** Copy the configs from `obsidianmd/obsidian-sample-plugin`: esbuild entry `src/main.ts`, output `main.js`, external `obsidian`, `electron` and `@codemirror/*`. Dev deps: `obsidian`, `typescript`, `esbuild`, `tslib`, `@types/node`, `vitest`, `builtin-modules`. Scripts: `dev`, `build` (`tsc -noEmit -skipLibCheck && node esbuild.config.mjs production`), `test` (`vitest run`). `.gitignore`: `node_modules/`, `main.js`, `.e2e/`. Fill in `manifest.json` from the Global Constraints. `versions.json` is `{"0.1.0": "1.5.7"}`. Run `npm install`.

- [ ] **Step 2: Write failing tests** in `tests/naming.test.ts`:

```ts
expect(photoFilename(new Date(2026, 10, 5, 9, 3, 7), "jpg")).toBe("Photo 2026-11-05 090307.jpg");
expect(extensionForMime("image/jpeg")).toBe("jpg");
expect(extensionForMime("image/png")).toBe("png");
expect(extensionForMime("image/heic")).toBe("heic");
expect(extensionForMime("image/webp")).toBe("webp");
expect(extensionForMime("")).toBe("jpg");
expect(extensionForMime("application/octet-stream")).toBe("jpg");
expect(resolveTargetPath("", "a.jpg")).toBeNull();
expect(resolveTargetPath("   ", "a.jpg")).toBeNull();
expect(resolveTargetPath("Camera", "a.jpg")).toBe("Camera/a.jpg");
expect(resolveTargetPath("/Camera/", "a.jpg")).toBe("Camera/a.jpg");
expect(resolveTargetPath("A//B/", "a.jpg")).toBe("A/B/a.jpg");
const taken = new Set(["C/Photo x.jpg", "C/Photo x 1.jpg"]);
expect(dedupePath("C/Photo x.jpg", p => taken.has(p))).toBe("C/Photo x 2.jpg");
expect(dedupePath("C/new.jpg", p => taken.has(p))).toBe("C/new.jpg");
```

- [ ] **Step 3: Run `npm test`.** Expected: FAIL, module not found.
- [ ] **Step 4: Implement `src/naming.ts`.** The suffix is inserted before the last `.` of the basename.
- [ ] **Step 5: Run `npm test && npm run build`.** Expected: all tests pass and `main.js` is produced.
- [ ] **Step 6: Stage the files.**

### Task 2: Settings, save/insert, menu wiring, mobile capture

**Files:**
- Create: `src/settings.ts`, `src/insert.ts`, `src/capture/mobile.ts`
- Modify: `src/main.ts`

**Interfaces:**
- Consumes: everything from Task 1's `naming.ts`.
- Produces:
  - `interface CameraCaptureSettings { folderOverride: string; jpegQuality: number }`, `DEFAULT_SETTINGS`, `class CameraCaptureSettingTab extends PluginSettingTab`
  - `savePhoto(app: App, settings: CameraCaptureSettings, blob: Blob, sourceFile: TFile): Promise<TFile>`
  - `insertLink(app: App, editor: Editor, file: TFile, sourcePath: string, cursor: EditorPosition): void`
  - `captureViaNativeCamera(): Promise<Blob | null>`
  - `CameraCapturePlugin` exposes `settings` and `takePicture(editor: Editor, file: TFile): Promise<void>`. The E2E test calls `takePicture` directly through `app.plugins.plugins["camera-capture"]`.

- [ ] **Step 1: `settings.ts`.** The setting tab has a text field labelled "Photo folder" (description: "Leave empty to use Obsidian's attachment location.") and a slider labelled "JPEG quality" from 0.5 to 1, step 0.05. Both save on change.
- [ ] **Step 2: `insert.ts`.** `savePhoto` builds the filename with `photoFilename(new Date(), extensionForMime(blob.type))`. If `resolveTargetPath` returns a path, it creates the folder with `vault.createFolder` when `getAbstractFileByPath(folder)` is null, then runs `dedupePath` using `vault.getAbstractFileByPath`. Otherwise it uses `fileManager.getAvailablePathForAttachment(filename, sourceFile.path)`. It writes with `vault.createBinary`. `insertLink` inserts `"!" + fileManager.generateMarkdownLink(file, sourcePath)` with `editor.replaceRange(text, cursor)`. The text is inserted, never replacing a selection.
- [ ] **Step 3: `capture/mobile.ts`.** Create an `<input type="file" accept="image/*" capture="environment">` and append it hidden to `document.body`. Resolve on `change` (`files[0] ?? null`) or `null` on `cancel`, remove the element, then call `.click()`.
- [ ] **Step 4: `main.ts`.** In `onload`, load the settings and add the setting tab. Register `editor-menu` to add the item when `info.file` is set. Add `addCommand({ id: "take-picture", name: "Take a picture", icon: "camera", editorCallback })`. Both call `takePicture`, which:
  1. Snapshots `editor.getCursor()` **first**.
  2. Picks `Platform.isMobileApp ? captureViaNativeCamera() : captureViaWebcam(this.app, this.settings.jpegQuality)`. Until Task 3, desktop also uses the mobile function.
  3. Returns if the blob is `null`.
  4. Calls `savePhoto`. On error, shows `new Notice("Couldn't save photo: " + msg)`.
  5. Calls `insertLink`. On error, shows `new Notice("Photo saved to " + file.path + " but couldn't be inserted.")`.
- [ ] **Step 5: Run `npm test && npm run build`.** Expected: PASS, no type errors.
- [ ] **Step 6: Stage the files.**

### Task 3: Desktop webcam modal

**Files:**
- Create: `src/capture/desktop.ts`
- Modify: `src/main.ts` (switch the desktop path), `styles.css`

**Interfaces:**
- Produces: `captureViaWebcam(app: App, jpegQuality: number): Promise<Blob | null>`, backed by `class CameraModal extends Modal`.

- [ ] **Step 1: Implement `CameraModal`.** The title is "Take a picture". `onOpen` shows a `<video autoplay playsinline muted>` and calls `getUserMedia({ video: true, audio: false })`.
  - **Live state:** a **Capture** button, disabled until the video emits `loadedmetadata`.
  - **Review state:** the `<canvas>` still replaces the video, with a **Retake** button (back to live) and an **Insert** button (mod-cta, `toBlob` → resolve).
  - **Errors:** map them to the spec's messages in a `.camera-capture-error` element. `NotAllowedError` → "Camera access denied", `NotFoundError` → "No camera found", `NotReadableError` → "Camera is in use by another app", anything else → `err.message`.
  - **Close:** `onClose` stops every track and resolves `null` if nothing was resolved yet. If `getUserMedia` resolves **after** close, stop its tracks immediately (Review Focus 5).
- [ ] **Step 2: Style it in `styles.css`.** The video and canvas are `width: 100%`, `max-height: 60vh`, `object-fit: contain`. The buttons sit in a right-aligned flex row.
- [ ] **Step 3: Switch the desktop branch** in `takePicture` to `captureViaWebcam`.
- [ ] **Step 4: Run `npm test && npm run build`.** Expected: PASS.
- [ ] **Step 5: Stage the files.**

### Task 4: Desktop end-to-end run on the installed Obsidian

**Files:**
- Create: `e2e/run.mjs`, `e2e/README.md` (how to run it, plus the Flatpak caveats)
- Modify: `package.json` (dev dep `playwright-core`, script `e2e`: `npm run build && node e2e/run.mjs`)

**Interfaces:**
- Consumes: `app.plugins.plugins["camera-capture"]` with `settings` and `takePicture` (Task 2), plus the modal's buttons, found by their text `Capture`, `Retake` and `Insert` (Task 3).

- [ ] **Step 1: Prepare the vault.**
  - Wipe and create `.e2e/vault` containing `Note.md` with the text `alpha beta\n`. Copy `main.js`, `manifest.json` and `styles.css` into `.e2e/vault/.obsidian/plugins/camera-capture/`. Write `.obsidian/community-plugins.json` containing `["camera-capture"]`.
  - Write `.e2e/userdata/obsidian.json` registering the vault with `open: true`.
  - Launch Obsidian, detached: `flatpak run --device=all md.obsidian.Obsidian --user-data-dir=<abs .e2e/userdata> --remote-debugging-port=9222`.
- [ ] **Step 2: Connect and enable the plugin.** Poll `http://127.0.0.1:9222/json/version`, then `chromium.connectOverCDP`. Through `page.evaluate`, turn off restricted mode (`app.plugins.setEnable(true)`), run `await app.plugins.enablePluginAndSave("camera-capture")`, and open `Note.md`.
- [ ] **Step 3: Case "menu, mid-line, attachment default".**
  1. Place the cursor at line 0, ch 5 (between `alpha` and ` beta`).
  2. Right-click in `.cm-content` at that spot, then click the menu item `Take a picture`.
  3. Wait for the `video` to have `readyState >= 2`, click **Capture**, screenshot to `.e2e/modal.png`, then click **Insert**.
  4. Assert: `Note.md` on disk matches `/^alpha!\[\[Photo \d{4}-\d{2}-\d{2} \d{6}\.jpg\]\] beta/`, and the file exists at the vault root (Obsidian's default attachment location).
- [ ] **Step 4: Case "selection preserved".** Select `beta` and run `takePicture` from the right-click menu. Assert the text still contains `beta` and one more embed was added.
- [ ] **Step 5: Case "override nested folder".** Set `settings.folderOverride = "A/B"`, capture through the command `camera-capture:take-picture`, and assert that `A/B/Photo …jpg` exists and is linked.
- [ ] **Step 6: Case "Esc closes, no live tracks".** Use `page.evaluate` to wrap `navigator.mediaDevices.getUserMedia` so it records the returned tracks in `window.__tracks`. Open the modal, then immediately press `Escape`. After 1 s, assert that every recorded track has `readyState === "ended"` and that the note is unchanged.
- [ ] **Step 7: Clean up.** Close Obsidian with `browser.close()`, kill the launched process, and print PASS/FAIL per case. If the camera or the CDP port is unavailable, exit with a clear message that names the cause. Don't work around it.
- [ ] **Step 8: Run `npm run e2e`.** Expected: 4/4 PASS and `.e2e/modal.png` shows a real webcam frame.
- [ ] **Step 9: Write `README.md`** covering what the plugin does, installation (copy the 3 files into `.obsidian/plugins/camera-capture/`), the settings, the mobile manual-test checklist from the spec, and the E2E instructions. Stage all the files.
