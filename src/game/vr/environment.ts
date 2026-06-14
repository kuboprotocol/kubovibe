/**
 * Procedural ultra-realistic environment: PBR floor, real IBL via
 * RoomEnvironment, cinematic 3-point lighting, volumetric-feel fog.
 * No external HDRI required — reflections are physically plausible.
 */
import * as THREE from 'three';
import { RoomEnvironment } from 'three/examples/jsm/environments/RoomEnvironment.js';
import type { VrQualityPreset } from './types';

export function buildCinematicEnvironment(
  scene: THREE.Scene,
  quality: VrQualityPreset,
  renderer?: THREE.WebGLRenderer,
) {
  // Sky / background gradient (linear-space friendly).
  scene.background = new THREE.Color(0x05070d);
  scene.fog = new THREE.FogExp2(0x05070d, 0.012);

  // Real IBL — generates a prefiltered env map from a procedural room.
  if (quality.envIBL && renderer) {
    const pmrem = new THREE.PMREMGenerator(renderer);
    const envTex = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;
    scene.environment = envTex;
    pmrem.dispose();
  }

  // Hemi light for soft ambient
  const hemi = new THREE.HemisphereLight(0xbfd4ff, 0x1a0f08, 0.55);
  scene.add(hemi);

  // Key light (sun-like, warm)
  const key = new THREE.DirectionalLight(0xfff1d6, 3.2);
  key.position.set(6, 10, 4);
  if (quality.shadows) {
    key.castShadow = true;
    key.shadow.mapSize.set(quality.shadowMapSize, quality.shadowMapSize);
    key.shadow.camera.near = 0.1;
    key.shadow.camera.far = 60;
    key.shadow.camera.left = -15;
    key.shadow.camera.right = 15;
    key.shadow.camera.top = 15;
    key.shadow.camera.bottom = -15;
    key.shadow.bias = -0.0001;
    key.shadow.normalBias = 0.02;
  }
  scene.add(key);

  // Rim light (cool neon — matches Kubo identity)
  const rim = new THREE.DirectionalLight(0x6a8cff, 1.4);
  rim.position.set(-5, 6, -7);
  scene.add(rim);

  // Fill point (gold accent)
  const fill = new THREE.PointLight(0xc9941a, 12, 18, 1.6);
  fill.position.set(0, 2.4, 2.2);
  scene.add(fill);

  // PBR ground — mirror-polished black marble feel.
  const groundGeo = new THREE.CircleGeometry(40, 96);
  const groundMat = new THREE.MeshPhysicalMaterial({
    color: 0x0a0d14,
    metalness: 0.6,
    roughness: 0.18,
    clearcoat: 1,
    clearcoatRoughness: 0.08,
  });
  const ground = new THREE.Mesh(groundGeo, groundMat);
  ground.rotation.x = -Math.PI / 2;
  ground.receiveShadow = quality.shadows;
  scene.add(ground);

  // Glowing horizon ring (sense of scale in VR)
  const ringGeo = new THREE.RingGeometry(18, 18.4, 128);
  const ringMat = new THREE.MeshBasicMaterial({ color: 0xc9941a, side: THREE.DoubleSide, transparent: true, opacity: 0.7 });
  const ring = new THREE.Mesh(ringGeo, ringMat);
  ring.rotation.x = -Math.PI / 2;
  ring.position.y = 0.01;
  scene.add(ring);

  // Distant skyline of glowing pillars — depth cue in VR.
  const pillarGroup = new THREE.Group();
  const pillarMat = new THREE.MeshStandardMaterial({
    color: 0x0e1320, emissive: 0x1a2240, emissiveIntensity: 0.4, metalness: 0.9, roughness: 0.35,
  });
  for (let i = 0; i < 24; i++) {
    const a = (i / 24) * Math.PI * 2;
    const r = 24 + Math.random() * 8;
    const h = 4 + Math.random() * 9;
    const p = new THREE.Mesh(new THREE.BoxGeometry(1.2, h, 1.2), pillarMat);
    p.position.set(Math.cos(a) * r, h / 2, Math.sin(a) * r);
    p.castShadow = false;
    p.receiveShadow = false;
    pillarGroup.add(p);
  }
  scene.add(pillarGroup);

  return { hemi, key, rim, fill, ground, ring, pillars: pillarGroup };
}
