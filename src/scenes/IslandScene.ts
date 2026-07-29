import Phaser from "phaser";
import {
  BUILDING_DEFINITIONS,
  getFarmBuildCost,
  getUpgradeCost,
} from "../config/BuildingConfig";
import { Dragon } from "../entities/Dragon";
import {
  Building,
  type BuildingType,
} from "../entities/Building";
import {
  GridSystem,
  type GridPosition,
} from "../systems/GridSystem";
import { PlayerResources } from "../systems/PlayerResources";
import { BuildingMenu } from "../ui/BuildingMenu";

interface BuildingFootprint {
  cols: number;
  rows: number;
}

interface SavedBuildingData {
  id: string;
  type: BuildingType;
  col: number;
  row: number;
  level: number;

  constructionStartedAt?: number;
  productionStartedAt?: number;
}

interface SavedIslandData {
  buildings: SavedBuildingData[];
  dragonHabitatId?: string;
  gold?: number;
  food?: number;
}

export class IslandScene extends Phaser.Scene {
  private readonly saveKey = "dragon-island-save-v1";
  private readonly resources =
    new PlayerResources({
      gold: 5000,
      food: 1000,
    });

  private readonly mapCols = 14;
  private readonly mapRows = 14;

  private readonly grid = new GridSystem(
    64,
    32,
    900,
    220,
  );

  private dragon!: Dragon;
  private buildingMenu!: BuildingMenu;
  private buildingInfoPanel?: Phaser.GameObjects.Container;
  private infoCloseButtonBounds?: Phaser.Geom.Rectangle;
  private destroyConfirmPanel?: Phaser.GameObjects.Container;
  private destroyCancelButtonBounds?: Phaser.Geom.Rectangle;
  private destroyConfirmButtonBounds?: Phaser.Geom.Rectangle;
  private modalBackdrop?: Phaser.GameObjects.Rectangle;
  private infoReturnBuilding?: Building;
  private destroyTargetBuilding?: Building;

  private selectedBuilding: BuildingType | null = null;
  private selectedPlacedBuilding?: Building;
  private placementPreview?: Phaser.GameObjects.Image;
  private placementAreaGraphics?: Phaser.GameObjects.Graphics;
  private placementAreaLabel?: Phaser.GameObjects.Text;

  private buildings: Building[] = [];
  private buildingSelectionGraphics?: Phaser.GameObjects.Graphics;

  private dragCandidate?: Building;
  private draggingBuilding?: Building;
  private moveHintContainer?: Phaser.GameObjects.Container;
  private buildingDragShadow?: Phaser.GameObjects.Ellipse;

  private dragPointerStart = new Phaser.Math.Vector2();
  private dragOriginalCol = 0;
  private dragOriginalRow = 0;
  private dragPreviewCol = 0;
  private dragPreviewRow = 0;

  private readonly dragThreshold = 8;

  private draggingCamera = false;
  private previousPointer = new Phaser.Math.Vector2();

  private actionText!: Phaser.GameObjects.Text;
  private goldText!: Phaser.GameObjects.Text;
  private foodText!: Phaser.GameObjects.Text;

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

    if (this.destroyConfirmPanel) {
      this.closeDestroyConfirm(true);
      return;
    }

    if (this.buildingInfoPanel) {
      this.closeBuildingInfo(true);
      return;
    }

    if (this.draggingBuilding) {
      this.cancelBuildingDrag();
      return;
    }

    if (this.buildingMenu?.isOpen()) {
      this.buildingMenu.close();
      return;
    }

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
    this.createResourceHud();
    this.createBuildingMenu();

    this.setupKeyboardControls();
    this.setupCameraControls();
    this.setupWorldInput();

    this.cameras.main.centerOn(900, 480);
    this.cameras.main.setZoom(1);
  }

  update(
    time: number,
    delta: number,
  ): void {
    this.dragon.update(time, delta);

    const currentTime = Date.now();

    for (const building of this.buildings) {
      building.updateFarmProduction(
        currentTime,
      );
    }
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
    const dragonStart =
      this.grid.gridToWorld(8, 8);

    this.dragon = new Dragon(
      this,
      dragonStart.x,
      dragonStart.y - 12,
    );

    const loaded = this.loadIsland();

    if (loaded) {
      return;
    }

    this.placeBuilding(
      "house",
      3,
      3,
      undefined,
      false,
    );

    const habitat = this.placeBuilding(
      "habitat",
      7,
      7,
      undefined,
      false,
    );

    if (habitat) {
      this.assignDragonToHabitat(habitat);
    }

    this.saveIsland();
  }

  private createBuildingMenu(): void {
    this.buildingMenu = new BuildingMenu(
      this,
      {
        onUpgrade: (building) => {
          const upgradeCost =
            getUpgradeCost(
              building.buildingType,
              building.level,
            );

          if (
            !this.resources.canAffordGold(
              upgradeCost,
            )
          ) {
            this.actionText.setText(
              `Không đủ vàng. Cần ${upgradeCost.toLocaleString(
                "vi-VN",
              )} vàng`,
            );

            return;
          }

          this.resources.spendGold(
            upgradeCost,
          );

          building.upgrade();

          if (
            building.buildingType === "farm"
          ) {
            building.beginFarmUpgrade();
          }

          this.buildingMenu.refresh();
          this.refreshResourceHud();
          this.saveIsland();

          const constructionSeconds =
            building.buildingType === "farm"
              ? building.getConstructionDuration() /
                1000
              : 0;

          if (
            building.buildingType === "farm"
          ) {
            this.actionText.setText(
              `Đang nâng Nông trại lên cấp ${building.level} • Hoàn tất sau ${constructionSeconds} giây`,
            );
          } else {
            this.actionText.setText(
              `${building.getDisplayName()} đã lên cấp ${building.level}`,
            );
          }
        },

        onInfo: (building) => {
          this.showBuildingInfo(building);
        },

        onRemove: (building) => {
          this.showDestroyConfirmation(building);
        },
      },
    );
  }

  private createModalBackdrop(): void {
    this.destroyModalBackdrop();

    this.modalBackdrop = this.add.rectangle(
      0,
      0,
      this.scale.width,
      this.scale.height,
      0x000000,
      0.42,
    );

    this.modalBackdrop
      .setOrigin(0)
      .setScrollFactor(0)
      .setDepth(299000)
      .setInteractive();
  }

  private destroyModalBackdrop(): void {
    if (!this.modalBackdrop) {
      return;
    }

    this.modalBackdrop.destroy();
    this.modalBackdrop = undefined;
  }

  private showBuildingInfo(
    building: Building,
  ): void {
    this.closeDestroyConfirm(false);
    this.closeBuildingInfo(false);

    this.infoReturnBuilding = building;
    this.buildingMenu.close();
    this.createModalBackdrop();

    const panel = this.add.container(
      this.scale.width / 2,
      this.scale.height / 2,
    );

    const screenCenterX = this.scale.width / 2;
    const screenCenterY = this.scale.height / 2;

    this.infoCloseButtonBounds =
      new Phaser.Geom.Rectangle(
        screenCenterX - 75,
        screenCenterY + 84,
        150,
        42,
      );

    panel
      .setScrollFactor(0)
      .setDepth(300000);

    const background = this.add.rectangle(
      0,
      0,
      350,
      290,
      0x111827,
      0.98,
    );

    background.setStrokeStyle(
      3,
      0xfacc15,
      1,
    );

    const title = this.add
      .text(0, -112, building.getDisplayName(), {
        fontFamily: "Arial",
        fontSize: "22px",
        color: "#facc15",
        fontStyle: "bold",
      })
      .setOrigin(0.5);

    const details = this.add
      .text(
        0,
        -20,
        [
          `Cấp độ: ${building.level}`,
          `Tọa độ: (${building.col}, ${building.row})`,
          `Kích thước: ${building.cols} × ${building.rows}`,
          `Diện tích: ${building.cols * building.rows} ô`,
          `ID: ${building.id}`,
        ],
        {
          fontFamily: "Arial",
          fontSize: "16px",
          color: "#ffffff",
          align: "center",
          lineSpacing: 9,
        },
      )
      .setOrigin(0.5);

    const closeBackground = this.add.rectangle(
      0,
      105,
      150,
      42,
      0x2563eb,
      1,
    );

    closeBackground
      .setStrokeStyle(2, 0xffffff, 1)
      .setInteractive({
        useHandCursor: true,
      });

    const closeText = this.add
      .text(0, 105, "Đóng", {
        fontFamily: "Arial",
        fontSize: "16px",
        color: "#ffffff",
        fontStyle: "bold",
      })
      .setOrigin(0.5);

    closeBackground.on(
      "pointerup",
      (
        _pointer: Phaser.Input.Pointer,
        _localX: number,
        _localY: number,
        event: Phaser.Types.Input.EventData,
      ) => {
        event.stopPropagation();

        this.closeBuildingInfo(true);
      },
    );

    panel.add([
      background,
      title,
      details,
      closeBackground,
      closeText,
    ]);

    this.buildingInfoPanel = panel;
  }

  private closeBuildingInfo(
    reopenMenu = false,
  ): void {
    const building = this.infoReturnBuilding;

    if (this.buildingInfoPanel) {
      this.buildingInfoPanel.destroy(true);
      this.buildingInfoPanel = undefined;
    }

    this.infoCloseButtonBounds = undefined;
    this.infoReturnBuilding = undefined;

    if (!this.destroyConfirmPanel) {
      this.destroyModalBackdrop();
    }

    if (
      reopenMenu &&
      building &&
      building.active &&
      this.buildings.includes(building)
    ) {
      this.selectPlacedBuilding(building);
      this.buildingMenu.open(building);
    }
  }

  private showDestroyConfirmation(
    building: Building,
  ): void {
    this.closeBuildingInfo(false);
    this.closeDestroyConfirm(false);

    this.destroyTargetBuilding = building;

    this.buildingMenu.close();
    this.createModalBackdrop();

    const panel = this.add.container(
      this.scale.width / 2,
      this.scale.height / 2,
    );

    const screenCenterX = this.scale.width / 2;
    const screenCenterY = this.scale.height / 2;

    this.destroyCancelButtonBounds =
      new Phaser.Geom.Rectangle(
        screenCenterX - 157.5,
        screenCenterY + 49,
        135,
        42,
      );

    this.destroyConfirmButtonBounds =
      new Phaser.Geom.Rectangle(
        screenCenterX + 22.5,
        screenCenterY + 49,
        135,
        42,
      );

    panel
      .setScrollFactor(0)
      .setDepth(300000);

    const background = this.add.rectangle(
      0,
      0,
      380,
      235,
      0x111827,
      0.98,
    );

    background.setStrokeStyle(
      3,
      0xfacc15,
      1,
    );

    const title = this.add
      .text(0, -78, "Xác nhận phá bỏ?", {
        fontFamily: "Arial",
        fontSize: "22px",
        color: "#facc15",
        fontStyle: "bold",
      })
      .setOrigin(0.5);

    const message = this.add
      .text(
        0,
        -18,
        [
          "Bạn có chắc muốn phá",
          `${building.getDisplayName()} cấp ${building.level}?`,
        ],
        {
          fontFamily: "Arial",
          fontSize: "17px",
          color: "#ffffff",
          align: "center",
          lineSpacing: 7,
        },
      )
      .setOrigin(0.5);

    const cancelButton = this.add.rectangle(
      -90,
      70,
      135,
      42,
      0x2563eb,
      1,
    );

    cancelButton
      .setStrokeStyle(2, 0xffffff)
      .setInteractive({
        useHandCursor: true,
      });

    const cancelText = this.add
      .text(-90, 70, "Hủy", {
        fontFamily: "Arial",
        fontSize: "16px",
        color: "#ffffff",
        fontStyle: "bold",
      })
      .setOrigin(0.5);

    const confirmButton = this.add.rectangle(
      90,
      70,
      135,
      42,
      0xdc2626,
      1,
    );

    confirmButton
      .setStrokeStyle(2, 0xffffff)
      .setInteractive({
        useHandCursor: true,
      });

    const confirmText = this.add
      .text(90, 70, "Phá bỏ", {
        fontFamily: "Arial",
        fontSize: "16px",
        color: "#ffffff",
        fontStyle: "bold",
      })
      .setOrigin(0.5);

    panel.add([
      background,
      title,
      message,
      cancelButton,
      cancelText,
      confirmButton,
      confirmText,
    ]);

    this.destroyConfirmPanel = panel;
  }

  private closeDestroyConfirm(
    reopenMenu = false,
  ): void {
    const building = this.destroyTargetBuilding;

    if (this.destroyConfirmPanel) {
      this.destroyConfirmPanel.destroy(true);
      this.destroyConfirmPanel = undefined;
    }

    this.destroyCancelButtonBounds = undefined;
    this.destroyConfirmButtonBounds = undefined;
    this.destroyTargetBuilding = undefined;

    if (!this.buildingInfoPanel) {
      this.destroyModalBackdrop();
    }

    if (
      reopenMenu &&
      building &&
      building.active &&
      this.buildings.includes(building)
    ) {
      this.selectPlacedBuilding(building);
      this.buildingMenu.open(building);
    }
  }

  private removeBuilding(
    building: Building,
  ): void {
    if (building.buildingType === "house") {
      this.actionText.setText(
        "Không thể phá Nhà chính",
      );

      return;
    }

    const buildingIndex =
      this.buildings.indexOf(building);

    if (buildingIndex === -1) {
      return;
    }

    const buildingName =
      building.getDisplayName();

    const wasAssignedHabitat =
      building.buildingType === "habitat" &&
      this.dragon.habitatId === building.id;

    this.buildings.splice(buildingIndex, 1);

    this.buildingMenu.close();
    this.clearBuildingSelection();

    building.destroy();

    if (wasAssignedHabitat) {
      this.reassignDragonToAvailableHabitat();
    }

    this.saveIsland();

    this.actionText.setText(
      `${buildingName} đã bị phá bỏ`,
    );
  }

  private reassignDragonToAvailableHabitat(): void {
    const nextHabitat = this.buildings.find(
      (building) =>
        building.buildingType === "habitat",
    );

    if (nextHabitat) {
      this.assignDragonToHabitat(nextHabitat);

      this.dragon.setVisible(true);

      this.actionText.setText(
        `Rồng đã được chuyển sang ${nextHabitat.getDisplayName()}`,
      );

      return;
    }

    this.dragon.clearHabitat();
    this.dragon.setVisible(false);

    this.actionText.setText(
      "Rồng đang được cất giữ vì chưa có Habitat",
    );
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
        "Phím R: reset dữ liệu đảo",
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

  private createResourceHud(): void {
    const panelWidth = 310;
    const panelHeight = 58;

    const panelX =
      this.scale.width - panelWidth - 20;

    const panelY = 20;

    const panel = this.add.rectangle(
      panelX,
      panelY,
      panelWidth,
      panelHeight,
      0x111827,
      0.92,
    );

    panel
      .setOrigin(0)
      .setScrollFactor(0)
      .setDepth(250000);

    panel.setStrokeStyle(
      2,
      0xffffff,
      0.3,
    );

    this.goldText = this.add.text(
      panelX + 18,
      panelY + 17,
      "",
      {
        fontFamily: "Arial",
        fontSize: "18px",
        color: "#facc15",
        fontStyle: "bold",
      },
    );

    this.goldText
      .setScrollFactor(0)
      .setDepth(250001);

    this.foodText = this.add.text(
      panelX + 165,
      panelY + 17,
      "",
      {
        fontFamily: "Arial",
        fontSize: "18px",
        color: "#86efac",
        fontStyle: "bold",
      },
    );

    this.foodText
      .setScrollFactor(0)
      .setDepth(250001);

    this.refreshResourceHud();
  }

  private refreshResourceHud(): void {
    this.goldText.setText(
      `Vàng: ${this.resources
        .getGold()
        .toLocaleString("vi-VN")}`,
    );

    this.foodText.setText(
      `Thức ăn: ${this.resources
        .getFood()
        .toLocaleString("vi-VN")}`,
    );
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

      keyboard.on("keydown-R", () => {
        localStorage.removeItem(this.saveKey);
        window.location.reload();
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

        /*
         * Popup Chi tiết đang mở.
         */
        if (this.buildingInfoPanel) {
          if (
            this.infoCloseButtonBounds?.contains(
              pointer.x,
              pointer.y,
            )
          ) {
            this.closeBuildingInfo(true);
          }

          return;
        }

        /*
         * Popup xác nhận phá bỏ đang mở.
         */
        if (this.destroyConfirmPanel) {
          if (
            this.destroyCancelButtonBounds?.contains(
              pointer.x,
              pointer.y,
            )
          ) {
            this.closeDestroyConfirm(true);
            return;
          }

          if (
            this.destroyConfirmButtonBounds?.contains(
              pointer.x,
              pointer.y,
            )
          ) {
            const target =
              this.destroyTargetBuilding;

            this.closeDestroyConfirm(false);

            if (target) {
              this.removeBuilding(target);
            }
          }

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
            this.tryBuildBuilding(
              this.selectedBuilding,
              gridPosition.col,
              gridPosition.row,
            );
          }

          return;
        }

        const clickedBuilding = this.getBuildingAt(
          gridPosition.col,
          gridPosition.row,
        );

        if (clickedBuilding) {
          if (this.tryHarvestFarm(clickedBuilding)) {
            this.buildingMenu.close();
            this.dragCandidate = undefined;
            this.clearBuildingSelection();
            return;
          }

          const clickedSelectedBuilding =
            this.selectedPlacedBuilding ===
            clickedBuilding;

          if (
            clickedSelectedBuilding &&
            !this.buildingMenu.isOpen()
          ) {
            this.buildingMenu.open(clickedBuilding);

            this.dragCandidate = undefined;
            return;
          }

          this.buildingMenu.close();

          this.selectPlacedBuilding(clickedBuilding);

          this.dragCandidate = clickedBuilding;
          this.dragPointerStart.set(pointer.x, pointer.y);

          return;
        }

        this.buildingMenu.close();
        this.dragCandidate = undefined;
        this.buildingMenu.close();
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
        if (
          this.buildingInfoPanel ||
          this.destroyConfirmPanel
        ) {
          return;
        }

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

  private showBuildingMoveFeedback(
    building: Building,
  ): void {
    this.hideBuildingMoveFeedback();

    const shadow = this.add.ellipse(
      building.x,
      building.y + 10,
      90,
      28,
      0x000000,
      0.25,
    );

    shadow.setDepth(building.depth - 1);

    const container = this.add.container(
      building.x,
      building.y,
    );

    const arrowStyle:
      Phaser.Types.GameObjects.Text.TextStyle = {
        fontFamily: "Arial",
        fontSize: "28px",
        color: "#ffffff",
        fontStyle: "bold",
        stroke: "#111827",
        strokeThickness: 5,
      };

    const offsetX = 78;
    const offsetY = 48;

    const topLeft = this.add
      .text(-offsetX, -offsetY, "◤", arrowStyle)
      .setOrigin(0.5);

    const topRight = this.add
      .text(offsetX, -offsetY, "◥", arrowStyle)
      .setOrigin(0.5);

    const bottomLeft = this.add
      .text(-offsetX, offsetY, "◣", arrowStyle)
      .setOrigin(0.5);

    const bottomRight = this.add
      .text(offsetX, offsetY, "◢", arrowStyle)
      .setOrigin(0.5);

    container.add([
      topLeft,
      topRight,
      bottomLeft,
      bottomRight,
    ]);
    container.setDepth(building.depth + 100);

    this.tweens.add({
      targets: [
        topLeft,
        topRight,
        bottomLeft,
        bottomRight,
      ],
      alpha: {
        from: 1,
        to: 0.45,
      },
      scale: {
        from: 1,
        to: 1.12,
      },
      duration: 450,
      yoyo: true,
      repeat: -1,
    });

    this.moveHintContainer = container;
    this.buildingDragShadow = shadow;

    this.tweens.add({
      targets: building,
      scaleX: 1.06,
      scaleY: 1.06,
      duration: 140,
      ease: "Sine.Out",
    });
  }

  private updateBuildingMoveFeedback(
    building: Building,
  ): void {
    if (this.moveHintContainer) {
      this.moveHintContainer.setPosition(
        building.x,
        building.y,
      );

      this.moveHintContainer.setDepth(
        building.depth + 100,
      );
    }

    if (this.buildingDragShadow) {
      this.buildingDragShadow.setPosition(
        building.x,
        building.y + 10,
      );

      this.buildingDragShadow.setDepth(
        building.depth - 1,
      );
    }
  }

  private hideBuildingMoveFeedback(): void {
    if (this.moveHintContainer) {
      this.tweens.killTweensOf(
        this.moveHintContainer.list,
      );

      this.moveHintContainer.destroy(true);
      this.moveHintContainer = undefined;
    }

    if (this.buildingDragShadow) {
      this.buildingDragShadow.destroy();
      this.buildingDragShadow = undefined;
    }
  }

  private startBuildingDrag(
    building: Building,
  ): void {
    this.buildingMenu.close();
    this.draggingBuilding = building;

    this.dragOriginalCol = building.col;
    this.dragOriginalRow = building.row;

    this.dragPreviewCol = building.col;
    this.dragPreviewRow = building.row;

    building.setAlpha(0.78);

    this.showBuildingMoveFeedback(building);

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

    this.updateBuildingMoveFeedback(
      this.draggingBuilding,
    );

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

    this.hideBuildingMoveFeedback();

    building.setAlpha(1);

    this.tweens.add({
      targets: building,
      scaleX: 1,
      scaleY: 1,
      duration: 220,
      ease: "Bounce.Out",
    });

    building.setTint(0xffd54f);

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

    this.saveIsland();
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

    const definition =
      BUILDING_DEFINITIONS[type];

    this.actionText.setText(
      `Đang đặt ${definition.displayName} • Giá ${definition.buildCost.toLocaleString(
        "vi-VN",
      )} vàng`,
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
    savedData?: {
      id?: string;
      level?: number;
      constructionStartedAt?: number;
      productionStartedAt?: number;
    },
    shouldSave = true,
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
        id: savedData?.id,
        type,
        col,
        row,
        cols: footprint.cols,
        rows: footprint.rows,
        texture,
        level: savedData?.level ?? 1,

        constructionStartedAt:
          savedData?.constructionStartedAt,

        productionStartedAt:
          savedData?.productionStartedAt,
      },
    );

    this.buildings.push(building);

    if (
      type === "habitat" &&
      this.dragon &&
      !this.dragon.habitatId
    ) {
      this.dragon.setVisible(true);
      this.assignDragonToHabitat(building);
    }

    if (shouldSave) {
      this.saveIsland();
    }

    return building;
  }

  private tryBuildBuilding(
    type: BuildingType,
    col: number,
    row: number,
  ): void {
    const definition =
      BUILDING_DEFINITIONS[type];

    const buildCost =
      type === "farm"
        ? getFarmBuildCost(1)
        : BUILDING_DEFINITIONS[type]
            .buildCost;

    if (
      !this.resources.canAffordGold(
        buildCost,
      )
    ) {
      this.actionText.setText(
        `Không đủ vàng. Cần ${buildCost.toLocaleString(
          "vi-VN",
        )} vàng`,
      );

      return;
    }

    const building = this.placeBuilding(
      type,
      col,
      row,
      undefined,
      false,
    );

    if (!building) {
      return;
    }

    this.resources.spendGold(
      buildCost,
    );

    this.refreshResourceHud();
    this.clearPlacementArea();
    this.saveIsland();

    this.actionText.setText(
      type === "farm"
        ? "Đang xây Nông trại cấp 1 • Hoàn tất sau 30 giây"
        : `Đã xây ${definition.displayName}`,
    );
  }

  private tryHarvestFarm(
    building: Building,
  ): boolean {
    if (
      building.buildingType !== "farm"
    ) {
      return false;
    }

    if (
      !building.isConstructionComplete()
    ) {
      const remainingSeconds =
        Math.ceil(
          building.getRemainingConstructionTime() /
            1000,
        );

      this.actionText.setText(
        `Nông trại đang xây • Còn ${remainingSeconds} giây`,
      );

      return true;
    }

    if (
      !building.isReadyToHarvest()
    ) {
      const remainingSeconds =
        Math.ceil(
          building.getRemainingProductionTime() /
            1000,
        );

      this.actionText.setText(
        `Nông trại đang sản xuất • Còn ${remainingSeconds} giây`,
      );

      return true;
    }

    const reward =
      building.getFoodReward();

    this.resources.addFood(reward);

    building.restartProduction();

    this.refreshResourceHud();
    this.saveIsland();

    this.actionText.setText(
      `Đã thu hoạch ${reward.toLocaleString(
        "vi-VN",
      )} thức ăn`,
    );

    return true;
  }

  private saveIsland(): void {
    const resourceState =
      this.resources.getState();

    const data: SavedIslandData = {
      buildings: this.buildings.map((building) => ({
        id: building.id,
        type: building.buildingType,
        col: building.col,
        row: building.row,
        level: building.level,

        constructionStartedAt:
          building.constructionStartedAt,

        productionStartedAt:
          building.productionStartedAt,
      })),

      dragonHabitatId: this.dragon?.habitatId,

      gold: resourceState.gold,
      food: resourceState.food,
    };

    localStorage.setItem(
      this.saveKey,
      JSON.stringify(data),
    );
  }

  private loadIsland(): boolean {
    const rawData = localStorage.getItem(
      this.saveKey,
    );

    if (!rawData) {
      return false;
    }

    try {
      const data = JSON.parse(
        rawData,
      ) as SavedIslandData;

      if (!Array.isArray(data.buildings)) {
        return false;
      }

      this.resources.setState({
        gold: data.gold,
        food: data.food,
      });

      for (const savedBuilding of data.buildings) {
        this.placeBuilding(
          savedBuilding.type,
          savedBuilding.col,
          savedBuilding.row,
          {
            id: savedBuilding.id,
            level: savedBuilding.level,

            constructionStartedAt:
              savedBuilding.constructionStartedAt,

            productionStartedAt:
              savedBuilding.productionStartedAt,
          },
          false,
        );
      }

      const assignedHabitat =
        this.buildings.find(
          (building) =>
            building.buildingType === "habitat" &&
            building.id === data.dragonHabitatId,
        ) ??
        this.buildings.find(
          (building) =>
            building.buildingType === "habitat",
        );

      if (assignedHabitat) {
        this.dragon.setVisible(true);
        this.assignDragonToHabitat(
          assignedHabitat,
        );
      } else {
        this.dragon.clearHabitat();
        this.dragon.setVisible(false);
      }

      return true;
    } catch (error) {
      console.error(
        "Không thể tải dữ liệu đảo:",
        error,
      );

      return false;
    }
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

    this.hideBuildingMoveFeedback();

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

    if (building.buildingType === "farm") {
      if (building.isReadyToHarvest()) {
        this.actionText.setText(
          `Nông trại cấp ${building.level} • Sẵn sàng thu hoạch`,
        );
      } else {
        const remainingSeconds = Math.ceil(
          building.getRemainingProductionTime() /
            1000,
        );

        this.actionText.setText(
          `Nông trại cấp ${building.level} • Còn ${remainingSeconds} giây`,
        );
      }

      return;
    }

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

  private cancelBuildingDrag(): void {
    const building = this.draggingBuilding;

    if (!building) {
      return;
    }

    const center = this.getBuildingWorldCenter(
      this.dragOriginalCol,
      this.dragOriginalRow,
      {
        cols: building.cols,
        rows: building.rows,
      },
    );

    building.moveToGrid(
      this.dragOriginalCol,
      this.dragOriginalRow,
      center.x,
      center.y - 36,
    );

    building
      .setAlpha(1)
      .setScale(1)
      .setTint(0xffd54f);

    this.draggingBuilding = undefined;
    this.dragCandidate = undefined;

    this.hideBuildingMoveFeedback();
    this.drawBuildingSelection(building);

    this.input.setDefaultCursor("default");
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
