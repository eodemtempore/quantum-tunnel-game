import * as THREE from 'three';
import { LevelConfig } from './levels/LevelConfig';

export interface ObstacleHit {
  type: 'collision' | 'nearMiss';
  obstacle: Obstacle;
}

export interface Obstacle {
  mesh: THREE.Object3D;
  radius: number;
  scoredNearMiss: boolean;
  kind: string;
  angle: number;
}

const LANES = [-2.25, -1.15, 0, 1.15, 2.25];
const RING_RADIUS = 2.12;
const OBSTACLE_RED = '#ff1744';
const OBSTACLE_HOT_RED = '#ff6b6b';

export class Obstacles {
  readonly group = new THREE.Group();
  private obstacles: Obstacle[] = [];
  private spawnTimer = 0;

  update(
    dt: number,
    level: LevelConfig,
    speed: number,
    playerX: number,
    playerAngle: number,
    playerHitbox: number,
    audioEnergy: number,
    circular: boolean
  ): ObstacleHit[] {
    const hits: ObstacleHit[] = [];
    this.spawnTimer -= dt;
    if (this.spawnTimer <= 0) {
      this.spawn(level);
      this.spawnTimer = Math.max(0.28, 1.15 / level.obstacleDensity - speed * 0.018);
    }

    for (const obstacle of [...this.obstacles]) {
      obstacle.mesh.position.z += speed * dt;
      obstacle.mesh.rotation.z += dt * (0.6 + audioEnergy * 2);
      obstacle.mesh.rotation.x += dt * 0.25;
      const dz = Math.abs(obstacle.mesh.position.z - 2.2);
      const lateralDistance = circular
        ? this.angularDistance(obstacle.angle, playerAngle) * RING_RADIUS
        : Math.abs(obstacle.mesh.position.x - playerX);

      if (dz < 0.42 && lateralDistance < obstacle.radius + playerHitbox) {
        hits.push({ type: 'collision', obstacle });
      } else if (
        !obstacle.scoredNearMiss &&
        obstacle.mesh.position.z > 2.35 &&
        lateralDistance < obstacle.radius + playerHitbox + 0.58
      ) {
        obstacle.scoredNearMiss = true;
        hits.push({ type: 'nearMiss', obstacle });
      }

      if (obstacle.mesh.position.z > 6.5) {
        this.remove(obstacle);
      }
    }

    return hits;
  }

  clear(): void {
    for (const obstacle of [...this.obstacles]) {
      this.remove(obstacle);
    }
    this.spawnTimer = 0.5;
  }

  remove(obstacle: Obstacle): void {
    this.group.remove(obstacle.mesh);
    obstacle.mesh.traverse((child: THREE.Object3D) => {
      const mesh = child as THREE.Mesh;
      mesh.geometry?.dispose?.();
      const material = mesh.material as THREE.Material | THREE.Material[] | undefined;
      if (Array.isArray(material)) material.forEach((item) => item.dispose());
      else material?.dispose?.();
    });
    this.obstacles = this.obstacles.filter((candidate) => candidate !== obstacle);
  }

  private spawn(level: LevelConfig): void {
    const lane = LANES[Math.floor(Math.random() * LANES.length)];
    const angle = Math.random() * Math.PI * 2;
    const z = -64 - Math.random() * 18;
    const material = new THREE.MeshBasicMaterial({
      color: OBSTACLE_RED,
      transparent: true,
      opacity: 0.86,
      wireframe: Math.random() > 0.45,
      blending: THREE.AdditiveBlending
    });
    const kind = this.pickKind(level);
    let mesh: THREE.Object3D;
    let radius = 0.42;

    if (kind === 'ring') {
      mesh = new THREE.Mesh(new THREE.TorusGeometry(0.64, 0.055, 8, 36), material);
      radius = 0.62;
    } else if (kind === 'barrier') {
      mesh = new THREE.Group();
      const gate = new THREE.Mesh(new THREE.BoxGeometry(0.22, 2.6, 0.12), material);
      const cross = new THREE.Mesh(new THREE.BoxGeometry(1.05, 0.16, 0.12), material.clone());
      (cross.material as THREE.MeshBasicMaterial).color.set(OBSTACLE_HOT_RED);
      mesh.add(gate, cross);
      radius = 0.55;
    } else {
      mesh = new THREE.Mesh(new THREE.TetrahedronGeometry(0.58, 0), material);
      radius = 0.48;
    }

    mesh.position.set(Math.cos(angle) * RING_RADIUS, Math.sin(angle) * RING_RADIUS, z);
    mesh.rotation.set(Math.random() * Math.PI, Math.random() * Math.PI, Math.random() * Math.PI);
    mesh.userData.kind = kind;
    this.group.add(mesh);
    this.obstacles.push({ mesh, radius, scoredNearMiss: false, kind, angle });

    if (level.obstaclePattern === 'waves' && Math.random() > 0.55) {
      const secondAngle = angle + (Math.random() > 0.5 ? 0.82 : -0.82);
      const cloneMaterial = material.clone();
      cloneMaterial.color.set(OBSTACLE_HOT_RED);
      const clone = new THREE.Mesh(new THREE.TorusGeometry(0.5, 0.045, 8, 28), cloneMaterial);
      clone.position.set(Math.cos(secondAngle) * RING_RADIUS, Math.sin(secondAngle) * RING_RADIUS, z - 3.5);
      this.group.add(clone);
      this.obstacles.push({ mesh: clone, radius: 0.52, scoredNearMiss: false, kind: 'wave-ring', angle: secondAngle });
    }
  }

  private pickKind(level: LevelConfig): string {
    switch (level.obstaclePattern) {
      case 'rings':
        return Math.random() > 0.25 ? 'ring' : 'barrier';
      case 'shards':
        return Math.random() > 0.25 ? 'shard' : 'barrier';
      case 'waves':
        return Math.random() > 0.35 ? 'ring' : 'shard';
      case 'mixed':
        return ['ring', 'shard', 'barrier'][Math.floor(Math.random() * 3)];
      default:
        return Math.random() > 0.55 ? 'barrier' : 'shard';
    }
  }

  private angularDistance(a: number, b: number): number {
    return Math.abs(Math.atan2(Math.sin(a - b), Math.cos(a - b)));
  }
}
