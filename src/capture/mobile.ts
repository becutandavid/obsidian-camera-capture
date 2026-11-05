const INPUT_CLASS = "camera-capture-input";

export function captureViaNativeCamera(): Promise<Blob | null> {
	// WebViews without the `cancel` event never settle a dismissed picker; drop those stale inputs.
	activeDocument.querySelectorAll(`.${INPUT_CLASS}`).forEach((el) => el.remove());

	return new Promise((resolve) => {
		const input = activeDocument.body.createEl("input", {
			type: "file",
			cls: INPUT_CLASS,
			attr: { accept: "image/*", capture: "environment" },
		});
		const finish = (blob: Blob | null) => {
			input.remove();
			resolve(blob);
		};
		input.addEventListener("change", () => finish(input.files?.[0] ?? null), { once: true });
		input.addEventListener("cancel", () => finish(null), { once: true });
		input.click();
	});
}
