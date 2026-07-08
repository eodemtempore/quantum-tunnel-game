import { LevelConfig } from '../game/levels/LevelConfig';
import { ParticleDefinition } from '../game/Particles';
import { GameSettings } from '../storage/Storage';

export type SynthEvent = 'sync' | 'nearMiss' | 'guard' | 'level' | 'collision';

export class ExperimentalSynth {
  private context?: AudioContext;
  private master?: GainNode;
  private droneGain?: GainNode;
  private acidGain?: GainNode;
  private textureGain?: GainNode;
  private percGain?: GainNode;
  private filter?: BiquadFilterNode;
  private panner?: StereoPannerNode;
  private delay?: DelayNode;
  private feedback?: GainNode;
  private drone?: OscillatorNode;
  private acid?: OscillatorNode;
  private fmCarrier?: OscillatorNode;
  private fmMod?: OscillatorNode;
  private fmModGain?: GainNode;
  private armed = false;
  private running = false;
  private levelRoot = 55;
  private stepTimer = 0;
  private stepIndex = 0;
  private currentLevel = 0;
  private runSeed = Math.random();
  private liquidTimer = 0;
  private arpPattern = [0, 3, 5, 7, 10, 12, 15, 19];

  async setEnabled(enabled: boolean, settings: GameSettings): Promise<void> {
    this.armed = enabled;
    if (!enabled) {
      this.stop();
      return;
    }
    this.applySettings(settings);
  }

  async ensureStarted(settings: GameSettings): Promise<void> {
    if (!this.armed) return;
    if (!this.context) this.createGraph();
    if (!this.context || !this.master) return;
    if (this.context.state !== 'running') await this.context.resume();
    if (!this.running) {
      this.runSeed = Math.random();
      this.stepIndex = 0;
      this.stepTimer = 0;
      this.liquidTimer = 1.8 + Math.random() * 2.2;
    }
    this.applySettings(settings);
    this.running = true;
  }

  applySettings(settings: GameSettings): void {
    if (!this.context || !this.master) return;
    const now = this.context.currentTime;
    this.master.gain.setTargetAtTime(settings.synthMasterVolume, now, 0.04);
    this.droneGain?.gain.setTargetAtTime(settings.synthDroneVolume * 0.18, now, 0.08);
    this.acidGain?.gain.setTargetAtTime(settings.synthAcidVolume * 0.22, now, 0.04);
    this.textureGain?.gain.setTargetAtTime(settings.synthTextureVolume * 0.16, now, 0.05);
    this.percGain?.gain.setTargetAtTime(settings.synthPercussionVolume * 0.4, now, 0.03);
    this.feedback?.gain.setTargetAtTime(settings.synthEffectsAmount * 0.42, now, 0.05);
  }

  update(dt: number, level: LevelConfig, speed: number, steering: number, shieldActive: boolean, particle: ParticleDefinition): void {
    if (!this.running || !this.context || !this.filter || !this.panner) return;
    const now = this.context.currentTime;
    const speedRatio = Math.min(1, speed / 75);
    if (level.level !== this.currentLevel) this.applyLevelPreset(level, particle);
    this.levelRoot = 43.65 * Math.pow(2, ((level.level % 12) + (particle.id === 'higgs' ? 7 : 0)) / 12);
    const levelPressure = Math.min(1, level.level / 30);
    const wobble = Math.sin(now * (0.7 + levelPressure * 2.2) + this.runSeed * 12);
    this.panner.pan.setTargetAtTime(Math.max(-1, Math.min(1, steering + wobble * levelPressure * 0.28)), now, 0.04);
    this.filter.frequency.setTargetAtTime(180 + speedRatio * 2300 + Math.abs(steering) * 820 + levelPressure * 760 + wobble * 170, now, 0.035);
    this.filter.Q.setTargetAtTime(6 + speedRatio * 14 + levelPressure * 9, now, 0.05);
    this.fmMod?.frequency.setTargetAtTime(2.4 + levelPressure * 9 + speedRatio * 4 + Math.abs(wobble) * 2.4, now, 0.06);
    this.fmModGain?.gain.setTargetAtTime((70 + speedRatio * 420 + levelPressure * 280) * (shieldActive ? 0.5 : 1), now, 0.04);
    this.drone?.frequency.setTargetAtTime(this.levelRoot * (0.48 + levelPressure * 0.08), now, 0.12);
    this.droneGain?.gain.setTargetAtTime((shieldActive ? 0.24 : 0.1 + levelPressure * 0.08), now, 0.08);

    this.stepTimer -= dt;
    this.liquidTimer -= dt;
    const tempo = 0.19 - speedRatio * 0.085 - levelPressure * 0.035;
    if (this.stepTimer <= 0) {
      this.stepTimer = Math.max(0.055, tempo);
      this.sequenceStep(speedRatio, levelPressure);
      if (Math.random() < levelPressure * 0.22) this.noiseHit(0.045 + levelPressure * 0.035, 650 + speedRatio * 2200);
    }
    if (this.liquidTimer <= 0) {
      this.liquidTimer = 1.2 + Math.random() * Math.max(0.45, 2.6 - levelPressure * 1.4);
      this.liquidSweep(speedRatio, levelPressure);
    }
  }

  trigger(event: SynthEvent): void {
    if (!this.running || !this.context || !this.master) return;
    if (event === 'sync') this.chime([0, 4, 7, 12, 16]);
    if (event === 'nearMiss') {
      this.noiseHit(0.09, 900);
      this.liquidSweep(0.6, 0.8);
    }
    if (event === 'guard') this.chime([0, 7, 14, 19]);
    if (event === 'level') {
      this.chime([0, 5, 9, 17, 24]);
      this.noiseHit(0.16, 1400);
    }
    if (event === 'collision') this.noiseHit(0.24, 110);
  }

  resetPreset(): void {
    this.stepIndex = 0;
    this.stepTimer = 0;
    this.currentLevel = 0;
    this.levelRoot = 55;
  }

  stop(): void {
    this.armed = false;
    this.stopPlayback();
  }

  stopPlayback(): void {
    this.running = false;
    this.currentLevel = 0;
    this.drone?.stop();
    this.acid?.stop();
    this.fmCarrier?.stop();
    this.fmMod?.stop();
    this.context?.close();
    this.context = undefined;
    this.master = undefined;
    this.drone = undefined;
    this.acid = undefined;
    this.fmCarrier = undefined;
    this.fmMod = undefined;
  }

  private createGraph(): void {
    const AudioCtor = window.AudioContext || window.webkitAudioContext;
    this.context = new AudioCtor();
    this.master = this.context.createGain();
    this.droneGain = this.context.createGain();
    this.acidGain = this.context.createGain();
    this.textureGain = this.context.createGain();
    this.percGain = this.context.createGain();
    this.filter = this.context.createBiquadFilter();
    this.panner = this.context.createStereoPanner();
    this.delay = this.context.createDelay(0.8);
    this.feedback = this.context.createGain();
    this.filter.type = 'lowpass';
    this.delay.delayTime.value = 0.27;
    this.delay.connect(this.feedback);
    this.feedback.connect(this.delay);
    this.droneGain.connect(this.master);
    this.acidGain.connect(this.filter);
    this.textureGain.connect(this.filter);
    this.percGain.connect(this.master);
    this.filter.connect(this.panner);
    this.panner.connect(this.master);
    this.panner.connect(this.delay);
    this.delay.connect(this.master);
    this.master.connect(this.context.destination);

    this.drone = this.context.createOscillator();
    this.drone.type = 'sine';
    this.drone.frequency.value = 55;
    this.drone.connect(this.droneGain);
    this.drone.start();

    this.acid = this.context.createOscillator();
    this.acid.type = 'sawtooth';
    this.acid.frequency.value = 110;
    this.acid.connect(this.acidGain);
    this.acid.start();

    this.fmCarrier = this.context.createOscillator();
    this.fmMod = this.context.createOscillator();
    this.fmModGain = this.context.createGain();
    this.fmCarrier.type = 'triangle';
    this.fmMod.type = 'sine';
    this.fmCarrier.frequency.value = 220;
    this.fmMod.frequency.value = 3.7;
    this.fmMod.connect(this.fmModGain);
    this.fmModGain.connect(this.fmCarrier.frequency);
    this.fmCarrier.connect(this.textureGain);
    this.fmCarrier.start();
    this.fmMod.start();
  }

  private applyLevelPreset(level: LevelConfig, particle: ParticleDefinition): void {
    this.currentLevel = level.level;
    const patternBank = [
      [0, 3, 5, 7, 10, 12, 15, 19],
      [0, 2, 7, 9, 12, 14, 19, 22],
      [0, 5, 6, 10, 12, 17, 18, 24],
      [0, 1, 7, 8, 13, 14, 20, 25]
    ];
    const index = Math.floor((level.level + this.runSeed * 9 + (particle.id === 'higgs' ? 1 : 0)) % patternBank.length);
    this.arpPattern = patternBank[index];
    this.stepIndex = Math.floor(this.runSeed * this.arpPattern.length);
    if (!this.context) return;
    const now = this.context.currentTime;
    this.delay?.delayTime.setTargetAtTime(0.18 + (level.level % 6) * 0.045, now, 0.08);
    this.feedback?.gain.setTargetAtTime(0.18 + Math.min(0.38, level.level * 0.012), now, 0.08);
  }

  private sequenceStep(speedRatio: number, levelPressure: number): void {
    if (!this.context || !this.acid || !this.fmCarrier) return;
    const note = this.arpPattern[this.stepIndex % this.arpPattern.length] + (this.stepIndex % 4 === 0 ? 12 : 0);
    const mutation = Math.random() < levelPressure * 0.18 ? (Math.random() > 0.5 ? 5 : -2) : 0;
    const freq = this.levelRoot * Math.pow(2, (note + mutation) / 12);
    const now = this.context.currentTime;
    this.acid.frequency.setTargetAtTime(freq, now, 0.015);
    this.fmCarrier.frequency.setTargetAtTime(freq * (1.35 + speedRatio * 0.7 + levelPressure * 0.35), now, 0.03);
    this.stepIndex += 1;
  }

  private liquidSweep(speedRatio: number, levelPressure: number): void {
    if (!this.context || !this.textureGain) return;
    const now = this.context.currentTime;
    const osc = this.context.createOscillator();
    const gain = this.context.createGain();
    const pan = this.context.createStereoPanner();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(this.levelRoot * (4 + levelPressure * 2), now);
    osc.frequency.exponentialRampToValueAtTime(this.levelRoot * (0.9 + speedRatio), now + 0.32);
    pan.pan.setValueAtTime(Math.random() * 2 - 1, now);
    pan.pan.linearRampToValueAtTime(Math.random() * 2 - 1, now + 0.32);
    gain.gain.setValueAtTime(0.0001, now);
    gain.gain.exponentialRampToValueAtTime(0.08 + levelPressure * 0.08, now + 0.035);
    gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.34);
    osc.connect(pan);
    pan.connect(gain);
    gain.connect(this.textureGain);
    osc.start(now);
    osc.stop(now + 0.36);
  }

  private chime(intervals: number[]): void {
    if (!this.context || !this.textureGain) return;
    const now = this.context.currentTime;
    intervals.forEach((interval, index) => {
      const osc = this.context!.createOscillator();
      const gain = this.context!.createGain();
      osc.type = 'sine';
      osc.frequency.value = this.levelRoot * Math.pow(2, interval / 12);
      gain.gain.setValueAtTime(0.0001, now + index * 0.035);
      gain.gain.exponentialRampToValueAtTime(0.16, now + index * 0.035 + 0.01);
      gain.gain.exponentialRampToValueAtTime(0.0001, now + index * 0.035 + 0.32);
      osc.connect(gain);
      gain.connect(this.textureGain!);
      osc.start(now + index * 0.035);
      osc.stop(now + index * 0.035 + 0.34);
    });
  }

  private noiseHit(duration: number, cutoff: number): void {
    if (!this.context || !this.percGain) return;
    const buffer = this.context.createBuffer(1, this.context.sampleRate * duration, this.context.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < data.length; i += 1) data[i] = (Math.random() * 2 - 1) * (1 - i / data.length);
    const source = this.context.createBufferSource();
    const filter = this.context.createBiquadFilter();
    filter.type = 'bandpass';
    filter.frequency.value = cutoff;
    filter.Q.value = 12;
    source.buffer = buffer;
    source.connect(filter);
    filter.connect(this.percGain);
    source.start();
  }
}
