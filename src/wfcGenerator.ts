import { TileSet, Tile } from './tileSet';

interface Cell {
  x: number;
  y: number;
  collapsed: boolean;
  tileId: number | null;
  possibleTiles: Set<number>;
}

export class WFCGenerator {
  private gridWidth: number;
  private gridHeight: number;
  private tileSet: TileSet;
  private adjacencyRules: Map<number, { up: number[]; down: number[]; left: number[]; right: number[] }>;
  private grid: Cell[][] = [];
  private tileSize: number;
  private overlapSize: number;

  constructor(tileSet: TileSet, gridWidth: number, gridHeight: number) {
    this.tileSet = tileSet;
    this.gridWidth = gridWidth;
    this.gridHeight = gridHeight;
    this.adjacencyRules = tileSet.getAdjacencyRules();
    this.tileSize = tileSet.getTiles()[0]?.pixelData.width || 3;
    this.overlapSize = this.tileSize - 1; // Overlap model: tiles share tileSize-1 pixels
    
    console.log('WFC Generator initialized:');
    console.log(`  Grid: ${gridWidth}x${gridHeight}`);
    console.log(`  Tile size: ${this.tileSize}x${this.tileSize}`);
    console.log(`  Overlap: ${this.overlapSize} pixels`);
    console.log(`  Total tiles: ${tileSet.getTiles().length}`);
    
    this.initializeGrid();
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
  async generate(onProgress?: (attempt: number, maxAttempts: number, iteration: number, maxIterations: number) => void): Promise<ImageData | null> {
    console.log('Starting WFC generation...');
    const maxAttempts = 10;
    let lastContradictionCell: { x: number; y: number } | null = null;
    let contradictionCount = 0;
    
    for (let attempt = 0; attempt < maxAttempts; attempt++) {
      console.log(`\nAttempt ${attempt + 1}/${maxAttempts}`);
      this.initializeGrid();
      
      let iteration = 0;
      const maxIterations = this.gridWidth * this.gridHeight;
      
      while (iteration < maxIterations) {
        // Update progress
        if (onProgress) {
          onProgress(attempt + 1, maxAttempts, iteration, maxIterations);
        }
        
        // Find cell with minimum entropy
        const cell = this.findMinEntropyCell();
        
        if (!cell) {
          console.log('✓ Grid fully collapsed!');
          if (onProgress) {
            onProgress(attempt + 1, maxAttempts, maxIterations, maxIterations);
          }
          return this.render();
        }
        
        // Collapse the cell
        this.collapseCell(cell);
        console.log(`Iteration ${iteration}: Collapsed (${cell.x},${cell.y}) to tile ${cell.tileId}`);
        
        // Propagate constraints
        await this.propagateConstraints(cell);
        
        // Check for contradictions
        const contradictionCell = this.getContradictionCell();
        if (contradictionCell) {
          console.log(`✗ Contradiction at (${contradictionCell.x},${contradictionCell.y}), restarting...`);
          lastContradictionCell = contradictionCell;
          contradictionCount++;
          break;
        }
        
        iteration++;
      }
      
      // Check if we completed successfully
      if (!this.getContradictionCell() && this.isFullyCollapsed()) {
        console.log('✓ Generation successful!');
        if (onProgress) {
          onProgress(attempt + 1, maxAttempts, maxIterations, maxIterations);
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
   * Find cell with minimum entropy (fewest possibilities)
   */
  private findMinEntropyCell(): Cell | null {
    let minEntropy = Infinity;
    let minCells: Cell[] = [];

    for (let y = 0; y < this.gridHeight; y++) {
      for (let x = 0; x < this.gridWidth; x++) {
        const cell = this.grid[y][x];
        if (cell.collapsed) continue;

        const entropy = cell.possibleTiles.size;
        if (entropy < minEntropy) {
          minEntropy = entropy;
          minCells = [cell];
        } else if (entropy === minEntropy) {
          minCells.push(cell);
        }
      }
    }

    if (minCells.length === 0) return null;
    
    // Random tie-breaking
    return minCells[Math.floor(Math.random() * minCells.length)];
  }

  /**
   * Collapse a cell to a random tile from its possibilities
   */
  private collapseCell(cell: Cell): void {
    const possibilities = Array.from(cell.possibleTiles);
    const chosenTile = possibilities[Math.floor(Math.random() * possibilities.length)];
    
    cell.collapsed = true;
    cell.tileId = chosenTile;
    cell.possibleTiles = new Set([chosenTile]);
  }

  /**
   * Propagate constraints to neighboring cells
   * Proper WFC algorithm: recompute possibilities based on ALL collapsed neighbors
   */
  private async propagateConstraints(startCell: Cell): Promise<void> {
    const stack: Cell[] = [];
    const visited = new Set<string>();
    
    // Add all neighbors of start cell to stack
    const startNeighbors = this.getNeighbors(startCell);
    for (const { neighbor } of startNeighbors) {
      if (!neighbor.collapsed) {
        stack.push(neighbor);
      }
    }

    let propagationSteps = 0;

    while (stack.length > 0) {
      const cell = stack.pop()!;
      const key = `${cell.x},${cell.y}`;
      
      if (visited.has(key)) continue;
      visited.add(key);
      
      if (cell.collapsed) continue;
      
      propagationSteps++;

      // Recompute valid tiles based on ALL collapsed neighbors
      const beforeSize = cell.possibleTiles.size;
      const validTiles = this.computeValidTilesForCell(cell);
      
      if (validTiles.size < beforeSize) {
        cell.possibleTiles = validTiles;
        console.log(`  Updated (${cell.x},${cell.y}): ${beforeSize} -> ${cell.possibleTiles.size} possibilities`);
        
        if (cell.possibleTiles.size === 0) {
          console.error(`  CONTRADICTION at (${cell.x},${cell.y})!`);
          return;
        }
        
        // Cell changed, propagate to its neighbors
        const neighbors = this.getNeighbors(cell);
        for (const { neighbor } of neighbors) {
          if (!neighbor.collapsed && !visited.has(`${neighbor.x},${neighbor.y}`)) {
            stack.push(neighbor);
          }
        }
      }
    }
    
    console.log(`  Propagation took ${propagationSteps} steps`);
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
      
      // Intersect current valid tiles with what this neighbor allows
      validTiles = new Set(
        Array.from(validTiles).filter(t => allowedByNeighbor.has(t))
      );
      
      console.log(`    From ${direction} (tile ${neighbor.tileId}): allows ${Array.from(allowedByNeighbor).join(',')} -> now ${validTiles.size} options`);
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
    const step = this.tileSize - this.overlapSize; // For overlap model: step = 1 pixel
    const actualWidth = this.tileSize + (this.gridWidth - 1) * step;
    const actualHeight = this.tileSize + (this.gridHeight - 1) * step;
    
    console.log(`Rendering output: ${actualWidth}x${actualHeight} (step=${step})`);
    
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
