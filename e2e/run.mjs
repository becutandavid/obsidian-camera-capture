import { existsSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { E2E, enablePluginAndOpen, launchObsidian, openContextMenu, prepareVault, sleep, waitForLiveCamera } from "./harness.mjs";

const NOTE = "Note.md";
const EMBED = /!\[\[Photo \d{4}-\d{2}-\d{2} \d{6}(?: \d+)?\.jpg\]\]/g;

const editorValue = (page) => page.evaluate(() => app.workspace.activeEditor.editor.getValue());
const photosIn = (dir) => (existsSync(dir) ? readdirSync(dir).filter((f) => /^Photo .*\.jpg$/.test(f)) : []);

async function captureAndInsert(page, screenshot) {
	const modal = await waitForLiveCamera(page);
	await sleep(800);
	await modal.getByRole("button", { name: "Capture" }).click();
	if (screenshot) await page.screenshot({ path: screenshot });
	await modal.getByRole("button", { name: "Insert" }).click();
	await modal.waitFor({ state: "detached" });
	await sleep(300);
}

const cases = (vault) => [
	[
		"menu, mid-line, attachment default",
		async (page) => {
			await page.evaluate(() => app.workspace.activeEditor.editor.setCursor({ line: 0, ch: 5 }));
			await (await openContextMenu(page, 0, 5)).click();
			await captureAndInsert(page, join(E2E, "modal.png"));
			const text = await editorValue(page);
			if (!/^alpha!\[\[Photo \d{4}-\d{2}-\d{2} \d{6}\.jpg\]\] beta/.test(text)) throw new Error(`Note text: ${JSON.stringify(text)}`);
			const name = text.match(/Photo [^\]]+\.jpg/)[0];
			if (!existsSync(join(vault, name))) throw new Error(`Missing file at vault root: ${name}`);
		},
	],
	[
		"selection preserved",
		async (page) => {
			const before = (await editorValue(page)).match(EMBED).length;
			const at = await page.evaluate(() => {
				const editor = app.workspace.activeEditor.editor;
				const ch = editor.getLine(0).lastIndexOf("beta");
				editor.setSelection({ line: 0, ch }, { line: 0, ch: ch + 4 });
				return ch + 2;
			});
			await (await openContextMenu(page, 0, at)).click();
			await captureAndInsert(page);
			const text = await editorValue(page);
			if (!text.includes("beta")) throw new Error(`Selected text was deleted: ${JSON.stringify(text)}`);
			if (text.match(EMBED).length !== before + 1) throw new Error(`Expected ${before + 1} embeds: ${JSON.stringify(text)}`);
		},
	],
	[
		"override nested folder",
		async (page) => {
			await page.evaluate(async () => {
				const plugin = app.plugins.plugins["camera-capture"];
				plugin.settings.folderOverride = "A/B";
				await plugin.saveSettings();
				const editor = app.workspace.activeEditor.editor;
				editor.focus();
				editor.setCursor({ line: editor.lastLine(), ch: 0 });
				app.commands.executeCommandById("camera-capture:take-picture");
			});
			await captureAndInsert(page);
			const photos = photosIn(join(vault, "A", "B"));
			if (photos.length !== 1) throw new Error(`Expected 1 photo in A/B, found ${JSON.stringify(photos)}`);
			const text = await editorValue(page);
			if (!text.includes(`![[${photos[0]}]]`)) throw new Error(`Not linked: ${JSON.stringify(text)}`);
		},
	],
	[
		"note switched during capture",
		async (page) => {
			const before = await page.evaluate(async () => {
				await app.vault.create("Other.md", "other note\n");
				const editor = app.workspace.activeEditor.editor;
				editor.focus();
				app.commands.executeCommandById("camera-capture:take-picture");
				return editor.getValue();
			});
			await page.locator(".camera-capture-modal").waitFor();
			await page.evaluate(() => app.workspace.getLeaf(false).openFile(app.vault.getAbstractFileByPath("Other.md")));
			await captureAndInsert(page);
			const other = await page.evaluate(() => app.workspace.activeEditor.editor.getValue());
			if (other !== "other note\n") throw new Error(`Embed went into the wrong note: ${JSON.stringify(other)}`);
			await page.evaluate(() => app.workspace.getLeaf(false).openFile(app.vault.getAbstractFileByPath("Note.md")));
			await sleep(300);
			if ((await editorValue(page)) !== before) throw new Error("Original note changed after switching away");
		},
	],
	[
		"Esc closes, no live tracks",
		async (page) => {
			const before = await editorValue(page);
			await page.evaluate(() => {
				window.__tracks = [];
				const md = navigator.mediaDevices;
				const original = md.getUserMedia.bind(md);
				md.getUserMedia = async (c) => {
					const s = await original(c);
					window.__tracks.push(...s.getTracks());
					return s;
				};
				app.workspace.activeEditor.editor.focus();
				app.commands.executeCommandById("camera-capture:take-picture");
			});
			await page.locator(".camera-capture-modal").waitFor();
			await page.keyboard.press("Escape");
			await sleep(3000);
			const tracks = await page.evaluate(() => window.__tracks.map((t) => t.readyState));
			if (tracks.length === 0) throw new Error("getUserMedia never resolved; cannot check tracks");
			if (tracks.some((s) => s !== "ended")) throw new Error(`Live tracks after close: ${tracks}`);
			if ((await editorValue(page)) !== before) throw new Error("Note changed after cancel");
		},
	],
	[
		"settings tab shows both settings and saves changes",
		async (page) => {
			await page.evaluate(() => {
				app.setting.open();
				app.setting.openTabById("camera-capture");
			});
			// Obsidian 1.15 opens settings in a popout window, i.e. a separate page; older versions use a modal.
			let settingsPage = page;
			for (let i = 0; i < 20; i++) {
				const popout = page
					.context()
					.browser()
					.contexts()
					.flatMap((c) => c.pages())
					.find((p) => p !== page && p.url() === "about:blank");
				if (popout && (await popout.title()).startsWith("Settings")) {
					settingsPage = popout;
					break;
				}
				await sleep(250);
			}
			const tab = settingsPage.locator(".vertical-tab-content");
			for (const name of ["Photo folder", "JPEG quality"]) {
				await tab.locator(".setting-item-name", { hasText: name }).waitFor({ timeout: 5000 });
			}
			const input = tab.locator(".setting-item", { hasText: "Photo folder" }).locator("input");
			await input.fill("Camera roll");
			await input.press("Tab");
			await sleep(500);
			const saved = await page.evaluate(async () => {
				const data = await app.plugins.plugins["camera-capture"].loadData();
				return data?.folderOverride;
			});
			await page.evaluate(() => app.setting.close());
			if (saved !== "Camera roll") throw new Error(`Folder setting not saved, got ${JSON.stringify(saved)}`);
		},
	],
];

async function main() {
	const { vault, userdata } = prepareVault("vault", { [NOTE]: "alpha beta\n" });
	let failed = 0;
	let total = 0;
	let app;
	try {
		app = await launchObsidian(userdata);
		const { page } = app;
		await enablePluginAndOpen(page, vault, NOTE);
		const all = cases(vault);
		total = all.length;
		for (const [name, run] of all) {
			try {
				await run(page);
				console.log(`PASS  ${name}`);
			} catch (err) {
				failed++;
				console.log(`FAIL  ${name}: ${err.message}`);
				await page.screenshot({ path: join(E2E, `fail-${name.replace(/\W+/g, "-")}.png`) }).catch(() => {});
				await page.keyboard.press("Escape").catch(() => {});
			}
		}
		console.log(`\n${total - failed}/${total} passed`);
	} catch (err) {
		failed = 1;
		console.log(`E2E setup failed: ${err.message}`);
	} finally {
		await app?.close();
	}
	process.exit(failed ? 1 : 0);
}

main();
