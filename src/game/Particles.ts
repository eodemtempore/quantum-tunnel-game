export type ParticleId = 'proton' | 'electron' | 'neutron' | 'higgs';

export interface ParticleDefinition {
  id: ParticleId;
  name: string;
  description: string;
  glow: string;
  secondaryGlow: string;
  size: number;
  hitbox: number;
  agility: number;
  speed: number;
  shieldDuration: number;
  scoreMultiplier: number;
  lockedByDefault: boolean;
}

export const HIGGS_UNLOCK_SCORE = 50_000;
export const GUARD_DURATION_SECONDS = 15;

export const PARTICLES: ParticleDefinition[] = [
  {
    id: 'proton',
    name: 'Proton',
    description: 'Balanced handling, dense red-orange charge.',
    glow: '#ff5a1f',
    secondaryGlow: '#ffb000',
    size: 0.34,
    hitbox: 0.48,
    agility: 1,
    speed: 1,
    shieldDuration: GUARD_DURATION_SECONDS,
    scoreMultiplier: 1,
    lockedByDefault: false
  },
  {
    id: 'electron',
    name: 'Electron',
    description: 'Fast and agile with a smaller collision field.',
    glow: '#22b7ff',
    secondaryGlow: '#78f6ff',
    size: 0.25,
    hitbox: 0.36,
    agility: 1.34,
    speed: 1.08,
    shieldDuration: GUARD_DURATION_SECONDS,
    scoreMultiplier: 1.04,
    lockedByDefault: false
  },
  {
    id: 'neutron',
    name: 'Neutron',
    description: 'Stable, heavier drift and a forgiving collision field.',
    glow: '#e9f0ff',
    secondaryGlow: '#a6b4c7',
    size: 0.39,
    hitbox: 0.55,
    agility: 0.82,
    speed: 0.96,
    shieldDuration: GUARD_DURATION_SECONDS,
    scoreMultiplier: 1,
    lockedByDefault: false
  },
  {
    id: 'higgs',
    name: 'Higgs Boson',
    description: 'Rare mass-field signature with a score multiplier.',
    glow: '#ffd76b',
    secondaryGlow: '#b84cff',
    size: 0.31,
    hitbox: 0.42,
    agility: 1.12,
    speed: 1.04,
    shieldDuration: GUARD_DURATION_SECONDS,
    scoreMultiplier: 1.18,
    lockedByDefault: true
  }
];

export function getParticle(id: ParticleId): ParticleDefinition {
  return PARTICLES.find((particle) => particle.id === id) ?? PARTICLES[0];
}
