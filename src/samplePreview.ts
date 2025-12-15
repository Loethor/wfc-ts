import { CONFIG } from './config';

export interface Highlight {
    x: number;
    y: number;
    w: number;
    h: number;
  }
  
  export class SamplePreview {
    private container: HTMLDivElement;
    private canvas: HTMLCanvasElement;
    private ctx: CanvasRenderingContext2D;
    private image: HTMLImageElement | null = null;
    private highlight: Highlight | null = null;
    private sizeLabel: HTMLDivElement;
  
    constructor(containerId: string) {
      const el = document.getElementById(containerId);
      if (!el) throw new Error('Missing preview container');
      this.container = el as HTMLDivElement;

      this.canvas = document.createElement('canvas');
      const ctx = this.canvas.getContext('2d');
      if (!ctx) throw new Error('Failed to get 2D rendering context');
      this.ctx = ctx;
      this.canvas.style.imageRendering = 'pixelated';
      this.container.innerHTML = '';
      this.container.appendChild(this.canvas);

      // Add a label for pixel size
      this.sizeLabel = document.createElement('div');
      this.sizeLabel.style.fontSize = '0.9em';
      this.sizeLabel.style.color = '#6c757d';
      this.sizeLabel.style.marginTop = '6px';
      this.sizeLabel.style.textAlign = 'center';
      this.container.appendChild(this.sizeLabel);
    }
  
    showImage(src: string) {
      if (!this.image) this.image = new Image();
      this.image.onload = () => {
        this.draw();
        // Show pixel size
        this.sizeLabel.textContent = `${this.image!.naturalWidth} × ${this.image!.naturalHeight} px`;
      };
      this.image.onerror = () => {
        console.error(`Failed to load preview image: ${src}`);
        this.sizeLabel.textContent = '';
        alert('Failed to load the selected image. Please try another one.');
      };
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
    
      const displaySize = CONFIG.ui.samplePreviewSize;
      canvas.width = displaySize;
      canvas.height = displaySize;
    
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      ctx.imageSmoothingEnabled = false;
    
      const imgW = this.image.naturalWidth;
      const imgH = this.image.naturalHeight;
    
      const scale = Math.min(
        canvas.width / imgW,
        canvas.height / imgH
      );
    
      const drawW = imgW * scale;
      const drawH = imgH * scale;
    
      const offsetX = (canvas.width - drawW) / 2;
      const offsetY = (canvas.height - drawH) / 2;
    
      ctx.drawImage(this.image, offsetX, offsetY, drawW, drawH);
    
      if (!this.highlight) return;
    
      const { x, y, w, h } = this.highlight;
    
      const x0 = x % imgW;
      const y0 = y % imgH;
    
      const w0 = Math.min(w, imgW - x0);
      const h0 = Math.min(h, imgH - y0);
    
      ctx.strokeStyle = 'blue';
      ctx.lineWidth = 2;
    
      ctx.strokeRect(
        offsetX + x0 * scale,
        offsetY + y0 * scale,
        w0 * scale,
        h0 * scale
      );
    
      if (x0 + w > imgW) {
        const wWrap = w - w0;
        ctx.strokeRect(
          offsetX,
          offsetY + y0 * scale,
          wWrap * scale,
          h0 * scale
        );
      }
    
      if (y0 + h > imgH) {
        const hWrap = h - h0;
        ctx.strokeRect(
          offsetX + x0 * scale,
          offsetY,
          w0 * scale,
          hWrap * scale
        );
      }
    
      if (x0 + w > imgW && y0 + h > imgH) {
        const wWrap = w - w0;
        const hWrap = h - h0;
        ctx.strokeRect(
          offsetX,
          offsetY,
          wWrap * scale,
          hWrap * scale
        );
      }
    }    
  }
  