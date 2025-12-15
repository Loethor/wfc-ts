/**
 * Application configuration constants
 */
export const CONFIG = {
  // DOM Element IDs
  elements: {
    sampleSelector: 'sample-selector',
    preview: 'sample-preview',
    tilesContainer: 'generated-tiles',
    tilesCount: 'tiles-count',
    generateBtn: 'generate-tiles',
    tileSizeInput: 'tile-size',
    adjacencyViewer: 'adjacency-viewer',
    wfcCanvas: 'wfc-canvas',
    generateWfcBtn: 'generate-wfc',
    outputSizeInput: 'output-size',
    wfcOutput: 'wfc-output'
  },

  // UI Constants
  ui: {
    adjacencyPreviewSize: 48,
    samplePreviewSize: 200,
    maxSamplePreviewSize: 64,
    tileScaleFactor: 16
  },

  // Tile Generation
  tiles: {
    defaultSize: 3,
    minSize: 1,
    maxSize: 20
  },

  // Canvas Settings
  canvas: {
    defaultWidth: 640,
    defaultHeight: 640,
    maxSize: 400
  }
} as const;

export type AppConfig = typeof CONFIG;
