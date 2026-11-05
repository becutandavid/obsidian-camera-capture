import { App, PluginSettingTab, Setting, SettingDefinitionItem } from "obsidian";
import type CameraCapturePlugin from "./main";

export interface CameraCaptureSettings {
	folderOverride: string;
	jpegQuality: number;
}

export const DEFAULT_SETTINGS: CameraCaptureSettings = {
	folderOverride: "",
	jpegQuality: 0.9,
};

const FOLDER_NAME = "Photo folder";
const FOLDER_DESC = "Leave empty to use Obsidian's attachment location.";
const QUALITY_NAME = "JPEG quality";
const QUALITY_DESC = "Applies to desktop webcam captures.";
const QUALITY = { min: 0.5, max: 1, step: 0.05 };

// Obsidian 1.13+ uses getSettingDefinitions() (searchable settings); older versions fall back to display().
export class CameraCaptureSettingTab extends PluginSettingTab {
	constructor(
		app: App,
		private plugin: CameraCapturePlugin,
	) {
		super(app, plugin);
	}

	getSettingDefinitions(): SettingDefinitionItem[] {
		return [
			{
				name: FOLDER_NAME,
				desc: FOLDER_DESC,
				control: { type: "folder", key: "folderOverride", placeholder: "Camera" },
			},
			{
				name: QUALITY_NAME,
				desc: QUALITY_DESC,
				control: { type: "slider", key: "jpegQuality", ...QUALITY },
			},
		];
	}

	display(): void {
		const { containerEl } = this;
		containerEl.empty();

		new Setting(containerEl)
			.setName(FOLDER_NAME)
			.setDesc(FOLDER_DESC)
			.addText((text) =>
				text
					.setPlaceholder("Camera")
					.setValue(this.plugin.settings.folderOverride)
					.onChange(async (value) => {
						this.plugin.settings.folderOverride = value;
						await this.plugin.saveSettings();
					}),
			);

		new Setting(containerEl)
			.setName(QUALITY_NAME)
			.setDesc(QUALITY_DESC)
			.addSlider((slider) =>
				slider
					.setLimits(QUALITY.min, QUALITY.max, QUALITY.step)
					.setValue(this.plugin.settings.jpegQuality)
					.onChange(async (value) => {
						this.plugin.settings.jpegQuality = value;
						await this.plugin.saveSettings();
					}),
			);
	}
}
