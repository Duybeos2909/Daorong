import Phaser from "phaser";
import { Building } from "../entities/Building";
import { UIButton } from "./UIButton";

export interface BuildingMenuCallbacks {
  onUpgrade: (building: Building) => void;
  onInfo: (building: Building) => void;
  onRemove: (building: Building) => void;
}

export class BuildingMenu extends Phaser.GameObjects.Container {
  private readonly titleText: Phaser.GameObjects.Text;
  private readonly levelText: Phaser.GameObjects.Text;

  private selectedBuilding?: Building;

  constructor(
    scene: Phaser.Scene,
    callbacks: BuildingMenuCallbacks,
  ) {
    super(scene, 0, 0);

    scene.add.existing(this);

    const background = scene.add.rectangle(
      0,
      0,
      210,
      275,
      0x111827,
      0.96,
    );

    background.setStrokeStyle(
      3,
      0xfacc15,
      1,
    );

    background.setInteractive();

    background.on(
      "pointerdown",
      (
        pointer: Phaser.Input.Pointer,
      ) => {
        pointer.event.stopPropagation();
      },
    );

    this.titleText = scene.add.text(
      0,
      -108,
      "",
      {
        fontFamily: "Arial",
        fontSize: "20px",
        color: "#facc15",
        fontStyle: "bold",
        align: "center",
      },
    );

    this.titleText.setOrigin(0.5);

    this.levelText = scene.add.text(
      0,
      -78,
      "",
      {
        fontFamily: "Arial",
        fontSize: "15px",
        color: "#ffffff",
      },
    );

    this.levelText.setOrigin(0.5);

    const upgradeButton = new UIButton(
      scene,
      0,
      -25,
      "Nâng cấp",
      () => {
        if (this.selectedBuilding) {
          callbacks.onUpgrade(
            this.selectedBuilding,
          );
        }
      },
      {
        backgroundColor: 0x16a34a,
        hoverColor: 0x22c55e,
      },
    );

    const infoButton = new UIButton(
      scene,
      0,
      35,
      "Chi tiết",
      () => {
        if (this.selectedBuilding) {
          callbacks.onInfo(
            this.selectedBuilding,
          );
        }
      },
    );

    const removeButton = new UIButton(
      scene,
      0,
      95,
      "Phá bỏ",
      () => {
        if (this.selectedBuilding) {
          callbacks.onRemove(
            this.selectedBuilding,
          );
        }
      },
      {
        backgroundColor: 0xdc2626,
        hoverColor: 0xef4444,
      },
    );

    this.add([
      background,
      this.titleText,
      this.levelText,
      upgradeButton,
      infoButton,
      removeButton,
    ]);

    this.setDepth(200000);
    this.setVisible(false);
  }

  public open(building: Building): void {
    this.selectedBuilding = building;

    this.titleText.setText(building.getDisplayName());
    this.levelText.setText(`Cấp ${building.level}`);

    this.setPosition(
      building.x + 155,
      building.y - 110,
    );

    this.setVisible(true);
  }

  public refresh(): void {
    if (!this.selectedBuilding) {
      return;
    }

    this.levelText.setText(
      `Cấp ${this.selectedBuilding.level}`,
    );
  }

  public close(): void {
    this.selectedBuilding = undefined;
    this.setVisible(false);
  }

  public isOpen(): boolean {
    return this.visible;
  }

  public getSelectedBuilding():
    | Building
    | undefined {
    return this.selectedBuilding;
  }
}
