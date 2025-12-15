import { SampleList } from './sampleList';
import { SamplePreview } from './samplePreview';
import { TileExtractor } from './tileExtractor';
import { TileSet, Tile } from './tileSet';
import { CONFIG } from './config';
import { AdjacencyViewer } from './adjacencyViewer';
import { WFCGenerator } from './wfcGenerator';

export class AppController {
  private sampleList: SampleList;
  private previewCanvas: SamplePreview;
  private tileExtractor: TileExtractor;
  private adjacencyViewer: AdjacencyViewer;
  private tileSizeInput: HTMLInputElement;
  private generateBtn: HTMLButtonElement;
  private generateWfcBtn: HTMLButtonElement;
  private outputSizeInput: HTMLInputElement;
  private wfcOutputDiv: HTMLElement;
  private currentTileSet: TileSet | null = null;
  private currentTiles: Tile[] = [];
  private isGenerating = false;

  constructor(
    sampleSelectorId: string,
    previewId: string,
    tileContainerId: string,
    tileCountId: string,
    generateBtnId: string,
    tileSizeInputId: string,
    adjacencyViewerId: string,
    generateWfcBtnId: string,
    outputSizeInputId: string,
    wfcOutputId: string,
    samples: string[]
  ) {
    this.sampleList = new SampleList(sampleSelectorId, samples);
    this.previewCanvas = new SamplePreview(previewId);
    this.tileExtractor = new TileExtractor(tileContainerId, tileCountId);
    this.adjacencyViewer = new AdjacencyViewer(adjacencyViewerId);
    this.generateBtn = document.getElementById(generateBtnId) as HTMLButtonElement;
    this.tileSizeInput = document.getElementById(tileSizeInputId) as HTMLInputElement;
    this.generateWfcBtn = document.getElementById(generateWfcBtnId) as HTMLButtonElement;
    this.outputSizeInput = document.getElementById(outputSizeInputId) as HTMLInputElement;
    this.wfcOutputDiv = document.getElementById(wfcOutputId) as HTMLElement;

    this.init();
  }

  private init() {
    this.sampleList.onSelect((src: string) => this.previewCanvas.showImage(src));
    this.generateBtn.addEventListener('click', () => {
      void this.generateTiles();
    });
    this.generateWfcBtn.addEventListener('click', () => {
      void this.generateWFC();
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
      
      // Enable WFC button now that we have tiles
      this.generateWfcBtn.disabled = false;
    } catch (error) {
      console.error('Error generating tiles:', error);
      alert(`Failed to generate tiles: ${error instanceof Error ? error.message : 'Unknown error'}`);
    } finally {
      this.generateBtn.disabled = false;
      this.generateBtn.textContent = 'Generate Tiles';
    }
  }

  private async generateWFC() {
    if (this.isGenerating) {
      return;
    }

    if (!this.currentTileSet) {
      alert('Please generate tiles first');
      return;
    }

    try {
      this.isGenerating = true;
      this.generateWfcBtn.disabled = true;
      this.generateWfcBtn.textContent = 'Generating...';

      const gridSize = parseInt(this.outputSizeInput.value);
      
      if (isNaN(gridSize) || gridSize < 3 || gridSize > 50) {
        alert('Please enter a valid grid size between 3 and 50');
        return;
      }

      console.log(`\n=== Starting WFC Generation (${gridSize}x${gridSize}) ===`);
      
      const generator = new WFCGenerator(this.currentTileSet, gridSize, gridSize);
      
      // Show progress during generation
      const outputImage = await generator.generate((attempt, maxAttempts, iteration, maxIterations) => {
        const progress = Math.round((iteration / maxIterations) * 100);
        this.generateWfcBtn.textContent = `Generating... (Attempt ${attempt}/${maxAttempts}, ${progress}%)`;
      });

      if (!outputImage) {
        throw new Error('WFC generation failed');
      }

      // Display the result
      this.wfcOutputDiv.innerHTML = '';
      const outputCanvas = document.createElement('canvas');
      outputCanvas.width = outputImage.width;
      outputCanvas.height = outputImage.height;
      const ctx = outputCanvas.getContext('2d');
      
      if (!ctx) {
        throw new Error('Failed to get canvas context');
      }

      ctx.imageSmoothingEnabled = false;
      ctx.putImageData(outputImage, 0, 0);
      
      // Scale up for visibility
      const scale = CONFIG.canvas.maxSize / Math.max(outputImage.width, outputImage.height);
      outputCanvas.style.width = `${outputImage.width * scale}px`;
      outputCanvas.style.height = `${outputImage.height * scale}px`;
      outputCanvas.style.imageRendering = 'pixelated';
      
      this.wfcOutputDiv.appendChild(outputCanvas);
      
      console.log('=== WFC Generation Complete ===\n');
    } catch (error) {
      console.error('Error in WFC generation:', error);
      alert(`WFC generation failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    } finally {
      this.isGenerating = false;
      this.generateWfcBtn.disabled = false;
      this.generateWfcBtn.textContent = 'Generate WFC';
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
