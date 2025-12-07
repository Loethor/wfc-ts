export class SampleList {
    private container: HTMLDivElement;
    private selectedImg: HTMLImageElement | null = null;
  
    constructor(containerId: string, private onSelect: (img: HTMLImageElement) => void) {
      const el = document.getElementById(containerId);
      if (!el) throw new Error('Missing container');
      this.container = el as HTMLDivElement;
    }
  
    public addSamples(samples: string[]) {
      samples.forEach((src) => {
        const img = document.createElement('img');
        img.src = src;
        img.style.cursor = 'pointer';
        img.style.margin = '5px';
        img.style.imageRendering = 'pixelated';
  
        img.onload = () => {
          const maxSize = 64;
          const scale = Math.floor(maxSize / img.naturalWidth) || 1;
          img.width = img.naturalWidth * scale;
          img.height = img.naturalHeight * scale;
        };
  
        img.addEventListener('click', () => this.select(img));
        this.container.appendChild(img);
      });
    }
  
    private select(img: HTMLImageElement) {
      this.container.querySelectorAll('img').forEach((el) => (el as HTMLImageElement).style.border = '');
      img.style.border = '2px solid red';
      this.selectedImg = img;
      this.onSelect(img);
    }
  
    public getSelected(): HTMLImageElement | null {
      return this.selectedImg;
    }
  }
  