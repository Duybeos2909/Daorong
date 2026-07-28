import Phaser from "phaser";
import { Dragon } from "../entities/Dragon";
import {
  Building,
  type BuildingType,
} from "../entities/Building";
import {
  GridSystem,
  type GridPosition,
} from "../systems/GridSystem";

interface BuildingFootprint {
  cols: number;
  rows: number;
}

export class IslandScene extends Phaser.Scene {
  private readonly mapCols = 14;
  private readonly mapRows = 14;

  private readonly grid = new GridSystem(
    64,
    32,
    900,
    220,
  );

  private dragon!: Dragon;

  private selectedBuilding: BuildingType | null = null;
  private selectedPlacedBuilding?: Building;
  private placementPreview?: Phaser.GameObjects.Image;
  private placementAreaGraphics?: Phaser.GameObjects.Graphics;
  private placementAreaLabel?: Phaser.GameObjects.Text;

  private buildings: Building[] = [];
  private buildingSelectionGraphics?: Phaser.GameObjects.Graphics;

  private dragCandidate?: Building;
  private draggingBuilding?: Building;

  private dragPointerStart = new Phaser.Math.Vector2();
  private dragOriginalCol = 0;
  private dragOriginalRow = 0;
  private dragPreviewCol = 0;
  private dragPreviewRow = 0;

  private readonly dragThreshold = 8;

  private draggingCamera = false;
  private previousPointer = new Phaser.Math.Vector2();

  private actionText!: Phaser.GameObjects.Text;

  private handleGlobalKeyDown = (
    event: KeyboardEvent,
  ): void => {
    if (
      event.key !== "Escape" &&
      event.code !== "Escape"
    ) {
      return;
    }

    event.preventDefault();
    event.stopPropagation();

    if (this.selectedBuilding || this.placementPreview) {
      this.cancelBuildingPlacement();
      return;
    }

    this.clearBuildingSelection();
  };

  constructor() {
    super("IslandScene");
  }

  create(): void {
    this.cameras.main.setBackgroundColor("#54a9d6");

    this.drawOcean();
    this.drawIsland();
    this.createStartingObjects();
    this.createHud();

    this.setupKeyboardControls();
    this.setupCameraControls();
    this.setupWorldInput();

    this.cameras.main.centerOn(900, 480);
    this.cameras.main.setZoom(1);
  }

  update(time: number, delta: number): void {
    this.dragon.update(time, delta);
  }

  private drawOcean(): void {
    const ocean = this.add.rectangle(
      900,
      480,
      3000,
      2000,
      0x3c9ed8,
    );

    ocean.setDepth(-100);
  }

  private drawIsland(): void {
    for (let row = 0; row < this.mapRows; row += 1) {
      for (let col = 0; col < this.mapCols; col += 1) {
        const point = this.grid.gridToWorld(col, row);

        const tile = this.add.image(
          point.x,
          point.y,
          "grass-tile",
        );

        tile.setDepth(point.y);
      }
    }
  }

  private createStartingObjects(): void {
    this.placeBuilding("house", 3, 3);

    const habitat = this.placeBuilding("habitat", 7, 7);

    const start = this.grid.gridToWorld(8.5, 8.5);

    this.dragon = new Dragon(this, start.x, start.y - 12);

    if (habitat) {
      this.assignDragonToHabitat(habitat);
    }
  }

  private createHud(): void {
    const panel = this.add.rectangle(
      0,
      0,
      330,
      200,
      0x111827,
      0.9,
    );

    panel
      .setOrigin(0)
      .setScrollFactor(0)
      .setDepth(100000);

    const title = this.add.text(
      16,
      12,
      "DRAGON ISLAND — PHASE 1",
      {
        fontFamily: "Arial",
        fontSize: "18px",
        color: "#ffffff",
        fontStyle: "bold",
      },
    );

    title
      .setScrollFactor(0)
      .setDepth(100001);

    const instruction = this.add.text(
      16,
      42,
      [
        "Chuột trái: chọn công trình / đặt nhà",
        "Chuột phải + kéo: di chuyển camera",
        "Lăn chuột: zoom",
        "Phím 1: chọn Nhà chính",
        "Phím 2: chọn Nông trại",
        "Phím 3: chọn Habitat",
        "ESC: hủy chế độ xây dựng",
      ],
      {
        fontFamily: "Arial",
        fontSize: "14px",
        color: "#dbeafe",
        lineSpacing: 4,
      },
    );

    instruction
      .setScrollFactor(0)
      .setDepth(100001);

    this.actionText = this.add.text(
      16,
      150,
      "Trạng thái: Di chuyển rồng",
      {
        fontFamily: "Arial",
        fontSize: "14px",
        color: "#facc15",
        fontStyle: "bold",
      },
    );

    this.actionText
      .setScrollFactor(0)
      .setDepth(100001);
  }

  private setupKeyboardControls(): void {
    const keyboard = this.input.keyboard;

    if (keyboard) {
      keyboard.on("keydown-ONE", () => {
        this.selectBuilding("house");
      });

      keyboard.on("keydown-NUMPAD_ONE", () => {
        this.selectBuilding("house");
      });

      keyboard.on("keydown-TWO", () => {
        this.selectBuilding("farm");
      });

      keyboard.on("keydown-NUMPAD_TWO", () => {
        this.selectBuilding("farm");
      });

      keyboard.on("keydown-THREE", () => {
        this.selectBuilding("habitat");
      });

      keyboard.on("keydown-NUMPAD_THREE", () => {
        this.selectBuilding("habitat");
      });

      keyboard.on("keydown-ESC", () => {
        if (this.selectedBuilding || this.placementPreview) {
          this.cancelBuildingPlacement();
          return;
        }

        this.clearBuildingSelection();
      });
    }

    window.addEventListener(
      "keydown",
      this.handleGlobalKeyDown,
      true,
    );

    this.events.once(
      Phaser.Scenes.Events.SHUTDOWN,
      () => {
        window.removeEventListener(
          "keydown",
          this.handleGlobalKeyDown,
          true,
        );
      },
    );

    this.events.once(
      Phaser.Scenes.Events.DESTROY,
      () => {
        window.removeEventListener(
          "keydown",
          this.handleGlobalKeyDown,
          true,
        );
      },
    );
  }

  private setupWorldInput(): void {
    this.input.on(
      "pointermove",
      (pointer: Phaser.Input.Pointer) => {
        if (this.draggingCamera) {
          return;
        }

        if (this.selectedBuilding) {
          this.updatePlacementPreview(pointer);
          return;
        }

        if (
          this.dragCandidate &&
          pointer.leftButtonDown()
        ) {
          const dragDistance =
            Phaser.Math.Distance.Between(
              this.dragPointerStart.x,
              this.dragPointerStart.y,
              pointer.x,
              pointer.y,
            );

          if (
            !this.draggingBuilding &&
            dragDistance >= this.dragThreshold
          ) {
            this.startBuildingDrag(this.dragCandidate);
          }
        }

        if (this.draggingBuilding) {
          this.updateBuildingDrag(pointer);
        }
      },
    );

    this.input.on(
      "pointerdown",
      (pointer: Phaser.Input.Pointer) => {
        if (!pointer.leftButtonDown()) {
          return;
        }

        if (
          pointer.x <= 330 &&
          pointer.y <= 200
        ) {
          return;
        }

        const worldPoint =
          pointer.positionToCamera(
            this.cameras.main,
          ) as Phaser.Math.Vector2;

        const gridPosition =
          this.grid.worldToGrid(
            worldPoint.x,
            worldPoint.y,
          );

        if (!this.isInsideMap(gridPosition)) {
          this.clearBuildingSelection();
          return;
        }

        if (this.selectedBuilding) {
          if (
            this.canPlaceBuilding(
              this.selectedBuilding,
              gridPosition.col,
              gridPosition.row,
            )
          ) {
            this.placeBuilding(
              this.selectedBuilding,
              gridPosition.col,
              gridPosition.row,
            );

            this.clearPlacementArea();
          }

          return;
        }

        const clickedBuilding = this.getBuildingAt(
          gridPosition.col,
          gridPosition.row,
        );

        if (clickedBuilding) {
          this.selectPlacedBuilding(clickedBuilding);

          this.dragCandidate = clickedBuilding;
          this.dragPointerStart.set(pointer.x, pointer.y);

          return;
        }

        this.dragCandidate = undefined;
        this.clearBuildingSelection();
      },
    );

    this.input.on(
      "pointerup",
      (pointer: Phaser.Input.Pointer) => {
        if (pointer.button !== 0) {
          return;
        }

        if (this.draggingBuilding) {
          this.finishBuildingDrag();
        }

        this.dragCandidate = undefined;
      },
    );
  }

  private setupCameraControls(): void {
    this.input.mouse?.disableContextMenu();

    this.input.on(
      "pointerdown",
      (pointer: Phaser.Input.Pointer) => {
        if (!pointer.rightButtonDown()) {
          return;
        }

        this.draggingCamera = true;

        this.previousPointer.set(
          pointer.x,
          pointer.y,
        );
      },
    );

    this.input.on(
      "pointerup",
      (pointer: Phaser.Input.Pointer) => {
        if (pointer.button === 2) {
          this.draggingCamera = false;
        }
      },
    );

    this.input.on(
      "pointermove",
      (pointer: Phaser.Input.Pointer) => {
        if (!this.draggingCamera) {
          return;
        }

        const camera = this.cameras.main;

        const dx =
          pointer.x - this.previousPointer.x;

        const dy =
          pointer.y - this.previousPointer.y;

        camera.scrollX -= dx / camera.zoom;
        camera.scrollY -= dy / camera.zoom;

        this.previousPointer.set(
          pointer.x,
          pointer.y,
        );
      },
    );

    this.input.on(
      "wheel",
      (
        _pointer: Phaser.Input.Pointer,
        _gameObjects: Phaser.GameObjects.GameObject[],
        _deltaX: number,
        deltaY: number,
      ) => {
        const camera = this.cameras.main;

        const nextZoom = Phaser.Math.Clamp(
          camera.zoom - deltaY * 0.001,
          0.55,
          1.8,
        );

        camera.setZoom(nextZoom);
      },
    );
  }

  private startBuildingDrag(
    building: Building,
  ): void {
    this.draggingBuilding = building;

    this.dragOriginalCol = building.col;
    this.dragOriginalRow = building.row;

    this.dragPreviewCol = building.col;
    this.dragPreviewRow = building.row;

    building.setAlpha(0.7);

    this.input.setDefaultCursor("grabbing");

    this.actionText.setText(
      `Đang di chuyển: ${building.getDisplayName()}`,
    );
  }

  private updateBuildingDrag(
    pointer: Phaser.Input.Pointer,
  ): void {
    if (!this.draggingBuilding) {
      return;
    }

    const worldPoint = pointer.positionToCamera(
      this.cameras.main,
    ) as Phaser.Math.Vector2;

    const gridPosition = this.grid.worldToGrid(
      worldPoint.x,
      worldPoint.y,
    );

    this.dragPreviewCol = gridPosition.col;
    this.dragPreviewRow = gridPosition.row;

    const footprint = {
      cols: this.draggingBuilding.cols,
      rows: this.draggingBuilding.rows,
    };

    const center = this.getBuildingWorldCenter(
      gridPosition.col,
      gridPosition.row,
      footprint,
    );

    this.draggingBuilding.setPosition(
      center.x,
      center.y - 36,
    );

    this.draggingBuilding.setDepth(center.y + 500);

    const canMove = this.canPlaceBuilding(
      this.draggingBuilding.buildingType,
      gridPosition.col,
      gridPosition.row,
      this.draggingBuilding,
    );

    this.draggingBuilding.setTint(
      canMove ? 0xffd54f : 0xff4444,
    );

    this.drawBuildingSelection(
      this.draggingBuilding,
      gridPosition.col,
      gridPosition.row,
    );
  }

  private finishBuildingDrag(): void {
    const building = this.draggingBuilding;

    if (!building) {
      return;
    }

    const canMove = this.canPlaceBuilding(
      building.buildingType,
      this.dragPreviewCol,
      this.dragPreviewRow,
      building,
    );

    const finalCol = canMove
      ? this.dragPreviewCol
      : this.dragOriginalCol;

    const finalRow = canMove
      ? this.dragPreviewRow
      : this.dragOriginalRow;

    const center = this.getBuildingWorldCenter(
      finalCol,
      finalRow,
      {
        cols: building.cols,
        rows: building.rows,
      },
    );

    building.moveToGrid(
      finalCol,
      finalRow,
      center.x,
      center.y - 36,
    );

    building.setAlpha(1).setTint(0xffd54f);

    this.draggingBuilding = undefined;

    this.input.setDefaultCursor("default");

    this.drawBuildingSelection(building);

    this.actionText.setText(
      `Đã chọn: ${building.getDisplayName()} - Cấp ${building.level}`,
    );

    if (
      building.buildingType === "habitat" &&
      this.dragon.habitatId === building.id
    ) {
      this.dragon.updateHabitatPoints(
        this.getHabitatRoamingPoints(building),
      );
    }
  }

  private selectBuilding(type: BuildingType): void {
    this.cancelBuildingPlacement();

    this.selectedBuilding = type;

    const texture =
      type === "house"
        ? "building-house"
        : "building-farm";

    this.placementPreview = this.add.image(
      0,
      0,
      texture,
    );

    this.placementPreview
      .setAlpha(0.55)
      .setVisible(false);

    this.input.setDefaultCursor("crosshair");

    const buildingName =
      type === "house"
        ? "Nhà chính"
        : type === "farm"
          ? "Nông trại"
          : "Habitat";

    this.actionText.setText(
      `Trạng thái: Đang đặt ${buildingName}`,
    );
  }

  private updatePlacementPreview(
    pointer: Phaser.Input.Pointer,
  ): void {
    if (
      !this.placementPreview ||
      !this.selectedBuilding
    ) {
      return;
    }

    const worldPoint = pointer.positionToCamera(
      this.cameras.main,
    ) as Phaser.Math.Vector2;

    const gridPosition = this.grid.worldToGrid(
      worldPoint.x,
      worldPoint.y,
    );

    if (!this.isInsideMap(gridPosition)) {
      this.placementPreview.setVisible(false);
      this.clearPlacementArea();
      return;
    }

    const footprint = this.getBuildingFootprint(
      this.selectedBuilding,
    );

    const canPlace = this.canPlaceBuilding(
      this.selectedBuilding,
      gridPosition.col,
      gridPosition.row,
    );

    const center = this.getBuildingWorldCenter(
      gridPosition.col,
      gridPosition.row,
      footprint,
    );

    this.drawPlacementArea(
      gridPosition.col,
      gridPosition.row,
      footprint,
      canPlace,
    );

    this.placementPreview
      .setVisible(true)
      .setPosition(
        center.x,
        center.y - 36,
      )
      .setDepth(center.y + 500)
      .setTint(
        canPlace
          ? 0xffffff
          : 0xff4444,
      );
  }

  private placeBuilding(
    type: BuildingType,
    col: number,
    row: number,
  ): Building | null {
    if (!this.canPlaceBuilding(type, col, row)) {
      return null;
    }

    const footprint =
      this.getBuildingFootprint(type);

    const center = this.getBuildingWorldCenter(
      col,
      row,
      footprint,
    );

    const texture =
      type === "house"
        ? "building-house"
        : "building-farm";

    const building = new Building(
      this,
      center.x,
      center.y - 36,
      {
        type,
        col,
        row,
        cols: footprint.cols,
        rows: footprint.rows,
        texture,
        level: 1,
      },
    );

    this.buildings.push(building);

    return building;
  }

  private canPlaceBuilding(
    type: BuildingType,
    col: number,
    row: number,
    ignoredBuilding?: Building,
  ): boolean {
    const footprint =
      this.getBuildingFootprint(type);

    const endCol = col + footprint.cols - 1;
    const endRow = row + footprint.rows - 1;

    // Công trình bị vượt ra ngoài đảo.
    if (
      col < 0 ||
      row < 0 ||
      endCol >= this.mapCols ||
      endRow >= this.mapRows
    ) {
      return false;
    }

    return !this.buildings.some(
      (building) =>
        building !== ignoredBuilding &&
        building.overlapsArea(
          col,
          row,
          footprint.cols,
          footprint.rows,
        ),
    );
  }

  private getBuildingFootprint(
    type: BuildingType,
  ): BuildingFootprint {
    switch (type) {
      case "house":
        return {
          cols: 2,
          rows: 2,
        };

      case "farm":
        return {
          cols: 2,
          rows: 2,
        };

      case "habitat":
        return {
          cols: 4,
          rows: 4,
        };
    }
  }

  private getBuildingWorldCenter(
    col: number,
    row: number,
    footprint: BuildingFootprint,
  ): { x: number; y: number } {
    const centerCol =
      col + (footprint.cols - 1) / 2;

    const centerRow =
      row + (footprint.rows - 1) / 2;

    return this.grid.gridToWorld(
      centerCol,
      centerRow,
    );
  }

  private drawPlacementArea(
    col: number,
    row: number,
    footprint: BuildingFootprint,
    canPlace: boolean,
  ): void {
    this.clearPlacementArea();

    const graphics = this.add.graphics();

    const fillColor = canPlace
      ? 0x22c55e
      : 0xef4444;

    const borderColor = canPlace
      ? 0x16a34a
      : 0xdc2626;

    for (
      let currentRow = row;
      currentRow < row + footprint.rows;
      currentRow += 1
    ) {
      for (
        let currentCol = col;
        currentCol < col + footprint.cols;
        currentCol += 1
      ) {
        const center = this.grid.gridToWorld(
          currentCol,
          currentRow,
        );

        const halfWidth = this.grid.tileWidth / 2;
        const halfHeight = this.grid.tileHeight / 2;

        graphics.fillStyle(fillColor, 0.35);
        graphics.lineStyle(2, borderColor, 0.9);

        graphics.beginPath();

        graphics.moveTo(
          center.x,
          center.y - halfHeight,
        );

        graphics.lineTo(
          center.x + halfWidth,
          center.y,
        );

        graphics.lineTo(
          center.x,
          center.y + halfHeight,
        );

        graphics.lineTo(
          center.x - halfWidth,
          center.y,
        );

        graphics.closePath();
        graphics.fillPath();
        graphics.strokePath();
      }
    }

    const center = this.getBuildingWorldCenter(
      col,
      row,
      footprint,
    );

    const area = footprint.cols * footprint.rows;

    const labelText = canPlace
      ? `${footprint.cols}×${footprint.rows} • ${area} ô`
      : "Không thể xây tại đây";

    const label = this.add.text(
      center.x,
      center.y + footprint.rows * 10 + 26,
      labelText,
      {
        fontFamily: "Arial",
        fontSize: "14px",
        color: "#ffffff",
        fontStyle: "bold",
        backgroundColor: canPlace
          ? "#16a34a"
          : "#dc2626",
        padding: {
          left: 8,
          right: 8,
          top: 4,
          bottom: 4,
        },
      },
    );

    label.setOrigin(0.5);
    label.setDepth(center.y + 2000);

    graphics.setDepth(center.y + 50);

    this.placementAreaGraphics = graphics;
    this.placementAreaLabel = label;
  }

  private clearPlacementArea(): void {
    if (this.placementAreaGraphics) {
      this.placementAreaGraphics.destroy();
      this.placementAreaGraphics = undefined;
    }

    if (this.placementAreaLabel) {
      this.placementAreaLabel.destroy();
      this.placementAreaLabel = undefined;
    }
  }

  private cancelBuildingPlacement(): void {
    if (
      !this.selectedBuilding &&
      !this.placementPreview
    ) {
      return;
    }

    this.selectedBuilding = null;
    this.clearBuildingSelection();

    if (this.placementPreview) {
      this.placementPreview.destroy();
      this.placementPreview = undefined;
    }

    this.clearPlacementArea();

    this.input.setDefaultCursor("default");

    if (this.actionText) {
      this.actionText.setText(
        "Trạng thái: Chọn công trình",
      );
    }
  }

  private getBuildingAt(
    col: number,
    row: number,
  ): Building | undefined {
    return this.buildings.find((building) =>
      building.occupiesCell(col, row),
    );
  }

  private selectPlacedBuilding(
    building: Building,
  ): void {
    this.clearBuildingSelection();

    this.selectedPlacedBuilding = building;

    building.setTint(0xffd54f);

    this.drawBuildingSelection(building);

    this.actionText.setText(
      `Đã chọn: ${building.getDisplayName()} - Cấp ${building.level}`,
    );
  }

  private drawBuildingSelection(
    building: Building,
    previewCol = building.col,
    previewRow = building.row,
  ): void {
    this.buildingSelectionGraphics?.destroy();

    const graphics = this.add.graphics();

    graphics.lineStyle(4, 0xffd700, 1);

    const corners = [
      this.grid.gridToWorld(previewCol, previewRow),
      this.grid.gridToWorld(
        previewCol + building.cols,
        previewRow,
      ),
      this.grid.gridToWorld(
        previewCol + building.cols,
        previewRow + building.rows,
      ),
      this.grid.gridToWorld(
        previewCol,
        previewRow + building.rows,
      ),
    ];

    graphics.beginPath();

    graphics.moveTo(
      corners[0].x,
      corners[0].y - 16,
    );

    for (
      let index = 1;
      index < corners.length;
      index += 1
    ) {
      graphics.lineTo(
        corners[index].x,
        corners[index].y - 16,
      );
    }

    graphics.closePath();
    graphics.strokePath();

    graphics.setDepth(building.depth + 1);

    this.buildingSelectionGraphics = graphics;
  }

  private clearBuildingSelection(): void {
    if (this.selectedPlacedBuilding) {
      this.selectedPlacedBuilding.clearTint();
      this.selectedPlacedBuilding = undefined;
    }

    if (this.buildingSelectionGraphics) {
      this.buildingSelectionGraphics.destroy();
      this.buildingSelectionGraphics = undefined;
    }

    if (!this.selectedBuilding && this.actionText) {
      this.actionText.setText(
        "Trạng thái: Di chuyển rồng",
      );
    }
  }

  private getHabitatRoamingPoints(
    habitat: Building,
  ): Array<{ x: number; y: number }> {
    const points: Array<{
      x: number;
      y: number;
    }> = [];

    const startCol = habitat.col + 1;
    const endCol = habitat.col + habitat.cols - 2;

    const startRow = habitat.row + 1;
    const endRow = habitat.row + habitat.rows - 2;

    for (let row = startRow; row <= endRow; row += 1) {
      for (let col = startCol; col <= endCol; col += 1) {
        const worldPoint = this.grid.gridToWorld(
          col,
          row,
        );

        points.push({
          x:
            worldPoint.x +
            Phaser.Math.Between(-12, 12),

          y:
            worldPoint.y -
            12 +
            Phaser.Math.Between(-5, 5),
        });
      }
    }

    return points;
  }

  private assignDragonToHabitat(
    habitat: Building,
  ): void {
    if (habitat.buildingType !== "habitat") {
      return;
    }

    this.dragon.assignHabitat(
      habitat.id,
      this.getHabitatRoamingPoints(habitat),
    );
  }

  private isInsideMap(
    position: GridPosition,
  ): boolean {
    return (
      position.col >= 0 &&
      position.row >= 0 &&
      position.col < this.mapCols &&
      position.row < this.mapRows
    );
  }
}