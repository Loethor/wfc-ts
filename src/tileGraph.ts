export interface Tile {
    id: number;
    canvas: HTMLCanvasElement;
    data: ImageData;
}

export type Direction = 'up' | 'down' | 'left' | 'right';

export interface TileNeighbors {
    up: number[];
    down: number[];
    left: number[];
    right: number[];
}

export class TileGraph {
    tiles: Tile[];
    neighbors: Map<number, TileNeighbors>;

    constructor(tiles: Tile[]) {
        this.tiles = tiles;
        this.neighbors = this.computeNeighbors();
    }

    private computeNeighbors(): Map<number, TileNeighbors> {
        const neighbors = new Map<number, TileNeighbors>();
        const tileSize = this.tiles[0].canvas.width;

        this.tiles.forEach((tileA, i) => {
            const compat: TileNeighbors = { up: [], down: [], left: [], right: [] };

            this.tiles.forEach((tileB, j) => {
                if (i === j) return;

                let matchRight = true;
                for (let y = 0; y < tileSize; y++) {
                    const aIndex = ((y * tileSize) + (tileSize - 1)) * 4;
                    const bIndex = (y * tileSize) * 4;
                    for (let k = 0; k < 4; k++) {
                        if (tileA.data.data[aIndex + k] !== tileB.data.data[bIndex + k]) {
                            matchRight = false;
                            break;
                        }
                    }
                    if (!matchRight) break;
                }
                if (matchRight) compat.right.push(tileB.id);

                let matchLeft = true;
                for (let y = 0; y < tileSize; y++) {
                    const aIndex = (y * tileSize) * 4;
                    const bIndex = ((y * tileSize) + (tileSize - 1)) * 4;
                    for (let k = 0; k < 4; k++) {
                        if (tileA.data.data[aIndex + k] !== tileB.data.data[bIndex + k]) {
                            matchLeft = false;
                            break;
                        }
                    }
                    if (matchLeft) compat.left.push(tileB.id);
                }

                let matchDown = true;
                for (let x = 0; x < tileSize; x++) {
                    const aIndex = ((tileSize - 1) * tileSize + x) * 4;
                    const bIndex = x * 4;
                    for (let k = 0; k < 4; k++) {
                        if (tileA.data.data[aIndex + k] !== tileB.data.data[bIndex + k]) {
                            matchDown = false;
                            break;
                        }
                    }
                    if (!matchDown) break;
                }
                if (matchDown) compat.down.push(tileB.id);

                let matchUp = true;
                for (let x = 0; x < tileSize; x++) {
                    const aIndex = x * 4;
                    const bIndex = ((tileSize - 1) * tileSize + x) * 4;
                    for (let k = 0; k < 4; k++) {
                        if (tileA.data.data[aIndex + k] !== tileB.data.data[bIndex + k]) {
                            matchUp = false;
                            break;
                        }
                    }
                    if (matchUp) compat.up.push(tileB.id);
                }
            });

            neighbors.set(tileA.id, compat);
        });

        return neighbors;
    }
}
