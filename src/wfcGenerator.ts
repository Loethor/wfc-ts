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
  private tileFrequencies: Map<number, number>;
  private history: HistoryEntry[];
  private snapshots: GridSnapshot[] = [];
  private snapshotInterval: number = 10;
  private recentContradictions: number = 0;
  private debug: boolean = false;
  private maxBacktrackDepth: number = 32; // Maximum steps to roll back at once
  // Directional collapse disabled
  private collapseDirection: null = null;
  private useDirectionalCollapse: boolean = false;

  constructor(tileSet: TileSet, gridWidth: number, gridHeight: number) {
    this.tileSet = tileSet;
    this.gridWidth = gridWidth;
    this.gridHeight = gridHeight;
    this.adjacencyRules = tileSet.getAdjacencyRules();
    this.tileSize = tileSet.getTiles()[0]?.pixelData.width || 3;
    this.overlapSize = this.tileSize - 1; // Overlap model: tiles share tileSize-1 pixels
    this.tileWeights = this.computeTileWeights();
    // Use actual frequencies from the sample
    this.tileFrequencies = tileSet.getTileFrequencies();
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
   * Get normalized frequency weight for a tile
   * Uses actual occurrence count from the sample image
   */
  private getFrequencyWeight(tileId: number): number {
    const freq = this.tileFrequencies.get(tileId) || 1;
    // Return the raw frequency - more common tiles are more likely
    return freq;
  }

  /**
   * Smart initial seeding with multiple strategies
   */
  private seedEdges(): void {
    const cellsToSeed: Cell[] = [];
    const cellCount = this.gridWidth * this.gridHeight;
    
    // Strategy 1: Corners (always)
    cellsToSeed.push(
      this.grid[0][0],
      this.grid[0][this.gridWidth - 1],
      this.grid[this.gridHeight - 1][0],
      this.grid[this.gridHeight - 1][this.gridWidth - 1]
    );
    
    // Strategy 2: Scattered random seeding for medium grids
    if (cellCount >= 100 && cellCount < 400) {
      const seedCount = Math.floor(Math.sqrt(cellCount) / 2); // ~5 for 10x10
      for (let i = 0; i < seedCount; i++) {
        const x = Math.floor(Math.random() * this.gridWidth);
        const y = Math.floor(Math.random() * this.gridHeight);
        const cell = this.grid[y][x];
        if (!cell.collapsed) {
          cellsToSeed.push(cell);
        }
      }
    }
    
    // Strategy 3: Checkerboard pattern for larger grids
    if (cellCount >= 400) {
      const step = Math.floor(Math.sqrt(cellCount) / 5); // Every ~4 cells for 20x20
      for (let y = 0; y < this.gridHeight; y += step) {
        for (let x = 0; x < this.gridWidth; x += step) {
          if (y < this.gridHeight && x < this.gridWidth) {
            cellsToSeed.push(this.grid[y][x]);
          }
        }
      }
    }
    
    // Collapse seeded cells with high-frequency tiles
    for (const cell of cellsToSeed) {
      if (cell && cell.possibleTiles.size > 1 && !cell.collapsed) {
        this.collapseCell(cell);
        this.propagateConstraints(cell);
        
        // Check for early contradiction
        if (this.getContradictionCell()) {
          return;
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
  async generate(
    onProgress?: (attempt: number, maxAttempts: number, iteration: number, maxIterations: number) => void,
    onVisualize?: (imageData: ImageData) => void
  ): Promise<ImageData | null> {
    const cellCount = this.gridWidth * this.gridHeight;
    const maxAttempts = Math.min(12, Math.ceil(4 + cellCount / 15));
    const maxBacktracks = Math.min(500, cellCount * 10); // Very aggressive backtracking
    let contradictionCount = 0;
    
    for (let attempt = 0; attempt < maxAttempts; attempt++) {
      this.initializeGrid();
      this.history = [];
      this.snapshots = [];
      this.recentContradictions = 0;
      
      // Start with a single random cell collapsed to a random tile
      const rx = Math.floor(Math.random() * this.gridWidth);
      const ry = Math.floor(Math.random() * this.gridHeight);
      const cell = this.grid[ry][rx];
      const allTileIds = Array.from(cell.possibleTiles);
      const randomTile = allTileIds[Math.floor(Math.random() * allTileIds.length)];
      cell.collapsed = true;
      cell.tileId = randomTile;
      cell.possibleTiles = new Set([randomTile]);
      this.recordCollapse(cell, randomTile);
      
      let iteration = 0;
      let backtracks = 0;
      const totalCells = this.gridWidth * this.gridHeight;
      const maxIterations = totalCells * 3; // Allow extra iterations for backtracking
      
      while (iteration < maxIterations && backtracks < maxBacktracks) {
        // Calculate progress based on collapsed cells, not iterations
        if (onProgress && iteration % 5 === 0) {
          const collapsedCount = this.countCollapsedCells();
          onProgress(attempt + 1, maxAttempts, collapsedCount, totalCells);
        }
        
        const cell = this.useDirectionalCollapse 
          ? this.findNextDirectionalCell() 
          : this.findMinEntropyCell();
        
        if (!cell) {
          if (onProgress) {
            onProgress(attempt + 1, maxAttempts, totalCells, totalCells);
          }
          return this.render();
        }
        
        this.collapseCell(cell);
        this.propagateConstraints(cell);
        
        // Visualize current state and allow browser to repaint
        if (onVisualize && iteration % 2 === 0) {
          const partialRender = this.renderPartial();
          if (partialRender) {
            onVisualize(partialRender);
            // Small delay to allow browser repaint
            await new Promise(resolve => setTimeout(resolve, 1));
          }
        }
        
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
          onProgress(attempt + 1, maxAttempts, totalCells, totalCells);
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
   * Find cell with minimum entropy using weighted Shannon entropy
   * Considers: tile frequencies, connectivity, and neighbor constraints
   */
  private findMinEntropyCell(): Cell | null {
    let minEntropy = Infinity;
    let bestCell: Cell | null = null;

    for (let y = 0; y < this.gridHeight; y++) {
      for (let x = 0; x < this.gridWidth; x++) {
        const cell = this.grid[y][x];
        if (cell.collapsed) continue;

        // Weighted Shannon entropy with frequency consideration
        let sumWeights = 0;
        let sumWeightLogWeight = 0;
        
        for (const tileId of cell.possibleTiles) {
          // Combine connectivity weight and frequency, favoring frequency
          const connectivity = this.tileWeights.get(tileId) || 1;
          const frequency = this.getFrequencyWeight(tileId);
          // Frequency is 3x more important than connectivity
          const weight = (frequency * 3 + connectivity) / 4;
          
          sumWeights += weight;
          sumWeightLogWeight += weight * Math.log(weight);
        }
        
        // Shannon entropy
        let entropy = Math.log(sumWeights) - (sumWeightLogWeight / sumWeights);
        
        // Bonus: prefer cells with more collapsed neighbors (MRV with degree heuristic)
        const neighbors = this.getNeighbors(cell);
        const collapsedNeighbors = neighbors.filter(n => n.neighbor.collapsed).length;
        entropy -= collapsedNeighbors * 0.1; // Small bonus for constrained cells
        
        // Small random noise for tie-breaking
        entropy += Math.random() * 0.001;
        
        if (entropy < minEntropy) {
          minEntropy = entropy;
          bestCell = cell;
        }
      }
    }

    return bestCell;
  }

  /**
   * Find next cell to collapse using directional wave strategy
   * Collapses from one edge to the opposite edge in a systematic order
   */
  private findNextDirectionalCell(): Cell | null {
    if (!this.collapseDirection) {
      return this.findMinEntropyCell();
    }

    switch (this.collapseDirection) {
      case 'left-to-right':
        // Collapse column by column, left to right
        for (let x = 0; x < this.gridWidth; x++) {
          for (let y = 0; y < this.gridHeight; y++) {
            const cell = this.grid[y][x];
            if (!cell.collapsed && cell.possibleTiles.size > 0) {
              return cell;
            }
          }
        }
        break;

      case 'right-to-left':
        // Collapse column by column, right to left
        for (let x = this.gridWidth - 1; x >= 0; x--) {
          for (let y = 0; y < this.gridHeight; y++) {
            const cell = this.grid[y][x];
            if (!cell.collapsed && cell.possibleTiles.size > 0) {
              return cell;
            }
          }
        }
        break;

      case 'top-to-bottom':
        // Collapse row by row, top to bottom
        for (let y = 0; y < this.gridHeight; y++) {
          for (let x = 0; x < this.gridWidth; x++) {
            const cell = this.grid[y][x];
            if (!cell.collapsed && cell.possibleTiles.size > 0) {
              return cell;
            }
          }
        }
        break;

      case 'bottom-to-top':
        // Collapse row by row, bottom to top
        for (let y = this.gridHeight - 1; y >= 0; y--) {
          for (let x = 0; x < this.gridWidth; x++) {
            const cell = this.grid[y][x];
            if (!cell.collapsed && cell.possibleTiles.size > 0) {
              return cell;
            }
          }
        }
        break;
    }

    return null;
  }

  /**
   * Collapse a cell to a weighted random tile using frequency and compatibility
   */
  private collapseCell(cell: Cell): void {
    const possibilities = Array.from(cell.possibleTiles);
    // Uniform weighting: ignore frequency, all tiles equally likely
    const weights = possibilities.map(() => 1);

    // Try tiles in weighted random order, but skip any that would cause a contradiction in a neighbor (lookahead)
    const weightedTiles = possibilities
      .map((id, i) => ({ id, weight: weights[i] }))
      .sort((a, b) => Math.random() * (b.weight - a.weight));

    let chosenTile: number | null = null;
    for (const { id } of weightedTiles) {
      // Simulate assigning this tile
      // For each neighbor, check if at least one valid tile remains
      let valid = true;
      for (const { direction, neighbor } of this.getNeighbors(cell)) {
        if (neighbor.collapsed) continue;
        // Simulate neighbor's possible tiles if this cell is assigned 'id'
        const neighborPossible = new Set(neighbor.possibleTiles);
        // Only keep tiles compatible with this assignment
        const rules = this.adjacencyRules.get(id);
        if (!rules) continue;
        const allowed = new Set(rules[direction]);
        const filtered = Array.from(neighborPossible).filter(tid => allowed.has(tid));
        if (filtered.length === 0) {
          valid = false;
          break;
        }
      }
      if (valid) {
        chosenTile = id;
        break;
      }
    }

    // If no tile passes lookahead, fall back to first possible tile (contradiction will be handled by backtracking)
    if (chosenTile === null) {
      chosenTile = possibilities[0];
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

    // Exponential/adaptive backtracking: increase rollback depth after repeated contradictions
    let stepsToRemove = 1;
    if (this.recentContradictions > 6) {
      stepsToRemove = Math.min(this.maxBacktrackDepth, Math.floor(this.history.length / 2));
    } else if (this.recentContradictions > 3) {
      stepsToRemove = Math.min(8, this.history.length);
    } else if (this.recentContradictions > 1) {
      stepsToRemove = Math.min(4, this.history.length);
    } else {
      stepsToRemove = Math.min(2, this.history.length);
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
   * Render partial grid state for visualization (showing uncollapsed cells as gray)
   */
  private renderPartial(): ImageData | null {
    const step = this.tileSize - this.overlapSize;
    const actualWidth = this.tileSize + (this.gridWidth - 1) * step;
    const actualHeight = this.tileSize + (this.gridHeight - 1) * step;
    
    const canvas = document.createElement('canvas');
    canvas.width = actualWidth;
    canvas.height = actualHeight;
    const ctx = canvas.getContext('2d');
    
    if (!ctx) return null;

    // Fill with light gray background for uncollapsed cells
    ctx.fillStyle = '#e0e0e0';
    ctx.fillRect(0, 0, actualWidth, actualHeight);

    // Render collapsed tiles
    for (let y = 0; y < this.gridHeight; y++) {
      for (let x = 0; x < this.gridWidth; x++) {
        const cell = this.grid[y][x];
        if (!cell.collapsed || cell.tileId === null) {
          // Show uncollapsed cells as solid gray
          ctx.fillStyle = '#808080';
          const posX = x * step;
          const posY = y * step;
          ctx.fillRect(posX, posY, this.tileSize, this.tileSize);
          continue;
        }

        const tile = this.tileSet.getTiles().find((t: Tile) => t.id === cell.tileId);
        if (!tile) continue;

        const tempCanvas = document.createElement('canvas');
        tempCanvas.width = tile.pixelData.width;
        tempCanvas.height = tile.pixelData.height;
        const tempCtx = tempCanvas.getContext('2d');
        if (!tempCtx) continue;

        tempCtx.putImageData(tile.pixelData, 0, 0);
        
        const posX = x * step;
        const posY = y * step;
        
        ctx.drawImage(tempCanvas, posX, posY);
      }
    }

    return ctx.getImageData(0, 0, actualWidth, actualHeight);
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
   * Count how many cells are collapsed
   */
  private countCollapsedCells(): number {
    let count = 0;
    for (let y = 0; y < this.gridHeight; y++) {
      for (let x = 0; x < this.gridWidth; x++) {
        if (this.grid[y][x].collapsed) {
          count++;
        }
      }
    }
    return count;
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
