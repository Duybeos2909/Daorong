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
    baseUpgradeCost: 0,
    refundRate: 0,
  },

  farm: {
    displayName: "Nông trại",
    buildCost: 500,
    baseUpgradeCost: 1000,
    refundRate: 0.5,
  },

  habitat: {
    displayName: "Habitat",
    buildCost: 600,
    baseUpgradeCost: 400,
    refundRate: 0.5,
  },
};

export function getFarmBuildCost(
  level: number,
): number {
  const safeLevel = Math.max(1, level);

  return 500 * Math.pow(2, safeLevel - 1);
}

export function getFarmConstructionDuration(
  level: number,
): number {
  const safeLevel = Math.max(1, level);

  return (
    30_000 +
    (safeLevel - 1) * 15_000
  );
}

export function getFarmProductionDuration(
  level: number,
): number {
  const safeLevel = Math.max(1, level);

  return (
    15_000 +
    (safeLevel - 1) * 5_000
  );
}

export function getFarmFoodReward(
  level: number,
): number {
  const safeLevel = Math.max(1, level);

  return (
    20 *
    Math.pow(2, safeLevel - 1)
  );
}

export function getUpgradeCost(
  type: BuildingType,
  currentLevel: number,
): number {
  const nextLevel = currentLevel + 1;

  if (type === "farm") {
    return getFarmBuildCost(nextLevel);
  }

  const definition =
    BUILDING_DEFINITIONS[type];

  return Math.floor(
    definition.baseUpgradeCost *
      Math.pow(1.6, currentLevel - 1),
  );
}
