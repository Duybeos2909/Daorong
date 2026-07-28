import Phaser from "phaser";

export class Dragon extends Phaser.GameObjects.Image {
  private target?: Phaser.Math.Vector2;
  private readonly moveSpeed = 150;

  constructor(scene: Phaser.Scene, x: number, y: number) {
    super(scene, x, y, "dragon");

    scene.add.existing(this);
    this.setDepth(y + 1000);
    this.setScale(0.9);
  }

  moveTo(x: number, y: number): void {
    this.target = new Phaser.Math.Vector2(x, y);
  }

  update(_time: number, delta: number): void {
    if (!this.target) {
      return;
    }

    const distance = Phaser.Math.Distance.Between(
      this.x,
      this.y,
      this.target.x,
      this.target.y,
    );

    if (distance < 4) {
      this.setPosition(this.target.x, this.target.y);
      this.target = undefined;
      return;
    }

    const direction = new Phaser.Math.Vector2(
      this.target.x - this.x,
      this.target.y - this.y,
    ).normalize();

    const step = this.moveSpeed * (delta / 1000);
    this.x += direction.x * Math.min(step, distance);
    this.y += direction.y * Math.min(step, distance);
    this.setFlipX(direction.x < 0);
    this.setDepth(this.y + 1000);
  }
}
