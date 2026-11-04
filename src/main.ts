import { Editor, Notice, Platform, Plugin, TFile } from "obsidian";
import { captureViaWebcam } from "./capture/desktop";
import { captureViaNativeCamera } from "./capture/mobile";
import { insertLink, savePhoto } from "./insert";
import { CameraCaptureSettingTab, CameraCaptureSettings, DEFAULT_SETTINGS } from "./settings";

const errorMessage = (err: unknown) => (err instanceof Error ? err.message : String(err));

export default class CameraCapturePlugin extends Plugin {
	settings: CameraCaptureSettings = { ...DEFAULT_SETTINGS };

	async onload() {
		await this.loadSettings();
		this.addSettingTab(new CameraCaptureSettingTab(this.app, this));

		this.registerEvent(
			this.app.workspace.on("editor-menu", (menu, editor, info) => {
				const file = info.file;
				if (!file) return;
				menu.addItem((item) =>
					item
						.setTitle("Take a picture")
						.setIcon("camera")
						.onClick(() => this.takePicture(editor, file)),
				);
			}),
		);

		this.addCommand({
			id: "take-picture",
			name: "Take a picture",
			icon: "camera",
			editorCallback: (editor, ctx) => {
				if (ctx.file) void this.takePicture(editor, ctx.file);
			},
		});
	}

	async takePicture(editor: Editor, file: TFile): Promise<void> {
		const cursor = editor.getCursor();
		const blob = Platform.isMobileApp
			? await captureViaNativeCamera()
			: await captureViaWebcam(this.app, this.settings.jpegQuality);
		if (!blob) return;

		let saved: TFile;
		try {
			saved = await savePhoto(this.app, this.settings, blob, file);
		} catch (err) {
			new Notice(`Couldn't save photo: ${errorMessage(err)}`);
			return;
		}

		try {
			insertLink(this.app, editor, saved, file.path, cursor);
		} catch {
			new Notice(`Photo saved to ${saved.path} but couldn't be inserted.`);
		}
	}

	async loadSettings() {
		this.settings = { ...DEFAULT_SETTINGS, ...(await this.loadData()) };
	}

	async saveSettings() {
		await this.saveData(this.settings);
	}
}
