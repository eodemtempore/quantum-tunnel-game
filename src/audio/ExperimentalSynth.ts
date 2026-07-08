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
  private enabled = false;
  private levelRoot = 55;
  private stepTimer = 0;
  private stepIndex = 0;

  async setEnabled(enabled: boolean, settings: GameSettings): Promise<void> {
    this.enabled = enabled;
    if (!enabled) {
      this.stop();
      return;
    }
    await this.ensureStarted(settings);
  }

  async ensureStarted(settings: GameSettings): Promise<void> {
    if (!this.context) this.createGraph();
    if (!this.context || !this.master) return;
    if (this.context.state !== 'running') await this.context.resume();
    this.applySettings(settings);
    this.enabled = true;
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
    if (!this.enabled || !this.context || !this.filter || !this.panner) return;
    const now = this.context.currentTime;
    const speedRatio = Math.min(1, speed / 75);
    this.levelRoot = 43.65 * Math.pow(2, ((level.level % 12) + (particle.id === 'higgs' ? 7 : 0)) / 12);
    this.panner.pan.setTargetAtTime(Math.max(-1, Math.min(1, steering)), now, 0.04);
    this.filter.frequency.setTargetAtTime(220 + speedRatio * 1900 + Math.abs(steering) * 720, now, 0.035);
    this.filter.Q.setTargetAtTime(7 + speedRatio * 12, now, 0.05);
    this.fmModGain?.gain.setTargetAtTime((80 + speedRatio * 360) * (shieldActive ? 0.55 : 1), now, 0.04);
    this.droneGain?.gain.setTargetAtTime((shieldActive ? 0.24 : 0.12), now, 0.08);

    this.stepTimer -= dt;
    const tempo = 0.18 - speedRatio * 0.08;
    if (this.stepTimer <= 0) {
      this.stepTimer = Math.max(0.075, tempo);
      this.sequenceStep(speedRatio);
    }
  }

  trigger(event: SynthEvent): void {
    if (!this.enabled || !this.context || !this.master) return;
    if (event === 'sync') this.chime([0, 4, 7, 12]);
    if (event === 'nearMiss') this.noiseHit(0.09, 900);
    if (event === 'guard') this.chime([0, 7, 14]);
    if (event === 'level') this.chime([0, 5, 9, 17]);
    if (event === 'collision') this.noiseHit(0.22, 120);
  }

  resetPreset(): void {
    this.stepIndex = 0;
    this.stepTimer = 0;
    this.levelRoot = 55;
  }

  stop(): void {
    this.enabled = false;
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

  private sequenceStep(speedRatio: number): void {
    if (!this.context || !this.acid || !this.fmCarrier) return;
    const scale = [0, 3, 5, 7, 10, 12, 15, 19];
    const note = scale[this.stepIndex % scale.length] + (this.stepIndex % 4 === 0 ? 12 : 0);
    const freq = this.levelRoot * Math.pow(2, note / 12);
    const now = this.context.currentTime;
    this.acid.frequency.setTargetAtTime(freq, now, 0.015);
    this.fmCarrier.frequency.setTargetAtTime(freq * (1.5 + speedRatio * 0.5), now, 0.03);
    this.stepIndex += 1;
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
