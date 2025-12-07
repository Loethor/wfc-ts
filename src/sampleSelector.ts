export class SampleSelector {
    private container: HTMLDivElement;
    private selectedSample: HTMLImageElement | null = null;
    private previewContainer: HTMLDivElement;
    private generatedTilesContainer: HTMLDivElement;
    private tilesCountLabel: HTMLDivElement;



    constructor(containerId: string, samples: string[]) {
        const el = document.getElementById(containerId);
        const previewEl = document.getElementById('sample-preview');
        
        if (!el || !previewEl) throw new Error('Missing containers');
        this.container = el as HTMLDivElement;
        this.previewContainer = previewEl as HTMLDivElement;
        
        const genTilesEl = document.getElementById('generated-tiles');
        if (!genTilesEl) throw new Error('Missing generated-tiles container');
        this.generatedTilesContainer = genTilesEl as HTMLDivElement;
        
        const generateBtn = document.getElementById('generate-tiles') as HTMLButtonElement;
        const tileSizeInput = document.getElementById('tile-size') as HTMLInputElement;
        
        generateBtn.addEventListener('click', () => {
            const tileSize = parseInt(tileSizeInput.value);
            this.generateOverlappingTiles(tileSize);
        });

        const tilesCountEl = document.getElementById('tiles-count');
        if (!tilesCountEl) throw new Error('Missing tiles count label');
        this.tilesCountLabel = tilesCountEl as HTMLDivElement;

        this.createPreviews(samples);
    }
  
    private createPreviews(samples: string[]) {
        samples.forEach((src) => {
            const img = document.createElement('img');
        
            img.src = src;
        
            // Pixel-art friendly rendering
            img.style.imageRendering = 'pixelated';
        
            // Spacing + cursor
            img.style.margin = '5px';
            img.style.cursor = 'pointer';
        
            img.onload = () => {
            const maxPreviewSize = 64;
        
            // Scale up tiny images cleanly
            const scale = Math.floor(maxPreviewSize / img.naturalWidth) || 1;
        
            img.width = img.naturalWidth * scale;
            img.height = img.naturalHeight * scale;
            };
        
            img.addEventListener('click', () => {
            this.selectedSample = img;
            console.log('Selected sample:', src);
            this.highlightSelected(img);

            this.updatePreview(src);
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

    private updatePreview(src: string) {
        this.previewContainer.innerHTML = '';
      
        const img = document.createElement('img');
        img.src = src;
        img.style.imageRendering = 'pixelated';
      
        img.onload = () => {
          const containerWidth = this.previewContainer.clientWidth;
          const containerHeight = this.previewContainer.clientHeight;
      
          // Calculate integer scale to fit container
          const scaleX = Math.floor(containerWidth / img.naturalWidth);
          const scaleY = Math.floor(containerHeight / img.naturalHeight);
          const scale = Math.max(1, Math.min(scaleX, scaleY)); // pick smaller to fit
      
          img.width = img.naturalWidth * scale;
          img.height = img.naturalHeight * scale;
        };
      
        this.previewContainer.appendChild(img);
    }

    private generateOverlappingTiles(tileSize: number) {
        if (!this.selectedSample) return;
      
        const canvas = document.createElement('canvas');
        const ctx = canvas.getContext('2d');
        if (!ctx) return;
      
        const img = this.selectedSample;
        canvas.width = img.naturalWidth;
        canvas.height = img.naturalHeight;
        ctx.drawImage(img, 0, 0);
      
        this.generatedTilesContainer.innerHTML = '';
        let tileCount = 0;
      
        const seenTiles = new Set<string>();
      
        for (let y = 0; y <= canvas.height - tileSize; y++) {
          for (let x = 0; x <= canvas.width - tileSize; x++) {
            const tileData = ctx.getImageData(x, y, tileSize, tileSize);
      
            // Create a simple hash of pixel data
            let hash = '';
            for (let i = 0; i < tileData.data.length; i += 4) {
              hash += `${tileData.data[i]},${tileData.data[i+1]},${tileData.data[i+2]},${tileData.data[i+3]};`;
            }
      
            if (seenTiles.has(hash)) continue; // skip duplicate
            seenTiles.add(hash);
      
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
      
            tempCtx.putImageData(tileData, 0, 0);
      
            tileCtx.imageSmoothingEnabled = false;
            tileCtx.drawImage(
              tempCanvas,
              0,
              0,
              tileSize,
              tileSize,
              0,
              0,
              tileCanvas.width,
              tileCanvas.height
            );
      
            this.generatedTilesContainer.appendChild(tileCanvas);
            tileCount++;
          }
        }
      
        // Update tile count label
        this.tilesCountLabel.textContent = `Tiles: ${tileCount}`;
      }
      
  
    public getSelectedSample(): string | null {
      return this.selectedSample?.src || null;
    }
  } 
  