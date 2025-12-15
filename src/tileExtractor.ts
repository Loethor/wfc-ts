import { CONFIG } from './config';

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
      onLeave: () => void,
      onTileHover?: (tileIndex: number, canvas: HTMLCanvasElement) => void,
      onTileLeave?: () => void
    ): Promise<HTMLCanvasElement[]> {
    return new Promise((resolve) => {
      const img = new Image();
      img.src = imgSrc;

      const tiles: HTMLCanvasElement[] = [];

      img.onload = () => {
        const width = img.naturalWidth;
        const height = img.naturalHeight;

        const mainCanvas = document.createElement('canvas');
        mainCanvas.width = width;
        mainCanvas.height = height;
        const mainCtx = mainCanvas.getContext('2d');
        if (!mainCtx) {
          console.error('Failed to get 2D context for main canvas');
          resolve([]);
          return;
        }
        mainCtx.drawImage(img, 0, 0);

        this.container.innerHTML = '';
        const seen = new Set<string>();

        for (let y = 0; y < height; y++) {
          for (let x = 0; x < width; x++) {
            const tempCanvas = document.createElement('canvas');
            tempCanvas.width = tileSize;
            tempCanvas.height = tileSize;
            const tempCtx = tempCanvas.getContext('2d');
            if (!tempCtx) {
              console.error('Failed to get 2D context for temp canvas');
              continue;
            }

            for (let dy = 0; dy < tileSize; dy++) {
              for (let dx = 0; dx < tileSize; dx++) {
                const px = (x + dx) % width;
                const py = (y + dy) % height;
                const data = mainCtx.getImageData(px, py, 1, 1);
                tempCtx.putImageData(data, dx, dy);
              }
            }

            const hashData = tempCtx.getImageData(0, 0, tileSize, tileSize);
            const hashParts: string[] = [];
            for (let i = 0; i < hashData.data.length; i += 4) {
              hashParts.push(
                hashData.data[i].toString(),
                hashData.data[i + 1].toString(),
                hashData.data[i + 2].toString(),
                hashData.data[i + 3].toString()
              );
            }
            const hash = hashParts.join(',');

            if (seen.has(hash)) continue;
            seen.add(hash);

            const tileWrapper = document.createElement('div');
            
            const index_text = document.createElement('span');
            index_text.textContent = `${tiles.length}`;

            const tileCanvas = document.createElement('canvas');
            tileCanvas.width = tileSize * CONFIG.ui.tileScaleFactor;
            tileCanvas.height = tileSize * CONFIG.ui.tileScaleFactor;
            const tileCtx = tileCanvas.getContext('2d');
            if (!tileCtx) {
              console.error('Failed to get 2D context for tile canvas');
              continue;
            }
            tileCtx.imageSmoothingEnabled = false;
            tileCtx.drawImage(tempCanvas, 0, 0, tileCanvas.width, tileCanvas.height);
            tileCanvas.style.imageRendering = 'pixelated';
            tileCanvas.style.border = '1px solid #ccc';

            tileWrapper.appendChild(index_text);
            tileWrapper.appendChild(tileCanvas);
            this.container.appendChild(tileWrapper);
            
            tiles.push(tempCanvas);
            const currentTileIndex = tiles.length - 1;

            const tileX = x;
            const tileY = y;
            
            ((index) => {
              tileCanvas.addEventListener('mouseenter', () => {
                onHover({ x: tileX, y: tileY, w: tileSize, h: tileSize });
                if (onTileHover) {
                  onTileHover(index, tempCanvas);
                }
              });
              tileCanvas.addEventListener('mouseleave', () => {
                onLeave();
                if (onTileLeave) {
                  onTileLeave();
                }
              });
            })(currentTileIndex);
          }
        }

        this.label.textContent = `Tiles: ${tiles.length}`;
        resolve(tiles);
      };
    });
  }
}
