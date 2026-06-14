/**
 * Base Game Engine Interface
 * All engines must implement this interface
 */

import { GameConfig, GameEntity, RenderTarget } from '../types';

export interface IGameEngine {
  // Lifecycle
  initialize(config: GameConfig): Promise<void>;
  destroy(): void;
  render(): void;
  update(deltaTime: number): void;

  // Camera
  setCamera(position: { x: number; y: number; z: number }, target: { x: number; y: number; z: number }): void;

  // Scene
  addEntity(entity: GameEntity): void;
  removeEntity(id: string): void;
  getEntity(id: string): GameEntity | null;
  getAllEntities(): GameEntity[];

  // Lighting
  addLight(type: 'ambient' | 'directional' | 'point' | 'spot', config: any): void;

  // Rendering
  getRenderTarget(): RenderTarget | null;
  setRenderTarget(target: RenderTarget | null): void;
  getRenderer(): any;
  getScene(): any;

  // Performance
  getStats(): { fps: number; meshes: number; triangles: number };
}
