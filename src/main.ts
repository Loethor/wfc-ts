import { AppController } from './appController';
import { CONFIG } from './config';

const images = import.meta.glob('/samples/*', {
  eager: true,
  query: '?url',
  import: 'default'
});

const fullPaths = Object.values(images) as string[];

try {
  new AppController(
    CONFIG.elements.sampleSelector,
    CONFIG.elements.preview,
    CONFIG.elements.tilesContainer,
    CONFIG.elements.tilesCount,
    CONFIG.elements.generateBtn,
    CONFIG.elements.tileSizeInput,
    CONFIG.elements.adjacencyViewer,
    CONFIG.elements.generateWfcBtn,
    CONFIG.elements.outputSizeInput,
    CONFIG.elements.wfcOutput,
    fullPaths
  );
} catch (error) {
  console.error('Failed to initialize application:', error);
  alert('Failed to initialize the application. Please check the console for details.');
}
