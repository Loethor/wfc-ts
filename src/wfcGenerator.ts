import { TileSet, Tile } from './tileSet';

interface Cell {
  x: number;
  y: number;
  collapsed: boolean;
  tileId: number | null;
  possibleTiles: Set<number>;
}

interface HistoryEntry {
  x: number;
  y: number;
  tileId: number;
}

export class WFCGenerator {
  private gridWidth: number;
  private gridHeight: number;
  private tileSet: TileSet;
  private adjacencyRules: Map<number, { up: number[]; down: number[]; left: number[]; right: number[] }>;
  private grid: Cell[][] = [];
  private tileSize: number;
  private overlapSize: number;
  private tileWeights: Map<number, number>;
  private history: HistoryEntry[];
  private debug: boolean = false; // Set to true to enable logging

  constructor(tileSet: TileSet, gridWidth: number, gridHeight: number) {
    this.tileSet = tileSet;
    this.gridWidth = gridWidth;
    this.gridHeight = gridHeight;
    this.adjacencyRules = tileSet.getAdjacencyRules();
    this.tileSize = tileSet.getTiles()[0]?.pixelData.width || 3;
    this.overlapSize = this.tileSize - 1; // Overlap model: tiles share tileSize-1 pixels
    this.tileWeights = this.computeTileWeights();
    this.history = [];
    this.initializeGrid();
  }

  /**
   * Compute tile weights based on connectivity (more connections = higher weight)
   */
  private computeTileWeights(): Map<number, number> {
    const weights = new Map<number, number>();
    
    for (const tile of this.tileSet.getTiles()) {
      const rules = this.adjacencyRules.get(tile.id);
      if (!rules) continue;
      
      // Weight = total number of valid neighbors + 1 (to allow isolated tiles)
      const connectivity = rules.up.length + rules.down.length + rules.left.length + rules.right.length;
      weights.set(tile.id, connectivity + 1);
    }
    
    return weights;
  }

  /**
   * Initialize grid with all tiles possible in each cell
   */
  private initializeGrid(): void {
    const allTileIds = this.tileSet.getTiles().map((t: Tile) => t.id);
    console.log(`Initializing grid with ${allTileIds.length} possible tiles per cell`);

    for (let y = 0; y < this.gridHeight; y++) {
      this.grid[y] = [];
      for (let x = 0; x < this.gridWidth; x++) {
        this.grid[y][x] = {
          x,
          y,
          collapsed: false,
          tileId: null,
          possibleTiles: new Set(allTileIds),
        };
      }
    }
  }

  /**
   * Main WFC generation loop
   */
  generate(onProgress?: (attempt: number, maxAttempts: number, iteration: number, maxIterations: number) => void): ImageData | null {
    const cellCount = this.gridWidth * this.gridHeight;
    const maxAttempts = Math.min(20, Math.ceil(5 + cellCount / 10));
    const maxBacktracks = Math.min(50, cellCount * 2);
    let contradictionCount = 0;
    
    for (let attempt = 0; attempt < maxAttempts; attempt++) {
      this.initializeGrid();
      this.history = [];
      
      let iteration = 0;
      let backtracks = 0;
      const maxIterations = this.gridWidth * this.gridHeight * 2;
      
      while (iteration < maxIterations && backtracks < maxBacktracks) {
        if (onProgress && iteration % 5 === 0) {
          onProgress(attempt + 1, maxAttempts, iteration, this.gridWidth * this.gridHeight);
        }
        
        const cell = this.findMinEntropyCell();
        
        if (!cell) {
          if (onProgress) {
            onProgress(attempt + 1, maxAttempts, this.gridWidth * this.gridHeight, this.gridWidth * this.gridHeight);
          }
          return this.render();
        }
        
        this.collapseCell(cell);
        this.propagateConstraints(cell);
        
        const contradictionCell = this.getContradictionCell();
        if (contradictionCell) {
          contradictionCount++;
          
          if (this.history.length > 0 && backtracks < maxBacktracks) {
            this.backtrack();
            backtracks++;
            iteration++;
            continue;
          } else {
            break;
          }
        }
        
        iteration++;
      }
      
      if (!this.getContradictionCell() && this.isFullyCollapsed()) {
        if (onProgress) {
          onProgress(attempt + 1, maxAttempts, this.gridWidth * this.gridHeight, this.gridWidth * this.gridHeight);
        }
        return this.render();
      }
    }
    
    // Failed after all attempts - provide detailed error
    const errorDetails = {
      attempts: maxAttempts,
      contradictions: contradictionCount,
      lastContradiction: lastContradictionCell,
      gridSize: `${this.gridWidth}x${this.gridHeight}`,
      tileCount: this.tileSet.getTiles().length
    };
    
    console.error('Failed to generate after max attempts:', errorDetails);
    throw new Error(
      `Could not generate valid output after ${maxAttempts} attempts. ` +
      `Try: (1) Smaller grid size, (2) Different tile size, or (3) Different sample image.`
    );
  }

  /**
   * Find cell with minimum entropy using Shannon entropy + noise for better distribution
   */
  private findMinEntropyCell(): Cell | null {
    let minEntropy = Infinity;
    let bestCell: Cell | null = null;

    for (let y = 0; y < this.gridHeight; y++) {
      for (let x = 0; x < this.gridWidth; x++) {
        const cell = this.grid[y][x];
        if (cell.collapsed) continue;

        // Shannon entropy: sum of weight * log(weight)
        let sumWeights = 0;
        let sumWeightLogWeight = 0;
        
        for (const tileId of cell.possibleTiles) {
          const weight = this.tileWeights.get(tileId) || 1;
          sumWeights += weight;
          sumWeightLogWeight += weight * Math.log(weight);
        }
        
        // Shannon entropy with small noise to break ties randomly
        const entropy = Math.log(sumWeights) - (sumWeightLogWeight / sumWeights) + (Math.random() * 0.001);
        
        if (entropy < minEntropy) {
          minEntropy = entropy;
          bestCell = cell;
        }
      }
    }

    return bestCell;
  }

  /**
   * Collapse a cell to a weighted random tile from its possibilities
   */
  private collapseCell(cell: Cell): void {
    const possibilities = Array.from(cell.possibleTiles);
    
    // Weighted random selection
    const weights = possibilities.map(id => this.tileWeights.get(id) || 1);
    const totalWeight = weights.reduce((sum, w) => sum + w, 0);
    
    let random = Math.random() * totalWeight;
    let chosenTile = possibilities[0];
    
    for (let i = 0; i < possibilities.length; i++) {
      random -= weights[i];
      if (random <= 0) {
        chosenTile = possibilities[i];
        break;
      }
    }
    
    cell.collapsed = true;
    cell.tileId = chosenTile;
    cell.possibleTiles = new Set([chosenTile]);
    
    // Record this decision for backtracking
    this.recordCollapse(cell, chosenTile);
  }

  /**
   * Record a collapse decision for replay during backtracking
   */
  private recordCollapse(cell: Cell, tileId: number): void {
    this.history.push({
      x: cell.x,
      y: cell.y,
      tileId: tileId
    });
  }

  /**
   * Backtrack by removing last decision and replaying history
   */
  private backtrack(): void {
    if (this.history.length === 0) return;
    
    this.history.pop();
    this.initializeGrid();
    
    for (const entry of this.history) {
      const cell = this.grid[entry.y][entry.x];
      cell.collapsed = true;
      cell.tileId = entry.tileId;
      cell.possibleTiles = new Set([entry.tileId]);
      this.propagateConstraints(cell);
      
      if (this.getContradictionCell()) {
        this.history = [];
        this.initializeGrid();
        return;
      }
    }
  }

  /**
   * Propagate constraints to neighboring cells
   */
  private propagateConstraints(startCell: Cell): void {
    const stack: Cell[] = [];
    const visited = new Set<string>();
    
    const startNeighbors = this.getNeighbors(startCell);
    for (const { neighbor } of startNeighbors) {
      if (!neighbor.collapsed) {
        stack.push(neighbor);
      }
    }

    while (stack.length > 0) {
      const cell = stack.pop()!;
      const key = `${cell.x},${cell.y}`;
      
      if (visited.has(key)) continue;
      visited.add(key);
      
      if (cell.collapsed) continue;

      const beforeSize = cell.possibleTiles.size;
      const validTiles = this.computeValidTilesForCell(cell);
      
      if (validTiles.size < beforeSize) {
        cell.possibleTiles = validTiles;
        
        if (cell.possibleTiles.size === 0) {
          return; // Contradiction found
        }
        
        const neighbors = this.getNeighbors(cell);
        for (const { neighbor } of neighbors) {
          if (!neighbor.collapsed && !visited.has(`${neighbor.x},${neighbor.y}`)) {
            stack.push(neighbor);
          }
        }
      }
    }
  }

  /**
   * Compute valid tiles for a cell based on ALL its collapsed neighbors
   * This is the core WFC constraint propagation logic
   */
  private computeValidTilesForCell(cell: Cell): Set<number> {
    // Start with all current possibilities
    let validTiles = new Set(cell.possibleTiles);

    const neighbors = this.getNeighbors(cell);

    // For each neighbor direction, intersect with allowed tiles
    for (const { direction, neighbor } of neighbors) {
      if (!neighbor.collapsed || neighbor.tileId === null) continue;

      const neighborRules = this.adjacencyRules.get(neighbor.tileId);
      if (!neighborRules) continue;

      // Get the opposite direction (if neighbor is 'up' from cell, cell is 'down' from neighbor)
      const oppositeDir = this.getOppositeDirection(direction);
      
      // Get which tiles the neighbor allows in our direction
      const allowedByNeighbor = new Set(neighborRules[oppositeDir]);
      
      validTiles = new Set(
        Array.from(validTiles).filter(t => allowedByNeighbor.has(t))
      );
    }

    return validTiles;
  }

  /**
   * Get opposite direction for constraint checking
   */
  private getOppositeDirection(direction: 'up' | 'down' | 'left' | 'right'): 'up' | 'down' | 'left' | 'right' {
    const opposites = {
      up: 'down' as const,
      down: 'up' as const,
      left: 'right' as const,
      right: 'left' as const
    };
    return opposites[direction];
  }

  /**
   * Get neighboring cells with their directions
   */
  private getNeighbors(cell: Cell): Array<{ direction: 'up' | 'down' | 'left' | 'right'; neighbor: Cell }> {
    const neighbors: Array<{ direction: 'up' | 'down' | 'left' | 'right'; neighbor: Cell }> = [];

    if (cell.y > 0) {
      neighbors.push({ direction: 'up', neighbor: this.grid[cell.y - 1][cell.x] });
    }
    if (cell.y < this.gridHeight - 1) {
      neighbors.push({ direction: 'down', neighbor: this.grid[cell.y + 1][cell.x] });
    }
    if (cell.x > 0) {
      neighbors.push({ direction: 'left', neighbor: this.grid[cell.y][cell.x - 1] });
    }
    if (cell.x < this.gridWidth - 1) {
      neighbors.push({ direction: 'right', neighbor: this.grid[cell.y][cell.x + 1] });
    }

    return neighbors;
  }

  /**
   * Check if there's any contradiction in the grid and return its location
   */
  private getContradictionCell(): { x: number; y: number } | null {
    for (let y = 0; y < this.gridHeight; y++) {
      for (let x = 0; x < this.gridWidth; x++) {
        const cell = this.grid[y][x];
        if (!cell.collapsed && cell.possibleTiles.size === 0) {
          return { x, y };
        }
      }
    }
    return null;
  }

  /**
   * Check if all cells are collapsed
   */
  private isFullyCollapsed(): boolean {
    for (let y = 0; y < this.gridHeight; y++) {
      for (let x = 0; x < this.gridWidth; x++) {
        if (!this.grid[y][x].collapsed) {
          return false;
        }
      }
    }
    return true;
  }

  /**
   * Render the final grid to an ImageData
   */
  render(): ImageData {
    const step = this.tileSize - this.overlapSize;
    const actualWidth = this.tileSize + (this.gridWidth - 1) * step;
    const actualHeight = this.tileSize + (this.gridHeight - 1) * step;
    
    const canvas = document.createElement('canvas');
    canvas.width = actualWidth;
    canvas.height = actualHeight;
    const ctx = canvas.getContext('2d');
    
    if (!ctx) {
      throw new Error('Failed to get canvas context');
    }

    // Render each tile with overlap
    for (let y = 0; y < this.gridHeight; y++) {
      for (let x = 0; x < this.gridWidth; x++) {
        const cell = this.grid[y][x];
        if (cell.tileId === null) continue;

        const tile = this.tileSet.getTiles().find((t: Tile) => t.id === cell.tileId);
        if (!tile) continue;

        const tempCanvas = document.createElement('canvas');
        tempCanvas.width = tile.pixelData.width;
        tempCanvas.height = tile.pixelData.height;
        const tempCtx = tempCanvas.getContext('2d');
        if (!tempCtx) continue;

        tempCtx.putImageData(tile.pixelData, 0, 0);
        
        // Position tiles with overlap: each tile advances by step pixels
        const posX = x * step;
        const posY = y * step;
        
        ctx.drawImage(tempCanvas, posX, posY);
      }
    }

    return ctx.getImageData(0, 0, actualWidth, actualHeight);
  }
}
