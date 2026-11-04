import { App, Editor, EditorPosition, TFile } from "obsidian";
import { dedupePath, extensionForMime, photoFilename, resolveTargetPath } from "./naming";
import type { CameraCaptureSettings } from "./settings";

export async function savePhoto(
	app: App,
	settings: CameraCaptureSettings,
	blob: Blob,
	sourceFile: TFile,
): Promise<TFile> {
	const filename = photoFilename(new Date(), extensionForMime(blob.type));
	const overridePath = resolveTargetPath(settings.folderOverride, filename);
	let path: string;
	if (overridePath) {
		const folder = overridePath.slice(0, overridePath.lastIndexOf("/"));
		if (!app.vault.getAbstractFileByPath(folder)) await app.vault.createFolder(folder);
		path = dedupePath(overridePath, (p) => app.vault.getAbstractFileByPath(p) !== null);
	} else {
		path = await app.fileManager.getAvailablePathForAttachment(filename, sourceFile.path);
	}
	return app.vault.createBinary(path, await blob.arrayBuffer());
}

export function insertLink(
	app: App,
	editor: Editor,
	file: TFile,
	sourcePath: string,
	cursor: EditorPosition,
): void {
	const link = app.fileManager.generateMarkdownLink(file, sourcePath);
	editor.replaceRange(link.startsWith("!") ? link : `!${link}`, cursor);
}
