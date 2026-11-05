# Contributing

Thanks for helping improve Camera Capture!

## Development setup

Requires Node.js 20 or later.

```sh
npm install
npm run dev     # rebuilds main.js on change
```

To try your changes, link or copy `main.js`, `manifest.json` and `styles.css` into `<test vault>/.obsidian/plugins/camera-capture/` and reload Obsidian. Use a test vault, not your main one.

## Project layout

| Path | Purpose |
|---|---|
| `src/main.ts` | Plugin entry: editor menu item, command, capture → save → insert flow |
| `src/capture/desktop.ts` | Webcam capture window (`getUserMedia`) |
| `src/capture/mobile.ts` | System camera via `<input capture>` |
| `src/insert.ts` | Saving the photo and inserting the embed |
| `src/naming.ts` | Pure filename and path helpers (unit-tested) |
| `src/settings.ts` | Settings and settings tab |
| `tests/` | Unit tests (vitest) |
| `e2e/` | Desktop end-to-end tests and README screenshots, driving a real Obsidian |

## Checks

```sh
npm run build   # type-check + production bundle
npm run lint    # eslint with eslint-plugin-obsidianmd (the rules used in plugin review)
npm test        # unit tests
npm run e2e     # desktop end-to-end tests, see e2e/README.md
```

CI runs build, lint and unit tests on every push and pull request.

### Manual checks

The end-to-end tests cover desktop only. Before a release, also check:

- [ ] Android: long-press → Take a picture → camera app opens → photo is embedded at the cursor
- [ ] iOS: same as Android
- [ ] Mobile: cancelling in the camera app leaves the note unchanged
- [ ] Desktop: with camera permission denied in the OS, the window shows "Camera access denied"
- [ ] With Markdown links (*Settings → Files and links → Use [[Wikilinks]]* off), the embed is `![](…)`

## Screenshots

`npm run screenshots` regenerates `assets/*.png` using Chromium's fake camera (a test pattern). See `e2e/screenshots.mjs` to use a real webcam instead.

## Releasing

1. Add the changes to `CHANGELOG.md`.
2. Run `npm version patch` (or `minor` / `major`). This updates `manifest.json`, `versions.json` and `package.json`, and creates a tag without a `v` prefix, as Obsidian requires.
3. Run `git push --follow-tags`.
4. The **Release Obsidian plugin** workflow builds the plugin and creates a draft release with `main.js`, `manifest.json` and `styles.css`. Add the changelog entry to the release notes and publish it.

If `minAppVersion` changes, update it in `manifest.json` before running `npm version`.
