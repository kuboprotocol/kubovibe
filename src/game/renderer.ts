// Three.js bridge — renders the ECS world. Premium dark + ouro/neon aesthetic.
import * as THREE from 'three';
import { World, Transform, Renderable, EntityId, Emote } from './ecs';

export class GameRenderer {
  scene: THREE.Scene;
  camera: THREE.PerspectiveCamera;
  renderer: THREE.WebGLRenderer;
  meshes = new Map<EntityId, THREE.Mesh>();
  private raf: number | null = null;
  private clock = new THREE.Clock();
  private container: HTMLElement;

  constructor(container: HTMLElement) {
    this.container = container;
    this.scene = new THREE.Scene();
    this.scene.background = new THREE.Color(0x0a0a14);
    this.scene.fog = new THREE.Fog(0x0a0a14, 18, 60);

    this.camera = new THREE.PerspectiveCamera(60, container.clientWidth / container.clientHeight, 0.1, 200);
    this.camera.position.set(14, 16, 18);
    this.camera.lookAt(0, 0, 0);

    this.renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    this.renderer.setSize(container.clientWidth, container.clientHeight);
    this.renderer.shadowMap.enabled = true;
    container.appendChild(this.renderer.domElement);

    // Premium lighting — gold key + neon purple rim
    const amb = new THREE.AmbientLight(0x4a3a6e, 0.5);
    const key = new THREE.DirectionalLight(0xc9941a, 1.4);
    key.position.set(10, 18, 8); key.castShadow = true;
    const rim = new THREE.PointLight(0x8b5cf6, 2, 30);
    rim.position.set(-8, 6, -6);
    const fill = new THREE.PointLight(0x38bdf8, 1.2, 25);
    fill.position.set(8, 4, -8);
    this.scene.add(amb, key, rim, fill);

    // Ground grid
    const grid = new THREE.GridHelper(80, 40, 0xc9941a, 0x2a2030);
    (grid.material as THREE.Material).transparent = true;
    (grid.material as THREE.Material).opacity = 0.25;
    this.scene.add(grid);

    window.addEventListener('resize', this.onResize);
  }

  private onResize = () => {
    this.camera.aspect = this.container.clientWidth / this.container.clientHeight;
    this.camera.updateProjectionMatrix();
    this.renderer.setSize(this.container.clientWidth, this.container.clientHeight);
  };

  syncEntities(world: World) {
    const seen = new Set<EntityId>();
    for (const id of world.query(['transform', 'renderable'])) {
      seen.add(id);
      const t = world.getComponent<Transform>(id, 'transform')!;
      const r = world.getComponent<Renderable>(id, 'renderable')!;
      let mesh = this.meshes.get(id);
      if (!mesh) {
        const geom =
          r.mesh === 'cube' ? new THREE.BoxGeometry(0.9, 0.9, 0.9) :
          r.mesh === 'sphere' ? new THREE.SphereGeometry(0.5, 24, 16) :
          new THREE.ConeGeometry(0.5, 1.4, 12); // npc
        const mat = new THREE.MeshStandardMaterial({
          color: r.color,
          metalness: r.mesh === 'cube' ? 0.6 : 0.3,
          roughness: r.mesh === 'cube' ? 0.5 : 0.25,
          emissive: r.mesh === 'npc' ? 0xc9941a : (r.mesh === 'sphere' ? 0x8b5cf6 : 0x000000),
          emissiveIntensity: r.mesh === 'npc' ? 0.4 : (r.mesh === 'sphere' ? 0.6 : 0),
        });
        mesh = new THREE.Mesh(geom, mat);
        mesh.castShadow = true; mesh.receiveShadow = true;
        mesh.userData.entityId = id;
        mesh.scale.setScalar(r.scale);
        this.scene.add(mesh);
        this.meshes.set(id, mesh);
      }
      mesh.position.set(t.x, t.y, t.z);
      mesh.rotation.y = t.rot;

      // Emote animation: scale pulse + small hop. Driven by ECS Emote component (TTL ticked by EmoteSystem).
      const emote = world.getComponent<Emote>(id, 'emote');
      if (emote) {
        const p = emote.elapsed / emote.ttl; // 0..1
        const pulse = 1 + Math.sin(p * Math.PI) * 0.25;
        mesh.scale.setScalar(r.scale * pulse);
        if (emote.kind === 'cheer' || emote.kind === 'wave') {
          mesh.position.y = t.y + Math.sin(p * Math.PI * 2) * 0.25;
        } else if (emote.kind === 'attack') {
          mesh.rotation.y += Math.sin(p * Math.PI * 4) * 0.4;
        } else if (emote.kind === 'bow') {
          mesh.rotation.x = Math.sin(p * Math.PI) * 0.6;
        }
      } else {
        mesh.scale.setScalar(r.scale);
        mesh.rotation.x = 0;
      }
    }
    // Cleanup removed entities
    for (const [id, mesh] of this.meshes) {
      if (!seen.has(id)) { this.scene.remove(mesh); this.meshes.delete(id); }
    }
  }

  start(onFrame: (dt: number) => void) {
    const loop = () => {
      const dt = this.clock.getDelta();
      onFrame(dt);
      this.renderer.render(this.scene, this.camera);
      this.raf = requestAnimationFrame(loop);
    };
    loop();
  }

  pickEntity(clientX: number, clientY: number): EntityId | null {
    const rect = this.renderer.domElement.getBoundingClientRect();
    const ndc = new THREE.Vector2(
      ((clientX - rect.left) / rect.width) * 2 - 1,
      -((clientY - rect.top) / rect.height) * 2 + 1,
    );
    const ray = new THREE.Raycaster();
    ray.setFromCamera(ndc, this.camera);
    const hits = ray.intersectObjects([...this.meshes.values()]);
    return hits[0]?.object.userData.entityId ?? null;
  }

  dispose() {
    if (this.raf) cancelAnimationFrame(this.raf);
    window.removeEventListener('resize', this.onResize);
    this.renderer.dispose();
    this.container.removeChild(this.renderer.domElement);
  }
}
