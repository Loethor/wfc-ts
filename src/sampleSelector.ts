export class SampleSelector {
    private container: HTMLDivElement;
    private selectedSample: HTMLImageElement | null = null;
  
    constructor(containerId: string, samples: string[]) {
      const el = document.getElementById(containerId);
      if (!el) throw new Error(`Container #${containerId} not found`);
      this.container = el as HTMLDivElement;
  
      this.createPreviews(samples);
    }
  
    private createPreviews(samples: string[]) {
        samples.forEach((src) => {
            const img = document.createElement('img');
        
            img.src = src;
        
            // Pixel-art friendly rendering
            img.style.imageRendering = 'pixelated';
        
            // Spacing + cursor
            img.style.margin = '5px';
            img.style.cursor = 'pointer';
        
            img.onload = () => {
            const maxPreviewSize = 64;
        
            // Scale up tiny images cleanly
            const scale = Math.floor(maxPreviewSize / img.naturalWidth) || 1;
        
            img.width = img.naturalWidth * scale;
            img.height = img.naturalHeight * scale;
            };
        
            img.addEventListener('click', () => {
            this.selectedSample = img;
            console.log('Selected sample:', src);
            this.highlightSelected(img);
            });
        
            this.container.appendChild(img);
        });
    }
      
  
    private highlightSelected(img: HTMLImageElement) {
      this.container.querySelectorAll('img').forEach((el) => {
        (el as HTMLImageElement).style.border = '';
      });
      img.style.border = '2px solid red';
    }
  
    public getSelectedSample(): string | null {
      return this.selectedSample?.src || null;
    }
  }
  