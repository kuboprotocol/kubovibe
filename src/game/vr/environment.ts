/**
 * Procedural ultra-realistic environment: PBR floor, IBL-style ambient,
 * cinematic 3-point lighting, volumetric-feel fog. No external HDRI required.
 */
import * as THREE from 'three';
import type { VrQualityPreset } from './types';

export function buildCinematicEnvironment(scene: THREE.Scene, quality: VrQualityPreset) {
  // Sky / background gradient (linear-space friendly).
  scene.background = new THREE.Color(0x05070d);
  scene.fog = new THREE.FogExp2(0x05070d, 0.012);

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

  // PBR ground with procedural normal-ish look via metal/roughness.
  const groundGeo = new THREE.CircleGeometry(40, 96);
  const groundMat = new THREE.MeshStandardMaterial({
    color: 0x0a0d14,
    metalness: 0.85,
    roughness: 0.35,
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

  return { hemi, key, rim, fill, ground, ring };
}
