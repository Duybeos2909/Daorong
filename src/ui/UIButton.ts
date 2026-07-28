import Phaser from "phaser";

export interface UIButtonConfig {
  width?: number;
  height?: number;
  backgroundColor?: number;
  hoverColor?: number;
  textColor?: string;
}

export class UIButton extends Phaser.GameObjects.Container {
  private readonly background: Phaser.GameObjects.Rectangle;
  private readonly label: Phaser.GameObjects.Text;

  constructor(
    scene: Phaser.Scene,
    x: number,
    y: number,
    text: string,
    onClick: () => void,
    config: UIButtonConfig = {},
  ) {
    super(scene, x, y);

    scene.add.existing(this);

    const width = config.width ?? 160;
    const height = config.height ?? 42;

    const backgroundColor =
      config.backgroundColor ?? 0x2563eb;

    const hoverColor =
      config.hoverColor ?? 0x3b82f6;

    this.background = scene.add.rectangle(
      0,
      0,
      width,
      height,
      backgroundColor,
      1,
    );

    this.background.setStrokeStyle(
      2,
      0xffffff,
      0.85,
    );

    this.background.setInteractive({
      useHandCursor: true,
    });

    this.label = scene.add.text(
      0,
      0,
      text,
      {
        fontFamily: "Arial",
        fontSize: "16px",
        color: config.textColor ?? "#ffffff",
        fontStyle: "bold",
      },
    );

    this.label.setOrigin(0.5);

    this.background.on("pointerover", () => {
      this.background.setFillStyle(hoverColor);
    });

    this.background.on("pointerout", () => {
      this.background.setFillStyle(backgroundColor);
    });

    this.background.on(
      "pointerdown",
      (
        pointer: Phaser.Input.Pointer,
      ) => {
        if (!pointer.leftButtonDown()) {
          return;
        }

        pointer.event.stopPropagation();
        onClick();
      },
    );

    this.add([this.background, this.label]);
  }

  public setText(text: string): void {
    this.label.setText(text);
  }
}
