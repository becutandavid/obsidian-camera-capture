import { App, Modal } from "obsidian";

const CAMERA_ERRORS: Record<string, string> = {
	NotAllowedError: "Camera access denied",
	NotFoundError: "No camera found",
	NotReadableError: "Camera is in use by another app",
};

function cameraErrorMessage(err: unknown): string {
	if (err instanceof Error) return CAMERA_ERRORS[err.name] ?? err.message;
	return String(err);
}

class CameraModal extends Modal {
	private stream: MediaStream | null = null;
	private closed = false;
	private settled = false;

	constructor(
		app: App,
		private jpegQuality: number,
		private resolve: (blob: Blob | null) => void,
	) {
		super(app);
	}

	onOpen(): void {
		this.titleEl.setText("Take a picture");
		this.modalEl.addClass("camera-capture-modal");
		const { contentEl } = this;

		const video = contentEl.createEl("video", { cls: "camera-capture-view" });
		video.autoplay = true;
		video.muted = true;
		video.playsInline = true;
		const canvas = contentEl.createEl("canvas", { cls: "camera-capture-view" });
		canvas.hide();
		const errorEl = contentEl.createDiv({ cls: "camera-capture-error" });
		errorEl.hide();

		const buttons = contentEl.createDiv({ cls: "camera-capture-buttons" });
		const captureBtn = buttons.createEl("button", { text: "Capture", cls: "mod-cta" });
		const retakeBtn = buttons.createEl("button", { text: "Retake" });
		const insertBtn = buttons.createEl("button", { text: "Insert", cls: "mod-cta" });
		captureBtn.disabled = true;
		retakeBtn.hide();
		insertBtn.hide();

		const showLive = () => {
			canvas.hide();
			video.show();
			retakeBtn.hide();
			insertBtn.hide();
			captureBtn.show();
		};

		video.addEventListener("loadedmetadata", () => (captureBtn.disabled = false));

		captureBtn.addEventListener("click", () => {
			canvas.width = video.videoWidth;
			canvas.height = video.videoHeight;
			canvas.getContext("2d")?.drawImage(video, 0, 0);
			video.hide();
			canvas.show();
			captureBtn.hide();
			retakeBtn.show();
			insertBtn.show();
		});

		retakeBtn.addEventListener("click", showLive);

		insertBtn.addEventListener("click", () => {
			insertBtn.disabled = true;
			canvas.toBlob(
				(blob) => {
					this.settle(blob);
					this.close();
				},
				"image/jpeg",
				this.jpegQuality,
			);
		});

		void this.startCamera(video, errorEl);
	}

	private async startCamera(video: HTMLVideoElement, errorEl: HTMLElement): Promise<void> {
		try {
			const stream = await navigator.mediaDevices.getUserMedia({ video: true, audio: false });
			if (this.closed) {
				stream.getTracks().forEach((t) => t.stop());
				return;
			}
			this.stream = stream;
			video.srcObject = stream;
		} catch (err) {
			if (this.closed) return;
			video.hide();
			errorEl.setText(cameraErrorMessage(err));
			errorEl.show();
		}
	}

	onClose(): void {
		this.closed = true;
		this.stream?.getTracks().forEach((t) => t.stop());
		this.stream = null;
		this.contentEl.empty();
		this.settle(null);
	}

	private settle(blob: Blob | null): void {
		if (this.settled) return;
		this.settled = true;
		this.resolve(blob);
	}
}

export function captureViaWebcam(app: App, jpegQuality: number): Promise<Blob | null> {
	return new Promise((resolve) => new CameraModal(app, jpegQuality, resolve).open());
}
