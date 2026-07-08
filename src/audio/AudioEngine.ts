import { LevelConfig } from '../game/levels/LevelConfig';
import { BassPattern, PlaylistEntry } from './PlaylistManager';

export interface AudioState {
  trackName: string;
  usingUpload: boolean;
  usingProcedural: boolean;
  error?: string;
}

type ScheduledNode = OscillatorNode | AudioBufferSourceNode;

export class AudioEngine {
  private context?: AudioContext;
  private master?: GainNode;
  private analyser?: AnalyserNode;
  private delay?: DelayNode;
  private delayFeedback?: GainNode;
  private analyserData = new Uint8Array(128);
  private schedulerTimer = 0;
  private nextBeatTime = 0;
  private beatIndex = 0;
  private intensity = 0.6;
  private muted = false;
  private volume = 0.72;
  private isPlaying = false;
  private proceduralActive = false;
  private proceduralBpm = 132;
  private proceduralRoot = 55;
  private proceduralMood = 'dark';
  private proceduralDrive = 1.18;
  private proceduralBassPattern: BassPattern = 'progressive';
  private proceduralArpEvery: 1 | 2 | 4 = 2;
  private audioElement?: HTMLAudioElement;
  private mediaSource?: MediaElementAudioSourceNode;
  private bufferSource?: AudioBufferSourceNode;
  private trackBuffer?: AudioBuffer;
  private trackStartedAt = 0;
  private trackOffset = 0;
  private trackPlaybackRate = 1;
  private activeNodes: ScheduledNode[] = [];
  private selectedTrack?: PlaylistEntry;
  private uploadUrl?: string;

  async ensureStarted(): Promise<void> {
    if (!this.context) {
      const AudioCtor = window.AudioContext || window.webkitAudioContext;
      this.context = new AudioCtor();
      this.master = this.context.createGain();
      this.analyser = this.context.createAnalyser();
      this.delay = this.context.createDelay(0.75);
      this.delayFeedback = this.context.createGain();
      this.analyser.fftSize = 256;
      this.master.gain.value = this.muted ? 0 : this.volume;
      this.delay.delayTime.value = 0.34;
      this.delayFeedback.gain.value = 0.22;
      this.delay.connect(this.delayFeedback);
      this.delayFeedback.connect(this.delay);
      this.delay.connect(this.master);
      this.master.connect(this.analyser);
      this.analyser.connect(this.context.destination);
    }

    if (this.context.state !== 'running') {
      await this.context.resume();
    }

    if (!this.schedulerTimer) {
      this.nextBeatTime = this.context.currentTime + 0.05;
      this.schedulerTimer = window.setInterval(() => this.scheduleProcedural(), 80);
    }
    this.isPlaying = true;
  }

  startTapPulse(): void {
    if (!this.context || !this.master || this.muted) return;
    const now = this.context.currentTime;
    const osc = this.context.createOscillator();
    const gain = this.context.createGain();
    osc.type = 'sawtooth';
    osc.frequency.setValueAtTime(220, now);
    osc.frequency.exponentialRampToValueAtTime(440, now + 0.09);
    gain.gain.setValueAtTime(0.001, now);
    gain.gain.exponentialRampToValueAtTime(0.12, now + 0.01);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.16);
    osc.connect(gain);
    gain.connect(this.master);
    if (this.delay) gain.connect(this.delay);
    osc.start(now);
    osc.stop(now + 0.18);
  }

  setMuted(muted: boolean): void {
    this.muted = muted;
    if (this.master) {
      this.master.gain.setTargetAtTime(muted ? 0 : this.volume, this.context?.currentTime ?? 0, 0.03);
    }
    if (this.audioElement) {
      this.audioElement.muted = muted;
    }
  }

  setVolume(volume: number): void {
    this.volume = Math.max(0, Math.min(1, volume));
    if (this.master) {
      this.master.gain.setTargetAtTime(this.muted ? 0 : this.volume, this.context?.currentTime ?? 0, 0.03);
    }
  }

  setLevel(level: LevelConfig, speedRatio: number): void {
    this.intensity = Math.min(1.8, level.musicIntensity + speedRatio * 0.34);
  }

  getEnergy(): number {
    if (!this.analyser) return 0.25 + Math.sin(performance.now() * 0.006) * 0.1;
    this.analyser.getByteFrequencyData(this.analyserData);
    let sum = 0;
    for (let i = 0; i < this.analyserData.length; i += 1) {
      sum += this.analyserData[i];
    }
    return Math.min(1, sum / (this.analyserData.length * 210));
  }

  async usePlaylistTrack(track: PlaylistEntry): Promise<AudioState> {
    this.selectedTrack = track;
    await this.ensureStarted();

    if (!track.url) {
      this.stopExternalTrack();
      this.configureProcedural(track);
      this.proceduralActive = true;
      this.isPlaying = true;
      this.scheduleProcedural();
      return this.getState();
    }

    try {
      this.proceduralActive = false;
      await this.loadExternalTrack(track.url, `${track.title} - ${track.artist}`);
      return this.getState();
    } catch (error) {
      this.stopExternalTrack();
      this.proceduralActive = false;
      this.isPlaying = false;
      return {
        ...this.getState(),
        error: `Could not play "${track.title}". No fallback audio was started.`
      };
    }
  }

  async useUpload(file: File): Promise<AudioState> {
    await this.ensureStarted();
    if (this.uploadUrl) {
      URL.revokeObjectURL(this.uploadUrl);
    }
    this.uploadUrl = URL.createObjectURL(file);
    this.selectedTrack = {
      id: 'upload',
      title: file.name,
      artist: 'Local upload',
      url: this.uploadUrl,
      mood: 'quantum',
      source: 'upload'
    };

    try {
      this.proceduralActive = false;
      const buffer = await this.decodeArrayBuffer(await file.arrayBuffer());
      this.trackPlaybackRate = 1;
      this.startBufferTrack(buffer, 0);
      return this.getState();
    } catch {
      this.stopExternalTrack();
      this.proceduralActive = false;
      this.isPlaying = false;
      return {
        ...this.getState(),
        error: 'This audio file could not be decoded here. No fallback audio was started.'
      };
    }
  }

  useProcedural(): AudioState {
    this.stopExternalTrack();
    this.selectedTrack = undefined;
    this.proceduralBpm = 132;
    this.proceduralRoot = 55;
    this.proceduralMood = 'quantum';
    this.proceduralDrive = 1.2;
    this.proceduralBassPattern = 'progressive';
    this.proceduralArpEvery = 2;
    this.proceduralActive = true;
    this.isPlaying = true;
    this.scheduleProcedural();
    return this.getState();
  }

  pauseTrack(): void {
    this.isPlaying = false;
    this.audioElement?.pause();
    if (this.bufferSource && this.context && this.trackBuffer) {
      this.trackOffset =
        (this.trackOffset + (this.context.currentTime - this.trackStartedAt) * this.trackPlaybackRate) % this.trackBuffer.duration;
      this.stopBufferSource();
    }
  }

  stopTrack(reset = false): void {
    this.isPlaying = false;
    this.audioElement?.pause();
    this.stopBufferSource();
    if (reset) {
      this.trackOffset = 0;
      this.trackPlaybackRate = 1;
      if (this.audioElement) {
        this.audioElement.currentTime = 0;
        this.audioElement.playbackRate = 1;
      }
    }
  }

  async playTrack(): Promise<void> {
    await this.ensureStarted();
    this.isPlaying = true;
    if (this.trackBuffer && !this.bufferSource) {
      this.startBufferTrack(this.trackBuffer, this.trackOffset);
    }
    if (this.audioElement) await this.audioElement.play();
    if (this.proceduralActive) this.scheduleProcedural();
  }

  restartTrack(): void {
    if (this.context) {
      this.beatIndex = 0;
      this.nextBeatTime = this.context.currentTime + 0.04;
    }
    this.isPlaying = true;
    if (this.trackBuffer) {
      this.trackPlaybackRate = 1;
      this.startBufferTrack(this.trackBuffer, 0);
    }
    if (this.audioElement) {
      this.audioElement.currentTime = 0;
      this.audioElement.playbackRate = 1;
      void this.audioElement.play();
    }
  }

  suspend(): void {
    this.isPlaying = false;
    this.audioElement?.pause();
    void this.context?.suspend();
  }

  private getState(): AudioState {
    return {
      trackName: this.selectedTrack ? this.selectedTrack.title : 'Procedural Soundtrack',
      usingUpload: this.selectedTrack?.source === 'upload',
      usingProcedural: this.proceduralActive
    };
  }

  private async loadExternalTrack(url: string, label: string): Promise<void> {
    this.stopExternalTrack();
    await this.ensureStarted();
    if (!this.context || !this.master) return;

    try {
      const response = await fetch(url, { cache: 'force-cache' });
      if (!response.ok) {
        throw new Error(`Audio request failed with ${response.status}`);
      }
      const buffer = await this.decodeArrayBuffer(await response.arrayBuffer());
      this.trackPlaybackRate = 1;
      this.startBufferTrack(buffer, 0);
      return;
    } catch (error) {
      console.info(`Web Audio buffer playback failed for ${label}; trying media element fallback.`, error);
    }

    const element = new Audio();
    element.src = url;
    element.loop = false;
    element.preload = 'auto';
    element.muted = this.muted;
    element.playbackRate = 1;
    element.addEventListener('ended', () => {
      if (!this.isPlaying || !this.audioElement) return;
      this.audioElement.currentTime = 0;
      this.audioElement.playbackRate = Math.min(1.18, this.audioElement.playbackRate + 0.025);
      void this.audioElement.play();
    });
    this.audioElement = element;
    this.mediaSource = this.context.createMediaElementSource(element);
    this.mediaSource.connect(this.master);
    this.isPlaying = true;
    await element.play();
    element.title = label;
  }

  private stopExternalTrack(): void {
    this.stopBufferSource();
    this.trackBuffer = undefined;
    this.trackOffset = 0;
    this.trackPlaybackRate = 1;
    if (this.audioElement) {
      this.audioElement.pause();
      this.audioElement.src = '';
      this.audioElement.load();
    }
    this.mediaSource?.disconnect();
    this.mediaSource = undefined;
    this.audioElement = undefined;
  }

  private async decodeArrayBuffer(arrayBuffer: ArrayBuffer): Promise<AudioBuffer> {
    await this.ensureStarted();
    if (!this.context) {
      throw new Error('Audio context is not available.');
    }
    return await this.context.decodeAudioData(arrayBuffer.slice(0));
  }

  private startBufferTrack(buffer: AudioBuffer, offset: number): void {
    if (!this.context || !this.master) return;
    this.stopBufferSource();
    this.proceduralActive = false;
    this.trackBuffer = buffer;
    this.trackOffset = Math.max(0, Math.min(offset, buffer.duration - 0.01));
    const source = this.context.createBufferSource();
    source.buffer = buffer;
    source.loop = false;
    source.playbackRate.setValueAtTime(this.trackPlaybackRate, this.context.currentTime);
    source.onended = () => {
      if (this.bufferSource !== source) return;
      this.bufferSource = undefined;
      if (!this.isPlaying || !this.trackBuffer) return;
      this.trackOffset = 0;
      this.trackPlaybackRate = Math.min(1.18, this.trackPlaybackRate + 0.025);
      this.startBufferTrack(this.trackBuffer, 0);
    };
    source.connect(this.master);
    source.start(0, this.trackOffset);
    this.bufferSource = source;
    this.trackStartedAt = this.context.currentTime;
    this.isPlaying = true;
  }

  private stopBufferSource(): void {
    if (!this.bufferSource) return;
    this.bufferSource.onended = null;
    try {
      this.bufferSource.stop();
    } catch {
      // Already stopped.
    }
    this.bufferSource.disconnect();
    this.bufferSource = undefined;
  }

  private scheduleProcedural(): void {
    if (!this.context || !this.master || this.audioElement || this.trackBuffer || !this.isPlaying || !this.proceduralActive) return;
    const secondsPerStep = 60 / (this.proceduralBpm + this.intensity * 8) / 4;
    while (this.nextBeatTime < this.context.currentTime + 0.18) {
      const step = this.beatIndex % 16;
      if (step % 4 === 0) this.kick(this.nextBeatTime);
      if (this.shouldPlayBass(step)) this.bass(this.nextBeatTime, step);
      if (step % 2 === 1) this.hat(this.nextBeatTime, step === 7 || step === 15);
      if (step % this.proceduralArpEvery === 0) this.arpeggio(this.nextBeatTime, step);
      if (this.proceduralMood !== 'chill' && step === 15) this.glitch(this.nextBeatTime + secondsPerStep * 0.5);
      this.beatIndex += 1;
      this.nextBeatTime += secondsPerStep;
    }
  }

  private kick(time: number): void {
    if (!this.context || !this.master) return;
    const osc = this.context.createOscillator();
    const gain = this.context.createGain();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(118, time);
    osc.frequency.exponentialRampToValueAtTime(46, time + 0.16);
    gain.gain.setValueAtTime(0.001, time);
    gain.gain.exponentialRampToValueAtTime(0.9 * Math.min(1.3, this.intensity * this.proceduralDrive), time + 0.01);
    gain.gain.exponentialRampToValueAtTime(0.001, time + 0.24);
    osc.connect(gain);
    gain.connect(this.master);
    osc.start(time);
    osc.stop(time + 0.26);
    this.activeNodes.push(osc);
  }

  private bass(time: number, step: number): void {
    if (!this.context || !this.master) return;
    const osc = this.context.createOscillator();
    const sub = this.context.createOscillator();
    const filter = this.context.createBiquadFilter();
    const gain = this.context.createGain();
    const subGain = this.context.createGain();
    const notes = [this.proceduralRoot, this.proceduralRoot * 0.891, this.proceduralRoot * 1.189, this.proceduralRoot * 0.75];
    const accent = step === 2 || step === 10 ? 1 : 0.72;
    osc.type = 'sawtooth';
    osc.frequency.value = notes[step % notes.length];
    sub.type = 'sine';
    sub.frequency.value = osc.frequency.value * 0.5;
    filter.type = 'lowpass';
    filter.frequency.setValueAtTime(170 + this.intensity * 260 * this.proceduralDrive, time);
    filter.Q.value = 8;
    gain.gain.setValueAtTime(0.001, time);
    gain.gain.exponentialRampToValueAtTime(0.2 * this.intensity * this.proceduralDrive * accent, time + 0.018);
    gain.gain.exponentialRampToValueAtTime(0.001, time + 0.19);
    subGain.gain.setValueAtTime(0.001, time);
    subGain.gain.exponentialRampToValueAtTime(0.16 * this.intensity * this.proceduralDrive * accent, time + 0.02);
    subGain.gain.exponentialRampToValueAtTime(0.001, time + 0.22);
    osc.connect(filter);
    filter.connect(gain);
    gain.connect(this.master);
    sub.connect(subGain);
    subGain.connect(this.master);
    osc.start(time);
    sub.start(time);
    osc.stop(time + 0.22);
    sub.stop(time + 0.24);
    this.activeNodes.push(osc);
    this.activeNodes.push(sub);
  }

  private hat(time: number, open: boolean): void {
    if (!this.context || !this.master) return;
    const buffer = this.context.createBuffer(1, this.context.sampleRate * (open ? 0.18 : 0.045), this.context.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < data.length; i += 1) {
      data[i] = (Math.random() * 2 - 1) * (1 - i / data.length);
    }
    const source = this.context.createBufferSource();
    const filter = this.context.createBiquadFilter();
    const gain = this.context.createGain();
    source.buffer = buffer;
    filter.type = 'highpass';
    filter.frequency.value = 6000;
    gain.gain.value = (open ? 0.055 : 0.038) * this.intensity * Math.min(1.2, this.proceduralDrive);
    source.connect(filter);
    filter.connect(gain);
    gain.connect(this.master);
    source.start(time);
    this.activeNodes.push(source);
  }

  private arpeggio(time: number, step: number): void {
    if (!this.context || !this.master) return;
    const intervals = this.proceduralMood === 'quantum' ? [0, 3, 7, 10, 14, 17, 22, 24] : [0, 3, 7, 10, 12, 15, 19, 22];
    const interval = intervals[step % intervals.length];
    const osc = this.context.createOscillator();
    const filter = this.context.createBiquadFilter();
    const gain = this.context.createGain();
    osc.type = 'sawtooth';
    osc.frequency.value = this.proceduralRoot * 4 * 2 ** (interval / 12);
    filter.type = 'lowpass';
    filter.frequency.value = 950 + this.intensity * 1250;
    filter.Q.value = 5;
    gain.gain.setValueAtTime(0.001, time);
    gain.gain.exponentialRampToValueAtTime(0.052 * this.intensity * Math.min(1.3, this.proceduralDrive), time + 0.012);
    gain.gain.exponentialRampToValueAtTime(0.001, time + 0.13);
    osc.connect(filter);
    filter.connect(gain);
    gain.connect(this.master);
    if (this.delay) gain.connect(this.delay);
    osc.start(time);
    osc.stop(time + 0.16);
    this.activeNodes.push(osc);
  }

  private glitch(time: number): void {
    if (!this.context || !this.master) return;
    const osc = this.context.createOscillator();
    const gain = this.context.createGain();
    osc.type = 'square';
    osc.frequency.setValueAtTime(880 + Math.random() * 620, time);
    osc.frequency.exponentialRampToValueAtTime(120, time + 0.08);
    gain.gain.setValueAtTime(0.001, time);
    gain.gain.exponentialRampToValueAtTime(0.08 * this.intensity, time + 0.01);
    gain.gain.exponentialRampToValueAtTime(0.001, time + 0.08);
    osc.connect(gain);
    gain.connect(this.master);
    osc.start(time);
    osc.stop(time + 0.1);
    this.activeNodes.push(osc);
  }

  private configureProcedural(track: PlaylistEntry): void {
    this.proceduralBpm = track.bpm ?? 132;
    this.proceduralMood = track.mood;
    const roots: Record<string, number> = {
      dark: 49,
      fast: 55,
      chill: 43.65,
      boss: 58.27,
      quantum: 51.91
    };
    this.proceduralRoot = track.profile?.root ?? roots[track.mood] ?? 55;
    this.proceduralDrive = track.profile?.drive ?? 1.16;
    this.proceduralBassPattern = track.profile?.bassPattern ?? 'progressive';
    this.proceduralArpEvery = track.profile?.arpEvery ?? 2;
    if (this.delay && track.profile?.delayTime) {
      this.delay.delayTime.setTargetAtTime(track.profile.delayTime, this.context?.currentTime ?? 0, 0.02);
    }
    if (this.context) {
      this.beatIndex = 0;
      this.nextBeatTime = this.context.currentTime + 0.04;
    }
  }

  private shouldPlayBass(step: number): boolean {
    if (this.proceduralBassPattern === 'rolling') {
      return [1, 2, 3, 5, 6, 7, 9, 10, 11, 13, 14, 15].includes(step);
    }
    if (this.proceduralBassPattern === 'progressive') {
      return [2, 3, 6, 7, 10, 11, 14, 15].includes(step);
    }
    return [2, 6, 10, 14].includes(step);
  }
}

declare global {
  interface Window {
    webkitAudioContext?: typeof AudioContext;
  }
}
