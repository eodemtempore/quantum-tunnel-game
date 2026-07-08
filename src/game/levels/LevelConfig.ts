export type SpecialVisualEffect =
  | 'soft-awakening'
  | 'code-rain'
  | 'proton-embers'
  | 'electron-arcs'
  | 'silent-silver'
  | 'decoherence-glitch'
  | 'antimatter-veil'
  | 'probability-storm'
  | 'singularity-lens'
  | 'higgs-aura'
  | 'quantum-drift';

export interface LevelConfig {
  level: number;
  name: string;
  act: 'Act I' | 'Act II' | 'Act III' | 'Endless';
  description: string;
  signatureMechanic: string;
  difficultyLabel: string;
  requiredScore: number;
  palette: {
    background: string;
    tunnel: string;
    accent: string;
    code: string;
    hazard: string;
  };
  speedMultiplier: number;
  obstacleDensity: number;
  collectibleFrequency: number;
  musicIntensity: number;
  specialVisualEffect: SpecialVisualEffect;
  unlockRequirement?: string;
  obstaclePattern: 'lanes' | 'rings' | 'shards' | 'waves' | 'mixed';
  tunnelShape: 'circle' | 'square' | 'hex';
}

type LevelIdentity = Pick<LevelConfig, 'act' | 'description' | 'signatureMechanic' | 'difficultyLabel'>;
type BaseLevelConfig = Omit<LevelConfig, keyof LevelIdentity>;

const LEVEL_IDENTITIES: Record<number, LevelIdentity> = {
  1: { act: 'Act I', description: 'A gentle circular tunnel that teaches steering, pickups, and red obstacle spacing.', signatureMechanic: 'Wide lane reads with generous Sync Orbs.', difficultyLabel: 'Onboarding' },
  2: { act: 'Act I', description: 'Green code rain thickens the tunnel while lane pressure stays readable.', signatureMechanic: 'Cascading lane gates with steady rhythm.', difficultyLabel: 'Easy' },
  3: { act: 'Act I', description: 'Warm proton embers introduce shard dodging and wider lateral movement.', signatureMechanic: 'Shard clusters reward early near-miss practice.', difficultyLabel: 'Easy+' },
  4: { act: 'Act I', description: 'Electric arcs bring the first wave timing challenge.', signatureMechanic: 'Wave rings teach circular timing.', difficultyLabel: 'Medium-' },
  5: { act: 'Act I', description: 'A quiet silver tunnel that asks for patience and cleaner ring threading.', signatureMechanic: 'Ring gates with calmer visibility but tighter reads.', difficultyLabel: 'Medium' },
  6: { act: 'Act I', description: 'The tunnel snaps into square geometry and starts mixing obstacle families.', signatureMechanic: 'Decoherence glitches hide mixed routes briefly.', difficultyLabel: 'Medium' },
  7: { act: 'Act I', description: 'Antimatter shards cut across a violet square tunnel with less pickup relief.', signatureMechanic: 'Shard-heavy bursts and sharper color contrast.', difficultyLabel: 'Medium+' },
  8: { act: 'Act I', description: 'Probability waves force rhythmic steering through storm pulses.', signatureMechanic: 'Audio-reactive wave rings and reduced collectibles.', difficultyLabel: 'Hard-' },
  9: { act: 'Act I', description: 'A dark gravity lens compresses the read window around ring obstacles.', signatureMechanic: 'Singularity lensing with fast ring gates.', difficultyLabel: 'Hard' },
  10: { act: 'Act I', description: 'The first prestige checkpoint combines mixed threats with Higgs-colored pressure.', signatureMechanic: 'Mixed hazards and unlock reminder pressure.', difficultyLabel: 'Act Boss' },
  11: { act: 'Act II', description: 'Hex geometry opens the acceleration arc with narrow Planck corridors.', signatureMechanic: 'Hex lane channels with faster baseline speed.', difficultyLabel: 'Advanced' },
  12: { act: 'Act II', description: 'Pink tachyon lattices pulse in waves around the ring.', signatureMechanic: 'Fast wave timing and high visual rhythm.', difficultyLabel: 'Advanced' },
  13: { act: 'Act II', description: 'Muon overdrive pushes shard recognition at higher speed.', signatureMechanic: 'Blue shard bursts with reduced Sync frequency.', difficultyLabel: 'Advanced+' },
  14: { act: 'Act II', description: 'Photon blackout strips the palette down and makes silhouettes matter.', signatureMechanic: 'High-contrast rings in near-darkness.', difficultyLabel: 'Precision' },
  15: { act: 'Act II', description: 'A cathedral-like wavefunction stage tests every Act II pattern together.', signatureMechanic: 'Higgs aura with mixed elite midgame patterns.', difficultyLabel: 'Act Boss' },
  16: { act: 'Act II', description: 'The tunnel returns to circular flow but now ruptures with dense mixed qubits.', signatureMechanic: 'Glitch-mixed patterns and faster rotation reads.', difficultyLabel: 'Expert-' },
  17: { act: 'Act II', description: 'Vacuum bloom hides shard danger inside bright antimatter color washes.', signatureMechanic: 'Shard bloom timing with scarce pickups.', difficultyLabel: 'Expert-' },
  18: { act: 'Act II', description: 'Chronon switchyard alternates wave timing and color-coded decision points.', signatureMechanic: 'Wave switchbacks with strong beat sync.', difficultyLabel: 'Expert' },
  19: { act: 'Act II', description: 'Gravity static slows the mood while ring gates get unforgiving.', signatureMechanic: 'Silent-silver ring precision.', difficultyLabel: 'Expert' },
  20: { act: 'Act II', description: 'Event horizon run closes Act II with mixed hazards at near-collapse speed.', signatureMechanic: 'Lens distortion and mixed survival pressure.', difficultyLabel: 'Act Boss' },
  21: { act: 'Act III', description: 'Neon Casimir vault begins the elite arc with square code lanes.', signatureMechanic: 'High-density lane vaults and fast recovery.', difficultyLabel: 'Elite' },
  22: { act: 'Act III', description: 'Entropy spiral throws hot shard fields through a square tunnel.', signatureMechanic: 'Shard spirals reward decisive 360 motion.', difficultyLabel: 'Elite' },
  23: { act: 'Act III', description: 'Dark current relay pushes wave timing into high-speed tunnel traffic.', signatureMechanic: 'Relay waves and late near-miss chances.', difficultyLabel: 'Elite+' },
  24: { act: 'Act III', description: 'Boson Crown is a prestige ring gauntlet with sparse safety.', signatureMechanic: 'Crown rings with Higgs aura pressure.', difficultyLabel: 'Precision+' },
  25: { act: 'Act III', description: 'Quantum Noir Apex blends code rain and mixed hazards at collapse tempo.', signatureMechanic: 'Noir mixed gauntlet with harsh recovery windows.', difficultyLabel: 'Apex' },
  26: { act: 'Act III', description: 'Planck Stormwall shifts back to hex geometry for final collapse patterns.', signatureMechanic: 'Hex stormwall with heavy decoherence glitches.', difficultyLabel: 'Apex+' },
  27: { act: 'Act III', description: 'Superposition Grid stacks wave choices into elite probability reads.', signatureMechanic: 'Fast wave grids and low collectible relief.', difficultyLabel: 'Master' },
  28: { act: 'Act III', description: 'Hawking afterimages make ring gaps feel delayed and dangerous.', signatureMechanic: 'White afterimage rings with lens pressure.', difficultyLabel: 'Master' },
  29: { act: 'Act III', description: 'Omega Decoherence is the final shard collapse before eigenstate lock.', signatureMechanic: 'Antimatter shards and maximum visual instability.', difficultyLabel: 'Master+' },
  30: { act: 'Act III', description: 'The final eigenstate combines elite mixed threats before endless drift.', signatureMechanic: 'Higgs-aura finale with all-family pressure.', difficultyLabel: 'Finale' }
};

const BASE_LEVELS: BaseLevelConfig[] = [
  { level: 1, name: 'Quantum Awakening', requiredScore: 0, palette: { background: '#020503', tunnel: '#00ff8a', accent: '#00d9ff', code: '#00ff8a', hazard: '#ff355e' }, speedMultiplier: 1, obstacleDensity: 0.7, collectibleFrequency: 1.2, musicIntensity: 0.55, specialVisualEffect: 'soft-awakening', obstaclePattern: 'lanes', tunnelShape: 'circle' },
  { level: 2, name: 'Code Rain Descent', requiredScore: 8_000, palette: { background: '#010704', tunnel: '#00ff66', accent: '#29ffc6', code: '#7cff00', hazard: '#ff2f93' }, speedMultiplier: 1.08, obstacleDensity: 0.82, collectibleFrequency: 1.16, musicIntensity: 0.62, specialVisualEffect: 'code-rain', obstaclePattern: 'lanes', tunnelShape: 'circle' },
  { level: 3, name: 'Proton Drift', requiredScore: 18_000, palette: { background: '#080302', tunnel: '#ff6a20', accent: '#00ff8a', code: '#00ff8a', hazard: '#ffd166' }, speedMultiplier: 1.17, obstacleDensity: 0.94, collectibleFrequency: 1.08, musicIntensity: 0.68, specialVisualEffect: 'proton-embers', obstaclePattern: 'shards', tunnelShape: 'circle' },
  { level: 4, name: 'Electron Surge', requiredScore: 31_000, palette: { background: '#010611', tunnel: '#23b7ff', accent: '#7df9ff', code: '#00ffbf', hazard: '#ff3df2' }, speedMultiplier: 1.28, obstacleDensity: 1.06, collectibleFrequency: 1, musicIntensity: 0.76, specialVisualEffect: 'electron-arcs', obstaclePattern: 'waves', tunnelShape: 'circle' },
  { level: 5, name: 'Neutron Silence', requiredScore: 47_000, palette: { background: '#040508', tunnel: '#dbe7ff', accent: '#7d8898', code: '#a7ffd6', hazard: '#9f4cff' }, speedMultiplier: 1.4, obstacleDensity: 1.15, collectibleFrequency: 0.94, musicIntensity: 0.82, specialVisualEffect: 'silent-silver', obstaclePattern: 'rings', tunnelShape: 'circle' },

  { level: 6, name: 'Decoherence Field', requiredScore: 66_000, palette: { background: '#06020a', tunnel: '#00ff8a', accent: '#b84cff', code: '#39ff14', hazard: '#ff3366' }, speedMultiplier: 1.54, obstacleDensity: 1.3, collectibleFrequency: 0.9, musicIntensity: 0.9, specialVisualEffect: 'decoherence-glitch', obstaclePattern: 'mixed', tunnelShape: 'square' },
  { level: 7, name: 'Antimatter Veil', requiredScore: 89_000, palette: { background: '#030006', tunnel: '#b84cff', accent: '#ff4fd8', code: '#00ff8a', hazard: '#f8ff6a' }, speedMultiplier: 1.69, obstacleDensity: 1.45, collectibleFrequency: 0.86, musicIntensity: 0.98, specialVisualEffect: 'antimatter-veil', obstaclePattern: 'shards', tunnelShape: 'square' },
  { level: 8, name: 'Probability Storm', requiredScore: 116_000, palette: { background: '#020713', tunnel: '#00d9ff', accent: '#ffea00', code: '#76ff03', hazard: '#ff355e' }, speedMultiplier: 1.85, obstacleDensity: 1.6, collectibleFrequency: 0.8, musicIntensity: 1.06, specialVisualEffect: 'probability-storm', obstaclePattern: 'waves', tunnelShape: 'square' },
  { level: 9, name: 'Singularity Approach', requiredScore: 148_000, palette: { background: '#000000', tunnel: '#2effa3', accent: '#ffffff', code: '#00ff8a', hazard: '#ff4b1f' }, speedMultiplier: 2.02, obstacleDensity: 1.78, collectibleFrequency: 0.74, musicIntensity: 1.14, specialVisualEffect: 'singularity-lens', obstaclePattern: 'rings', tunnelShape: 'square' },
  { level: 10, name: 'Higgs Threshold', requiredScore: 185_000, palette: { background: '#06020c', tunnel: '#ffd76b', accent: '#b84cff', code: '#00ff8a', hazard: '#ff2f93' }, speedMultiplier: 2.2, obstacleDensity: 1.96, collectibleFrequency: 0.69, musicIntensity: 1.22, specialVisualEffect: 'higgs-aura', unlockRequirement: 'Reach 50,000 total run score to unlock the Higgs Boson.', obstaclePattern: 'mixed', tunnelShape: 'square' },

  { level: 11, name: 'Planck Corridor', requiredScore: 228_000, palette: { background: '#020609', tunnel: '#23ffd2', accent: '#ff5df7', code: '#00ff8a', hazard: '#ffb000' }, speedMultiplier: 2.38, obstacleDensity: 2.08, collectibleFrequency: 0.66, musicIntensity: 1.28, specialVisualEffect: 'code-rain', obstaclePattern: 'lanes', tunnelShape: 'hex' },
  { level: 12, name: 'Tachyon Lattice', requiredScore: 278_000, palette: { background: '#07010b', tunnel: '#ff2f93', accent: '#00f5ff', code: '#9cff00', hazard: '#ffe66d' }, speedMultiplier: 2.55, obstacleDensity: 2.2, collectibleFrequency: 0.63, musicIntensity: 1.34, specialVisualEffect: 'electron-arcs', obstaclePattern: 'waves', tunnelShape: 'hex' },
  { level: 13, name: 'Muon Overdrive', requiredScore: 336_000, palette: { background: '#02030f', tunnel: '#4058ff', accent: '#00ff8a', code: '#6dffb8', hazard: '#ff355e' }, speedMultiplier: 2.72, obstacleDensity: 2.34, collectibleFrequency: 0.6, musicIntensity: 1.4, specialVisualEffect: 'probability-storm', obstaclePattern: 'shards', tunnelShape: 'hex' },
  { level: 14, name: 'Photon Blackout', requiredScore: 403_000, palette: { background: '#000000', tunnel: '#f5f7ff', accent: '#00d9ff', code: '#00ff8a', hazard: '#b84cff' }, speedMultiplier: 2.9, obstacleDensity: 2.5, collectibleFrequency: 0.57, musicIntensity: 1.46, specialVisualEffect: 'singularity-lens', obstaclePattern: 'rings', tunnelShape: 'hex' },
  { level: 15, name: 'Wavefunction Cathedral', requiredScore: 480_000, palette: { background: '#050011', tunnel: '#b84cff', accent: '#ffd76b', code: '#00ff8a', hazard: '#ff4fd8' }, speedMultiplier: 3.08, obstacleDensity: 2.66, collectibleFrequency: 0.54, musicIntensity: 1.52, specialVisualEffect: 'higgs-aura', obstaclePattern: 'mixed', tunnelShape: 'hex' },

  { level: 16, name: 'Qubit Rupture', requiredScore: 568_000, palette: { background: '#02110c', tunnel: '#39ff14', accent: '#ff355e', code: '#d7ff00', hazard: '#00d9ff' }, speedMultiplier: 3.24, obstacleDensity: 2.78, collectibleFrequency: 0.52, musicIntensity: 1.56, specialVisualEffect: 'decoherence-glitch', obstaclePattern: 'mixed', tunnelShape: 'circle' },
  { level: 17, name: 'Vacuum Bloom', requiredScore: 668_000, palette: { background: '#080108', tunnel: '#ff7ad9', accent: '#7dffef', code: '#00ff8a', hazard: '#f8ff6a' }, speedMultiplier: 3.39, obstacleDensity: 2.9, collectibleFrequency: 0.5, musicIntensity: 1.6, specialVisualEffect: 'antimatter-veil', obstaclePattern: 'shards', tunnelShape: 'circle' },
  { level: 18, name: 'Chronon Switchyard', requiredScore: 781_000, palette: { background: '#03060d', tunnel: '#00a2ff', accent: '#ffea00', code: '#64ffda', hazard: '#ff3366' }, speedMultiplier: 3.55, obstacleDensity: 3.04, collectibleFrequency: 0.48, musicIntensity: 1.64, specialVisualEffect: 'probability-storm', obstaclePattern: 'waves', tunnelShape: 'circle' },
  { level: 19, name: 'Gravity Static', requiredScore: 908_000, palette: { background: '#070704', tunnel: '#c7ff6b', accent: '#ffffff', code: '#00ff8a', hazard: '#ff6a20' }, speedMultiplier: 3.72, obstacleDensity: 3.18, collectibleFrequency: 0.46, musicIntensity: 1.68, specialVisualEffect: 'silent-silver', obstaclePattern: 'rings', tunnelShape: 'circle' },
  { level: 20, name: 'Event Horizon Run', requiredScore: 1_050_000, palette: { background: '#010005', tunnel: '#ffd76b', accent: '#ff355e', code: '#00ff8a', hazard: '#b84cff' }, speedMultiplier: 3.9, obstacleDensity: 3.32, collectibleFrequency: 0.44, musicIntensity: 1.72, specialVisualEffect: 'singularity-lens', obstaclePattern: 'mixed', tunnelShape: 'circle' },

  { level: 21, name: 'Neon Casimir Vault', requiredScore: 1_208_000, palette: { background: '#020b08', tunnel: '#00ff8a', accent: '#ff4fd8', code: '#7cff00', hazard: '#00d9ff' }, speedMultiplier: 4.05, obstacleDensity: 3.44, collectibleFrequency: 0.43, musicIntensity: 1.75, specialVisualEffect: 'code-rain', obstaclePattern: 'lanes', tunnelShape: 'square' },
  { level: 22, name: 'Entropy Spiral', requiredScore: 1_383_000, palette: { background: '#090203', tunnel: '#ff4b1f', accent: '#ffe66d', code: '#00ff8a', hazard: '#23b7ff' }, speedMultiplier: 4.2, obstacleDensity: 3.56, collectibleFrequency: 0.42, musicIntensity: 1.78, specialVisualEffect: 'proton-embers', obstaclePattern: 'shards', tunnelShape: 'square' },
  { level: 23, name: 'Dark Current Relay', requiredScore: 1_576_000, palette: { background: '#00060a', tunnel: '#18f7ff', accent: '#b84cff', code: '#00ffbf', hazard: '#ffd166' }, speedMultiplier: 4.36, obstacleDensity: 3.68, collectibleFrequency: 0.41, musicIntensity: 1.81, specialVisualEffect: 'electron-arcs', obstaclePattern: 'waves', tunnelShape: 'square' },
  { level: 24, name: 'Boson Crown', requiredScore: 1_789_000, palette: { background: '#080509', tunnel: '#dbe7ff', accent: '#ffd76b', code: '#a7ffd6', hazard: '#ff2f93' }, speedMultiplier: 4.52, obstacleDensity: 3.82, collectibleFrequency: 0.4, musicIntensity: 1.84, specialVisualEffect: 'higgs-aura', obstaclePattern: 'rings', tunnelShape: 'square' },
  { level: 25, name: 'Quantum Noir Apex', requiredScore: 2_023_000, palette: { background: '#010101', tunnel: '#00ff66', accent: '#ffffff', code: '#39ff14', hazard: '#ff355e' }, speedMultiplier: 4.68, obstacleDensity: 3.96, collectibleFrequency: 0.39, musicIntensity: 1.87, specialVisualEffect: 'quantum-drift', obstaclePattern: 'mixed', tunnelShape: 'square' },

  { level: 26, name: 'Planck Stormwall', requiredScore: 2_280_000, palette: { background: '#05010a', tunnel: '#b84cff', accent: '#00ff8a', code: '#00ff8a', hazard: '#ffb000' }, speedMultiplier: 4.83, obstacleDensity: 4.08, collectibleFrequency: 0.38, musicIntensity: 1.9, specialVisualEffect: 'decoherence-glitch', obstaclePattern: 'mixed', tunnelShape: 'hex' },
  { level: 27, name: 'Superposition Grid', requiredScore: 2_562_000, palette: { background: '#010812', tunnel: '#00d9ff', accent: '#ff4fd8', code: '#76ff03', hazard: '#f8ff6a' }, speedMultiplier: 4.98, obstacleDensity: 4.2, collectibleFrequency: 0.37, musicIntensity: 1.93, specialVisualEffect: 'probability-storm', obstaclePattern: 'waves', tunnelShape: 'hex' },
  { level: 28, name: 'Hawking Afterimage', requiredScore: 2_871_000, palette: { background: '#000000', tunnel: '#ffffff', accent: '#00ff8a', code: '#7dffef', hazard: '#ff4b1f' }, speedMultiplier: 5.14, obstacleDensity: 4.32, collectibleFrequency: 0.36, musicIntensity: 1.96, specialVisualEffect: 'singularity-lens', obstaclePattern: 'rings', tunnelShape: 'hex' },
  { level: 29, name: 'Omega Decoherence', requiredScore: 3_209_000, palette: { background: '#090006', tunnel: '#ff355e', accent: '#ffd76b', code: '#00ff8a', hazard: '#00d9ff' }, speedMultiplier: 5.3, obstacleDensity: 4.45, collectibleFrequency: 0.35, musicIntensity: 1.99, specialVisualEffect: 'antimatter-veil', obstaclePattern: 'shards', tunnelShape: 'hex' },
  { level: 30, name: 'Final Eigenstate', requiredScore: 3_578_000, palette: { background: '#02000a', tunnel: '#ffd76b', accent: '#b84cff', code: '#39ff14', hazard: '#ff2f93' }, speedMultiplier: 5.5, obstacleDensity: 4.6, collectibleFrequency: 0.34, musicIntensity: 2.05, specialVisualEffect: 'higgs-aura', obstaclePattern: 'mixed', tunnelShape: 'hex' }
];

export const LEVELS: LevelConfig[] = BASE_LEVELS.map((level) => ({ ...level, ...LEVEL_IDENTITIES[level.level] }));

export const QUANTUM_DRIFT_LEVEL: LevelConfig = {
  level: 31,
  name: 'Quantum Drift',
  act: 'Endless',
  description: 'Endless post-Level 30 score chase where speed, density, and tunnel shape keep scaling.',
  signatureMechanic: 'Rotating shape families and endless difficulty growth.',
  difficultyLabel: 'Endless',
  requiredScore: 3_980_000,
  palette: { background: '#010103', tunnel: '#00ff8a', accent: '#b84cff', code: '#39ff14', hazard: '#ff355e' },
  speedMultiplier: 5.68,
  obstacleDensity: 4.75,
  collectibleFrequency: 0.32,
  musicIntensity: 2.1,
  specialVisualEffect: 'quantum-drift',
  obstaclePattern: 'mixed',
  tunnelShape: 'circle'
};

export function getLevelForScore(score: number): LevelConfig {
  const level = [...LEVELS].reverse().find((candidate) => score >= candidate.requiredScore);
  return level ?? LEVELS[0];
}

export function getStageForScore(score: number): LevelConfig {
  if (score >= QUANTUM_DRIFT_LEVEL.requiredScore) {
    const driftStep = Math.floor((score - QUANTUM_DRIFT_LEVEL.requiredScore) / 25_000);
    return {
      ...QUANTUM_DRIFT_LEVEL,
      level: QUANTUM_DRIFT_LEVEL.level + driftStep,
      speedMultiplier: QUANTUM_DRIFT_LEVEL.speedMultiplier + driftStep * 0.08,
      obstacleDensity: QUANTUM_DRIFT_LEVEL.obstacleDensity + driftStep * 0.05,
      musicIntensity: QUANTUM_DRIFT_LEVEL.musicIntensity + driftStep * 0.03,
      tunnelShape: (['circle', 'square', 'hex'] as const)[driftStep % 3]
    };
  }

  return getLevelForScore(score);
}
