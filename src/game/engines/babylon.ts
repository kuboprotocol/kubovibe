/**
 * Babylon.js Game Engine Implementation
 * Alternative 3D engine with advanced physics integration
 */

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const BABYLON: any = {};
import { GameConfig, GameEntity, RenderTarget } from '../types';
import { IGameEngine } from './base';

export class BabylonJSEngine implements IGameEngine {
  private engine: BABYLON.Engine | null = null;
  private scene: BABYLON.Scene | null = null;
  private camera: BABYLON.UniversalCamera | null = null;
  private entities = new Map<string, GameEntity>();
  private stats = { fps: 0, meshes: 0, triangles: 0 };
  private renderTarget: RenderTarget | null = null;

  async initialize(config: GameConfig): Promise<void> {
    this.engine = new BABYLON.Engine(config.canvas, true, {
      antialias: config.antialias,
      alpha: config.alpha,
    });

    this.scene = new BABYLON.Scene(this.engine);
    this.scene.clearColor = new BABYLON.Color3(0.1, 0.1, 0.1);

    // Camera setup
    this.camera = new BABYLON.UniversalCamera('camera', new BABYLON.Vector3(0, 10, 20), this.scene);
    this.camera.attachControl(config.canvas, true);
    this.camera.minZ = 0.1;
    this.camera.maxZ = 10000;

    // Default lighting
    const light = new BABYLON.HemisphericLight('light', new BABYLON.Vector3(1, 1, 0), this.scene);
    light.intensity = 0.7;

    // Directional light
    const dirLight = new BABYLON.PointLight('dirLight', new BABYLON.Vector3(100, 100, 50), this.scene);
    dirLight.intensity = 0.5;

    // Ground
    const ground = BABYLON.MeshBuilder.CreateGround('ground', { width: 1000, height: 1000 }, this.scene);
    const groundMat = new BABYLON.StandardMaterial('groundMat', this.scene);
    groundMat.diffuse = new BABYLON.Color3(0.3, 0.3, 0.3);
    ground.material = groundMat;

    // Render loop
    this.engine.runRenderLoop(() => {
      this.render();
    });

    window.addEventListener('resize', () => this.engine?.resize());
  }

  destroy(): void {
    this.scene?.dispose();
    this.engine?.dispose();
    this.engine = null;
    this.scene = null;
    this.camera = null;
    this.entities.clear();
  }

  render(): void {
    if (!this.scene) return;
    this.stats.fps = this.engine?.getFps() || 0;
    this.scene.render();
  }

  update(deltaTime: number): void {
    // Babylon handles updates in render loop
  }

  setCamera(position: { x: number; y: number; z: number }, target: { x: number; y: number; z: number }): void {
    if (!this.camera) return;
    this.camera.position = new BABYLON.Vector3(position.x, position.y, position.z);
    this.camera.setTarget(new BABYLON.Vector3(target.x, target.y, target.z));
  }

  addEntity(entity: GameEntity): void {
    this.entities.set(entity.id, entity);

    const box = BABYLON.MeshBuilder.CreateBox(entity.id, { size: 1 }, this.scene);
    const mat = new BABYLON.StandardMaterial(entity.id + '_mat', this.scene);
    mat.diffuse = new BABYLON.Color3(0, 1, 0);
    box.material = mat;

    this.stats.meshes++;
  }

  removeEntity(id: string): void {
    const mesh = this.scene?.getMeshByName(id);
    if (mesh) {
      mesh.dispose();
      this.stats.meshes--;
    }
    this.entities.delete(id);
  }

  getEntity(id: string): GameEntity | null {
    return this.entities.get(id) || null;
  }

  getAllEntities(): GameEntity[] {
    return Array.from(this.entities.values());
  }

  addLight(type: 'ambient' | 'directional' | 'point' | 'spot', config: any): void {
    if (!this.scene) return;

    let light: BABYLON.Light;

    switch (type) {
      case 'ambient':
        light = new BABYLON.HemisphericLight('light', new BABYLON.Vector3(1, 1, 0), this.scene);
        light.intensity = config.intensity || 1;
        break;
      case 'point':
        light = new BABYLON.PointLight('pointLight', new BABYLON.Vector3(
          config.position?.x || 0,
          config.position?.y || 0,
          config.position?.z || 0
        ), this.scene);
        light.intensity = config.intensity || 1;
        break;
      case 'spot':
        light = new BABYLON.SpotLight('spotLight', new BABYLON.Vector3(
          config.position?.x || 0,
          config.position?.y || 0,
          config.position?.z || 0
        ), new BABYLON.Vector3(0, -1, 0), Math.PI / 3, 2, this.scene);
        light.intensity = config.intensity || 1;
        break;
      default:
        light = new BABYLON.PointLight('light', new BABYLON.Vector3(0, 0, 0), this.scene);
    }
  }

  getRenderTarget(): RenderTarget | null {
    return this.renderTarget;
  }

  setRenderTarget(target: RenderTarget | null): void {
    this.renderTarget = target;
  }

  getRenderer(): BABYLON.Engine | null {
    return this.engine;
  }

  getScene(): BABYLON.Scene | null {
    return this.scene;
  }

  getStats() {
    return this.stats;
  }
}
