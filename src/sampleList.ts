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
        img.style.imageRendering = 'pixelated';
        img.style.margin = '5px';
        img.style.cursor = 'pointer';
  
        img.onload = () => {
          const maxPreviewSize = 64;
          const scale = Math.floor(maxPreviewSize / img.naturalWidth) || 1;
          img.width = img.naturalWidth * scale;
          img.height = img.naturalHeight * scale;
        };
  
        img.addEventListener('click', () => {
          this.selected = img;
          this.container.querySelectorAll('img').forEach((el) => (el as HTMLImageElement).style.border = '');
          img.style.border = '2px solid red';
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
  