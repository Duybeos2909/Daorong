import Phaser from "phaser";

export type BuildingType =
  | "house"
  | "farm"
  | "habitat";

export interface BuildingConfig {
  id?: string;
  type: BuildingType;

  col: number;
  row: number;
  cols: number;
  rows: number;

  level?: number;
  texture: string;
}

export class Building extends Phaser.GameObjects.Image {
  public readonly id: string;
  public readonly buildingType: BuildingType;

  public col: number;
  public row: number;

  public readonly cols: number;
  public readonly rows: number;

  public level: number;

  constructor(
    scene: Phaser.Scene,
    x: number,
    y: number,
    config: BuildingConfig,
  ) {
    super(scene, x, y, config.texture);

    scene.add.existing(this);

    this.id =
      config.id ??
      `${config.type}-${Date.now()}-${Phaser.Math.Between(
        1000,
        9999,
      )}`;

    this.buildingType = config.type;

    this.col = config.col;
    this.row = config.row;

    this.cols = config.cols;
    this.rows = config.rows;

    this.level = config.level ?? 1;

    this.setDepth(y + 500);
  }

  public occupiesCell(
    col: number,
    row: number,
  ): boolean {
    const endCol = this.col + this.cols - 1;
    const endRow = this.row + this.rows - 1;

    return (
      col >= this.col &&
      col <= endCol &&
      row >= this.row &&
      row <= endRow
    );
  }

  public overlapsArea(
    col: number,
    row: number,
    cols: number,
    rows: number,
  ): boolean {
    const thisEndCol = this.col + this.cols - 1;
    const thisEndRow = this.row + this.rows - 1;

    const otherEndCol = col + cols - 1;
    const otherEndRow = row + rows - 1;

    const separated =
      otherEndCol < this.col ||
      col > thisEndCol ||
      otherEndRow < this.row ||
      row > thisEndRow;

    return !separated;
  }

  public moveToGrid(
    col: number,
    row: number,
    worldX: number,
    worldY: number,
  ): void {
    this.col = col;
    this.row = row;

    this.setPosition(worldX, worldY);
    this.setDepth(worldY + 500);
  }

  public upgrade(): void {
    this.level += 1;
  }

  public getDisplayName(): string {
    switch (this.buildingType) {
      case "house":
        return "Nhà chính";

      case "farm":
        return "Nông trại";

      case "habitat":
        return "Môi trường sống";
    }
  }
}
