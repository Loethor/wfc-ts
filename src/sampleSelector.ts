export class SampleSelector {
    private container: HTMLDivElement;
    private selectedSample: HTMLImageElement | null = null;
    private previewContainer: HTMLDivElement;

    constructor(containerId: string, samples: string[]) {
        const el = document.getElementById(containerId);
        const previewEl = document.getElementById('sample-preview');
      
        if (!el || !previewEl) throw new Error('Missing containers');
      
        this.container = el as HTMLDivElement;
        this.previewContainer = previewEl as HTMLDivElement;
      
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

            this.updatePreview(src);
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

    private updatePreview(src: string) {
        this.previewContainer.innerHTML = '';
      
        const img = document.createElement('img');
        img.src = src;
        img.style.imageRendering = 'pixelated';
      
        img.onload = () => {
          const containerWidth = this.previewContainer.clientWidth;
          const containerHeight = this.previewContainer.clientHeight;
      
          // Calculate integer scale to fit container
          const scaleX = Math.floor(containerWidth / img.naturalWidth);
          const scaleY = Math.floor(containerHeight / img.naturalHeight);
          const scale = Math.max(1, Math.min(scaleX, scaleY)); // pick smaller to fit
      
          img.width = img.naturalWidth * scale;
          img.height = img.naturalHeight * scale;
        };
      
        this.previewContainer.appendChild(img);
      }
  
    public getSelectedSample(): string | null {
      return this.selectedSample?.src || null;
    }
  } 
  