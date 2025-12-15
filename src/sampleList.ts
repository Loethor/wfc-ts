import { CONFIG } from './config';

export class SampleList {
    private container: HTMLDivElement;
    private selected: HTMLImageElement | null = null;
    private selectCallback: ((src: string) => void) | null = null;
  
    constructor(containerId: string, samples: string[]) {
      const el = document.getElementById(containerId);
      if (!el) throw new Error('Missing container');
      this.container = el as HTMLDivElement;
      this.createPreviews(samples);
    }
  
    private createPreviews(samples: string[]) {
      samples.forEach((src) => {
        const img = document.createElement('img');
        img.src = src;
        img.alt = `Sample image ${src.split('/').pop()}`;
        img.role = 'button';
        img.tabIndex = 0;
        img.style.imageRendering = 'pixelated';
        img.style.margin = '5px';
        img.style.cursor = 'pointer';
  
        img.onload = () => {
          const maxPreviewSize = CONFIG.ui.maxSamplePreviewSize;
          const scale = Math.floor(maxPreviewSize / img.naturalWidth) || 1;
          img.width = img.naturalWidth * scale;
          img.height = img.naturalHeight * scale;
        };

        img.onerror = () => {
          console.error(`Failed to load sample image: ${src}`);
          img.style.opacity = '0.3';
          img.title = 'Failed to load image';
        };
  
        img.addEventListener('click', () => {
          if (this.selected) {
            this.selected.classList.remove('selected');
          }
          this.selected = img;
          img.classList.add('selected');
          if (this.selectCallback) this.selectCallback(img.src);
        });
  
        this.container.appendChild(img);
      });
    }
  
    onSelect(callback: (src: string) => void) {
      this.selectCallback = callback;
    }
  
    getSelected(): string | null {
      return this.selected?.src || null;
    }
  }
  