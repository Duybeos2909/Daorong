import Phaser from "phaser";

export interface DragonRoamingPoint {
  x: number;
  y: number;
}

export class Dragon extends Phaser.GameObjects.Image {
  public habitatId?: string;

  private target?: Phaser.Math.Vector2;
  private roamingPoints: DragonRoamingPoint[] = [];

  private readonly moveSpeed = 65;

  private waitUntil = 0;
  private readonly minimumWaitTime = 700;
  private readonly maximumWaitTime = 2200;

  constructor(
    scene: Phaser.Scene,
    x: number,
    y: number,
  ) {
    super(scene, x, y, "dragon");

    scene.add.existing(this);

    this.setScale(0.9);
    this.setDepth(y + 1000);
  }

  public assignHabitat(
    habitatId: string,
    roamingPoints: DragonRoamingPoint[],
  ): void {
    this.habitatId = habitatId;
    this.roamingPoints = roamingPoints;

    this.target = undefined;
    this.waitUntil = 0;

    this.moveInsideHabitatImmediately();
  }

  public updateHabitatPoints(
    roamingPoints: DragonRoamingPoint[],
  ): void {
    this.roamingPoints = roamingPoints;
    this.target = undefined;

    this.moveInsideHabitatImmediately();
  }

  public clearHabitat(): void {
    this.habitatId = undefined;
    this.roamingPoints = [];
    this.target = undefined;
  }

  public update(
    time: number,
    delta: number,
  ): void {
    if (
      !this.habitatId ||
      this.roamingPoints.length === 0
    ) {
      return;
    }

    if (!this.target) {
      if (time >= this.waitUntil) {
        this.chooseRandomTarget();
      }

      return;
    }

    const distance = Phaser.Math.Distance.Between(
      this.x,
      this.y,
      this.target.x,
      this.target.y,
    );

    if (distance <= 3) {
      this.setPosition(
        this.target.x,
        this.target.y,
      );

      this.target = undefined;

      this.waitUntil =
        time +
        Phaser.Math.Between(
          this.minimumWaitTime,
          this.maximumWaitTime,
        );

      return;
    }

    const direction = new Phaser.Math.Vector2(
      this.target.x - this.x,
      this.target.y - this.y,
    ).normalize();

    const step =
      this.moveSpeed * (delta / 1000);

    this.x +=
      direction.x * Math.min(step, distance);

    this.y +=
      direction.y * Math.min(step, distance);

    this.setFlipX(direction.x < 0);
    this.setDepth(this.y + 1000);
  }

  private chooseRandomTarget(): void {
    if (this.roamingPoints.length === 0) {
      return;
    }

    const index = Phaser.Math.Between(
      0,
      this.roamingPoints.length - 1,
    );

    const point = this.roamingPoints[index];

    this.target = new Phaser.Math.Vector2(
      point.x,
      point.y,
    );
  }

  private moveInsideHabitatImmediately(): void {
    if (this.roamingPoints.length === 0) {
      return;
    }

    const centerIndex = Math.floor(
      this.roamingPoints.length / 2,
    );

    const point = this.roamingPoints[centerIndex];

    this.setPosition(point.x, point.y);
    this.setDepth(this.y + 1000);
  }
}
