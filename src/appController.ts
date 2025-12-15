import { SampleList } from './sampleList';
import { SamplePreview } from './samplePreview';
import { TileExtractor } from './tileExtractor';
import { TileSet, Tile } from './tileSet';
import { CONFIG } from './config';

export class AppController {
  private sampleList: SampleList;
  private previewCanvas: SamplePreview;
  private tileExtractor: TileExtractor;
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
    samples: string[]
  ) {
    this.sampleList = new SampleList(sampleSelectorId, samples);
    this.previewCanvas = new SamplePreview(previewId);
    this.tileExtractor = new TileExtractor(tileContainerId, tileCountId);
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
    const selectedSample = this.sampleList.getSelected();
    if (!selectedSample) return;

    const tileSize = parseInt(this.tileSizeInput.value);

    const tileElements = await this.tileExtractor.generate(
      selectedSample,
      tileSize,
      this.previewCanvas.setHighlight.bind(this.previewCanvas),
      () => this.previewCanvas.setHighlight(null),
      (tileIndex: number, canvas: HTMLCanvasElement) => {
        console.log('Tile hover callback fired:', tileIndex);
        this.showTileAdjacencies(tileIndex);
      },
      () => {
        console.log('Tile leave callback fired');
        this.clearAdjacencies();
      }
    );

    const tiles: Tile[] = tileElements.map((canvas, id) => ({
      id,
      canvas,
      pixelData: canvas.getContext('2d')!.getImageData(0, 0, tileSize, tileSize)
    }));

    const graph = new TileSet(tiles);
    this.currentTileSet = graph;
    this.currentTiles = tiles;
    console.log('TileSet created:', graph);
    console.log('Total tiles:', tiles.length);
    console.log('Neighbors map:', graph.neighbors);
  }

  private showTileAdjacencies(tileIndex: number) {
    console.log('showTileAdjacencies called with index:', tileIndex);
    console.log('currentTileSet:', this.currentTileSet);
    console.log('currentTiles length:', this.currentTiles.length);
    
    if (!this.currentTileSet || !this.currentTiles[tileIndex]) {
      console.warn('TileSet or tile not found');
      return;
    }
    
    const adjacencies = this.currentTileSet.neighbors.get(tileIndex);
    console.log('Adjacencies for tile', tileIndex, ':', adjacencies);
    
    if (!adjacencies) {
      console.warn('No adjacencies found for tile', tileIndex);
      return;
    }

    const adjContainer = document.getElementById(CONFIG.elements.adjacencyViewer);
    console.log('adjacency-viewer element:', adjContainer);
    
    if (!adjContainer) {
      console.error('adjacency-viewer element not found!');
      return;
    }

    adjContainer.innerHTML = '<h3>Adjacencies:</h3>';
    
    ['up', 'down', 'left', 'right'].forEach(dir => {
      const dirDiv = document.createElement('div');
      dirDiv.innerHTML = `<strong>${dir.toUpperCase()}:</strong>`;
      const tilesDiv = document.createElement('div');
      tilesDiv.style.display = 'flex';
      tilesDiv.style.gap = '2px';
      tilesDiv.style.flexWrap = 'wrap';
      
      const adjList = adjacencies[dir as keyof typeof adjacencies];
      console.log(`${dir} adjacencies:`, adjList);
      
      adjList.forEach((adjId: number) => {
        const tile = this.currentTiles[adjId];
        if (tile) {
          // Create a scaled-up canvas for preview
          const previewSize = CONFIG.ui.adjacencyPreviewSize;
          const preview = document.createElement('canvas');
          preview.width = previewSize;
          preview.height = previewSize;
          const ctx = preview.getContext('2d')!;
          ctx.imageSmoothingEnabled = false;
          ctx.drawImage(tile.canvas, 0, 0, previewSize, previewSize);
          
          preview.style.imageRendering = 'pixelated';
          preview.style.border = '1px solid #999';
          tilesDiv.appendChild(preview);
        }
      });
      
      dirDiv.appendChild(tilesDiv);
      adjContainer.appendChild(dirDiv);
    });
  }

  private clearAdjacencies() {
    const adjContainer = document.getElementById(CONFIG.elements.adjacencyViewer);
    if (adjContainer) {
      adjContainer.innerHTML = '';
    }
  }
}
