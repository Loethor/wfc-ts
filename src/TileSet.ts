export interface Tile {
    id: number;
    canvas: HTMLCanvasElement;
    pixelData: ImageData;
  }
  
  export type Direction = 'up' | 'down' | 'left' | 'right';
  
  export interface AdjacencyRules {
    up: number[];
    down: number[];
    left: number[];
    right: number[];
  }
  
  export class TileSet {
    tiles: Tile[];
    neighbors: Map<number, AdjacencyRules>;
  
    constructor(tiles: Tile[]) {
      this.tiles = tiles;
      this.neighbors = this.computeNeighbors();
    }
  
    private computeNeighbors(): Map<number, AdjacencyRules> {
      const neighbors = new Map<number, AdjacencyRules>();
      if (!this.tiles.length) return neighbors;
  
      const tileSize = this.tiles[0].pixelData.width;
      const stride = tileSize * 4;
  
      this.tiles.forEach((tileA) => {
        const upSet = new Set<number>();
        const downSet = new Set<number>();
        const leftSet = new Set<number>();
        const rightSet = new Set<number>();
  
        this.tiles.forEach((tileB) => {
          if (tileA.id === tileB.id) return;
  
          let okRight = true;
          for (let r = 0; r < tileSize && okRight; r++) {
            for (let c = 1; c < tileSize; c++) {
              const aIdx = (r * tileSize + c) * 4;
              const bIdx = (r * tileSize + (c - 1)) * 4;
              for (let k = 0; k < 4; k++) {
                if (tileA.pixelData.data[aIdx + k] !== tileB.pixelData.data[bIdx + k]) {
                  okRight = false;
                  break;
                }
              }
              if (!okRight) break;
            }
          }
          if (okRight) rightSet.add(tileB.id);
  
          let okLeft = true;
          for (let r = 0; r < tileSize && okLeft; r++) {
            for (let c = 0; c < tileSize - 1; c++) {
              const aIdx = (r * tileSize + c) * 4;
              const bIdx = (r * tileSize + (c + 1)) * 4;
              for (let k = 0; k < 4; k++) {
                if (tileA.pixelData.data[aIdx + k] !== tileB.pixelData.data[bIdx + k]) {
                  okLeft = false;
                  break;
                }
              }
              if (!okLeft) break;
            }
          }
          if (okLeft) leftSet.add(tileB.id);
  
          let okDown = true;
          for (let r = 1; r < tileSize && okDown; r++) {
            for (let c = 0; c < tileSize; c++) {
              const aIdx = (r * tileSize + c) * 4;
              const bIdx = ((r - 1) * tileSize + c) * 4;
              for (let k = 0; k < 4; k++) {
                if (tileA.pixelData.data[aIdx + k] !== tileB.pixelData.data[bIdx + k]) {
                  okDown = false;
                  break;
                }
              }
              if (!okDown) break;
            }
          }
          if (okDown) downSet.add(tileB.id);
  
          let okUp = true;
          for (let r = 0; r < tileSize - 1 && okUp; r++) {
            for (let c = 0; c < tileSize; c++) {
              const aIdx = (r * tileSize + c) * 4;
              const bIdx = (((r + 1) * tileSize) + c) * 4;
              for (let k = 0; k < 4; k++) {
                if (tileA.pixelData.data[aIdx + k] !== tileB.pixelData.data[bIdx + k]) {
                  okUp = false;
                  break;
                }
              }
              if (!okUp) break;
            }
          }
          if (okUp) upSet.add(tileB.id);
        });
  
        neighbors.set(tileA.id, {
          up: Array.from(upSet),
          down: Array.from(downSet),
          left: Array.from(leftSet),
          right: Array.from(rightSet)
        });
      });
  
      return neighbors;
    }
  }
  