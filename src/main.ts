import { AppController } from './appController';

const images = import.meta.glob('/samples/*', {
  eager: true,
  query: '?url',
  import: 'default'
});

const fullPaths = Object.values(images) as string[];

new AppController(
  'sample-selector',
  'sample-preview',
  'generated-tiles',
  'tiles-count',
  'generate-tiles',
  'tile-size',
  fullPaths
);
