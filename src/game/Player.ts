import * as THREE from 'three';
import { ParticleDefinition } from './Particles';

export class Player {
  readonly group = new THREE.Group();
  private core: THREE.Mesh;
  private halo: THREE.Mesh;
  private trail: THREE.Points;
  private trailPositions: Float32Array;
  private shield?: THREE.Mesh;
  private shieldTime = 0;
  private collisionGraceTime = 0;
  x = 0;
  angle = Math.PI * -0.5;
  readonly ringRadius = 2.12;

  constructor(private particle: ParticleDefinition) {
    const coreMaterial = new THREE.MeshBasicMaterial({ color: particle.glow });
    this.core = new THREE.Mesh(new THREE.SphereGeometry(particle.size, 24, 16), coreMaterial);

    const haloMaterial = new THREE.MeshBasicMaterial({
      color: particle.secondaryGlow,
      transparent: true,
      opacity: particle.id === 'higgs' ? 0.42 : 0.25,
      blending: THREE.AdditiveBlending,
      depthWrite: false
    });
    this.halo = new THREE.Mesh(new THREE.SphereGeometry(particle.size * 2.1, 24, 16), haloMaterial);

    this.trailPositions = new Float32Array(90 * 3);
    const trailGeometry = new THREE.BufferGeometry();
    trailGeometry.setAttribute('position', new THREE.BufferAttribute(this.trailPositions, 3));
    const trailMaterial = new THREE.PointsMaterial({
      color: particle.glow,
      size: 0.055,
      transparent: true,
      opacity: 0.7,
      blending: THREE.AdditiveBlending,
      depthWrite: false
    });
    this.trail = new THREE.Points(trailGeometry, trailMaterial);

    this.group.add(this.trail, this.halo, this.core);
    this.group.position.set(0, -1.58, 2.2);
  }

  setParticle(particle: ParticleDefinition): void {
    this.particle = particle;
    (this.core.material as THREE.MeshBasicMaterial).color.set(particle.glow);
    (this.halo.material as THREE.MeshBasicMaterial).color.set(particle.secondaryGlow);
    (this.trail.material as THREE.PointsMaterial).color.set(particle.glow);
    const scale = particle.size / 0.34;
    this.core.scale.setScalar(scale);
    this.halo.scale.setScalar(scale);
  }

  update(dt: number, target: number, audioEnergy: number, circular = true): void {
    const lerp = Math.min(1, dt * 7.5 * this.particle.agility);
    if (circular) {
      this.angle = this.lerpAngle(this.angle, target, lerp);
      this.x = Math.cos(this.angle) * this.ringRadius;
      this.group.position.x = this.x;
      this.group.position.y = Math.sin(this.angle) * this.ringRadius;
      this.group.rotation.z = this.angle + Math.PI / 2;
    } else {
      this.x = THREE.MathUtils.lerp(this.x, target, lerp);
      this.group.position.x = this.x;
      this.group.position.y = -1.58;
      this.group.rotation.z = THREE.MathUtils.lerp(this.group.rotation.z, (target - this.x) * -0.4, dt * 8);
    }

    this.core.rotation.x += dt * (2.2 + audioEnergy * 4);
    this.core.rotation.y += dt * (3.4 + audioEnergy * 6);
    this.core.rotation.z += dt * (1.8 + audioEnergy * 3);
    this.halo.scale.setScalar(1 + audioEnergy * 0.45 + (this.particle.id === 'higgs' ? 0.22 : 0));

    for (let i = this.trailPositions.length - 3; i >= 3; i -= 3) {
      this.trailPositions[i] = this.trailPositions[i - 3];
      this.trailPositions[i + 1] = this.trailPositions[i - 2];
      this.trailPositions[i + 2] = this.trailPositions[i - 1] - dt * 7;
    }
    this.trailPositions[0] = (Math.random() - 0.5) * 0.12;
    this.trailPositions[1] = (Math.random() - 0.5) * 0.16;
    this.trailPositions[2] = 0.2;
    (this.trail.geometry.attributes.position as THREE.BufferAttribute).needsUpdate = true;

    this.collisionGraceTime = Math.max(0, this.collisionGraceTime - dt);

    if (this.shieldTime > 0) {
      this.shieldTime -= dt;
      if (this.shield) {
        this.shield.rotation.y += dt * 4.6;
        this.shield.rotation.x -= dt * 1.4;
        const material = this.shield.material as THREE.MeshBasicMaterial;
        material.opacity = Math.max(0.2, Math.min(0.58, this.shieldTime / this.particle.shieldDuration + audioEnergy * 0.12));
      }
    } else if (this.shield) {
      this.group.remove(this.shield);
      this.shield.geometry.dispose();
      (this.shield.material as THREE.Material).dispose();
      this.shield = undefined;
    }
  }

  activateShield(): void {
    this.shieldTime = this.particle.shieldDuration;
    this.collisionGraceTime = Math.max(this.collisionGraceTime, 0.45);
    this.ensureShieldMesh();
  }

  activateContinueGuard(seconds: number): void {
    this.shieldTime = Math.max(this.shieldTime, seconds);
    this.collisionGraceTime = Math.max(this.collisionGraceTime, seconds);
    this.ensureShieldMesh();
  }

  private ensureShieldMesh(): void {
    if (!this.shield) {
      this.shield = new THREE.Mesh(
        new THREE.IcosahedronGeometry(this.particle.size * 2.8, 2),
        new THREE.MeshBasicMaterial({
          color: '#00ff7a',
          wireframe: true,
          transparent: true,
          opacity: 0.5,
          blending: THREE.AdditiveBlending
        })
      );
      this.group.add(this.shield);
    }
  }

  consumeShield(): boolean {
    if (this.shieldTime <= 0) return false;
    this.shieldTime = 0;
    this.collisionGraceTime = 0.85;
    return true;
  }

  hasShield(): boolean {
    return this.shieldTime > 0;
  }

  isInvulnerable(): boolean {
    return this.hasShield() || this.collisionGraceTime > 0;
  }

  getShieldRatio(): number {
    return Math.max(0, this.shieldTime / this.particle.shieldDuration);
  }

  getShieldSeconds(): number {
    return Math.max(0, this.shieldTime);
  }

  getHitbox(): number {
    return this.particle.hitbox;
  }

  private lerpAngle(current: number, target: number, alpha: number): number {
    const delta = Math.atan2(Math.sin(target - current), Math.cos(target - current));
    return current + delta * alpha;
  }
}
