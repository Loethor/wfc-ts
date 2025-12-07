export class TileExtractor {
    private container: HTMLDivElement;
    private label: HTMLDivElement;
  
    constructor(containerId: string, labelId: string) {
      const cont = document.getElementById(containerId);
      if (!cont) throw new Error('Missing container');
      this.container = cont as HTMLDivElement;
  
      const lab = document.getElementById(labelId);
      if (!lab) throw new Error('Missing label');
      this.label = lab as HTMLDivElement;
    }
  
    generate(
      imgSrc: string,
      tileSize: number,
      onHover: (rect: { x: number; y: number; w: number; h: number }) => void,
      onLeave: () => void
    ): HTMLCanvasElement[] {
      const img = new Image();
      img.src = imgSrc;
  
      const tiles: HTMLCanvasElement[] = [];
  
      img.onload = () => {
        const width = img.naturalWidth;
        const height = img.naturalHeight;
  
        const mainCanvas = document.createElement('canvas');
        mainCanvas.width = width;
        mainCanvas.height = height;
        const mainCtx = mainCanvas.getContext('2d')!;
        mainCtx.drawImage(img, 0, 0);
  
        this.container.innerHTML = '';
        const seen = new Set<string>();
        let rowDiv: HTMLDivElement | null = null;
        const tilesPerRow = 8;
  
        for (let y = 0; y < height; y++) {
          for (let x = 0; x < width; x++) {
            const tempCanvas = document.createElement('canvas');
            tempCanvas.width = tileSize;
            tempCanvas.height = tileSize;
            const tempCtx = tempCanvas.getContext('2d')!;
            for (let dy = 0; dy < tileSize; dy++) {
              for (let dx = 0; dx < tileSize; dx++) {
                const px = (x + dx) % width;
                const py = (y + dy) % height;
                const data = mainCtx.getImageData(px, py, 1, 1);
                tempCtx.putImageData(data, dx, dy);
              }
            }
  
            const hashData = tempCtx.getImageData(0, 0, tileSize, tileSize);
            let hash = '';
            for (let i = 0; i < hashData.data.length; i += 4) {
              hash += `${hashData.data[i]},${hashData.data[i + 1]},${hashData.data[i + 2]},${hashData.data[i + 3]};`;
            }
            if (seen.has(hash)) continue;
            seen.add(hash);
  
            const tileCanvas = document.createElement('canvas');
            tileCanvas.width = tileSize * 16;
            tileCanvas.height = tileSize * 16;
            const tileCtx = tileCanvas.getContext('2d')!;
            tileCtx.imageSmoothingEnabled = false;
            tileCtx.drawImage(tempCanvas, 0, 0, tileCanvas.width, tileCanvas.height);
            tileCanvas.style.imageRendering = 'pixelated';
            tileCanvas.style.border = '1px solid #ccc';
  
            if (tiles.length % tilesPerRow === 0) {
              rowDiv = document.createElement('div');
              rowDiv.style.display = 'flex';
              rowDiv.style.gap = '4px';
              this.container.appendChild(rowDiv);
            }
            rowDiv!.appendChild(tileCanvas);
            tiles.push(tileCanvas);
  
            const tileX = x;
            const tileY = y;
            tileCanvas.addEventListener('mouseenter', () => onHover({ x: tileX, y: tileY, w: tileSize, h: tileSize }));
            tileCanvas.addEventListener('mouseleave', () => onLeave());
          }
        }
        this.label.textContent = `Tiles: ${tiles.length}`;
      };
  
      return tiles;
    }
  }
  