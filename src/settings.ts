import { App, PluginSettingTab, Setting } from "obsidian";
import type CameraCapturePlugin from "./main";

export interface CameraCaptureSettings {
	folderOverride: string;
	jpegQuality: number;
}

export const DEFAULT_SETTINGS: CameraCaptureSettings = {
	folderOverride: "",
	jpegQuality: 0.9,
};

export class CameraCaptureSettingTab extends PluginSettingTab {
	constructor(app: App, private plugin: CameraCapturePlugin) {
		super(app, plugin);
	}

	display(): void {
		const { containerEl } = this;
		containerEl.empty();

		new Setting(containerEl)
			.setName("Photo folder")
			.setDesc("Leave empty to use Obsidian's attachment location.")
			.addText((text) =>
				text
					.setPlaceholder("e.g. Camera")
					.setValue(this.plugin.settings.folderOverride)
					.onChange(async (value) => {
						this.plugin.settings.folderOverride = value;
						await this.plugin.saveSettings();
					}),
			);

		new Setting(containerEl)
			.setName("JPEG quality")
			.setDesc("Applies to desktop webcam captures.")
			.addSlider((slider) =>
				slider
					.setLimits(0.5, 1, 0.05)
					.setValue(this.plugin.settings.jpegQuality)
					.setDynamicTooltip()
					.onChange(async (value) => {
						this.plugin.settings.jpegQuality = value;
						await this.plugin.saveSettings();
					}),
			);
	}
}
