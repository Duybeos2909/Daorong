import Phaser from "phaser";
import {
  getFarmConstructionDuration,
  getFarmFoodReward,
  getFarmProductionDuration,
} from "../config/BuildingConfig";

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

  constructionStartedAt?: number;
  productionStartedAt?: number;
}

export class Building extends Phaser.GameObjects.Image {
  public readonly id: string;
  public readonly buildingType: BuildingType;

  public col: number;
  public row: number;

  public readonly cols: number;
  public readonly rows: number;

  public level: number;
  public constructionStartedAt: number;
  public productionStartedAt: number;

  private constructionLabel?: Phaser.GameObjects.Text;
  private harvestIcon?: Phaser.GameObjects.Text;

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

    const currentTime = Date.now();

    this.constructionStartedAt =
      config.constructionStartedAt ??
      currentTime;

    this.productionStartedAt =
      config.productionStartedAt ??
      0;

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

    this.updateFarmIndicatorPosition();
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

  public isFarm(): boolean {
    return this.buildingType === "farm";
  }

  public getConstructionDuration(): number {
    if (!this.isFarm()) {
      return 0;
    }

    return getFarmConstructionDuration(
      this.level,
    );
  }

  public isConstructionComplete(
    currentTime = Date.now(),
  ): boolean {
    if (!this.isFarm()) {
      return true;
    }

    return (
      currentTime -
        this.constructionStartedAt >=
      this.getConstructionDuration()
    );
  }

  public getRemainingConstructionTime(
    currentTime = Date.now(),
  ): number {
    if (!this.isFarm()) {
      return 0;
    }

    return Math.max(
      0,
      this.getConstructionDuration() -
        (currentTime -
          this.constructionStartedAt),
    );
  }

  public ensureProductionStarted(
    currentTime = Date.now(),
  ): void {
    if (
      !this.isFarm() ||
      !this.isConstructionComplete(
        currentTime,
      )
    ) {
      return;
    }

    if (this.productionStartedAt > 0) {
      return;
    }

    this.productionStartedAt =
      currentTime;
  }

  public getProductionDuration(): number {
    if (!this.isFarm()) {
      return 0;
    }

    return getFarmProductionDuration(
      this.level,
    );
  }

  public getFoodReward(): number {
    if (!this.isFarm()) {
      return 0;
    }

    return getFarmFoodReward(
      this.level,
    );
  }

  public isReadyToHarvest(
    currentTime = Date.now(),
  ): boolean {
    if (
      !this.isFarm() ||
      !this.isConstructionComplete(
        currentTime,
      )
    ) {
      return false;
    }

    this.ensureProductionStarted(
      currentTime,
    );

    return (
      currentTime -
        this.productionStartedAt >=
      this.getProductionDuration()
    );
  }

  public getRemainingProductionTime(
    currentTime = Date.now(),
  ): number {
    if (
      !this.isFarm() ||
      !this.isConstructionComplete(
        currentTime,
      )
    ) {
      return 0;
    }

    this.ensureProductionStarted(
      currentTime,
    );

    return Math.max(
      0,
      this.getProductionDuration() -
        (currentTime -
          this.productionStartedAt),
    );
  }

  public restartProduction(): void {
    if (
      !this.isFarm() ||
      !this.isConstructionComplete()
    ) {
      return;
    }

    this.productionStartedAt =
      Date.now();

    this.hideHarvestIcon();
  }

  public beginFarmUpgrade(): void {
    if (!this.isFarm()) {
      return;
    }

    this.constructionStartedAt =
      Date.now();

    this.productionStartedAt = 0;

    this.hideHarvestIcon();
    this.hideConstructionLabel();
  }

  public showConstructionLabel(
    remainingMilliseconds: number,
  ): void {
    const seconds = Math.ceil(
      remainingMilliseconds / 1000,
    );

    if (!this.constructionLabel) {
      this.constructionLabel = this.scene.add
        .text(
          this.x,
          this.y - 90,
          "",
          {
            fontFamily: "Arial",
            fontSize: "18px",
            color: "#ffffff",
            backgroundColor: "#111827",
            padding: {
              x: 8,
              y: 5,
            },
          },
        )
        .setOrigin(0.5)
        .setDepth(this.depth + 200);
    }

    this.constructionLabel
      .setText(`🔨 ${seconds}s`)
      .setPosition(
        this.x,
        this.y - 90,
      )
      .setDepth(this.depth + 200);
  }

  public hideConstructionLabel(): void {
    if (!this.constructionLabel) {
      return;
    }

    this.constructionLabel.destroy();
    this.constructionLabel =
      undefined;
  }

  public showHarvestIcon(): void {
    if (!this.isFarm() || this.harvestIcon) {
      return;
    }

    this.harvestIcon = this.scene.add
      .text(this.x, this.y - 95, "🌾", {
        fontFamily: "Arial",
        fontSize: "34px",
        backgroundColor: "#ffffff",
        padding: {
          x: 7,
          y: 4,
        },
      })
      .setOrigin(0.5)
      .setDepth(this.depth + 200);

    this.scene.tweens.add({
      targets: this.harvestIcon,
      y: this.harvestIcon.y - 10,
      duration: 550,
      ease: "Sine.InOut",
      yoyo: true,
      repeat: -1,
    });
  }

  public hideHarvestIcon(): void {
    if (!this.harvestIcon) {
      return;
    }

    this.scene.tweens.killTweensOf(
      this.harvestIcon,
    );

    this.harvestIcon.destroy();
    this.harvestIcon = undefined;
  }

  public updateFarmProduction(
    currentTime = Date.now(),
  ): void {
    if (!this.isFarm()) {
      return;
    }

    if (
      !this.isConstructionComplete(
        currentTime,
      )
    ) {
      this.hideHarvestIcon();

      this.showConstructionLabel(
        this.getRemainingConstructionTime(
          currentTime,
        ),
      );

      return;
    }

    this.hideConstructionLabel();

    this.ensureProductionStarted(
      currentTime,
    );

    if (
      this.isReadyToHarvest(
        currentTime,
      )
    ) {
      this.showHarvestIcon();
    } else {
      this.hideHarvestIcon();
    }
  }

  public updateFarmIndicatorPosition(): void {
    if (this.harvestIcon) {
      this.harvestIcon
        .setPosition(
          this.x,
          this.y - 95,
        )
        .setDepth(this.depth + 200);
    }

    if (this.constructionLabel) {
      this.constructionLabel
        .setPosition(
          this.x,
          this.y - 90,
        )
        .setDepth(this.depth + 200);
    }
  }

  public destroy(
    fromScene?: boolean,
  ): void {
    this.hideHarvestIcon();
    this.hideConstructionLabel();

    super.destroy(fromScene);
  }
}
