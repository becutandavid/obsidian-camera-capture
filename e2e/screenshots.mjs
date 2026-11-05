import { mkdirSync } from "node:fs";
import { join } from "node:path";
import { ROOT, enablePluginAndOpen, launchObsidian, openContextMenu, prepareVault, sleep, waitForLiveCamera } from "./harness.mjs";

// Regenerates the README images in assets/. Chromium's fake camera supplies a test pattern,
// so this works in any lighting; drop the two fake-camera flags to use your real webcam.
const ASSETS = join(ROOT, "assets");
const NOTE = "Plant experiment.md";
const TEXT = [
	"## Day 4",
	"",
	"Seedlings are about 3 cm tall. Moved the tray closer to the window this morning.",
	"",
	"",
	"",
	"Next check: Saturday.",
	"",
].join("\n");
const PHOTO_LINE = 4;

async function main() {
	mkdirSync(ASSETS, { recursive: true });
	const { vault, userdata } = prepareVault("Notebook", { [NOTE]: TEXT });
	const app = await launchObsidian(userdata, ["--use-fake-device-for-media-stream", "--use-fake-ui-for-media-stream"]);
	const { page } = app;
	try {
		await page.setViewportSize({ width: 1200, height: 900 });
		await sleep(800);
		await enablePluginAndOpen(page, vault, NOTE);
		await page.evaluate(() => {
			app.workspace.rightSplit.collapse();
			app.workspace.activeEditor.editor.setCursor({ line: 4, ch: 0 });
		});

		const item = await openContextMenu(page, PHOTO_LINE, 0);
		await item.hover();
		await sleep(300);
		await page.screenshot({ path: join(ASSETS, "menu.png") });
		console.log("wrote assets/menu.png");

		await item.click();
		const modal = await waitForLiveCamera(page);
		await sleep(1500);
		await page.screenshot({ path: join(ASSETS, "camera.png") });
		console.log("wrote assets/camera.png");

		await modal.getByRole("button", { name: "Capture" }).click();
		await modal.getByRole("button", { name: "Insert" }).click();
		await modal.waitFor({ state: "detached" });
		await page.evaluate(() => { const e = app.workspace.activeEditor.editor; e.setCursor({ line: e.lastLine(), ch: 0 }); });
		await sleep(1200);
		await page.screenshot({ path: join(ASSETS, "result.png") });
		console.log("wrote assets/result.png");
	} finally {
		await app.close();
	}
	process.exit(0);
}

main();
