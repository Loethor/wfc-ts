import { SampleList } from './sampleList';
import { SamplePreview } from './samplePreview';
import { TileExtractor } from './tileExtractor';
import { TileSet, Tile } from './TileSet';

export class AppController {
  private sampleList: SampleList;
  private previewCanvas: SamplePreview;
  private tileGenerator: TileExtractor;
  private tileSizeInput: HTMLInputElement;
  private generateBtn: HTMLButtonElement;

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
    this.tileGenerator = new TileExtractor(tileContainerId, tileCountId);
    this.generateBtn = document.getElementById(generateBtnId) as HTMLButtonElement;
    this.tileSizeInput = document.getElementById(tileSizeInputId) as HTMLInputElement;

    this.init();
  }

  private init() {
    this.sampleList.onSelect((src: string) => this.previewCanvas.showImage(src));
    this.generateBtn.addEventListener('click', () => this.generateTiles());
  }

  private generateTiles() {
    const selectedSample = this.sampleList.getSelected();
    if (!selectedSample) return;

    const tileSize = parseInt(this.tileSizeInput.value);
    const tileElements = this.tileGenerator.generate(
      selectedSample,
      tileSize,
      this.previewCanvas.setHighlight.bind(this.previewCanvas),
      () => this.previewCanvas.setHighlight(null)
    );

    const tiles: Tile[] = tileElements.map((canvas, id) => ({
      id,
      canvas,
      pixelData: canvas.getContext('2d')!.getImageData(0, 0, tileSize, tileSize)
    }));

    const graph = new TileSet(tiles);
    console.log(graph);
  }
}
