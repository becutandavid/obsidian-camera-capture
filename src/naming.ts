const MIME_EXTENSIONS: Record<string, string> = {
	"image/jpeg": "jpg",
	"image/png": "png",
	"image/heic": "heic",
	"image/heif": "heif",
	"image/webp": "webp",
	"image/gif": "gif",
};

const pad = (n: number) => String(n).padStart(2, "0");

export function photoFilename(date: Date, ext: string): string {
	const day = `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
	const time = `${pad(date.getHours())}${pad(date.getMinutes())}${pad(date.getSeconds())}`;
	return `Photo ${day} ${time}.${ext}`;
}

export function extensionForMime(mime: string): string {
	return MIME_EXTENSIONS[mime.toLowerCase()] ?? "jpg";
}

export function resolveTargetPath(folderOverride: string, filename: string): string | null {
	const folder = folderOverride.split("/").map((s) => s.trim()).filter(Boolean).join("/");
	return folder ? `${folder}/${filename}` : null;
}

export function dedupePath(path: string, exists: (p: string) => boolean): string {
	if (!exists(path)) return path;
	const slash = path.lastIndexOf("/");
	const dot = path.lastIndexOf(".");
	const hasExt = dot > slash + 1;
	const stem = hasExt ? path.slice(0, dot) : path;
	const ext = hasExt ? path.slice(dot) : "";
	for (let i = 1; ; i++) {
		const candidate = `${stem} ${i}${ext}`;
		if (!exists(candidate)) return candidate;
	}
}
