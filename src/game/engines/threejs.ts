/**
 * Three.js Game Engine Implementation
 * High-performance 3D rendering with WebGL/WebGPU
 */

import * as THREE from 'three';
import { GameConfig, GameEntity, RenderTarget } from '../types';
import { IGameEngine } from './base';

export class ThreeJSEngine implements IGameEngine {
  private scene: THREE.Scene | null = null;
  private camera: THREE.PerspectiveCamera | null = null;
  private renderer: THREE.WebGLRenderer | null = null;
  private entities = new Map<string, GameEntity>();
  private clock = new THREE.Clock();
  private renderTarget: RenderTarget | null = null;
  private stats = { fps: 0, meshes: 0, triangles: 0 };
  private lastFrameTime = 0;
  private frameCount = 0;

  async initialize(config: GameConfig): Promise<void> {
    // Scene setup
    this.scene = new THREE.Scene();
    this.scene.background = new THREE.Color(0x1a1a1a);
    this.scene.fog = new THREE.Fog(0x1a1a1a, 100, 1000);

    // Camera setup
    this.camera = new THREE.PerspectiveCamera(
      75,
      config.width / config.height,
      0.1,
      10000
    );
    this.camera.position.set(0, 10, 20);
    this.camera.lookAt(0, 0, 0);

    // Renderer setup
    this.renderer = new THREE.WebGLRenderer({
      canvas: config.canvas,
      antialias: config.antialias,
      alpha: config.alpha,
      premultipliedAlpha: config.premultipliedAlpha,
    });
    this.renderer.setSize(config.width, config.height);
    this.renderer.setPixelRatio(window.devicePixelRatio);
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = THREE.PCFShadowShadowMap;

    // Default lighting
    const ambientLight = new THREE.AmbientLight(0xffffff, 0.5);
    this.scene.add(ambientLight);

    const directionalLight = new THREE.DirectionalLight(0xffffff, 0.8);
    directionalLight.position.set(100, 100, 50);
    directionalLight.castShadow = true;
    directionalLight.shadow.camera.left = -100;
    directionalLight.shadow.camera.right = 100;
    directionalLight.shadow.camera.top = 100;
    directionalLight.shadow.camera.bottom = -100;
    this.scene.add(directionalLight);

    // Handle window resize
    window.addEventListener('resize', () => this.onWindowResize(config));

    this.clock.start();
  }

  destroy(): void {
    this.renderer?.dispose();
    this.scene = null;
    this.camera = null;
    this.renderer = null;
    this.entities.clear();
  }

  render(): void {
    if (!this.renderer || !this.scene || !this.camera) return;

    this.frameCount++;
    const now = performance.now();
    if (now - this.lastFrameTime >= 1000) {
      this.stats.fps = this.frameCount;
      this.frameCount = 0;
      this.lastFrameTime = now;
    }

    if (this.renderTarget) {
      this.renderer.setRenderTarget(this.renderTarget as any);
    }

    this.renderer.render(this.scene, this.camera);

    if (this.renderTarget) {
      this.renderer.setRenderTarget(null);
    }
  }

  update(deltaTime: number): void {
    // Update entities
    this.entities.forEach((entity) => {
      if (!entity.active) return;

      const mesh = this.scene?.getObjectByName(entity.id) as THREE.Mesh;
      if (mesh) {
        mesh.position.set(
          entity.transform.position.x,
          entity.transform.position.y,
          entity.transform.position.z
        );
        mesh.rotation.set(
          entity.transform.rotation.x,
          entity.transform.rotation.y,
          entity.transform.rotation.z
        );
        mesh.scale.set(
          entity.transform.scale.x,
          entity.transform.scale.y,
          entity.transform.scale.z
        );
      }
    });
  }

  setCamera(position: { x: number; y: number; z: number }, target: { x: number; y: number; z: number }): void {
    if (!this.camera) return;
    this.camera.position.set(position.x, position.y, position.z);
    this.camera.lookAt(target.x, target.y, target.z);
  }

  addEntity(entity: GameEntity): void {
    this.entities.set(entity.id, entity);

    // Create a mesh (default: cube)
    const geometry = new THREE.BoxGeometry(1, 1, 1);
    const material = new THREE.MeshStandardMaterial({ color: 0x00ff00 });
    const mesh = new THREE.Mesh(geometry, material);
    mesh.name = entity.id;
    mesh.castShadow = true;
    mesh.receiveShadow = true;

    this.scene?.add(mesh);
    this.stats.meshes++;
  }

  removeEntity(id: string): void {
    const mesh = this.scene?.getObjectByName(id);
    if (mesh) {
      this.scene?.remove(mesh);
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

    let light: THREE.Light;

    switch (type) {
      case 'ambient':
        light = new THREE.AmbientLight(config.color || 0xffffff, config.intensity || 1);
        break;
      case 'directional':
        light = new THREE.DirectionalLight(config.color || 0xffffff, config.intensity || 1);
        (light as THREE.DirectionalLight).position.set(
          config.position?.x || 0,
          config.position?.y || 0,
          config.position?.z || 0
        );
        break;
      case 'point':
        light = new THREE.PointLight(config.color || 0xffffff, config.intensity || 1, config.distance || 100);
        light.position.set(
          config.position?.x || 0,
          config.position?.y || 0,
          config.position?.z || 0
        );
        break;
      case 'spot':
        light = new THREE.SpotLight(config.color || 0xffffff, config.intensity || 1);
        light.position.set(
          config.position?.x || 0,
          config.position?.y || 0,
          config.position?.z || 0
        );
        break;
    }

    this.scene.add(light);
  }

  getRenderTarget(): RenderTarget | null {
    return this.renderTarget;
  }

  setRenderTarget(target: RenderTarget | null): void {
    this.renderTarget = target;
  }

  getRenderer(): THREE.WebGLRenderer | null {
    return this.renderer;
  }

  getScene(): THREE.Scene | null {
    return this.scene;
  }

  getStats() {
    return this.stats;
  }

  private onWindowResize(config: GameConfig): void {
    if (!this.camera || !this.renderer) return;

    const width = config.canvas.clientWidth;
    const height = config.canvas.clientHeight;

    this.camera.aspect = width / height;
    this.camera.updateProjectionMatrix();
    this.renderer.setSize(width, height);
  }
}
