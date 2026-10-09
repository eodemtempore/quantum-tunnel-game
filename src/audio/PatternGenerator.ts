import { MusicIdentity, chordMidiNotes, hashChance, scaleDegreeMidi } from './MusicTheory';
import { MusicalPosition, MusicalSection } from './MusicTransport';
import { MusicalState } from './MusicDirector';

export type PatternEvent =
  | { type: 'kick'; velocity: number }
  | { type: 'hat'; velocity: number }
  | { type: 'snare'; velocity: number }
  | { type: 'bass'; midi: number; velocity: number; duration: number }
  | { type: 'acid'; midi: number; velocity: number; duration: number; pan: number; accent: boolean }
  | { type: 'pad'; notes: number[]; velocity: number; duration: number }
  | { type: 'riser'; velocity: number; duration: number }

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
    const levelStage = Math.min(3, Math.max(0, Math.floor(state.level) - 1));

    if (stepInBar === 0) {
      const eightBarLift = position.bar > 0 && position.bar % 8 === 0;
      events.push({
        type: 'pad',
        notes: chordMidiNotes(this.identity, chordDegree, 1, isHiggs || eightBarLift),
        velocity: state.section === 'breath' ? 0.32 : state.section === 'intro' ? 0.3 : 0.24 + (eightBarLift ? 0.035 : 0),
        duration: state.section === 'breath' ? 2.35 : 1.95
      });
    }

    // A psytrance 16th engine: one kick, then three short bass notes in each
    // quarter-note cell. Four kick cells make the bar; bass variation can
    // drift independently without losing the pulse.
    if ((state.section === 'build' || state.section === 'peak') && position.bar % 8 === 7 && stepInBar === 12) {
      events.push({ type: 'riser', velocity: state.section === 'peak' ? 0.7 : 0.48, duration: 0.48 });
    }

    this.addPercussion(events, stepInBar, position.bar, state.section, state.particleId, levelStage);
    this.addBass(events, position, chordDegree, variation, state.section, isNeutron);
    this.addLead(events, position, chordDegree, variation, state, isElectron, isNeutron, isHiggs, levelStage);
    return events;
  }

  getChordDegree(bar: number): number {
    return this.identity.progression[bar % this.identity.progression.length];
  }

  getScaleNote(degree: number, octaveOffset = 0): number {
    return scaleDegreeMidi(this.identity.tonicMidi, this.identity.scale, degree) + octaveOffset * 12;
  }

  private addPercussion(events: PatternEvent[], step: number, bar: number, section: MusicalSection, particleId: string, levelStage: number): void {
    if (section === 'breath') return;

    const family = this.identity.rhythmFamily;
    // Psytrance foundation: four-on-the-floor kicks in every active section.
    const kickOnBeat = step % 4 === 0;
    const syncKick = section === 'peak' && (step === 6 || (family === 2 && step === 14) || (particleId === 'electron' && levelStage >= 2 && step === 10));
    const fillKick = (section === 'build' || section === 'peak') && (family === 1 || (particleId === 'higgs' && levelStage >= 3)) && step === 12;
    if (kickOnBeat || syncKick || fillKick) {
      events.push({ type: 'kick', velocity: step === 0 ? 0.96 : 0.78 });
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
    const hatOn = section === 'intro'
      ? step === 14
      : isNeutron
      ? step === 2 || step === 10 || (section === 'peak' && step === 6 && levelStage >= 1)
      : particleId === 'higgs'
      ? step === 2 || step === 6 || step === 10 || step === 14 || (section === 'peak' && step % 2 === 1 && levelStage >= 3)
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
    const levelGhostHat = levelStage >= 1 && (section === 'peak' || (levelStage >= 2 && section === 'build')) && [3, 7, 11, 15].includes(step);
    if (levelGhostHat && !hatOn && !electronGhostHat) {
      events.push({ type: 'hat', velocity: 0.11 + levelStage * 0.025 });
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
    if (section === 'breath') return;
    const step = position.step % 16;
    const bassPattern = this.getBassPattern(section);
    const motifIndex = ((Math.floor(step / 2) + variation.rotation) % this.identity.bassMotif.length + this.identity.bassMotif.length) % this.identity.bassMotif.length;
    const motifTone = this.identity.bassMotif[variation.reverse ? this.identity.bassMotif.length - 1 - motifIndex : motifIndex];
    const requestedTone = bassPattern[step];
    if (requestedTone === null || (isNeutron && step % 4 !== 2)) return;

    // Keep the bass anchored to the chord root, with an occasional fifth as a
    // phrase accent. This preserves the rolling pulse instead of sounding like
    // a wandering melodic bass line.
    const chordTone = requestedTone === 2 || (motifTone === 3 && step % 4 === 3 && position.bar % 4 === 3) ? 2 : 0;
    const octave = isNeutron ? -2 : -1;
    const midi = Math.max(34, scaleDegreeMidi(this.identity.tonicMidi, this.identity.scale, chordDegree + chordTone * 2) + octave * 12 + (variation.octave > 0 && position.bar % 4 === 3 ? 12 : 0));
    events.push({
      type: 'bass',
      midi,
      velocity: (section === 'peak' ? 0.86 : section === 'build' ? 0.78 : 0.72) * (step % 4 === 1 ? 1 : step % 4 === 3 ? 0.88 : 0.78),
      duration: 0.07
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
    isHiggs: boolean,
    levelStage: number
  ): void {
    const step = position.step % 16;
    const spacing = state.section === 'intro' || state.section === 'breath'
      ? 8
      : state.section === 'peak'
        ? (isElectron || (isHiggs && levelStage >= 2) ? 1 : 2)
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
    const steeringShift = state.steering < -0.38 ? -1 : state.steering > 0.38 ? 1 : 0;
    const performedTone = (toneIndex + steeringShift + chordTones.length) % chordTones.length;
    const octave = isNeutron ? (state.section === 'peak' ? 0 : -1) : state.section === 'peak' || isElectron || (isHiggs && levelStage >= 1) ? 1 : 0;
    const octaveDisplacement = (variation.octave || (levelStage >= 2 && position.bar % 4 === 3)) && position.bar % 4 === 3 ? 1 : 0;
    const stableIndex = position.step + position.bar * 17;
    const tensionNote = state.tension > 0.46 && hashChance(this.identity.seed ^ 0x51ed270b, stableIndex + 17) < state.tension * 0.3;
    const noteMidi = tensionNote
      ? scaleDegreeMidi(this.identity.tonicMidi, this.identity.scale, chordDegree + 1)
      : chordTones[performedTone];
    const midi = noteMidi + (octave + octaveDisplacement) * 12;
    const weakSixteenth = step % 4 !== 0;
    const levelDensity = levelStage * 0.045;
    const chance = weakSixteenth
      ? state.section === 'peak'
        ? isElectron || isHiggs ? 0.9 : 0.72
        : state.section === 'build' ? 0.48 + levelDensity : Math.max(0.08, (state.density - 0.34) * 0.7 + levelDensity)
      : Math.min(0.98, 0.76 + state.density * 0.24 + levelDensity);
    if (hashChance(this.identity.seed ^ (phraseIndex * 0x45d9f3b), stableIndex) > chance) return;
    if (hashChance(this.identity.seed ^ 0x3c6ef372, stableIndex + 91) < variation.omitProbability && step !== 0) return;

    const phraseFill = position.bar % 4 === 3 && step >= 12;
    const velocity = state.section === 'peak' ? 0.78 : state.section === 'build' ? 0.64 : state.section === 'intro' ? 0.38 : 0.52;
    events.push({
      type: 'acid',
      midi,
      velocity: velocity + (phraseFill ? 0.08 : 0) + state.variation * 0.06,
      duration: state.section === 'peak' ? (isElectron ? 0.105 : 0.13) : 0.2,
      pan: (hashChance(this.identity.seed, stableIndex + 401) - 0.5) * (isHiggs ? 0.72 : isElectron ? 0.28 : 0.38),
      accent: step % 4 === 0 || step % 4 === 3 || phraseFill
    });
  }

  private getBassPattern(section: MusicalSection): Array<number | null> {
    const family = this.identity.rhythmFamily;
    const pattern: Array<number | null> = Array(16).fill(null);
    for (let step = 0; step < 16; step += 1) {
      // 1--- kick / -111 bass, repeated four times per 4/4 bar.
      if (step % 4 !== 0) pattern[step] = 0;
    }
    if (section === 'build' || section === 'peak') {
      // Keep the rolling line continuous but let one seeded family add a
      // fifth on the last sixteenth of phrase-ending bars.
      if (family === 2 && section === 'peak') pattern[15] = 2;
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
