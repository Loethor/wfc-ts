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

interface GridSnapshot {
  grid: Cell[][];
  historyLength: number;
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
  private snapshots: GridSnapshot[] = [];
  private snapshotInterval: number = 10;
  private recentContradictions: number = 0;
  private debug: boolean = false;

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
   * Seed edges with compatible tiles to constrain search space
   */
  private seedEdges(): void {
    const cellsToSeed: Cell[] = [];
    
    // Add corners
    cellsToSeed.push(
      this.grid[0][0],
      this.grid[0][this.gridWidth - 1],
      this.grid[this.gridHeight - 1][0],
      this.grid[this.gridHeight - 1][this.gridWidth - 1]
    );
    
    // Add some edge cells for larger grids
    if (this.gridWidth > 15 || this.gridHeight > 15) {
      const midX = Math.floor(this.gridWidth / 2);
      const midY = Math.floor(this.gridHeight / 2);
      
      cellsToSeed.push(
        this.grid[0][midX],
        this.grid[this.gridHeight - 1][midX],
        this.grid[midY][0],
        this.grid[midY][this.gridWidth - 1]
      );
    }
    
    // Collapse seeded cells
    for (const cell of cellsToSeed) {
      if (cell && cell.possibleTiles.size > 1 && !cell.collapsed) {
        this.collapseCell(cell);
        this.propagateConstraints(cell);
        
        // Check for early contradiction
        if (this.getContradictionCell()) {
          return; // Let main loop handle it
        }
      }
    }
  }

  /**
   * Initialize grid with all tiles possible in each cell
   */
  private initializeGrid(): void {
    const allTileIds = this.tileSet.getTiles().map((t: Tile) => t.id);

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
    const maxAttempts = Math.min(12, Math.ceil(4 + cellCount / 15));
    const maxBacktracks = Math.min(500, cellCount * 10); // Very aggressive backtracking
    let contradictionCount = 0;
    
    for (let attempt = 0; attempt < maxAttempts; attempt++) {
      this.initializeGrid();
      this.history = [];
      this.snapshots = [];
      this.recentContradictions = 0;
      
      // Strategic initial seeding for medium and large grids
      if (cellCount > 50) {
        this.seedEdges();
      }
      
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
          this.recentContradictions++;
          
          if (this.history.length > 0 && backtracks < maxBacktracks) {
            this.backtrack();
            backtracks++;
            iteration++;
            continue;
          } else {
            break;
          }
        }
        
        // Success - reset recent contradiction counter
        this.recentContradictions = Math.max(0, this.recentContradictions - 1);
        iteration++;
      }
      
      if (!this.getContradictionCell() && this.isFullyCollapsed()) {
        if (onProgress) {
          onProgress(attempt + 1, maxAttempts, this.gridWidth * this.gridHeight, this.gridWidth * this.gridHeight);
        }
        return this.render();
      }
    }
    
    // Failed after all attempts
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
   * Record a collapse decision and save snapshot periodically
   */
  private recordCollapse(cell: Cell, tileId: number): void {
    this.history.push({
      x: cell.x,
      y: cell.y,
      tileId: tileId
    });
    
    // Save snapshot periodically
    if (this.history.length % this.snapshotInterval === 0) {
      this.saveSnapshot();
    }
  }

  /**
   * Save current grid state as snapshot
   */
  private saveSnapshot(): void {
    const snapshot: GridSnapshot = {
      grid: this.grid.map(row => 
        row.map(cell => ({
          x: cell.x,
          y: cell.y,
          collapsed: cell.collapsed,
          tileId: cell.tileId,
          possibleTiles: new Set(cell.possibleTiles)
        }))
      ),
      historyLength: this.history.length
    };
    
    this.snapshots.push(snapshot);
    
    // Limit snapshot memory (keep last 5)
    if (this.snapshots.length > 5) {
      this.snapshots.shift();
    }
  }

  /**
   * Restore grid from snapshot
   */
  private restoreSnapshot(snapshot: GridSnapshot): void {
    for (let y = 0; y < this.gridHeight; y++) {
      for (let x = 0; x < this.gridWidth; x++) {
        const snapshotCell = snapshot.grid[y][x];
        const cell = this.grid[y][x];
        cell.collapsed = snapshotCell.collapsed;
        cell.tileId = snapshotCell.tileId;
        cell.possibleTiles = new Set(snapshotCell.possibleTiles);
      }
    }
  }

  /**
   * Backtrack using snapshots with adaptive multi-step rollback
   */
  private backtrack(): void {
    if (this.history.length === 0) return;
    
    // Adaptive backtracking: remove more steps if we're stuck (recent contradictions)
    let stepsToRemove = 1;
    if (this.recentContradictions > 3) {
      stepsToRemove = Math.min(3 + Math.floor(Math.random() * 3), this.history.length); // 3-5 steps
    } else if (this.recentContradictions > 1) {
      stepsToRemove = Math.min(2 + Math.floor(Math.random() * 2), this.history.length); // 2-3 steps
    } else {
      stepsToRemove = Math.min(1 + Math.floor(Math.random() * 2), this.history.length); // 1-2 steps
    }
    for (let i = 0; i < stepsToRemove; i++) {
      this.history.pop();
    }
    
    // Find nearest snapshot
    let snapshotToRestore: GridSnapshot | null = null;
    for (let i = this.snapshots.length - 1; i >= 0; i--) {
      if (this.snapshots[i].historyLength <= this.history.length) {
        snapshotToRestore = this.snapshots[i];
        // Remove snapshots after this point
        this.snapshots.splice(i + 1);
        break;
      }
    }
    
    // Restore from snapshot or reinitialize
    if (snapshotToRestore) {
      this.restoreSnapshot(snapshotToRestore);
      
      // Replay decisions after snapshot
      for (let i = snapshotToRestore.historyLength; i < this.history.length; i++) {
        const entry = this.history[i];
        const cell = this.grid[entry.y][entry.x];
        cell.collapsed = true;
        cell.tileId = entry.tileId;
        cell.possibleTiles = new Set([entry.tileId]);
        this.propagateConstraints(cell);
      }
    } else {
      // No snapshot, full replay
      this.initializeGrid();
      for (const entry of this.history) {
        const cell = this.grid[entry.y][entry.x];
        cell.collapsed = true;
        cell.tileId = entry.tileId;
        cell.possibleTiles = new Set([entry.tileId]);
        this.propagateConstraints(cell);
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
