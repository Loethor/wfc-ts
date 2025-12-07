import { SampleList } from './sampleList';
import { PreviewCanvas } from './previewCanvas';
import { TileGenerator } from './tileGenerator';
import { TileGraph, Tile } from './tileGraph';

const images = import.meta.glob('/samples/*', {
  eager: true,
  query: '?url',
  import: 'default'
});

const fullPaths = Object.values(images) as string[];

const sampleList = new SampleList('sample-selector', fullPaths);
const previewCanvas = new PreviewCanvas('sample-preview');
const tileGenerator = new TileGenerator('generated-tiles', 'tiles-count');

sampleList.onSelect((src: string) => {
  previewCanvas.showImage(src);
});

const generateBtn = document.getElementById('generate-tiles') as HTMLButtonElement;
const tileSizeInput = document.getElementById('tile-size') as HTMLInputElement;

generateBtn.addEventListener('click', () => {
  const selectedSample = sampleList.getSelected();
  if (!selectedSample) return;

  const tileSize = parseInt(tileSizeInput.value);
  const tileElements = tileGenerator.generate(
    selectedSample,
    tileSize,
    previewCanvas.setHighlight.bind(previewCanvas),
    () => previewCanvas.setHighlight(null)
  );
  const tiles: Tile[] = tileElements.map((canvas, id) => ({
    id,
    canvas,
    data: canvas.getContext('2d')!.getImageData(0, 0, tileSize, tileSize)
  }));

  const graph = new TileGraph(tiles);
  console.log(graph);
});
