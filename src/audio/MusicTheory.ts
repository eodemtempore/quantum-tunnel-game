import { ParticleId } from '../game/Particles';

export type ScaleName = 'naturalMinor' | 'dorian' | 'phrygian' | 'minorPentatonic';

export interface MusicIdentity {
  seed: number;
  tonicMidi: number;
  scale: ScaleName;
  progression: number[];
  bpm: number;
  bassMotif: number[];
  arpMotif: number[];
  rhythmFamily: number;
  texture: number;
}

export const SCALE_INTERVALS: Record<ScaleName, number[]> = {
  naturalMinor: [0, 2, 3, 5, 7, 8, 10],
  dorian: [0, 2, 3, 5, 7, 9, 10],
  phrygian: [0, 1, 3, 5, 7, 8, 10],
  minorPentatonic: [0, 3, 5, 7, 10]
};

const PROGRESSIONS: number[][] = [
  [0, 5, 2, 6],
  [0, 3, 5, 4],
  [0, 6, 3, 2],
  [0, 4, 0, 5]
];

export function seededRandom(seed: number): () => number {
  let state = (seed >>> 0) || 0x6d2b79f5;
  return () => {
    state += 0x6d2b79f5;
    let value = state;
    value = Math.imul(value ^ (value >>> 15), value | 1);
    value ^= value + Math.imul(value ^ (value >>> 7), value | 61);
    return ((value ^ (value >>> 14)) >>> 0) / 4294967296;
  };
}

export function hashChance(seed: number, index: number): number {
  let value = (seed ^ Math.imul(index + 1, 0x9e3779b1)) >>> 0;
  value ^= value >>> 16;
  value = Math.imul(value, 0x7feb352d);
  value ^= value >>> 15;
  value = Math.imul(value, 0x846ca68b);
  value ^= value >>> 16;
  return (value >>> 0) / 4294967296;
}

export function createMusicIdentity(seed: number, particleId: ParticleId): MusicIdentity {
  const random = seededRandom(seed);
  const scaleChoices: ScaleName[] = particleId === 'electron'
    ? ['naturalMinor', 'dorian', 'dorian']
    : particleId === 'neutron'
      ? ['naturalMinor', 'minorPentatonic', 'minorPentatonic']
      : particleId === 'higgs'
        ? ['dorian', 'phrygian', 'naturalMinor']
        : ['naturalMinor', 'dorian', 'phrygian'];
  const scale = scaleChoices[Math.floor(random() * scaleChoices.length)];
  const progression = [...PROGRESSIONS[Math.floor(random() * PROGRESSIONS.length)]];
  const bassMotif = Array.from({ length: 8 }, () => Math.floor(random() * 4));
  const arpMotif = Array.from({ length: 8 }, () => Math.floor(random() * 4));

  return {
    seed: seed >>> 0,
    tonicMidi: 45 + Math.floor(random() * 12),
    scale,
    progression,
    bpm: 138 + Math.floor(random() * 5),
    bassMotif,
    arpMotif,
    rhythmFamily: Math.floor(random() * 4),
    texture: random()
  };
}

export function scaleDegreeMidi(tonicMidi: number, scale: ScaleName, degree: number): number {
  const intervals = SCALE_INTERVALS[scale];
  const octave = Math.floor(degree / intervals.length);
  const index = ((degree % intervals.length) + intervals.length) % intervals.length;
  return tonicMidi + octave * 12 + intervals[index];
}

export function chordMidiNotes(
  identity: MusicIdentity,
  degree: number,
  octaveOffset = 0,
  includeSeventh = false
): number[] {
  const chordDegrees = includeSeventh ? [degree, degree + 2, degree + 4, degree + 6] : [degree, degree + 2, degree + 4];
  return chordDegrees.map((chordDegree) => scaleDegreeMidi(identity.tonicMidi, identity.scale, chordDegree) + octaveOffset * 12);
}

export function midiToFrequency(midi: number): number {
  return 440 * Math.pow(2, (midi - 69) / 12);
}
