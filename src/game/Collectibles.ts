import * as THREE from 'three';
import { LevelConfig } from './levels/LevelConfig';

export type CollectibleType = 'sync' | 'shield';

interface Collectible {
  mesh: THREE.Object3D;
  type: CollectibleType;
  radius: number;
  angle: number;
}

const LANES = [-2.25, -1.15, 0, 1.15, 2.25];
const RING_RADIUS = 2.12;

export class Collectibles {
  readonly group = new THREE.Group();
  private collectibles: Collectible[] = [];
  private spawnTimer = 1.2;

  update(
    dt: number,
    level: LevelConfig,
    speed: number,
    playerX: number,
    playerAngle: number,
    hitbox: number,
    circular: boolean
  ): CollectibleType[] {
    const collected: CollectibleType[] = [];
    this.spawnTimer -= dt;
    if (this.spawnTimer <= 0) {
      this.spawn(level);
      this.spawnTimer = Math.max(0.55, 1.9 / level.collectibleFrequency);
    }

    for (const collectible of [...this.collectibles]) {
      collectible.mesh.position.z += speed * dt;
      collectible.mesh.rotation.y += dt * (collectible.type === 'shield' ? 5.4 : 3);
      collectible.mesh.rotation.x += dt * (collectible.type === 'shield' ? 2.6 : 1.7);

      const dz = Math.abs(collectible.mesh.position.z - 2.2);
      const lateralDistance = circular
        ? this.angularDistance(collectible.angle, playerAngle) * RING_RADIUS
        : Math.abs(collectible.mesh.position.x - playerX);
      if (dz < 0.5 && lateralDistance < collectible.radius + hitbox) {
        collected.push(collectible.type);
        this.remove(collectible);
      } else if (collectible.mesh.position.z > 6.5) {
        this.remove(collectible);
      }
    }

    return collected;
  }

  clear(): void {
    for (const collectible of [...this.collectibles]) {
      this.remove(collectible);
    }
    this.spawnTimer = 1;
  }

  private spawn(level: LevelConfig): void {
    const type: CollectibleType = Math.random() > 0.82 ? 'shield' : 'sync';
    const angle = Math.random() * Math.PI * 2;
    const mesh = type === 'shield' ? this.createGuardMesh() : this.createSyncMesh();
    mesh.position.set(Math.cos(angle) * RING_RADIUS, Math.sin(angle) * RING_RADIUS, -62 - Math.random() * 18);
    this.group.add(mesh);
    this.collectibles.push({ mesh, type, radius: type === 'shield' ? 0.66 : 0.3, angle });
  }

  private remove(collectible: Collectible): void {
    this.group.remove(collectible.mesh);
    collectible.mesh.traverse((child: THREE.Object3D) => {
      const mesh = child as THREE.Mesh;
      mesh.geometry?.dispose?.();
      const material = mesh.material as THREE.Material | THREE.Material[] | undefined;
      if (Array.isArray(material)) material.forEach((item) => item.dispose());
      else material?.dispose?.();
    });
    this.collectibles = this.collectibles.filter((candidate) => candidate !== collectible);
  }

  private createSyncMesh(): THREE.Mesh {
    return new THREE.Mesh(
      new THREE.SphereGeometry(0.24, 16, 12),
      new THREE.MeshBasicMaterial({
        color: '#7dffef',
        transparent: true,
        opacity: 0.9,
        blending: THREE.AdditiveBlending
      })
    );
  }

  private createGuardMesh(): THREE.Group {
    const group = new THREE.Group();
    const green = new THREE.MeshBasicMaterial({
      color: '#00ff7a',
      transparent: true,
      opacity: 0.94,
      blending: THREE.AdditiveBlending
    });
    const wireGreen = new THREE.MeshBasicMaterial({
      color: '#7dff9c',
      transparent: true,
      opacity: 0.72,
      wireframe: true,
      blending: THREE.AdditiveBlending
    });
    const white = new THREE.MeshBasicMaterial({
      color: '#f3fff7',
      transparent: true,
      opacity: 0.96,
      blending: THREE.AdditiveBlending
    });

    const body = new THREE.Mesh(new THREE.IcosahedronGeometry(0.43, 2), green);
    const halo = new THREE.Mesh(new THREE.TorusGeometry(0.58, 0.035, 8, 32), wireGreen);
    const horn = new THREE.Mesh(new THREE.ConeGeometry(0.12, 0.42, 8), white);
    horn.position.set(0, 0.47, 0.07);
    horn.rotation.x = Math.PI * 0.48;

    group.add(body, halo, horn);
    group.userData.kind = 'green-guard';
    return group;
  }

  private angularDistance(a: number, b: number): number {
    return Math.abs(Math.atan2(Math.sin(a - b), Math.cos(a - b)));
  }
}
