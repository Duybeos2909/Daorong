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
  private placementPreview?: Phaser.GameObjects.Image;

  private buildings: Building[] = [];

  private draggingCamera = false;
  private previousPointer = new Phaser.Math.Vector2();

  private actionText!: Phaser.GameObjects.Text;

  private handleGlobalKeyDown = (
    event: KeyboardEvent,
  ): void => {
    if (event.key === "Escape" || event.code === "Escape") {
      event.preventDefault();
      event.stopPropagation();

      this.cancelBuildingPlacement();
    }
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
    this.placeBuilding("house", 5, 5);

    const start = this.grid.gridToWorld(8, 8);

    this.dragon = new Dragon(
      this,
      start.x,
      start.y - 12,
    );
  }

  private createHud(): void {
    const panel = this.add.rectangle(
      0,
      0,
      330,
      180,
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
        "Chuột trái: di chuyển rồng / đặt nhà",
        "Chuột phải + kéo: di chuyển camera",
        "Lăn chuột: zoom",
        "Phím 1: chọn Nhà chính",
        "Phím 2: chọn Nông trại",
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

      keyboard.on("keydown-ESC", () => {
        this.cancelBuildingPlacement();
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
        }
      },
    );

    this.input.on(
      "pointerdown",
      (pointer: Phaser.Input.Pointer) => {
        if (pointer.rightButtonDown()) {
          return;
        }

        // Không xử lý click phía trên bảng hướng dẫn.
        if (pointer.x <= 330 && pointer.y <= 180) {
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
          }

          return;
        }

        const target = this.grid.gridToWorld(
          gridPosition.col,
          gridPosition.row,
        );

        this.dragon.moveTo(
          target.x,
          target.y - 12,
        );
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

    this.actionText.setText(
      type === "house"
        ? "Trạng thái: Đang đặt Nhà chính"
        : "Trạng thái: Đang đặt Nông trại",
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

    const canPlace = this.canPlaceBuilding(
      this.selectedBuilding,
      gridPosition.col,
      gridPosition.row,
    );

    if (!this.isInsideMap(gridPosition)) {
      this.placementPreview.setVisible(false);
      return;
    }

    const footprint = this.getBuildingFootprint(
      this.selectedBuilding,
    );

    const center = this.getBuildingWorldCenter(
      gridPosition.col,
      gridPosition.row,
      footprint,
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

    return !this.buildings.some((building) =>
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

  private cancelBuildingPlacement(): void {
    if (!this.selectedBuilding && !this.placementPreview) {
      return;
    }

    this.selectedBuilding = null;

    if (this.placementPreview) {
      this.placementPreview.setVisible(false);
      this.placementPreview.destroy();
      this.placementPreview = undefined;
    }

    this.input.setDefaultCursor("default");

    if (this.actionText) {
      this.actionText.setText(
        "Trạng thái: Di chuyển rồng",
      );
    }

    console.log("Đã hủy chế độ xây dựng");
  }

  private getBuildingAt(
    col: number,
    row: number,
  ): Building | undefined {
    return this.buildings.find((building) =>
      building.occupiesCell(col, row),
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