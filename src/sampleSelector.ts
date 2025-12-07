export class SampleSelector {
    private container: HTMLDivElement;
    private selectedSample: HTMLImageElement | null = null;
    private generatedTilesContainer: HTMLDivElement;
    private tilesCountLabel: HTMLDivElement;
    private previewCanvas: HTMLCanvasElement;
    private previewCtx: CanvasRenderingContext2D;
    private previewHighlight: { x: number; y: number; w: number; h: number } | null = null;
    private previewImg: HTMLImageElement | null = null;
  
    constructor(containerId: string, samples: string[]) {
      const el = document.getElementById(containerId);
      const previewEl = document.getElementById('sample-preview');
      const genTilesEl = document.getElementById('generated-tiles');
      const generateBtn = document.getElementById('generate-tiles') as HTMLButtonElement;
      const tileSizeInput = document.getElementById('tile-size') as HTMLInputElement;
      const tilesCountEl = document.getElementById('tiles-count');
  
      if (!el || !previewEl || !genTilesEl || !generateBtn || !tileSizeInput || !tilesCountEl) {
        throw new Error('Missing required elements');
      }
  
      this.container = el as HTMLDivElement;
      this.generatedTilesContainer = genTilesEl as HTMLDivElement;
      this.tilesCountLabel = tilesCountEl as HTMLDivElement;
  
      // Create preview canvas
      this.previewCanvas = document.createElement('canvas');
      this.previewCanvas.width = 200;
      this.previewCanvas.height = 200;
      this.previewCanvas.style.imageRendering = 'pixelated';
      previewEl.innerHTML = '';
      previewEl.appendChild(this.previewCanvas);
  
      const ctx = this.previewCanvas.getContext('2d');
      if (!ctx) throw new Error('Failed to get canvas context');
      this.previewCtx = ctx;
  
      // Generate tiles on button click
      generateBtn.addEventListener('click', () => {
        const tileSize = parseInt(tileSizeInput.value);
        this.generateOverlappingTiles(tileSize);
      });
  
      // Create sample previews
      this.createPreviews(samples);
    }
  
    private createPreviews(samples: string[]) {
      samples.forEach((src) => {
        const img = document.createElement('img');
        img.src = src;
        img.style.imageRendering = 'pixelated';
        img.style.margin = '5px';
        img.style.cursor = 'pointer';
  
        img.onload = () => {
          const maxPreviewSize = 64;
          const scale = Math.floor(maxPreviewSize / img.naturalWidth) || 1;
          img.width = img.naturalWidth * scale;
          img.height = img.naturalHeight * scale;
        };
  
        img.addEventListener('click', () => {
          this.selectedSample = img;
          this.highlightSelected(img);
  
          // Load preview image if not already
          if (!this.previewImg) {
            this.previewImg = new Image();
            this.previewImg.onload = () => this.drawPreview();
            this.previewImg.src = img.src;
          } else {
            this.previewImg.src = img.src;
          }
        });
  
        this.container.appendChild(img);
      });
    }
  
    private highlightSelected(img: HTMLImageElement) {
      this.container.querySelectorAll('img').forEach((el) => {
        (el as HTMLImageElement).style.border = '';
      });
      img.style.border = '2px solid red';
    }
  
    private drawPreview() {
      if (!this.previewImg || !this.previewCtx) return;
  
      const canvas = this.previewCanvas;
      const ctx = this.previewCtx;
  
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      ctx.imageSmoothingEnabled = false;
      ctx.drawImage(this.previewImg, 0, 0, canvas.width, canvas.height);
  
      if (this.previewHighlight) {
        const canvasWidth = canvas.width;
        const canvasHeight = canvas.height;
        const imgWidth = this.previewImg.naturalWidth;
        const imgHeight = this.previewImg.naturalHeight;
  
        const scaleX = canvasWidth / imgWidth;
        const scaleY = canvasHeight / imgHeight;
  
        ctx.strokeStyle = 'blue';
        ctx.lineWidth = 2;
  
        const x0 = this.previewHighlight.x % imgWidth;
        const y0 = this.previewHighlight.y % imgHeight;
        const w0 = Math.min(this.previewHighlight.w, imgWidth - x0);
        const h0 = Math.min(this.previewHighlight.h, imgHeight - y0);
  
        ctx.strokeRect(x0 * scaleX, y0 * scaleY, w0 * scaleX, h0 * scaleY);
  
        if (x0 + this.previewHighlight.w > imgWidth) {
          const wWrap = this.previewHighlight.w - w0;
          ctx.strokeRect(0, y0 * scaleY, wWrap * scaleX, h0 * scaleY);
        }
        if (y0 + this.previewHighlight.h > imgHeight) {
          const hWrap = this.previewHighlight.h - h0;
          ctx.strokeRect(x0 * scaleX, 0, w0 * scaleX, hWrap * scaleY);
        }
        if (x0 + this.previewHighlight.w > imgWidth && y0 + this.previewHighlight.h > imgHeight) {
          const wWrap = this.previewHighlight.w - w0;
          const hWrap = this.previewHighlight.h - h0;
          ctx.strokeRect(0, 0, wWrap * scaleX, hWrap * scaleY);
        }
      }
    }
  
    private generateOverlappingTiles(tileSize: number) {
      if (!this.selectedSample) return;
  
      const img = this.selectedSample;
      const width = img.naturalWidth;
      const height = img.naturalHeight;
  
      const mainCanvas = document.createElement('canvas');
      mainCanvas.width = width;
      mainCanvas.height = height;
      const mainCtx = mainCanvas.getContext('2d');
      if (!mainCtx) return;
      mainCtx.drawImage(img, 0, 0);
  
      this.generatedTilesContainer.innerHTML = '';
      let tileCount = 0;
      const seenTiles = new Set<string>();
      const tilesPerRow = 8;
      let rowDiv: HTMLDivElement | null = null;
  
      for (let y = 0; y < height; y++) {
        for (let x = 0; x < width; x++) {
          const tileCanvas = document.createElement('canvas');
          tileCanvas.width = tileSize * 16;
          tileCanvas.height = tileSize * 16;
          tileCanvas.style.imageRendering = 'pixelated';
          tileCanvas.style.border = '1px solid #ccc';
          const tileCtx = tileCanvas.getContext('2d');
          if (!tileCtx) continue;
  
          const tempCanvas = document.createElement('canvas');
          tempCanvas.width = tileSize;
          tempCanvas.height = tileSize;
          const tempCtx = tempCanvas.getContext('2d');
          if (!tempCtx) continue;
  
          for (let dy = 0; dy < tileSize; dy++) {
            for (let dx = 0; dx < tileSize; dx++) {
              const px = (x + dx) % width;
              const py = (y + dy) % height;
              const pixel = mainCtx.getImageData(px, py, 1, 1);
              tempCtx.putImageData(pixel, dx, dy);
            }
          }
  
          // Deduplication
          const tileData = tempCtx.getImageData(0, 0, tileSize, tileSize);
          let hash = '';
          for (let i = 0; i < tileData.data.length; i += 4) {
            hash += `${tileData.data[i]},${tileData.data[i + 1]},${tileData.data[i + 2]},${tileData.data[i + 3]};`;
          }
          if (seenTiles.has(hash)) continue;
          seenTiles.add(hash);
  
          tileCtx.imageSmoothingEnabled = false;
          tileCtx.drawImage(tempCanvas, 0, 0, tileCanvas.width, tileCanvas.height);
  
          // Wrap tiles into rows
          if (tileCount % tilesPerRow === 0) {
            rowDiv = document.createElement('div');
            rowDiv.style.display = 'flex';
            rowDiv.style.gap = '4px';
            this.generatedTilesContainer.appendChild(rowDiv);
          }
          rowDiv?.appendChild(tileCanvas);
          tileCount++;
  
          const tileX = x;
          const tileY = y;
          tileCanvas.addEventListener('mouseenter', () => {
            this.previewHighlight = { x: tileX, y: tileY, w: tileSize, h: tileSize };
            this.drawPreview();
          });
          tileCanvas.addEventListener('mouseleave', () => {
            this.previewHighlight = null;
            this.drawPreview();
          });
        }
      }
  
      this.tilesCountLabel.textContent = `Tiles: ${tileCount}`;
    }
  
    public getSelectedSample(): string | null {
      return this.selectedSample?.src || null;
    }
  }
  