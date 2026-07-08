import * as THREE from 'three';
import { LevelConfig } from './levels/LevelConfig';

const SYMBOLS = ['ψ', 'Δ', 'ℏ', 'E=mc²', '0101', 'λ', '|φ⟩', '∑', '001'];

export class Tunnel {
  readonly group = new THREE.Group();
  private rings: THREE.Object3D[] = [];
  private codeSprites: THREE.Sprite[] = [];
  private speedLines: THREE.LineSegments;
  private ringSpacing = 2.8;
  private depth = 92;
  private palette?: LevelConfig['palette'];
  private shape: LevelConfig['tunnelShape'];

  constructor(level: LevelConfig) {
    this.palette = level.palette;
    this.shape = level.tunnelShape;
    for (let i = 0; i < 38; i += 1) {
      const ring = this.createRing(level, i);
      ring.position.z = -i * this.ringSpacing;
      ring.rotation.z = i * 0.17;
      this.group.add(ring);
      this.rings.push(ring);
    }

    const linePositions = new Float32Array(90 * 2 * 3);
    for (let i = 0; i < 90; i += 1) {
      const angle = Math.random() * Math.PI * 2;
      const radius = 3.1 + Math.random() * 0.85;
      const z = -Math.random() * this.depth;
      const base = i * 6;
      linePositions[base] = Math.cos(angle) * radius;
      linePositions[base + 1] = Math.sin(angle) * radius;
      linePositions[base + 2] = z;
      linePositions[base + 3] = Math.cos(angle) * radius;
      linePositions[base + 4] = Math.sin(angle) * radius;
      linePositions[base + 5] = z - 1.5 - Math.random() * 3;
    }
    const linesGeometry = new THREE.BufferGeometry();
    linesGeometry.setAttribute('position', new THREE.BufferAttribute(linePositions, 3));
    this.speedLines = new THREE.LineSegments(
      linesGeometry,
      new THREE.LineBasicMaterial({
        color: level.palette.accent,
        transparent: true,
        opacity: 0.3,
        blending: THREE.AdditiveBlending
      })
    );
    this.group.add(this.speedLines);

    for (let i = 0; i < 56; i += 1) {
      const sprite = this.createSymbolSprite(SYMBOLS[i % SYMBOLS.length], level.palette.code);
      this.placeSprite(sprite, -Math.random() * this.depth);
      this.group.add(sprite);
      this.codeSprites.push(sprite);
    }
  }

  setLevel(level: LevelConfig): void {
    this.palette = level.palette;
    if (level.tunnelShape !== this.shape) {
      this.rebuildRings(level);
    }
    this.rings.forEach((ring, index) => {
      this.setRingColor(ring, index % 3 === 0 ? level.palette.accent : level.palette.tunnel);
    });
    (this.speedLines.material as THREE.LineBasicMaterial).color.set(level.palette.accent);
    this.codeSprites.forEach((sprite) => {
      (sprite.material as THREE.SpriteMaterial).color.set(level.palette.code);
    });
  }

  update(dt: number, speed: number, level: LevelConfig, audioEnergy: number, glitch: number): void {
    this.group.rotation.z += dt * 0.05 * level.speedMultiplier;

    for (const ring of this.rings) {
      ring.position.z += speed * dt;
      if (ring.position.z > 6) ring.position.z -= this.depth;
      this.setRingOpacity(ring, 0.25 + audioEnergy * 0.38 + glitch * 0.25);
      ring.scale.setScalar(1 + audioEnergy * 0.04 + Math.sin(performance.now() * 0.002 + ring.position.z) * 0.015);
    }

    const positions = this.speedLines.geometry.attributes.position as THREE.BufferAttribute;
    for (let i = 0; i < positions.count; i += 2) {
      const z = positions.getZ(i) + speed * dt * 1.35;
      if (z > 6) {
        const angle = Math.random() * Math.PI * 2;
        const radius = 3.1 + Math.random() * 0.9;
        const nextZ = -this.depth;
        positions.setXYZ(i, Math.cos(angle) * radius, Math.sin(angle) * radius, nextZ);
        positions.setXYZ(i + 1, Math.cos(angle) * radius, Math.sin(angle) * radius, nextZ - 2 - Math.random() * 4);
      } else {
        positions.setZ(i, z);
        positions.setZ(i + 1, positions.getZ(i + 1) + speed * dt * 1.35);
      }
    }
    positions.needsUpdate = true;
    (this.speedLines.material as THREE.LineBasicMaterial).opacity = 0.22 + audioEnergy * 0.34;

    for (const sprite of this.codeSprites) {
      sprite.position.z += speed * dt * (0.72 + audioEnergy * 0.45);
      sprite.material.opacity = 0.34 + audioEnergy * 0.45;
      if (sprite.position.z > 5) this.placeSprite(sprite, -this.depth);
    }
  }

  private placeSprite(sprite: THREE.Sprite, z: number): void {
    const angle = Math.random() * Math.PI * 2;
    const radius = 3.7 + Math.random() * 0.55;
    sprite.position.set(Math.cos(angle) * radius, Math.sin(angle) * radius, z);
    sprite.scale.setScalar(0.45 + Math.random() * 0.42);
  }

  private createSymbolSprite(text: string, color: string): THREE.Sprite {
    const canvas = document.createElement('canvas');
    canvas.width = 256;
    canvas.height = 128;
    const ctx = canvas.getContext('2d');
    if (ctx) {
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      ctx.font = text.length > 4 ? '34px monospace' : '58px monospace';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.shadowColor = color;
      ctx.shadowBlur = 18;
      ctx.fillStyle = '#ffffff';
      ctx.fillText(text, canvas.width / 2, canvas.height / 2);
    }
    const texture = new THREE.CanvasTexture(canvas);
    const material = new THREE.SpriteMaterial({
      map: texture,
      color,
      transparent: true,
      opacity: 0.65,
      blending: THREE.AdditiveBlending,
      depthWrite: false
    });
    return new THREE.Sprite(material);
  }

  private createRing(level: LevelConfig, index: number): THREE.Object3D {
    const materialOptions = {
      color: index % 3 === 0 ? level.palette.accent : level.palette.tunnel,
      transparent: true,
      opacity: 0.46,
      blending: THREE.AdditiveBlending,
      depthWrite: false
    };

    if (level.tunnelShape === 'square') {
      const size = 3.75 + (index % 2) * 0.16;
      const geometry = new THREE.BufferGeometry().setFromPoints([
        new THREE.Vector3(-size, -size, 0),
        new THREE.Vector3(size, -size, 0),
        new THREE.Vector3(size, size, 0),
        new THREE.Vector3(-size, size, 0)
      ]);
      const ring = new THREE.LineLoop(geometry, new THREE.LineBasicMaterial(materialOptions));
      ring.rotation.z = Math.PI / 4;
      return ring;
    }

    if (level.tunnelShape === 'hex') {
      const radius = 4 + (index % 2) * 0.12;
      const points: THREE.Vector3[] = [];
      for (let i = 0; i < 6; i += 1) {
        const angle = Math.PI / 6 + i * (Math.PI / 3);
        points.push(new THREE.Vector3(Math.cos(angle) * radius, Math.sin(angle) * radius, 0));
      }
      return new THREE.LineLoop(new THREE.BufferGeometry().setFromPoints(points), new THREE.LineBasicMaterial(materialOptions));
    }

    return new THREE.Mesh(new THREE.TorusGeometry(4.1, 0.018, 5, 72), new THREE.MeshBasicMaterial(materialOptions));
  }

  private rebuildRings(level: LevelConfig): void {
    this.rings.forEach((ring) => {
      this.group.remove(ring);
      ring.traverse((child) => {
        const mesh = child as THREE.Mesh | THREE.Line;
        mesh.geometry?.dispose?.();
        const material = mesh.material as THREE.Material | THREE.Material[] | undefined;
        if (Array.isArray(material)) material.forEach((item) => item.dispose());
        else material?.dispose?.();
      });
    });
    this.rings = [];
    this.shape = level.tunnelShape;
    for (let i = 0; i < 38; i += 1) {
      const ring = this.createRing(level, i);
      ring.position.z = -i * this.ringSpacing;
      ring.rotation.z += i * (level.tunnelShape === 'circle' ? 0.17 : 0.08);
      this.group.add(ring);
      this.rings.push(ring);
    }
  }

  private setRingColor(ring: THREE.Object3D, color: string): void {
    ring.traverse((child) => {
      const material = (child as THREE.Mesh | THREE.Line).material as THREE.MeshBasicMaterial | THREE.LineBasicMaterial | undefined;
      material?.color?.set(color);
    });
  }

  private setRingOpacity(ring: THREE.Object3D, opacity: number): void {
    ring.traverse((child) => {
      const material = (child as THREE.Mesh | THREE.Line).material as THREE.MeshBasicMaterial | THREE.LineBasicMaterial | undefined;
      if (material) material.opacity = opacity;
    });
  }
}
