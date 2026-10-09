import { MusicIdentity, chordMidiNotes, hashChance, scaleDegreeMidi } from './MusicTheory';
import { MusicalPosition, MusicalSection } from './MusicTransport';
import { MusicalState } from './MusicDirector';

export type PatternEvent =
  | { type: 'kick'; velocity: number }
  | { type: 'hat'; velocity: number }
  | { type: 'snare'; velocity: number }
  | { type: 'bass'; midi: number; velocity: number; duration: number }
  | { type: 'lead'; midi: number; velocity: number; duration: number; pan: number }
  | { type: 'pad'; notes: number[]; velocity: number; duration: number }

interface PhraseVariation {
  rotation: number;
  reverse: boolean;
  octave: number;
  omitProbability: number;
}

export class PatternGenerator {
  constructor(private identity: MusicIdentity) {}

  eventsAt(position: MusicalPosition, state: MusicalState): PatternEvent[] {
    const events: PatternEvent[] = [];
    const stepInBar = position.step % 16;
    const beat = Math.floor(stepInBar / 4);
    const chordDegree = this.identity.progression[position.bar % this.identity.progression.length];
    const variation = this.variationForPhrase(Math.floor(position.bar / 4));
    const isElectron = state.particleId === 'electron';
    const isNeutron = state.particleId === 'neutron';
    const isHiggs = state.particleId === 'higgs';

    if (stepInBar === 0) {
      const eightBarLift = position.bar > 0 && position.bar % 8 === 0;
      events.push({
        type: 'pad',
        notes: chordMidiNotes(this.identity, chordDegree, 1, isHiggs || eightBarLift),
        velocity: state.section === 'breath' ? 0.32 : state.section === 'intro' ? 0.3 : 0.24 + (eightBarLift ? 0.035 : 0),
        duration: state.section === 'breath' ? 2.35 : 1.95
      });
    }

    this.addPercussion(events, stepInBar, position.bar, state.section, state.particleId);
    this.addBass(events, position, chordDegree, variation, state.section, isNeutron);
    this.addLead(events, position, chordDegree, variation, state, isElectron, isNeutron, isHiggs);
    return events;
  }

  getChordDegree(bar: number): number {
    return this.identity.progression[bar % this.identity.progression.length];
  }

  getScaleNote(degree: number, octaveOffset = 0): number {
    return scaleDegreeMidi(this.identity.tonicMidi, this.identity.scale, degree) + octaveOffset * 12;
  }

  private addPercussion(events: PatternEvent[], step: number, bar: number, section: MusicalSection, particleId: string): void {
    if (section === 'intro' || section === 'breath') return;

    const family = this.identity.rhythmFamily;
    const kickOnBeat = section === 'groove' ? step === 0 || step === 8 : step % 4 === 0;
    const syncKick = section === 'peak' && (step === 6 || (family === 2 && step === 14));
    const fillKick = (section === 'build' || section === 'peak') && family === 1 && step === 12;
    if (kickOnBeat || syncKick || fillKick) {
      events.push({ type: 'kick', velocity: step === 0 ? 0.76 : 0.58 });
    }

    if (section !== 'groove' && step === 8) {
      events.push({ type: 'snare', velocity: section === 'peak' ? 0.42 : 0.3 });
    }
    if ((section === 'build' || section === 'peak') && bar % 8 === 7 && step === 14) {
      events.push({ type: 'snare', velocity: 0.34 });
    }
    if ((section === 'build' || section === 'peak') && bar % 16 === 15 && step === 12) {
      events.push({ type: 'snare', velocity: 0.4 });
    }

    const isNeutron = particleId === 'neutron';
    const hatOn = isNeutron
      ? step === 2 || step === 10 || (section === 'peak' && step === 6)
      : section === 'peak'
        ? true
      : section === 'build'
        ? step % 2 === 0
        : step === 2 || step === 6 || step === 10 || step === 14;
    const electronGhostHat = particleId === 'electron' && section === 'peak' && step % 2 === 1 && this.identity.rhythmFamily === 2;
    if (hatOn || electronGhostHat) {
      const accented = step % 4 === 0;
      const fillBoost = step === 14 && bar % 4 === 3 ? 0.12 : 0;
      events.push({ type: 'hat', velocity: (accented ? 0.3 : 0.2) + fillBoost });
    }
  }

  private addBass(
    events: PatternEvent[],
    position: MusicalPosition,
    chordDegree: number,
    variation: PhraseVariation,
    section: MusicalSection,
    isNeutron: boolean
  ): void {
    if (section === 'intro' || section === 'breath') return;
    const step = position.step % 16;
    const bassPattern = this.getBassPattern(section);
    const motifIndex = ((Math.floor(step / 2) + variation.rotation) % this.identity.bassMotif.length + this.identity.bassMotif.length) % this.identity.bassMotif.length;
    const motifTone = this.identity.bassMotif[variation.reverse ? this.identity.bassMotif.length - 1 - motifIndex : motifIndex];
    const requestedTone = bassPattern[step];
    if (requestedTone === null || (isNeutron && step % 8 !== 0)) return;

    const chordTone = (requestedTone + motifTone + variation.rotation) % 3;
    const octave = isNeutron ? -2 : -1;
    const midi = Math.max(34, scaleDegreeMidi(this.identity.tonicMidi, this.identity.scale, chordDegree + chordTone * 2) + octave * 12 + (variation.octave > 0 && position.bar % 4 === 3 ? 12 : 0));
    events.push({
      type: 'bass',
      midi,
      velocity: section === 'peak' ? 0.66 : section === 'build' ? 0.57 : 0.48,
      duration: step % 4 === 0 ? 0.2 : 0.13
    });
  }

  private addLead(
    events: PatternEvent[],
    position: MusicalPosition,
    chordDegree: number,
    variation: PhraseVariation,
    state: MusicalState,
    isElectron: boolean,
    isNeutron: boolean,
    isHiggs: boolean
  ): void {
    const step = position.step % 16;
    const spacing = state.section === 'intro' || state.section === 'breath'
      ? 8
      : state.section === 'peak'
        ? (isElectron || isHiggs ? 1 : 2)
      : state.section === 'build'
        ? 2
        : state.section === 'groove' && isElectron
          ? 2
          : 4;
    if (step % spacing !== 0) return;

    const phraseIndex = Math.floor(position.bar / 4);
    const motifIndex = (Math.floor(step / 2) + variation.rotation + phraseIndex) % this.identity.arpMotif.length;
    const motifValue = this.identity.arpMotif[variation.reverse ? this.identity.arpMotif.length - 1 - motifIndex : motifIndex];
    const chordTones = chordMidiNotes(this.identity, chordDegree, 0, isHiggs);
    const toneIndex = (motifValue + variation.rotation) % chordTones.length;
    const octave = isNeutron ? 1 : state.section === 'peak' || isElectron ? 2 : 1;
    const octaveDisplacement = variation.octave && position.bar % 4 === 3 ? 1 : 0;
    const midi = chordTones[toneIndex] + (octave + octaveDisplacement) * 12;
    const weakSixteenth = step % 4 !== 0;
    const chance = weakSixteenth
      ? Math.max(0.06, (state.density - 0.34) * 0.7)
      : Math.min(0.98, 0.48 + state.density * 0.52);
    const stableIndex = position.step + position.bar * 17;
    if (hashChance(this.identity.seed ^ (phraseIndex * 0x45d9f3b), stableIndex) > chance) return;
    if (hashChance(this.identity.seed ^ 0x3c6ef372, stableIndex + 91) < variation.omitProbability && step !== 0) return;

    const phraseFill = position.bar % 4 === 3 && step >= 12;
    const velocity = state.section === 'peak' ? 0.52 : state.section === 'build' ? 0.42 : state.section === 'intro' ? 0.27 : 0.32;
    events.push({
      type: 'lead',
      midi,
      velocity: velocity + (phraseFill ? 0.08 : 0) + state.variation * 0.06,
      duration: state.section === 'peak' ? 0.13 : 0.2,
      pan: (hashChance(this.identity.seed, stableIndex + 401) - 0.5) * (isHiggs ? 0.62 : 0.38)
    });
  }

  private getBassPattern(section: MusicalSection): Array<number | null> {
    const family = this.identity.rhythmFamily;
    const patterns: Array<Array<number | null>> = [
      [0, null, null, null, 1, null, 2, null, 0, null, null, 2, 1, null, 2, null],
      [0, null, null, 2, null, null, 1, null, 0, null, 2, null, 1, null, null, 2],
      [0, null, 2, null, 1, null, null, 2, 0, null, 1, null, 2, null, 1, null],
      [0, null, null, 1, 2, null, 1, null, 0, null, null, 2, 1, null, 2, null]
    ];
    const pattern = patterns[family];
    if (section === 'groove') {
      return pattern.map((tone, step) => step % 4 === 0 || step === 6 || step === 14 ? tone : null);
    }
    return pattern;
  }

  private variationForPhrase(phrase: number): PhraseVariation {
    const seed = (this.identity.seed ^ Math.imul(phrase + 1, 0x9e3779b1)) >>> 0;
    const rotation = Math.floor(hashChance(seed, 1) * this.identity.arpMotif.length);
    return {
      rotation,
      reverse: hashChance(seed, 2) < 0.18,
      octave: hashChance(seed, 3) < (this.identity.texture > 0.65 ? 0.32 : 0.18) ? 1 : 0,
      omitProbability: hashChance(seed, 4) < 0.5 ? 0.06 : 0.12
    };
  }
}
