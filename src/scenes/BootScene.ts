import Phaser from "phaser";

export class BootScene extends Phaser.Scene {
  constructor() {
    super("BootScene");
  }

  create(): void {
    this.createTextures();
    this.scene.start("IslandScene");
  }

  private createTextures(): void {
    const graphics = this.add.graphics();

    // Ô cỏ 64x32 theo phong cách isometric.
    graphics.fillStyle(0x75bd57);
    graphics.lineStyle(2, 0x4f8f3e);
    graphics.beginPath();
    graphics.moveTo(32, 0);
    graphics.lineTo(64, 16);
    graphics.lineTo(32, 32);
    graphics.lineTo(0, 16);
    graphics.closePath();
    graphics.fillPath();
    graphics.strokePath();
    graphics.generateTexture("grass-tile", 64, 32);
    graphics.clear();

    // Nước.
    graphics.fillStyle(0x3c9ed8);
    graphics.fillRect(0, 0, 64, 32);
    graphics.generateTexture("water", 64, 32);
    graphics.clear();

    // Nhà chính tạm.
    graphics.fillStyle(0xe5b96f);
    graphics.fillRoundedRect(8, 24, 80, 60, 8);
    graphics.fillStyle(0xb54c45);
    graphics.beginPath();
    graphics.moveTo(0, 32);
    graphics.lineTo(48, 0);
    graphics.lineTo(96, 32);
    graphics.closePath();
    graphics.fillPath();
    graphics.fillStyle(0x6d432b);
    graphics.fillRect(38, 54, 20, 30);
    graphics.generateTexture("building-house", 96, 88);
    graphics.clear();

    // Nông trại tạm.
    graphics.fillStyle(0x8b5a2b);
    graphics.fillRoundedRect(4, 22, 88, 50, 6);
    graphics.lineStyle(4, 0xe2bd69);
    for (let x = 14; x <= 82; x += 17) {
      graphics.lineBetween(x, 28, x, 66);
    }
    graphics.generateTexture("building-farm", 96, 76);
    graphics.clear();

    // Rồng tạm.
    graphics.fillStyle(0x7c3aed);
    graphics.fillCircle(28, 26, 19);
    graphics.fillTriangle(11, 20, 0, 8, 18, 12);
    graphics.fillTriangle(45, 20, 56, 8, 38, 12);
    graphics.fillStyle(0xffffff);
    graphics.fillCircle(21, 22, 4);
    graphics.fillCircle(35, 22, 4);
    graphics.fillStyle(0x111827);
    graphics.fillCircle(22, 22, 2);
    graphics.fillCircle(36, 22, 2);
    graphics.fillStyle(0xf59e0b);
    graphics.fillTriangle(28, 28, 23, 35, 33, 35);
    graphics.generateTexture("dragon", 56, 52);
    graphics.destroy();
  }
}
