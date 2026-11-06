# Changelog

All notable changes to this project are documented here. The format follows [Keep a Changelog](https://keepachangelog.com/en/1.1.0/), and the project uses [Semantic Versioning](https://semver.org/).

## [Unreleased]

## [0.1.1]

### Changed

- Build: use Node's built-in `node:module` list instead of the `builtin-modules` package (flagged by the community directory review). No change to the plugin itself.

## [0.1.0]

First release.

### Added

- **Take a picture** in the editor's right-click menu and as a command.
- Desktop capture window with live preview, Capture, Retake and Insert.
- Mobile capture through the system camera app (Android and iOS).
- Photos saved to Obsidian's attachment location, or an optional photo folder (created if missing, never overwrites).
- Embeds follow the vault's wikilink or Markdown link preference.
- JPEG quality setting for desktop captures.
- Settings appear in Obsidian's settings search on 1.13 and later.

[Unreleased]: https://github.com/becutandavid/obsidian-camera-capture/compare/0.1.1...HEAD
[0.1.1]: https://github.com/becutandavid/obsidian-camera-capture/compare/0.1.0...0.1.1
[0.1.0]: https://github.com/becutandavid/obsidian-camera-capture/releases/tag/0.1.0
