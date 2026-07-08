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
  private ultraVisuals = false;
  private darkTrip = false;

  setUltraMode(enabled: boolean, darkTrip: boolean): void {
    this.ultraVisuals = enabled;
    this.darkTrip = darkTrip;
  }

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
      obstacle.mesh.rotation.z += dt * (0.6 + audioEnergy * 2 + (this.ultraVisuals ? 1.2 : 0));
      obstacle.mesh.rotation.x += dt * (0.25 + (this.ultraVisuals ? 0.55 : 0));
      if (this.ultraVisuals) this.animateUltraObstacle(obstacle, audioEnergy);
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
      color: this.darkTrip ? '#f7f7f7' : OBSTACLE_RED,
      transparent: true,
      opacity: this.ultraVisuals ? 0.92 : 0.86,
      wireframe: this.ultraVisuals || Math.random() > 0.45,
      blending: THREE.AdditiveBlending
    });
    const kind = this.pickKind(level);
    let mesh: THREE.Object3D;
    let radius = 0.42;

    if (this.ultraVisuals) {
      const obstacle = this.createUltraObstacle(kind, material);
      mesh = obstacle.mesh;
      radius = obstacle.radius;
    } else {
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
    }

    mesh.position.set(Math.cos(angle) * RING_RADIUS, Math.sin(angle) * RING_RADIUS, z);
    mesh.rotation.set(Math.random() * Math.PI, Math.random() * Math.PI, Math.random() * Math.PI);
    mesh.userData.kind = kind;
    this.group.add(mesh);
    this.obstacles.push({ mesh, radius, scoredNearMiss: false, kind, angle });

    if (level.obstaclePattern === 'waves' && Math.random() > 0.55) {
      const secondAngle = angle + (Math.random() > 0.5 ? 0.82 : -0.82);
      const cloneMaterial = material.clone();
      cloneMaterial.color.set(this.darkTrip ? '#d0d0d0' : OBSTACLE_HOT_RED);
      const clone = new THREE.Mesh(new THREE.TorusGeometry(0.5, this.ultraVisuals ? 0.075 : 0.045, 8, this.ultraVisuals ? 48 : 28), cloneMaterial);
      clone.position.set(Math.cos(secondAngle) * RING_RADIUS, Math.sin(secondAngle) * RING_RADIUS, z - 3.5);
      this.group.add(clone);
      this.obstacles.push({ mesh: clone, radius: 0.52, scoredNearMiss: false, kind: 'wave-ring', angle: secondAngle });
    }
  }

  private createUltraObstacle(kind: string, material: THREE.MeshBasicMaterial): { mesh: THREE.Object3D; radius: number } {
    const group = new THREE.Group();
    const accent = material.clone();
    accent.color.set(this.darkTrip ? '#202020' : '#00d9ff');
    const hot = material.clone();
    hot.color.set(this.darkTrip ? '#ffffff' : '#ffea00');

    if (kind === 'ring') {
      const outer = new THREE.Mesh(new THREE.TorusGeometry(0.72, 0.07, 6, 54), material);
      const inner = new THREE.Mesh(new THREE.TorusGeometry(0.43, 0.036, 5, 32), accent);
      inner.rotation.x = Math.PI / 2;
      group.add(outer, inner);
      group.userData.ultraKind = this.darkTrip ? 'monochrome-mandala' : 'chromatic-ring';
      return { mesh: group, radius: 0.64 };
    }

    if (kind === 'barrier') {
      const mandala = new THREE.Mesh(new THREE.IcosahedronGeometry(0.56, 1), material);
      const barA = new THREE.Mesh(new THREE.BoxGeometry(0.12, 2.45, 0.1), accent);
      const barB = new THREE.Mesh(new THREE.BoxGeometry(1.22, 0.12, 0.1), hot);
      barA.rotation.z = Math.PI / 5;
      barB.rotation.z = -Math.PI / 7;
      group.add(mandala, barA, barB);
      group.userData.ultraKind = this.darkTrip ? 'dark-trip-barrier' : 'warped-mandala';
      return { mesh: group, radius: 0.58 };
    }

    const crystal = new THREE.Mesh(new THREE.OctahedronGeometry(0.6, 1), material);
    const liquid = new THREE.Mesh(new THREE.TorusKnotGeometry(0.32, 0.035, 48, 6), accent);
    liquid.rotation.x = Math.PI / 2.5;
    group.add(crystal, liquid);
    group.userData.ultraKind = this.darkTrip ? 'silver-silhouette' : 'glitch-crystal';
    return { mesh: group, radius: 0.5 };
  }

  private animateUltraObstacle(obstacle: Obstacle, audioEnergy: number): void {
    const time = performance.now() * 0.001;
    const pulse = 1 + Math.sin(time * 5 + obstacle.angle * 3) * 0.08 + audioEnergy * 0.16;
    obstacle.mesh.scale.setScalar(pulse);
    obstacle.mesh.traverse((child) => {
      const material = (child as THREE.Mesh).material as THREE.MeshBasicMaterial | undefined;
      if (!material?.color) return;
      if (this.darkTrip) {
        const light = 54 + Math.sin(time * 8 + obstacle.mesh.position.z) * 28;
        material.color.set(`hsl(0, 0%, ${light}%)`);
      } else {
        const hue = (time * 145 + obstacle.angle * 90 + obstacle.mesh.position.z * 2) % 360;
        material.color.set(`hsl(${hue}, 100%, 58%)`);
      }
      material.opacity = 0.76 + audioEnergy * 0.2;
    });
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
