export interface GridPosition {
  col: number;
  row: number;
}

export class GridSystem {
  constructor(
    public readonly tileWidth: number,
    public readonly tileHeight: number,
    public readonly originX: number,
    public readonly originY: number,
  ) {}

  gridToWorld(col: number, row: number): { x: number; y: number } {
    return {
      x: this.originX + (col - row) * (this.tileWidth / 2),
      y: this.originY + (col + row) * (this.tileHeight / 2),
    };
  }

  worldToGrid(worldX: number, worldY: number): GridPosition {
    const localX = worldX - this.originX;
    const localY = worldY - this.originY;

    const col = Math.round(
      localX / this.tileWidth + localY / this.tileHeight,
    );
    const row = Math.round(
      localY / this.tileHeight - localX / this.tileWidth,
    );

    return { col, row };
  }
}
