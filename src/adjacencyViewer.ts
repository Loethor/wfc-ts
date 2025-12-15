import { CONFIG } from './config';
import { Tile, AdjacencyRules } from './tileSet';

/**
 * Handles visualization of tile adjacency relationships
 */
export class AdjacencyViewer {
  private container: HTMLElement;

  constructor(containerId: string) {
    const el = document.getElementById(containerId);
    if (!el) {
      throw new Error(`Adjacency viewer container '${containerId}' not found`);
    }
    this.container = el;
  }

  /**
   * Display adjacency information for a specific tile
   */
  show(tileIndex: number, adjacencies: AdjacencyRules, tiles: Tile[], frequency?: number): void {
    if (!tiles[tileIndex]) {
      console.warn(`Tile ${tileIndex} not found`);
      return;
    }

    this.container.innerHTML = `<h3>Adjacencies:</h3>`;
    // Show frequency info
    if (typeof frequency === 'number') {
      const freqDiv = document.createElement('div');
      freqDiv.style.marginBottom = '8px';
      freqDiv.innerHTML = `<strong>Frequency:</strong> ${frequency}`;
      this.container.appendChild(freqDiv);
    }

    const directions: Array<keyof AdjacencyRules> = ['up', 'down', 'left', 'right'];
    for (const dir of directions) {
      const dirDiv = document.createElement('div');
      dirDiv.innerHTML = `<strong>${dir.toUpperCase()}:</strong>`;

      const tilesDiv = document.createElement('div');
      tilesDiv.style.display = 'flex';
      tilesDiv.style.gap = '2px';
      tilesDiv.style.flexWrap = 'wrap';

      const adjList = adjacencies[dir];
      for (const adjId of adjList) {
        const tile = tiles[adjId];
        if (!tile) continue;

        const preview = this.createTilePreview(tile);
        if (preview) {
          tilesDiv.appendChild(preview);
        }
      }

      dirDiv.appendChild(tilesDiv);
      this.container.appendChild(dirDiv);
    }
  }

  /**
   * Create a preview canvas for a tile
   */
  private createTilePreview(tile: Tile): HTMLCanvasElement | null {
    const previewSize = CONFIG.ui.adjacencyPreviewSize;
    const preview = document.createElement('canvas');
    preview.width = previewSize;
    preview.height = previewSize;
    
    const ctx = preview.getContext('2d');
    if (!ctx) {
      console.error('Failed to get 2D context for preview canvas');
      return null;
    }

    ctx.imageSmoothingEnabled = false;
    ctx.drawImage(tile.canvas, 0, 0, previewSize, previewSize);
    
    preview.style.imageRendering = 'pixelated';
    preview.style.border = '1px solid #999';
    
    return preview;
  }

  /**
   * Clear the adjacency display
   */
  clear(): void {
    this.container.innerHTML = '';
  }
}
