export function captureViaNativeCamera(): Promise<Blob | null> {
	return new Promise((resolve) => {
		const input = document.createElement("input");
		input.type = "file";
		input.accept = "image/*";
		input.setAttribute("capture", "environment");
		input.style.display = "none";
		const finish = (blob: Blob | null) => {
			input.remove();
			resolve(blob);
		};
		input.addEventListener("change", () => finish(input.files?.[0] ?? null), { once: true });
		input.addEventListener("cancel", () => finish(null), { once: true });
		document.body.appendChild(input);
		input.click();
	});
}
