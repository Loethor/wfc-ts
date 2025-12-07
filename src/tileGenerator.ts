type HoverCallback = (x: number, y: number, w: number, h: number) => void;
type LeaveCallback = () => void;

export class TileGenerator {
    private container: HTMLDivElement;
    private tilesCountLabel: HTMLDivElement;

    constructor(containerId: string, labelId: string) {
        const el = document.getElementById(containerId);
        if (!el) throw new Error('Missing generated-tiles container');
        this.container = el as HTMLDivElement;

        const labelEl = document.getElementById(labelId);
        if (!labelEl) throw new Error('Missing tiles count label');
        this.tilesCountLabel = labelEl as HTMLDivElement;
    }

    public generate(
        img: HTMLImageElement,
        tileSize: number,
        hoverCallback: HoverCallback,
        leaveCallback: LeaveCallback
    ) {
        const width = img.naturalWidth;
        const height = img.naturalHeight;

        const mainCanvas = document.createElement('canvas');
        mainCanvas.width = width;
        mainCanvas.height = height;
        const mainCtx = mainCanvas.getContext('2d');
        if (!mainCtx) return;
        mainCtx.drawImage(img, 0, 0);

        this.container.innerHTML = '';
        let tileCount = 0;
        const seenTiles = new Set<string>();
        const tilesPerRow = 8;
        let rowDiv: HTMLDivElement | null = null;

        for (let y = 0; y < height; y++) {
            for (let x = 0; x < width; x++) {
                const tempCanvas = document.createElement('canvas');
                tempCanvas.width = tileSize;
                tempCanvas.height = tileSize;
                const tempCtx = tempCanvas.getContext('2d');
                if (!tempCtx) continue;

                // NxN tile with wrapping
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
                    hash += `${tileData.data[i]},${tileData.data[i+1]},${tileData.data[i+2]},${tileData.data[i+3]};`;
                }
                if (seenTiles.has(hash)) continue;
                seenTiles.add(hash);

                const tileCanvas = document.createElement('canvas');
                tileCanvas.width = tileSize * 16;
                tileCanvas.height = tileSize * 16;
                tileCanvas.style.imageRendering = 'pixelated';
                tileCanvas.style.border = '1px solid #ccc';
                const tileCtx = tileCanvas.getContext('2d');
                if (!tileCtx) continue;
                tileCtx.imageSmoothingEnabled = false;
                tileCtx.drawImage(tempCanvas, 0, 0, tileCanvas.width, tileCanvas.height);

                if (tileCount % tilesPerRow === 0) {
                    rowDiv = document.createElement('div');
                    rowDiv.style.display = 'flex';
                    rowDiv.style.gap = '4px';
                    this.container.appendChild(rowDiv);
                }
                rowDiv?.appendChild(tileCanvas);
                tileCount++;

                const tileX = x;
                const tileY = y;
                tileCanvas.addEventListener('mouseenter', () => hoverCallback(tileX, tileY, tileSize, tileSize));
                tileCanvas.addEventListener('mouseleave', leaveCallback);
            }
        }

        this.tilesCountLabel.textContent = `Tiles: ${tileCount}`;
    }
}
