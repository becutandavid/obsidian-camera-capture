# Desktop end-to-end test

`npm run e2e` builds the plugin, creates a throwaway vault in `.e2e/vault`, then launches the installed Obsidian Flatpak with a separate profile (`.e2e/userdata`) and a remote-debugging port. It drives the app with Playwright over CDP. Your real Obsidian profile and vaults are never touched.

Cases:

1. Right-click mid-line → Take a picture → Capture → Insert. The embed lands at the exact cursor column, and the file goes to Obsidian's attachment location.
2. Right-click on a selection. The selected text is kept and one embed is added.
3. Photo folder set to `A/B` (doesn't exist yet), triggered from the command. The photo lands in `A/B` and is linked.
4. Open the window, then press Esc immediately. Every camera track ends and the note is unchanged.

`.e2e/modal.png` is a screenshot of the review step with a real webcam frame.

## Requirements and caveats

- Obsidian installed as the Flatpak `md.obsidian.Obsidian`. Port 9222 must be free, and Obsidian must not already be running with that profile.
- The Flatpak's default permissions don't include the webcam (`devices=dri`). The runner passes `--device=all` **for that run only**, and your saved Flatpak permissions stay the same.
- The test vault is under the repo (inside `$HOME`) because the Flatpak can't see `/tmp`.
- An Obsidian window opens and the webcam light turns on during the run.
