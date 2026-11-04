import { spawn } from "node:child_process";
import { cpSync, existsSync, mkdirSync, readdirSync, rmSync, writeFileSync } from "node:fs";
import { join, resolve } from "node:path";
import { chromium } from "playwright-core";

const ROOT = resolve(import.meta.dirname, "..");
const E2E = join(ROOT, ".e2e");
const VAULT = join(E2E, "vault");
const USERDATA = join(E2E, "userdata");
const PORT = 9222;
const NOTE = "Note.md";
const EMBED = /!\[\[Photo \d{4}-\d{2}-\d{2} \d{6}(?: \d+)?\.jpg\]\]/g;

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

function prepareVault() {
	rmSync(E2E, { recursive: true, force: true });
	const pluginDir = join(VAULT, ".obsidian", "plugins", "camera-capture");
	mkdirSync(pluginDir, { recursive: true });
	mkdirSync(USERDATA, { recursive: true });
	for (const f of ["main.js", "manifest.json", "styles.css"]) cpSync(join(ROOT, f), join(pluginDir, f));
	writeFileSync(join(VAULT, NOTE), "alpha beta\n");
	writeFileSync(
		join(USERDATA, "obsidian.json"),
		JSON.stringify({ vaults: { e2ecameracapture: { path: VAULT, ts: Date.now(), open: true } } }),
	);
}

function launchObsidian() {
	const child = spawn(
		"flatpak",
		["run", "--device=all", "md.obsidian.Obsidian", `--user-data-dir=${USERDATA}`, `--remote-debugging-port=${PORT}`],
		{ detached: true, stdio: "ignore" },
	);
	child.unref();
	return child;
}

async function connect() {
	for (let i = 0; i < 60; i++) {
		try {
			const res = await fetch(`http://127.0.0.1:${PORT}/json/version`);
			if (res.ok) return chromium.connectOverCDP(`http://127.0.0.1:${PORT}`);
		} catch {}
		await sleep(500);
	}
	throw new Error(`Obsidian did not open the CDP port ${PORT} within 30 s`);
}

async function findVaultPage(browser) {
	for (let i = 0; i < 60; i++) {
		for (const ctx of browser.contexts()) {
			for (const page of ctx.pages()) {
				const ready = await page.evaluate(() => !!window.app?.workspace?.layoutReady).catch(() => false);
				if (ready) return page;
			}
		}
		await sleep(500);
	}
	throw new Error("Vault window never became ready");
}

const editorValue = (page) => page.evaluate(() => app.workspace.activeEditor.editor.getValue());
const photosIn = (dir) => (existsSync(dir) ? readdirSync(dir).filter((f) => /^Photo .*\.jpg$/.test(f)) : []);

async function rightClickAt(page, line, ch) {
	const { x, y } = await page.evaluate(
		([line, ch]) => {
			const editor = app.workspace.activeEditor.editor;
			const view = editor.cm;
			const pos = view.state.doc.line(line + 1).from + ch;
			const c = view.coordsAtPos(pos);
			return { x: c.left + 1, y: (c.top + c.bottom) / 2 };
		},
		[line, ch],
	);
	const item = page.locator(".menu .menu-item", { hasText: "Take a picture" });
	for (let attempt = 0; attempt < 3; attempt++) {
		await page.mouse.click(x, y, { button: "right" });
		try {
			await item.waitFor({ timeout: 3000 });
			return item.click();
		} catch {
			await page.keyboard.press("Escape");
			await sleep(500);
		}
	}
	throw new Error("Editor context menu never showed 'Take a picture'");
}

async function captureAndInsert(page, screenshot) {
	const modal = page.locator(".camera-capture-modal");
	await modal.waitFor();
	const error = modal.locator(".camera-capture-error");
	await page.waitForFunction(
		() => {
			const v = document.querySelector(".camera-capture-modal video");
			const e = document.querySelector(".camera-capture-modal .camera-capture-error");
			return (v && v.readyState >= 2) || (e && e.textContent);
		},
		null,
		{ timeout: 15000 },
	);
	if (await error.isVisible()) throw new Error(`Camera error in modal: ${await error.textContent()}`);
	await sleep(800);
	await modal.getByRole("button", { name: "Capture" }).click();
	if (screenshot) await page.screenshot({ path: screenshot });
	await modal.getByRole("button", { name: "Insert" }).click();
	await modal.waitFor({ state: "detached" });
	await sleep(300);
}

const cases = [
	[
		"menu, mid-line, attachment default",
		async (page) => {
			await page.evaluate(() => app.workspace.activeEditor.editor.setCursor({ line: 0, ch: 5 }));
			await rightClickAt(page, 0, 5);
			await captureAndInsert(page, join(E2E, "modal.png"));
			const text = await editorValue(page);
			if (!/^alpha!\[\[Photo \d{4}-\d{2}-\d{2} \d{6}\.jpg\]\] beta/.test(text)) throw new Error(`Note text: ${JSON.stringify(text)}`);
			const name = text.match(/Photo [^\]]+\.jpg/)[0];
			if (!existsSync(join(VAULT, name))) throw new Error(`Missing file at vault root: ${name}`);
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
			await rightClickAt(page, 0, at);
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
			const photos = photosIn(join(VAULT, "A", "B"));
			if (photos.length !== 1) throw new Error(`Expected 1 photo in A/B, found ${JSON.stringify(photos)}`);
			const text = await editorValue(page);
			if (!text.includes(`![[${photos[0]}]]`)) throw new Error(`Not linked: ${JSON.stringify(text)}`);
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
];

async function main() {
	prepareVault();
	const child = launchObsidian();
	let browser;
	let failed = 0;
	try {
		browser = await connect();
		const page = await findVaultPage(browser);
		await page.evaluate(async () => {
			app.plugins.setEnable(true);
			await app.plugins.loadManifests();
			await app.plugins.enablePluginAndSave("camera-capture");
		});
		const loaded = await page.evaluate(() => !!app.plugins.plugins["camera-capture"]);
		if (!loaded) throw new Error("Plugin did not load");
		await page.evaluate(async (note) => {
			await app.workspace.getLeaf(false).openFile(app.vault.getAbstractFileByPath(note));
		}, NOTE);
		await page.locator(".cm-content").waitFor();
		await sleep(1500);

		for (const [name, run] of cases) {
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
		console.log(`\n${cases.length - failed}/${cases.length} passed`);
	} catch (err) {
		failed = cases.length;
		console.log(`E2E setup failed: ${err.message}`);
	} finally {
		if (browser) {
			// Browser.close never acknowledges over Electron's CDP, so fire it and move on.
			const session = await browser.newBrowserCDPSession().catch(() => null);
			session?.send("Browser.close").catch(() => {});
			await sleep(1000);
		}
		try {
			process.kill(-child.pid, "SIGTERM");
		} catch {}
	}
	process.exit(failed ? 1 : 0);
}

main();
