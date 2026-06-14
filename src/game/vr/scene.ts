/**
 * KUBO VR Scene — WebXR-ready ultra-realistic Three.js scene wrapper.
 *
 * - Uses ACES Filmic tonemapping + sRGB output for cinematic color.
 * - Enables WebXR when available; falls back to flat 3D when not.
 * - Procedural cinematic environment (no external HDRI required).
 * - VRButton appended on demand via `mountVrButton(parent)`.
 */
import * as THREE from 'three';
import { VRButton } from 'three/examples/jsm/webxr/VRButton.js';
import { XRControllerModelFactory } from 'three/examples/jsm/webxr/XRControllerModelFactory.js';
import { buildCinematicEnvironment } from './environment';
import {
  VR_QUALITY,
  type VrQualityName,
  type VrQualityPreset,
  type VrSceneOptions,
  type VrUpdateFn,
  type VrFrameStats,
  type VrObjectDescriptor,
} from './types';

export class VrScene {
  readonly renderer: THREE.WebGLRenderer;
  readonly scene: THREE.Scene;
  readonly camera: THREE.PerspectiveCamera;
  readonly playerRig: THREE.Group;
  readonly controllers: THREE.Group[] = [];

  private quality: VrQualityPreset;
  private updates: VrUpdateFn[] = [];
  private clock = new THREE.Clock();
  private xrActive = false;
  private stats: VrFrameStats = { fps: 0, drawCalls: 0, triangles: 0, xrActive: false };
  private frameCount = 0;
  private lastFpsAt = performance.now();
  private objects = new Map<string, THREE.Object3D>();

  constructor(opts: VrSceneOptions) {
    this.quality =
      typeof opts.quality === 'string' || opts.quality == null
        ? VR_QUALITY[(opts.quality ?? 'ultra') as VrQualityName]
        : opts.quality;

    this.renderer = new THREE.WebGLRenderer({
      canvas: opts.canvas,
      antialias: this.quality.msaa > 0,
      powerPreference: 'high-performance',
      alpha: false,
    });
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio * this.quality.pixelRatio, 3));
    this.renderer.setSize(opts.canvas.clientWidth, opts.canvas.clientHeight, false);
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;
    this.renderer.toneMapping = this.quality.acesTonemapping ? THREE.ACESFilmicToneMapping : THREE.NoToneMapping;
    this.renderer.toneMappingExposure = 1.05;
    this.renderer.shadowMap.enabled = this.quality.shadows;
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    this.renderer.xr.enabled = true;
    if (this.quality.msaa > 0 && 'setFramebufferScaleFactor' in this.renderer.xr) {
      try { (this.renderer.xr as any).setFramebufferScaleFactor(this.quality.pixelRatio); } catch { /* noop */ }
    }

    this.scene = new THREE.Scene();
    this.camera = new THREE.PerspectiveCamera(72, opts.canvas.clientWidth / opts.canvas.clientHeight, 0.05, 500);
    this.camera.position.set(0, 1.65, 3.2);

    // Player rig (so XR camera offset stays consistent in non-XR fallback)
    this.playerRig = new THREE.Group();
    this.playerRig.add(this.camera);
    this.scene.add(this.playerRig);

    buildCinematicEnvironment(this.scene, this.quality);
    this.setupControllers();
    this.bindResize(opts.canvas);
    this.bindXrEvents();
  }

  /** Append a "Enter VR" button into the parent element. */
  mountVrButton(parent: HTMLElement): HTMLElement | null {
    try {
      const btn = VRButton.createButton(this.renderer);
      btn.style.position = 'absolute';
      btn.style.bottom = '16px';
      btn.style.left = '50%';
      btn.style.transform = 'translateX(-50%)';
      parent.appendChild(btn);
      return btn;
    } catch {
      return null;
    }
  }

  /** Register a per-frame update callback. Returns an unsubscribe fn. */
  onUpdate(fn: VrUpdateFn): () => void {
    this.updates.push(fn);
    return () => { this.updates = this.updates.filter((f) => f !== fn); };
  }

  /** Start the render loop. */
  start(): void {
    this.renderer.setAnimationLoop(() => this.tick());
  }

  stop(): void {
    this.renderer.setAnimationLoop(null);
  }

  dispose(): void {
    this.stop();
    this.renderer.dispose();
    this.scene.traverse((o) => {
      const m = o as THREE.Mesh;
      m.geometry?.dispose?.();
      const mat = m.material as THREE.Material | THREE.Material[] | undefined;
      if (Array.isArray(mat)) mat.forEach((mm) => mm.dispose());
      else mat?.dispose?.();
    });
    this.objects.clear();
  }

  /** Add a high-fidelity PBR object by descriptor. Returns the created Object3D. */
  addObject(d: VrObjectDescriptor): THREE.Object3D {
    let mesh: THREE.Object3D;
    const mat = new THREE.MeshPhysicalMaterial({
      color: d.material?.color ?? 0xffffff,
      metalness: d.material?.metalness ?? 0.6,
      roughness: d.material?.roughness ?? 0.25,
      emissive: d.material?.emissive ?? 0x000000,
      emissiveIntensity: d.material?.emissiveIntensity ?? 0,
      clearcoat: d.material?.clearcoat ?? 0.6,
      clearcoatRoughness: 0.08,
      transmission: d.material?.transmission ?? 0,
      ior: d.material?.ior ?? 1.45,
      reflectivity: 0.6,
    });

    switch (d.kind) {
      case 'sphere':
        mesh = new THREE.Mesh(new THREE.SphereGeometry(0.5, 64, 64), mat);
        break;
      case 'plane':
        mesh = new THREE.Mesh(new THREE.PlaneGeometry(1, 1, 1, 1), mat);
        break;
      case 'gltf':
        // GLTF loading is intentionally deferred to consumer apps to avoid
        // pulling GLTFLoader into the core VR bundle. Use a stand-in cube.
        mesh = new THREE.Mesh(new THREE.BoxGeometry(0.6, 0.6, 0.6), mat);
        break;
      case 'box':
      default:
        mesh = new THREE.Mesh(new THREE.BoxGeometry(1, 1, 1), mat);
    }

    if (d.position) mesh.position.fromArray(d.position);
    if (d.rotation) mesh.rotation.fromArray(d.rotation as [number, number, number]);
    if (d.scale) mesh.scale.fromArray(d.scale);
    mesh.castShadow = this.quality.shadows;
    mesh.receiveShadow = this.quality.shadows;
    mesh.name = d.id;

    this.scene.add(mesh);
    this.objects.set(d.id, mesh);
    return mesh;
  }

  removeObject(id: string): void {
    const o = this.objects.get(id);
    if (!o) return;
    this.scene.remove(o);
    this.objects.delete(id);
  }

  getStats(): VrFrameStats {
    const info = this.renderer.info;
    this.stats.drawCalls = info.render.calls;
    this.stats.triangles = info.render.triangles;
    this.stats.xrActive = this.xrActive;
    return { ...this.stats };
  }

  isImmersive(): boolean {
    return this.xrActive;
  }

  /* ------------------------------------------------------------------ */

  private tick(): void {
    const dt = this.clock.getDelta();
    for (const fn of this.updates) fn(dt, { scene: this.scene, camera: this.camera, xrActive: this.xrActive });
    this.renderer.render(this.scene, this.camera);

    this.frameCount++;
    const now = performance.now();
    if (now - this.lastFpsAt >= 1000) {
      this.stats.fps = this.frameCount;
      this.frameCount = 0;
      this.lastFpsAt = now;
    }
  }

  private setupControllers(): void {
    const factory = new XRControllerModelFactory();
    for (let i = 0; i < 2; i++) {
      const controller = this.renderer.xr.getController(i);
      const grip = this.renderer.xr.getControllerGrip(i);
      grip.add(factory.createControllerModel(grip));
      this.playerRig.add(controller, grip);
      this.controllers.push(controller);

      // Visible laser pointer
      const lineGeo = new THREE.BufferGeometry().setFromPoints([
        new THREE.Vector3(0, 0, 0),
        new THREE.Vector3(0, 0, -5),
      ]);
      const lineMat = new THREE.LineBasicMaterial({ color: 0xc9941a, transparent: true, opacity: 0.85 });
      controller.add(new THREE.Line(lineGeo, lineMat));
    }
  }

  private bindResize(canvas: HTMLCanvasElement): void {
    const handler = () => {
      const w = canvas.clientWidth || canvas.parentElement?.clientWidth || window.innerWidth;
      const h = canvas.clientHeight || canvas.parentElement?.clientHeight || window.innerHeight;
      this.renderer.setSize(w, h, false);
      this.camera.aspect = w / h;
      this.camera.updateProjectionMatrix();
    };
    window.addEventListener('resize', handler);
    handler();
  }

  private bindXrEvents(): void {
    this.renderer.xr.addEventListener('sessionstart', () => { this.xrActive = true; });
    this.renderer.xr.addEventListener('sessionend',   () => { this.xrActive = false; });
  }
}

/** Async capability check — true if the browser exposes immersive-vr. */
export async function isVrSupported(): Promise<boolean> {
  const xr = (navigator as Navigator & { xr?: XRSystem }).xr;
  if (!xr || typeof xr.isSessionSupported !== 'function') return false;
  try { return await xr.isSessionSupported('immersive-vr'); } catch { return false; }
}
