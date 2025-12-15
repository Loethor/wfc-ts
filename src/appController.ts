import { SampleList } from './sampleList';
import { SamplePreview } from './samplePreview';
import { TileExtractor } from './tileExtractor';
import { TileSet, Tile } from './tileSet';
import { CONFIG } from './config';
import { AdjacencyViewer } from './adjacencyViewer';

export class AppController {
  private sampleList: SampleList;
  private previewCanvas: SamplePreview;
  private tileExtractor: TileExtractor;
  private adjacencyViewer: AdjacencyViewer;
  private tileSizeInput: HTMLInputElement;
  private generateBtn: HTMLButtonElement;
  private currentTileSet: TileSet | null = null;
  private currentTiles: Tile[] = [];

  constructor(
    sampleSelectorId: string,
    previewId: string,
    tileContainerId: string,
    tileCountId: string,
    generateBtnId: string,
    tileSizeInputId: string,
    adjacencyViewerId: string,
    samples: string[]
  ) {
    this.sampleList = new SampleList(sampleSelectorId, samples);
    this.previewCanvas = new SamplePreview(previewId);
    this.tileExtractor = new TileExtractor(tileContainerId, tileCountId);
    this.adjacencyViewer = new AdjacencyViewer(adjacencyViewerId);
    this.generateBtn = document.getElementById(generateBtnId) as HTMLButtonElement;
    this.tileSizeInput = document.getElementById(tileSizeInputId) as HTMLInputElement;

    this.init();
  }

  private init() {
    this.sampleList.onSelect((src: string) => this.previewCanvas.showImage(src));
    this.generateBtn.addEventListener('click', () => {
      void this.generateTiles();
    });
  }

  private async generateTiles() {
    try {
      const selectedSample = this.sampleList.getSelected();
      if (!selectedSample) {
        alert('Please select a sample image first');
        return;
      }

      const tileSize = parseInt(this.tileSizeInput.value);
      
      if (isNaN(tileSize) || tileSize < 1 || tileSize > 20) {
        alert('Please enter a valid tile size between 1 and 20');
        return;
      }

      this.generateBtn.disabled = true;
      this.generateBtn.textContent = 'Generating...';

      const tileElements = await this.tileExtractor.generate(
        selectedSample,
        tileSize,
        this.previewCanvas.setHighlight.bind(this.previewCanvas),
        () => this.previewCanvas.setHighlight(null),
        (tileIndex: number) => this.showTileAdjacencies(tileIndex),
        () => this.clearAdjacencies()
      );

      if (tileElements.length === 0) {
        throw new Error('No tiles were generated');
      }

      const tiles: Tile[] = [];
      for (let id = 0; id < tileElements.length; id++) {
        const canvas = tileElements[id];
        const ctx = canvas.getContext('2d');
        if (!ctx) {
          console.error(`Failed to get 2D context for tile ${id}`);
          continue;
        }
        tiles.push({
          id,
          canvas,
          pixelData: ctx.getImageData(0, 0, tileSize, tileSize)
        });
      }

      if (tiles.length === 0) {
        throw new Error('Failed to create tiles');
      }

      const tileSet = new TileSet(tiles);
      this.currentTileSet = tileSet;
      this.currentTiles = tiles;
    } catch (error) {
      console.error('Error generating tiles:', error);
      alert(`Failed to generate tiles: ${error instanceof Error ? error.message : 'Unknown error'}`);
    } finally {
      this.generateBtn.disabled = false;
      this.generateBtn.textContent = 'Generate Tiles';
    }
  }

  private showTileAdjacencies(tileIndex: number) {
    if (!this.currentTileSet || !this.currentTiles[tileIndex]) {
      return;
    }
    
    const adjacencies = this.currentTileSet.neighbors.get(tileIndex);
    if (!adjacencies) {
      return;
    }

    this.adjacencyViewer.show(tileIndex, adjacencies, this.currentTiles);
  }

  private clearAdjacencies() {
    this.adjacencyViewer.clear();
  }
}
