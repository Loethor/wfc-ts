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

  interface OverlapSignatures {
    rightOverlap: string;  // Columns 1 to end (for matching with left side of neighbor)
    leftOverlap: string;   // Columns 0 to end-1 (for matching with right side of neighbor)
    downOverlap: string;   // Rows 1 to end (for matching with top side of neighbor)
    upOverlap: string;     // Rows 0 to end-1 (for matching with bottom side of neighbor)
  }
  
  export class TileSet {
    tiles: Tile[];
    neighbors: Map<number, AdjacencyRules>;
    private overlapSignatures: Map<number, OverlapSignatures>;
  
    constructor(tiles: Tile[]) {
      this.tiles = tiles;
      this.overlapSignatures = new Map();
      this.precomputeOverlapSignatures();
      this.neighbors = this.computeNeighbors();
    }

    /**
     * Precompute overlap signatures for all tiles to optimize neighbor computation.
     * Uses WFC overlap model where tiles share (tileSize-1) pixels when adjacent.
     * This reduces complexity from O(n²·s²) to O(n·s² + n²).
     */
    private precomputeOverlapSignatures(): void {
      if (!this.tiles.length) return;
      
      const tileSize = this.tiles[0].pixelData.width;

      for (const tile of this.tiles) {
        const data = tile.pixelData.data;
        const signatures: OverlapSignatures = {
          rightOverlap: '',
          leftOverlap: '',
          downOverlap: '',
          upOverlap: ''
        };

        // Right overlap: columns 1 to tileSize-1 (all rows)
        const rightOverlap: number[] = [];
        for (let r = 0; r < tileSize; r++) {
          for (let c = 1; c < tileSize; c++) {
            const idx = (r * tileSize + c) * 4;
            rightOverlap.push(data[idx], data[idx + 1], data[idx + 2], data[idx + 3]);
          }
        }
        signatures.rightOverlap = rightOverlap.join(',');

        // Left overlap: columns 0 to tileSize-2 (all rows)
        const leftOverlap: number[] = [];
        for (let r = 0; r < tileSize; r++) {
          for (let c = 0; c < tileSize - 1; c++) {
            const idx = (r * tileSize + c) * 4;
            leftOverlap.push(data[idx], data[idx + 1], data[idx + 2], data[idx + 3]);
          }
        }
        signatures.leftOverlap = leftOverlap.join(',');

        // Down overlap: rows 1 to tileSize-1 (all columns)
        const downOverlap: number[] = [];
        for (let r = 1; r < tileSize; r++) {
          for (let c = 0; c < tileSize; c++) {
            const idx = (r * tileSize + c) * 4;
            downOverlap.push(data[idx], data[idx + 1], data[idx + 2], data[idx + 3]);
          }
        }
        signatures.downOverlap = downOverlap.join(',');

        // Up overlap: rows 0 to tileSize-2 (all columns)
        const upOverlap: number[] = [];
        for (let r = 0; r < tileSize - 1; r++) {
          for (let c = 0; c < tileSize; c++) {
            const idx = (r * tileSize + c) * 4;
            upOverlap.push(data[idx], data[idx + 1], data[idx + 2], data[idx + 3]);
          }
        }
        signatures.upOverlap = upOverlap.join(',');

        this.overlapSignatures.set(tile.id, signatures);
      }
    }

    /**
     * Compute which tiles can be adjacent using the overlap model.
     * Optimized to O(n²) instead of O(n²·s²).
     */
    private computeNeighbors(): Map<number, AdjacencyRules> {
      const neighbors = new Map<number, AdjacencyRules>();
      if (!this.tiles.length) return neighbors;

      for (const tileA of this.tiles) {
        const sigA = this.overlapSignatures.get(tileA.id);
        if (!sigA) continue;

        const upSet = new Set<number>();
        const downSet = new Set<number>();
        const leftSet = new Set<number>();
        const rightSet = new Set<number>();

        for (const tileB of this.tiles) {
          const sigB = this.overlapSignatures.get(tileB.id);
          if (!sigB) continue;

          // Tile B can be to the RIGHT: A's right overlap matches B's left overlap
          if (sigA.rightOverlap === sigB.leftOverlap) {
            rightSet.add(tileB.id);
          }

          // Tile B can be to the LEFT: A's left overlap matches B's right overlap
          if (sigA.leftOverlap === sigB.rightOverlap) {
            leftSet.add(tileB.id);
          }

          // Tile B can be BELOW: A's down overlap matches B's up overlap
          if (sigA.downOverlap === sigB.upOverlap) {
            downSet.add(tileB.id);
          }

          // Tile B can be ABOVE: A's up overlap matches B's down overlap
          if (sigA.upOverlap === sigB.downOverlap) {
            upSet.add(tileB.id);
          }
        }

        neighbors.set(tileA.id, {
          up: Array.from(upSet),
          down: Array.from(downSet),
          left: Array.from(leftSet),
          right: Array.from(rightSet)
        });
      }

      return neighbors;
    }

    /**
     * Get all tiles
     */
    getTiles(): Tile[] {
      return this.tiles;
    }

    /**
     * Get adjacency rules for all tiles
     */
    getAdjacencyRules(): Map<number, AdjacencyRules> {
      return this.neighbors;
    }
  }
  