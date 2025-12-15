import { defineConfig } from 'vite';

export default defineConfig({
  // Set base to your repo name for GitHub Pages
  base: process.env.NODE_ENV === 'production' ? '/wfc-ts/' : '/',
  build: {
    outDir: 'docs',
    assetsDir: 'assets',
    // Generate source maps for debugging
    sourcemap: false,
    // Optimize bundle size
    minify: 'esbuild',
    rollupOptions: {
      output: {
        manualChunks: undefined,
      },
    },
  },
});
