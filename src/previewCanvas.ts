export interface Highlight {
    x: number;
    y: number;
    w: number;
    h: number;
  }
  
  export class PreviewCanvas {
    private container: HTMLDivElement;
    private canvas: HTMLCanvasElement;
    private ctx: CanvasRenderingContext2D;
    private image: HTMLImageElement | null = null;
    private highlight: Highlight | null = null;
  
    constructor(containerId: string) {
      const el = document.getElementById(containerId);
      if (!el) throw new Error('Missing preview container');
      this.container = el as HTMLDivElement;
  
      this.canvas = document.createElement('canvas');
      this.ctx = this.canvas.getContext('2d')!;
      this.canvas.style.imageRendering = 'pixelated';
      this.container.innerHTML = '';
      this.container.appendChild(this.canvas);
    }
  
    showImage(src: string) {
      if (!this.image) this.image = new Image();
      this.image.onload = () => this.draw();
      this.image.src = src;
    }
  
    setHighlight(highlight: Highlight | null) {
      this.highlight = highlight;
      this.draw();
    }
  
    private draw() {
        if (!this.image || !this.ctx) return;
      
        const canvas = this.canvas;
        const ctx = this.ctx;
      
        const displaySize = 200;
        canvas.width = displaySize;
        canvas.height = displaySize;
      
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        ctx.imageSmoothingEnabled = false;
        ctx.drawImage(this.image, 0, 0, canvas.width, canvas.height);
      
        if (!this.highlight) return;
      
        const { x, y, w, h } = this.highlight;
      
        const scaleX = canvas.width / this.image.naturalWidth;
        const scaleY = canvas.height / this.image.naturalHeight;
      
        const x0 = x % this.image.naturalWidth;
        const y0 = y % this.image.naturalHeight;
        const w0 = Math.min(w, this.image.naturalWidth - x0);
        const h0 = Math.min(h, this.image.naturalHeight - y0);
      
        ctx.strokeStyle = 'blue';
        ctx.lineWidth = 2;
        ctx.strokeRect(x0 * scaleX, y0 * scaleY, w0 * scaleX, h0 * scaleY);
      
        if (x0 + w > this.image.naturalWidth) {
          const wWrap = w - w0;
          ctx.strokeRect(0, y0 * scaleY, wWrap * scaleX, h0 * scaleY);
        }
        if (y0 + h > this.image.naturalHeight) {
          const hWrap = h - h0;
          ctx.strokeRect(x0 * scaleX, 0, w0 * scaleX, hWrap * scaleY);
        }
        if (x0 + w > this.image.naturalWidth && y0 + h > this.image.naturalHeight) {
          const wWrap = w - w0;
          const hWrap = h - h0;
          ctx.strokeRect(0, 0, wWrap * scaleX, hWrap * scaleY);
        }
      }      
  }
  