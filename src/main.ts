import { SampleList } from './sampleList';
import { PreviewCanvas } from './previewCanvas';
import { TileGenerator } from './tileGenerator';

// Dynamically import all samples from the folder
const images = import.meta.glob('/samples/*', {
    eager: true,
    query: '?url',
    import: 'default'
});

const fullPaths = Object.values(images) as string[];

const preview = new PreviewCanvas('sample-preview');

const tileGen = new TileGenerator('generated-tiles', 'tiles-count');

const sampleList = new SampleList('sample-selector', (img) => {
    preview.showImage(img);
});

// Add samples dynamically
sampleList.addSamples(fullPaths);

// Setup generate button
const generateBtn = document.getElementById('generate-tiles') as HTMLButtonElement;
const tileSizeInput = document.getElementById('tile-size') as HTMLInputElement;

generateBtn.addEventListener('click', () => {
    const tileSize = parseInt(tileSizeInput.value);
    const img = sampleList.getSelected();
    if (!img) return;

    tileGen.generate(
        img,
        tileSize,
        (x, y, w, h) => preview.setHighlight(x, y, w, h), // hover callback
        () => preview.clearHighlight()                     // leave callback
    );
});
