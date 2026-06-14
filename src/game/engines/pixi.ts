/**
 * Pixi.js Game Engine Implementation
 * 2D WebGL rendering for fast, lightweight games
 */

import * as PIXI from 'pixi.js';
import { GameConfig, GameEntity, RenderTarget } from '../types';
import { IGameEngine } from './base';

export class PixiJSEngine implements IGameEngine {
  private app: PIXI.Application | null = null;
  private entities = new Map<string, GameEntity>();
  private entitySprites = new Map<string, PIXI.Container>();
  private stats = { fps: 0, meshes: 0, triangles: 0 };

  async initialize(config: GameConfig): Promise<void> {
    this.app = new PIXI.Application({
      view: config.canvas,
      width: config.width,
      height: config.height,
      antialias: config.antialias,
      backgroundAlpha: config.alpha ? 0 : 1,
      resolution: window.devicePixelRatio,
      powerPreference: 'high-performance',
    });

    // Set background color
    this.app.renderer.background.color = 0x1a1a1a;

    // Handle resize
    window.addEventListener('resize', () => this.onWindowResize(config));
  }

  destroy(): void {
    if (this.app) {
      this.app.destroy(true);
      this.app = null;
    }
    this.entities.clear();
    this.entitySprites.clear();
  }

  render(): void {
    if (!this.app) return;
    this.stats.fps = this.app.ticker.FPS;
  }

  update(deltaTime: number): void {
    // Pixi handles rendering via ticker
  }

  setCamera(position: { x: number; y: number; z: number }, target: { x: number; y: number; z: number }): void {
    if (!this.app) return;
    // Pixi 2D doesn't have camera, but we can adjust viewport
    this.app.stage.pivot.set(position.x, position.y);
  }

  addEntity(entity: GameEntity): void {
    this.entities.set(entity.id, entity);

    // Create a simple circle sprite
    const sprite = new PIXI.Graphics();
    sprite.circle(0, 0, 10);
    sprite.fill(0x00ff00);
    sprite.position.set(entity.transform.position.x, entity.transform.position.y);

    if (this.app) {
      this.app.stage.addChild(sprite as any);
    }

    this.entitySprites.set(entity.id, sprite as any);
    this.stats.meshes++;
  }

  removeEntity(id: string): void {
    const sprite = this.entitySprites.get(id);
    if (sprite && this.app) {
      this.app.stage.removeChild(sprite);
    }
    this.entitySprites.delete(id);
    this.entities.delete(id);
    this.stats.meshes--;
  }

  getEntity(id: string): GameEntity | null {
    return this.entities.get(id) || null;
  }

  getAllEntities(): GameEntity[] {
    return Array.from(this.entities.values());
  }

  addLight(): void {
    // Pixi doesn't support lighting in 2D
  }

  getRenderTarget(): RenderTarget | null {
    return null;
  }

  setRenderTarget(): void {
    // Pixi render target management
  }

  getRenderer(): PIXI.Renderer | null {
    return this.app?.renderer || null;
  }

  getScene(): PIXI.Container | null {
    return this.app?.stage || null;
  }

  getStats() {
    return this.stats;
  }

  private onWindowResize(config: GameConfig): void {
    if (!this.app) return;
    const width = config.canvas.clientWidth;
    const height = config.canvas.clientHeight;
    this.app.renderer.resize(width, height);
  }
}
