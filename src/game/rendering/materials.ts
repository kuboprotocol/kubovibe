/**
 * Material Definitions and Factory
 */

export enum MaterialType {
  STANDARD = 'standard',
  PBRDL = 'pbr',
  UNLIT = 'unlit',
  WATER = 'water',
  GLASS = 'glass',
}

export interface MaterialConfig {
  type: MaterialType;
  color?: number;
  metallic?: number;
  roughness?: number;
  emissive?: number;
  map?: string;
  normalMap?: string;
  roughnessMap?: string;
  metalnessMap?: string;
}

export class MaterialFactory {
  static createMaterial(config: MaterialConfig): any {
    switch (config.type) {
      case MaterialType.STANDARD:
        return {
          type: 'standard',
          color: config.color || 0xffffff,
        };
      case MaterialType.PBRDL:
        return {
          type: 'pbr',
          baseColor: config.color || 0xffffff,
          metallic: config.metallic || 0,
          roughness: config.roughness || 0.5,
        };
      case MaterialType.WATER:
        return {
          type: 'water',
          color: 0x0066ff,
          normalMap: config.normalMap,
        };
      default:
        return { type: 'standard', color: 0xffffff };
    }
  }
}
