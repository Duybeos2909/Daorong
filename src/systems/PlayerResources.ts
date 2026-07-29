export interface PlayerResourceState {
  gold: number;
  food: number;
}

export class PlayerResources {
  private gold: number;
  private food: number;

  constructor(initialState: PlayerResourceState) {
    this.gold = initialState.gold;
    this.food = initialState.food;
  }

  public getGold(): number {
    return this.gold;
  }

  public getFood(): number {
    return this.food;
  }

  public canAffordGold(amount: number): boolean {
    return this.gold >= amount;
  }

  public spendGold(amount: number): boolean {
    if (amount <= 0) {
      return true;
    }

    if (!this.canAffordGold(amount)) {
      return false;
    }

    this.gold -= amount;
    return true;
  }

  public addGold(amount: number): void {
    this.gold += Math.max(0, amount);
  }

  public addFood(amount: number): void {
    this.food += Math.max(0, amount);
  }

  public spendFood(amount: number): boolean {
    if (amount <= 0) {
      return true;
    }

    if (this.food < amount) {
      return false;
    }

    this.food -= amount;
    return true;
  }

  public setState(
    state: Partial<PlayerResourceState>,
  ): void {
    if (
      typeof state.gold === "number" &&
      state.gold >= 0
    ) {
      this.gold = state.gold;
    }

    if (
      typeof state.food === "number" &&
      state.food >= 0
    ) {
      this.food = state.food;
    }
  }

  public getState(): PlayerResourceState {
    return {
      gold: this.gold,
      food: this.food,
    };
  }
}
