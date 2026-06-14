/**
 * Babylon.js Game Engine Implementation — STUB.
 * The actual Babylon integration lives in the external @kubo/renderer-3d package.
 * This stub keeps the IGameEngine interface satisfied so tree-shaken builds compile.
 */

import { GameConfig, GameEntity, RenderTarget } from '../types';
import { IGameEngine } from './base';

export class BabylonJSEngine implements IGameEngine {
  private entities = new Map<string, GameEntity>();
  private stats = { fps: 0, meshes: 0, triangles: 0 };

  async initialize(_config: GameConfig): Promise<void> {
    throw new Error('BabylonJSEngine is provided by @kubo/renderer-3d. Install the external package to use it.');
  }

  destroy(): void { this.entities.clear(); }
  render(): void { /* noop */ }
  update(_dt: number): void { /* noop */ }
  setCamera(_p: { x: number; y: number; z: number }, _t: { x: number; y: number; z: number }): void { /* noop */ }

  addEntity(entity: GameEntity): void { this.entities.set(entity.id, entity); }
  removeEntity(id: string): void { this.entities.delete(id); }
  getEntity(id: string): GameEntity | null { return this.entities.get(id) ?? null; }
  getAllEntities(): GameEntity[] { return [...this.entities.values()]; }

  addLight(_type: 'ambient' | 'directional' | 'point' | 'spot', _config: unknown): void { /* noop */ }

  getRenderTarget(): RenderTarget | null { return null; }
  setRenderTarget(_t: RenderTarget | null): void { /* noop */ }
  getRenderer(): unknown { return null; }
  getScene(): unknown { return null; }

  getStats() { return this.stats; }
}
