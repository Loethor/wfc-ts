export class PreviewCanvas {
    private container: HTMLDivElement;
    private canvas: HTMLCanvasElement;
    private ctx: CanvasRenderingContext2D;
    private img: HTMLImageElement | null = null;
    private highlight: { x: number; y: number; w: number; h: number } | null = null;

    constructor(containerId: string) {
        const el = document.getElementById(containerId);
        if (!el) throw new Error('Missing preview container');
        this.container = el as HTMLDivElement;

        this.canvas = document.createElement('canvas');
        this.canvas.width = 200;
        this.canvas.height = 200;
        this.canvas.style.imageRendering = 'pixelated';
        this.container.innerHTML = '';
        this.container.appendChild(this.canvas);

        const ctx = this.canvas.getContext('2d');
        if (!ctx) throw new Error('Failed to get canvas context');
        this.ctx = ctx;
    }

    public showImage(img: HTMLImageElement) {
        this.img = img;
        this.draw();
    }

    public setHighlight(x: number, y: number, w: number, h: number) {
        this.highlight = { x, y, w, h };
        this.draw();
    }

    public clearHighlight() {
        this.highlight = null;
        this.draw();
    }

    private draw() {
        if (!this.img) return;
        const ctx = this.ctx;
        const canvas = this.canvas;

        ctx.clearRect(0, 0, canvas.width, canvas.height);
        ctx.imageSmoothingEnabled = false;
        ctx.drawImage(this.img, 0, 0, canvas.width, canvas.height);

        if (this.highlight) {
            const scaleX = canvas.width / this.img.naturalWidth;
            const scaleY = canvas.height / this.img.naturalHeight;

            ctx.strokeStyle = 'blue';
            ctx.lineWidth = 2;

            const x0 = this.highlight.x % this.img.naturalWidth;
            const y0 = this.highlight.y % this.img.naturalHeight;
            const w0 = Math.min(this.highlight.w, this.img.naturalWidth - x0);
            const h0 = Math.min(this.highlight.h, this.img.naturalHeight - y0);

            ctx.strokeRect(x0 * scaleX, y0 * scaleY, w0 * scaleX, h0 * scaleY);

            // Handle wrapping if needed
            if (x0 + this.highlight.w > this.img.naturalWidth) {
                const wWrap = this.highlight.w - w0;
                ctx.strokeRect(0, y0 * scaleY, wWrap * scaleX, h0 * scaleY);
            }
            if (y0 + this.highlight.h > this.img.naturalHeight) {
                const hWrap = this.highlight.h - h0;
                ctx.strokeRect(x0 * scaleX, 0, w0 * scaleX, hWrap * scaleY);
            }
            if (x0 + this.highlight.w > this.img.naturalWidth && y0 + this.highlight.h > this.img.naturalHeight) {
                const wWrap = this.highlight.w - w0;
                const hWrap = this.highlight.h - h0;
                ctx.strokeRect(0, 0, wWrap * scaleX, hWrap * scaleY);
            }
        }
    }
}
