import { describe, expect, it } from "vitest";
import { dedupePath, extensionForMime, photoFilename, resolveTargetPath } from "../src/naming";

describe("photoFilename", () => {
	it("formats local time zero-padded", () => {
		expect(photoFilename(new Date(2026, 10, 5, 9, 3, 7), "jpg")).toBe("Photo 2026-11-05 090307.jpg");
	});
});

describe("extensionForMime", () => {
	it("maps known image types", () => {
		expect(extensionForMime("image/jpeg")).toBe("jpg");
		expect(extensionForMime("image/png")).toBe("png");
		expect(extensionForMime("image/heic")).toBe("heic");
		expect(extensionForMime("image/webp")).toBe("webp");
	});

	it("falls back to jpg for empty or unknown types", () => {
		expect(extensionForMime("")).toBe("jpg");
		expect(extensionForMime("application/octet-stream")).toBe("jpg");
	});
});

describe("resolveTargetPath", () => {
	it("returns null for a blank override", () => {
		expect(resolveTargetPath("", "a.jpg")).toBeNull();
		expect(resolveTargetPath("   ", "a.jpg")).toBeNull();
	});

	it("normalizes slashes in the override folder", () => {
		expect(resolveTargetPath("Camera", "a.jpg")).toBe("Camera/a.jpg");
		expect(resolveTargetPath("/Camera/", "a.jpg")).toBe("Camera/a.jpg");
		expect(resolveTargetPath("A//B/", "a.jpg")).toBe("A/B/a.jpg");
	});

	it("treats Windows backslashes as folder separators", () => {
		expect(resolveTargetPath("Camera\\Phone\\", "a.jpg")).toBe("Camera/Phone/a.jpg");
	});
});

describe("dedupePath", () => {
	const taken = new Set(["C/Photo x.jpg", "C/Photo x 1.jpg"]);

	it("appends the first free numeric suffix before the extension", () => {
		expect(dedupePath("C/Photo x.jpg", (p) => taken.has(p))).toBe("C/Photo x 2.jpg");
	});

	it("keeps a free path unchanged", () => {
		expect(dedupePath("C/new.jpg", (p) => taken.has(p))).toBe("C/new.jpg");
	});
});
