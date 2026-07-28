import type { BuildingType } from "../entities/Building";

export interface BuildingDefinition {
  displayName: string;
  buildCost: number;
  baseUpgradeCost: number;
  refundRate: number;
}

export const BUILDING_DEFINITIONS: Record<
  BuildingType,
  BuildingDefinition
> = {
  house: {
    displayName: "Nhà chính",
    buildCost: 0,
    baseUpgradeCost: 500,
    refundRate: 0,
  },

  farm: {
    displayName: "Nông trại",
    buildCost: 250,
    baseUpgradeCost: 180,
    refundRate: 0.5,
  },

  habitat: {
    displayName: "Habitat",
    buildCost: 600,
    baseUpgradeCost: 400,
    refundRate: 0.5,
  },
};

export function getUpgradeCost(
  type: BuildingType,
  currentLevel: number,
): number {
  const definition =
    BUILDING_DEFINITIONS[type];

  return Math.floor(
    definition.baseUpgradeCost *
      Math.pow(1.6, currentLevel - 1),
  );
}
