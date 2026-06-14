/**
 * Three.js scene helpers for the metaverse template.
 * Builds the room (floor, walls, lights) and avatar meshes with name billboards.
 */

import * as THREE from 'three';

export interface MetaverseScene {
  scene: THREE.Scene;
  camera: THREE.PerspectiveCamera;
  renderer: THREE.WebGLRenderer;
  resize: (w: number, h: number) => void;
  dispose: () => void;
}

export function createMetaverseScene(canvas: HTMLCanvasElement, w: number, h: number): MetaverseScene {
  const scene = new THREE.Scene();
  scene.background = new THREE.Color(0x0a0d18);
  scene.fog = new THREE.Fog(0x0a0d18, 30, 90);

  const camera = new THREE.PerspectiveCamera(70, w / h, 0.1, 500);
  camera.position.set(0, 4, 8);

  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
  renderer.setSize(w, h);
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.1;

  // Lights
  scene.add(new THREE.AmbientLight(0xffffff, 0.35));
  const dir = new THREE.DirectionalLight(0xffd58a, 0.9);
  dir.position.set(20, 30, 10);
  dir.castShadow = true;
  dir.shadow.mapSize.set(2048, 2048);
  dir.shadow.camera.left = -40; dir.shadow.camera.right = 40;
  dir.shadow.camera.top = 40; dir.shadow.camera.bottom = -40;
  scene.add(dir);

  const gold = new THREE.PointLight(0xc9941a, 1.5, 30);
  gold.position.set(0, 6, 0);
  scene.add(gold);

  // Floor — large checker plane
  const floorMat = new THREE.MeshStandardMaterial({ color: 0x14182a, roughness: 0.6, metalness: 0.2 });
  const floor = new THREE.Mesh(new THREE.PlaneGeometry(80, 80, 16, 16), floorMat);
  floor.rotation.x = -Math.PI / 2;
  floor.receiveShadow = true;
  scene.add(floor);

  // Grid overlay
  const grid = new THREE.GridHelper(80, 40, 0xc9941a, 0x22273a);
  (grid.material as THREE.Material).opacity = 0.4;
  (grid.material as THREE.Material).transparent = true;
  scene.add(grid);

  // Central pedestal with KUBO obelisk
  const pedestalGeo = new THREE.CylinderGeometry(2.5, 3, 0.6, 24);
  const pedestal = new THREE.Mesh(pedestalGeo, new THREE.MeshStandardMaterial({ color: 0x222a44, metalness: 0.6, roughness: 0.3 }));
  pedestal.position.y = 0.3; pedestal.receiveShadow = true; pedestal.castShadow = true;
  scene.add(pedestal);

  const obelisk = new THREE.Mesh(
    new THREE.ConeGeometry(0.6, 4, 4),
    new THREE.MeshStandardMaterial({ color: 0xc9941a, metalness: 0.9, roughness: 0.2, emissive: 0x553300, emissiveIntensity: 0.6 }),
  );
  obelisk.position.y = 2.6; obelisk.castShadow = true;
  scene.add(obelisk);

  // Boundary walls (low glass)
  const wallMat = new THREE.MeshStandardMaterial({ color: 0x2a3358, transparent: true, opacity: 0.5, metalness: 0.3, roughness: 0.2 });
  const wallGeo = new THREE.BoxGeometry(80, 2, 0.4);
  const walls = [
    new THREE.Mesh(wallGeo, wallMat),
    new THREE.Mesh(wallGeo, wallMat),
    new THREE.Mesh(new THREE.BoxGeometry(0.4, 2, 80), wallMat),
    new THREE.Mesh(new THREE.BoxGeometry(0.4, 2, 80), wallMat),
  ];
  walls[0].position.set(0, 1, -40);
  walls[1].position.set(0, 1, 40);
  walls[2].position.set(-40, 1, 0);
  walls[3].position.set(40, 1, 0);
  walls.forEach((w) => scene.add(w));

  const resize = (w: number, h: number) => {
    camera.aspect = w / h;
    camera.updateProjectionMatrix();
    renderer.setSize(w, h);
  };
  const dispose = () => {
    renderer.dispose();
    scene.traverse((o) => {
      const m = o as THREE.Mesh;
      m.geometry?.dispose?.();
      const mat = m.material as THREE.Material | THREE.Material[] | undefined;
      if (Array.isArray(mat)) mat.forEach((x) => x.dispose());
      else mat?.dispose?.();
    });
  };

  return { scene, camera, renderer, resize, dispose };
}

export interface AvatarMesh {
  group: THREE.Group;
  setPose: (x: number, y: number, z: number, ry: number) => void;
  dispose: () => void;
}

export function createAvatar(name: string, color: string, isSelf = false): AvatarMesh {
  const group = new THREE.Group();

  const body = new THREE.Mesh(
    new THREE.CapsuleGeometry(0.4, 0.9, 4, 8),
    new THREE.MeshStandardMaterial({ color, metalness: 0.4, roughness: 0.3, emissive: isSelf ? color : 0x000000, emissiveIntensity: isSelf ? 0.15 : 0 }),
  );
  body.position.y = 0.95;
  body.castShadow = true;
  group.add(body);

  const head = new THREE.Mesh(
    new THREE.SphereGeometry(0.32, 16, 16),
    new THREE.MeshStandardMaterial({ color: 0xffe8b0, roughness: 0.6 }),
  );
  head.position.y = 1.85;
  head.castShadow = true;
  group.add(head);

  // Facing indicator (nose)
  const nose = new THREE.Mesh(
    new THREE.ConeGeometry(0.08, 0.2, 6),
    new THREE.MeshStandardMaterial({ color: 0xc9941a }),
  );
  nose.position.set(0, 1.85, 0.32);
  nose.rotation.x = Math.PI / 2;
  group.add(nose);

  // Name billboard
  const label = makeLabelSprite(name, color);
  label.position.y = 2.55;
  group.add(label);

  return {
    group,
    setPose: (x, y, z, ry) => {
      group.position.set(x, y, z);
      group.rotation.y = ry;
    },
    dispose: () => {
      group.traverse((o) => {
        const m = o as THREE.Mesh;
        m.geometry?.dispose?.();
        const mat = m.material as THREE.Material | undefined;
        mat?.dispose?.();
      });
    },
  };
}

function makeLabelSprite(text: string, color: string): THREE.Sprite {
  const canvas = document.createElement('canvas');
  canvas.width = 256; canvas.height = 64;
  const ctx = canvas.getContext('2d')!;
  ctx.fillStyle = 'rgba(10,13,24,0.85)';
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  ctx.strokeStyle = color; ctx.lineWidth = 3;
  ctx.strokeRect(2, 2, canvas.width - 4, canvas.height - 4);
  ctx.fillStyle = '#fff';
  ctx.font = 'bold 28px Inter, system-ui, sans-serif';
  ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
  ctx.fillText(text.slice(0, 16), canvas.width / 2, canvas.height / 2);
  const tex = new THREE.CanvasTexture(canvas);
  tex.minFilter = THREE.LinearFilter;
  const mat = new THREE.SpriteMaterial({ map: tex, transparent: true, depthTest: false });
  const sprite = new THREE.Sprite(mat);
  sprite.scale.set(2.2, 0.55, 1);
  return sprite;
}
