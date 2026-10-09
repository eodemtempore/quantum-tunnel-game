import { ParticleId } from '../game/Particles';
import { MusicalSection } from './MusicTransport';

export interface MusicalGameState {
  level: number;
  speedRatio: number;
  steering: number;
  shieldActive: boolean;
  syncActive: boolean;
  nearMissStreak: number;
  particleId: ParticleId;
  danger: number;
}

export interface MusicalState {
  bpm: number;
  energy: number;
  tension: number;
  density: number;
  section: MusicalSection;
  variation: number;
  shieldActive: boolean;
  particleId: ParticleId;
}

export class MusicDirector {
  private gameState: MusicalGameState = {
    level: 1,
    speedRatio: 0.2,
    steering: 0,
    shieldActive: false,
    syncActive: false,
    nearMissStreak: 0,
    particleId: 'proton',
    danger: 0.2
  };
  private section: MusicalSection = 'intro';
  private sectionStartedBar = 0;
  private energy = 0.25;
  private tension = 0.18;
  private eventEnergy = 0;
  private eventTension = 0;
  private variation = 0;
  private bpm = 110;
  private baseBpm = 110;

  constructor(baseBpm: number, particleId: ParticleId = 'proton') {
    this.baseBpm = baseBpm;
    this.bpm = baseBpm;
    this.gameState.particleId = particleId;
  }

  update(gameState: MusicalGameState, dt: number): void {
    this.gameState = {
      ...gameState,
      level: Math.max(1, gameState.level),
      speedRatio: Math.max(0, Math.min(1.5, gameState.speedRatio)),
      steering: Math.max(-1, Math.min(1, gameState.steering)),
      nearMissStreak: Math.max(0, gameState.nearMissStreak),
      danger: Math.max(0, Math.min(1, gameState.danger))
    };

    const levelEnergy = Math.min(0.2, (this.gameState.level - 1) * 0.006);
    const nearMissEnergy = Math.min(0.18, this.gameState.nearMissStreak * 0.035);
    const targetEnergy = Math.max(0.12, Math.min(1, 0.18 + this.gameState.speedRatio * 0.28 + levelEnergy + this.gameState.danger * 0.16 + nearMissEnergy + this.eventEnergy + (this.gameState.syncActive ? 0.1 : 0)));
    const targetTension = Math.max(0.04, Math.min(1, 0.12 + this.gameState.danger * 0.42 + Math.min(0.22, this.gameState.nearMissStreak * 0.045) + this.eventTension - (this.gameState.shieldActive ? 0.3 : 0)));
    const smoothing = 1 - Math.exp(-Math.max(0, dt) * 1.8);
    this.energy += (targetEnergy - this.energy) * smoothing;
    this.tension += (targetTension - this.tension) * smoothing;
    this.eventEnergy *= Math.exp(-Math.max(0, dt) * 0.12);
    this.eventTension *= Math.exp(-Math.max(0, dt) * 0.16);
    this.variation *= Math.exp(-Math.max(0, dt) * 0.25);

    const intensityTempo = this.energy * 4 + this.tension * 2;
    this.bpm += (this.baseBpm + intensityTempo - this.bpm) * Math.min(1, Math.max(0, dt) * 0.12);
    this.bpm = Math.max(136, Math.min(144, this.bpm));
  }

  onBar(bar: number): MusicalState {
    if (bar < 2) {
      this.section = 'intro';
      this.sectionStartedBar = 0;
    } else if (bar - this.sectionStartedBar >= 2) {
      const desired = this.desiredSection();
      if (desired !== this.section) {
        this.section = desired;
        this.sectionStartedBar = bar;
      }
    }

    return this.getState();
  }

  getState(): MusicalState {
    const shieldSoftening = this.gameState.shieldActive ? 0.08 : 0;
    const baseDensity: Record<MusicalSection, number> = {
      intro: 0.14,
      groove: 0.4,
      build: 0.67,
      peak: 0.9,
      breath: 0.16
    };
    const sectionPressure = this.section === 'build' || this.section === 'peak' ? this.tension * 0.12 : 0;

    return {
      bpm: this.bpm,
      energy: Math.max(0.08, Math.min(1, this.energy - shieldSoftening)),
      tension: this.tension,
      density: Math.max(0.08, Math.min(1, baseDensity[this.section] + sectionPressure)),
      section: this.section,
      variation: this.variation,
      shieldActive: this.gameState.shieldActive,
      particleId: this.gameState.particleId
    };
  }

  onEvent(event: 'sync' | 'nearMiss' | 'guard' | 'level' | 'collision'): void {
    if (event === 'sync') {
      this.eventEnergy = Math.min(0.3, this.eventEnergy + 0.18);
      this.eventTension = Math.max(0, this.eventTension - 0.18);
      this.variation = Math.min(1, this.variation + 0.7);
    } else if (event === 'nearMiss') {
      this.eventEnergy = Math.min(0.35, this.eventEnergy + 0.12);
      this.eventTension = Math.min(0.75, this.eventTension + 0.18);
    } else if (event === 'guard') {
      this.eventTension = Math.max(-0.3, this.eventTension - 0.24);
      this.variation = Math.min(1, this.variation + 0.35);
    } else if (event === 'level') {
      this.eventEnergy = Math.min(0.4, this.eventEnergy + 0.2);
      this.eventTension = Math.min(0.8, this.eventTension + 0.12);
      this.variation = Math.min(1, this.variation + 0.8);
    } else {
      this.eventEnergy = Math.min(0.5, this.eventEnergy + 0.16);
      this.eventTension = Math.min(1, this.eventTension + 0.35);
    }
  }

  private desiredSection(): MusicalSection {
    if (this.section === 'peak') {
      if (this.gameState.shieldActive && this.energy < 0.64) return 'breath';
      if (this.tension >= 0.65 || this.energy >= 0.68 || this.gameState.syncActive) return 'peak';
      return this.energy >= 0.38 || this.tension >= 0.34 ? 'build' : 'groove';
    }
    if (this.section === 'build') {
      if (this.tension >= 0.8 || this.energy >= 0.83 || this.gameState.syncActive) return 'peak';
      if (this.gameState.shieldActive && this.energy < 0.62) return 'breath';
      return this.tension >= 0.37 || this.energy >= 0.43 || this.gameState.nearMissStreak >= 2 ? 'build' : 'groove';
    }
    if (this.section === 'breath') {
      if (this.gameState.shieldActive && this.energy < 0.62) return 'breath';
      if (this.energy >= 0.82 || this.tension >= 0.78) return 'peak';
      return this.energy >= 0.38 || this.tension >= 0.36 ? 'groove' : 'breath';
    }
    if (this.gameState.shieldActive && this.energy < 0.62) return 'breath';
    if (this.tension >= 0.8 || this.energy >= 0.83 || this.gameState.syncActive) return 'peak';
    if (this.tension >= 0.57 || this.energy >= 0.61 || this.gameState.nearMissStreak >= 2) return 'build';
    if (this.energy < 0.2 && this.tension < 0.24) return 'breath';
    return 'groove';
  }
}
