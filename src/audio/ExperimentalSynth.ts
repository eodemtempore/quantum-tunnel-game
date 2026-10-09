import { ParticleId } from '../game/Particles';
import { GameSettings } from '../storage/Storage';
import { MusicDirector, MusicalGameState, MusicalState } from './MusicDirector';
import { MusicIdentity, chordMidiNotes, createMusicIdentity } from './MusicTheory';
import { MusicalPosition, MusicTransport } from './MusicTransport';
import { PatternEvent, PatternGenerator } from './PatternGenerator';
import { SynthVoices } from './SynthVoices';

export type SynthEvent = 'sync' | 'nearMiss' | 'guard' | 'level' | 'collision';

export interface StopOptions {
  fadeSeconds?: number;
  preserveVoices?: boolean;
}

export class ExperimentalSynth {
  private context?: AudioContext;
  private master?: GainNode;
  private compressor?: DynamicsCompressorNode;
  private analyser?: AnalyserNode;
  private delay?: DelayNode;
  private delayFeedback?: GainNode;
  private delayReturn?: GainNode;
  private analyserData = new Uint8Array(128);
  private voices?: SynthVoices;
  private readonly transport = new MusicTransport();
  private director?: MusicDirector;
  private patterns?: PatternGenerator;
  private identity?: MusicIdentity;
  private latestState?: MusicalState;
  private settings?: GameSettings;
  private currentParticle: ParticleId = 'proton';
  private runSeed = 0;
  private armed = false;
  private running = false;
  private energy = 0.12;
  private suspendTimer?: number;

  async setEnabled(enabled: boolean, settings: GameSettings): Promise<void> {
    this.armed = enabled;
    this.settings = settings;
    if (!enabled) {
      this.stop();
      return;
    }
    this.applySettings(settings);
  }

  beginRun(particleId: ParticleId): void {
    this.currentParticle = particleId;
    this.energy = 0.12;
    this.runSeed = this.createRunSeed();
    this.identity = createMusicIdentity(this.runSeed, particleId);
    this.director = new MusicDirector(this.identity.bpm, particleId);
    this.patterns = new PatternGenerator(this.identity);
    this.latestState = this.director.getState();
    this.transport.reset(this.identity.bpm);
    this.voices?.stopAll();
  }

  async ensureStarted(settings: GameSettings): Promise<void> {
    if (!this.armed) return;
    this.settings = settings;
    if (!this.context) this.createGraph();
    if (!this.context || !this.master) return;
    if (this.suspendTimer !== undefined) {
      window.clearTimeout(this.suspendTimer);
      this.suspendTimer = undefined;
    }
    if (this.context.state !== 'running') await this.context.resume();
    if (!this.identity) this.beginRun(this.currentParticle);
    this.applySettings(settings);
    this.running = true;
    this.transport.start(this.context, (time, position) => this.scheduleStep(time, position), this.identity?.bpm ?? 110);
  }

  applySettings(settings: GameSettings): void {
    this.settings = settings;
    if (!this.context || !this.master) return;
    const now = this.context.currentTime;
    this.master.gain.setTargetAtTime(settings.muted ? 0 : settings.synthMasterVolume, now, 0.06);
    this.voices?.applySettings(settings);
  }

  update(gameState: MusicalGameState, dt: number): void {
    if (!this.running || !this.context || !this.director || !this.identity) return;
    this.currentParticle = gameState.particleId;
    this.director.update(gameState, dt);
    this.latestState = this.director.getState();
    this.voices?.updatePerformance({
      time: this.context.currentTime,
      particleId: gameState.particleId,
      speedRatio: gameState.speedRatio,
      steering: gameState.steering,
      energy: this.latestState.energy,
      tension: this.latestState.tension,
      shieldActive: gameState.shieldActive
    });
  }

  trigger(event: SynthEvent): void {
    if (!this.running || !this.context || !this.director || !this.patterns || !this.identity || !this.voices) return;
    this.director.onEvent(event);
    const particleId = this.currentParticle;

    if (event === 'collision') {
      this.voices.playImpact(this.context.currentTime, particleId);
      return;
    }

    if (event === 'nearMiss') {
      this.transport.schedule('sixteenth', (time, position) => {
        const degree = this.patterns?.getChordDegree(position.bar) ?? 0;
        const notes = chordMidiNotes(this.identity!, degree, 2, true);
        this.voices?.playAccent(notes[2] + 12, time, 0.62, particleId);
      });
    } else if (event === 'sync') {
      this.transport.schedule('beat', (time, position) => {
        const degree = this.patterns?.getChordDegree(position.bar) ?? 0;
        const notes = chordMidiNotes(this.identity!, degree, 2, true);
        notes.slice(0, 3).forEach((note, index) => {
          this.voices?.playAccent(note + (index === 2 ? 12 : 0), time + index * 0.045, 0.5 - index * 0.06, particleId);
        });
      });
    } else if (event === 'guard') {
      this.transport.schedule('beat', (time, position) => {
        const degree = this.patterns?.getChordDegree(position.bar) ?? 0;
        const notes = chordMidiNotes(this.identity!, degree, 1, true);
        this.voices?.playPad(notes, time, 1.1, 0.52, particleId);
      });
    } else if (event === 'level') {
      this.transport.schedule('bar', (time, position) => {
        const degree = this.patterns?.getChordDegree(position.bar) ?? 0;
        const notes = chordMidiNotes(this.identity!, degree, 2, true);
        this.voices?.playSnare(time, 0.58);
        this.voices?.playAccent(notes[1] + 12, time + 0.04, 0.58, particleId);
      });
    }
  }

  getEnergy(): number {
    if (!this.analyser || !this.context || this.context.state !== 'running' || !this.running) {
      this.energy += (0.12 - this.energy) * 0.08;
      return this.energy;
    }
    this.analyser.getByteFrequencyData(this.analyserData);
    let weightedSum = 0;
    let totalWeight = 0;
    for (let index = 1; index < this.analyserData.length; index += 1) {
      const weight = index < 12 ? 1.2 : index < 48 ? 1 : 0.58;
      weightedSum += this.analyserData[index] * weight;
      totalWeight += weight;
    }
    const measured = Math.max(0.08, Math.min(1, weightedSum / Math.max(1, totalWeight * 142)));
    this.energy += (measured - this.energy) * 0.22;
    return this.energy;
  }

  resetPreset(): void {
    const resumePlayback = this.running && !!this.context && this.context.state === 'running';
    this.beginRun(this.currentParticle);
    if (this.settings) this.applySettings(this.settings);
    // beginRun resets the transport. Restart its lookahead scheduler if the
    // player reset the preset while already in a run.
    if (resumePlayback && this.context && this.identity) {
      this.transport.start(this.context, (time, position) => this.scheduleStep(time, position), this.identity.bpm);
    }
  }

  stop(): void {
    this.armed = false;
    this.stopPlayback();
    this.voices?.disconnect();
    this.voices = undefined;
    this.transport.reset();
    this.identity = undefined;
    this.patterns = undefined;
    this.director = undefined;
    const context = this.context;
    this.context = undefined;
    this.master = undefined;
    this.compressor = undefined;
    this.analyser = undefined;
    this.delay = undefined;
    this.delayFeedback = undefined;
    this.delayReturn = undefined;
    if (context && context.state !== 'closed') void context.close();
  }

  stopPlayback(options: StopOptions = {}): void {
    this.running = false;
    this.transport.stop();
    if (this.suspendTimer !== undefined) {
      window.clearTimeout(this.suspendTimer);
      this.suspendTimer = undefined;
    }
    if (!this.context || !this.master) return;
    const now = this.context.currentTime;
    const fadeSeconds = Math.max(0, options.fadeSeconds ?? 0.04);
    if (!options.preserveVoices) this.voices?.stopAll(now + Math.min(0.01, fadeSeconds));
    this.master.gain.cancelScheduledValues(now);
    this.master.gain.setValueAtTime(Math.max(0.0001, this.master.gain.value), now);
    this.master.gain.linearRampToValueAtTime(0.0001, now + Math.max(0.012, fadeSeconds));
    this.suspendTimer = window.setTimeout(() => {
      if (!this.running && this.context?.state === 'running') void this.context.suspend();
      this.suspendTimer = undefined;
    }, Math.ceil(Math.max(0.04, fadeSeconds + 0.03) * 1000));
  }

  private createGraph(): void {
    const AudioCtor = window.AudioContext || window.webkitAudioContext;
    this.context = new AudioCtor();
    this.master = this.context.createGain();
    this.compressor = this.context.createDynamicsCompressor();
    this.analyser = this.context.createAnalyser();
    this.delay = this.context.createDelay(0.8);
    this.delayFeedback = this.context.createGain();
    this.delayReturn = this.context.createGain();
    this.analyser.fftSize = 256;
    this.compressor.threshold.value = -18;
    this.compressor.knee.value = 12;
    this.compressor.ratio.value = 5;
    this.compressor.attack.value = 0.004;
    this.compressor.release.value = 0.22;
    this.master.gain.value = 0.0001;
    this.delay.delayTime.value = 0.28;
    this.delayFeedback.gain.value = 0.16;
    this.delayReturn.gain.value = 0.24;
    this.delay.connect(this.delayFeedback);
    this.delayFeedback.connect(this.delay);
    this.delay.connect(this.delayReturn);
    this.delayReturn.connect(this.master);
    this.master.connect(this.compressor);
    this.compressor.connect(this.analyser);
    this.analyser.connect(this.context.destination);
    this.voices = new SynthVoices(this.context, this.master, this.delay, this.delayFeedback);
    if (this.settings) this.voices.applySettings(this.settings);
  }

  private scheduleStep(time: number, position: MusicalPosition): void {
    if (!this.context || !this.identity || !this.director || !this.patterns || !this.voices) return;
    if (position.step % 16 === 0) {
      this.latestState = this.director.onBar(position.bar);
      this.transport.setTargetBpm(this.latestState.bpm);
      if (this.delay) this.delay.delayTime.setTargetAtTime(Math.max(0.12, Math.min(0.52, (60 / this.latestState.bpm) * 0.75)), time, 0.08);
    }
    const state = this.latestState ?? this.director.getState();
    const events = this.patterns.eventsAt(position, state);
    events.forEach((event) => this.playPatternEvent(event, time, state));
  }

  private playPatternEvent(event: PatternEvent, time: number, state: MusicalState): void {
    if (!this.voices) return;
    if (event.type === 'kick') this.voices.playKick(time, event.velocity);
    else if (event.type === 'hat') this.voices.playHat(time, event.velocity);
    else if (event.type === 'snare') this.voices.playSnare(time, event.velocity);
    else if (event.type === 'bass') this.voices.playBass(event.midi, time, event.duration, event.velocity, state.particleId);
    else if (event.type === 'acid') this.voices.playAcid(event.midi, time, event.duration, event.velocity, event.pan, event.accent, state.particleId);
    else if (event.type === 'pad') this.voices.playPad(event.notes, time, event.duration, event.velocity, state.particleId);
    else this.voices.playPsyRiser(time, event.duration, event.velocity);
  }

  private createRunSeed(): number {
    const seed = new Uint32Array(1);
    if (typeof crypto !== 'undefined' && crypto.getRandomValues) crypto.getRandomValues(seed);
    else seed[0] = (Date.now() ^ Math.floor(performance.now() * 1000)) >>> 0;
    return seed[0] || 1;
  }
}
