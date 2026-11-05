import { spawn } from "node:child_process";
import { cpSync, mkdirSync, rmSync, writeFileSync } from "node:fs";
import { join, resolve } from "node:path";
import { chromium } from "playwright-core";

export const ROOT = resolve(import.meta.dirname, "..");
export const E2E = join(ROOT, ".e2e");
const PORT = 9222;

export const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

/** Fresh vault + isolated Obsidian profile under .e2e/. The plugin is installed later by enablePluginAndOpen. */
export function prepareVault(vaultName, notes) {
	rmSync(E2E, { recursive: true, force: true });
	const vault = join(E2E, vaultName);
	const userdata = join(E2E, "userdata");
	mkdirSync(vault, { recursive: true });
	mkdirSync(userdata, { recursive: true });
	for (const [name, text] of Object.entries(notes)) writeFileSync(join(vault, name), text);
	writeFileSync(
		join(userdata, "obsidian.json"),
		JSON.stringify({ vaults: { e2ecameracapture: { path: vault, ts: Date.now(), open: true } } }),
	);
	return { vault, userdata };
}

/** Starts the Flatpak Obsidian; --device=all grants webcam access for this run only. */
export async function launchObsidian(userdata, extraArgs = []) {
	const child = spawn(
		"flatpak",
		[
			"run",
			"--device=all",
			"md.obsidian.Obsidian",
			`--user-data-dir=${userdata}`,
			`--remote-debugging-port=${PORT}`,
			...extraArgs,
		],
		{ detached: true, stdio: "ignore" },
	);
	child.unref();

	let browser;
	for (let i = 0; i < 60 && !browser; i++) {
		try {
			const res = await fetch(`http://127.0.0.1:${PORT}/json/version`);
			if (res.ok) browser = await chromium.connectOverCDP(`http://127.0.0.1:${PORT}`);
		} catch {}
		if (!browser) await sleep(500);
	}
	if (!browser) throw new Error(`Obsidian did not open the CDP port ${PORT} within 30 s`);

	const page = await findVaultPage(browser);
	const close = async () => {
		// Browser.close never acknowledges over Electron's CDP, so fire it and move on.
		const session = await browser.newBrowserCDPSession().catch(() => null);
		session?.send("Browser.close").catch(() => {});
		await sleep(1000);
		try {
			process.kill(-child.pid, "SIGTERM");
		} catch {}
	};
	return { browser, page, close };
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

// Installed after the vault is open: a vault that already contains plugins on first open
// shows a "Do you trust the author of this vault?" dialog that blocks every later modal.
export async function enablePluginAndOpen(page, vault, note) {
	const pluginDir = join(vault, ".obsidian", "plugins", "camera-capture");
	mkdirSync(pluginDir, { recursive: true });
	for (const f of ["main.js", "manifest.json", "styles.css"]) cpSync(join(ROOT, f), join(pluginDir, f));
	await page.evaluate(async () => {
		app.plugins.setEnable(true);
		await app.plugins.loadManifests();
		await app.plugins.enablePluginAndSave("camera-capture");
	});
	if (!(await page.evaluate(() => !!app.plugins.plugins["camera-capture"]))) throw new Error("Plugin did not load");
	await page.evaluate(async (note) => {
		await app.workspace.getLeaf(false).openFile(app.vault.getAbstractFileByPath(note));
	}, note);
	await page.locator(".cm-content").waitFor();
	await sleep(1500);
}

/** Right-clicks at a document position and returns the visible "Take a picture" menu item. */
export async function openContextMenu(page, line, ch) {
	const { x, y } = await page.evaluate(
		([line, ch]) => {
			const view = app.workspace.activeEditor.editor.cm;
			const c = view.coordsAtPos(view.state.doc.line(line + 1).from + ch);
			return { x: c.left + 1, y: (c.top + c.bottom) / 2 };
		},
		[line, ch],
	);
	await page.mouse.click(x, y, { button: "right" });
	const item = page.locator(".menu .menu-item", { hasText: "Take a picture" });
	await item.waitFor({ timeout: 5000 });
	return item;
}

/** Waits for a live frame (or a camera error) in the capture modal. */
export async function waitForLiveCamera(page) {
	const modal = page.locator(".camera-capture-modal");
	await modal.waitFor();
	await page.waitForFunction(
		() => {
			const v = document.querySelector(".camera-capture-modal video");
			const e = document.querySelector(".camera-capture-modal .camera-capture-error");
			return (v && v.readyState >= 2) || (e && e.textContent);
		},
		null,
		{ timeout: 15000 },
	);
	const error = modal.locator(".camera-capture-error");
	if (await error.isVisible()) throw new Error(`Camera error in modal: ${await error.textContent()}`);
	return modal;
}
