export type SfxEvent = 'sync' | 'guard' | 'nearMiss' | 'hit' | 'gameOver';

export class SfxEngine {
  private context?: AudioContext;
  private master?: GainNode;
  private limiter?: DynamicsCompressorNode;
  private muted = false;
  private volume = 0.72;

  async ensureStarted(): Promise<void> {
    if (!this.context) {
      const AudioCtor = window.AudioContext || window.webkitAudioContext;
      this.context = new AudioCtor();
      this.master = this.context.createGain();
      this.limiter = this.context.createDynamicsCompressor();
      this.limiter.threshold.value = -10;
      this.limiter.knee.value = 8;
      this.limiter.ratio.value = 8;
      this.limiter.attack.value = 0.003;
      this.limiter.release.value = 0.12;
      this.master.gain.value = this.muted ? 0 : this.volume * 1.85;
      this.master.connect(this.limiter);
      this.limiter.connect(this.context.destination);
    }
    if (this.context.state !== 'running') await this.context.resume();
  }

  setMuted(muted: boolean): void {
    this.muted = muted;
    if (this.master && this.context) {
      this.master.gain.setTargetAtTime(muted ? 0 : this.volume * 1.85, this.context.currentTime, 0.025);
    }
  }

  setVolume(volume: number): void {
    this.volume = Math.max(0, Math.min(1, volume));
    if (this.master && this.context) {
      this.master.gain.setTargetAtTime(this.muted ? 0 : this.volume * 1.85, this.context.currentTime, 0.025);
    }
  }

  play(event: SfxEvent): void {
    if (!this.context || !this.master || this.muted) return;
    if (event === 'sync') this.chime([880, 1320, 1760], 0.19, '#sync');
    if (event === 'guard') this.chime([392, 523.25, 783.99], 0.26, '#guard');
    if (event === 'nearMiss') this.zap(980, 2200, 0.09, 0.13);
    if (event === 'hit') this.noiseBurst(0.12, 180, 0.22);
    if (event === 'gameOver') {
      this.zap(220, 58, 0.42, 0.2);
      window.setTimeout(() => this.noiseBurst(0.18, 90, 0.15), 70);
    }
  }

  private chime(frequencies: number[], duration: number, profile: '#sync' | '#guard'): void {
    if (!this.context || !this.master) return;
    const now = this.context.currentTime;
    frequencies.forEach((frequency, index) => {
      const osc = this.context!.createOscillator();
      const gain = this.context!.createGain();
      const filter = this.context!.createBiquadFilter();
      osc.type = profile === '#sync' ? 'triangle' : 'sine';
      osc.frequency.setValueAtTime(frequency, now + index * 0.028);
      osc.detune.setValueAtTime(profile === '#sync' ? 7 : -4, now);
      filter.type = 'bandpass';
      filter.frequency.value = frequency * 1.4;
      filter.Q.value = profile === '#sync' ? 10 : 7;
      gain.gain.setValueAtTime(0.0001, now + index * 0.028);
      gain.gain.exponentialRampToValueAtTime(profile === '#sync' ? 0.16 : 0.13, now + index * 0.028 + 0.012);
      gain.gain.exponentialRampToValueAtTime(0.0001, now + index * 0.028 + duration);
      osc.connect(filter);
      filter.connect(gain);
      gain.connect(this.master!);
      osc.start(now + index * 0.028);
      osc.stop(now + index * 0.028 + duration + 0.03);
    });
  }

  private zap(from: number, to: number, duration: number, gainPeak: number): void {
    if (!this.context || !this.master) return;
    const now = this.context.currentTime;
    const osc = this.context.createOscillator();
    const gain = this.context.createGain();
    const filter = this.context.createBiquadFilter();
    osc.type = 'sawtooth';
    osc.frequency.setValueAtTime(from, now);
    osc.frequency.exponentialRampToValueAtTime(Math.max(24, to), now + duration);
    filter.type = 'lowpass';
    filter.frequency.setValueAtTime(Math.max(from, to) * 1.7, now);
    filter.Q.value = 9;
    gain.gain.setValueAtTime(0.0001, now);
    gain.gain.exponentialRampToValueAtTime(gainPeak, now + 0.012);
    gain.gain.exponentialRampToValueAtTime(0.0001, now + duration);
    osc.connect(filter);
    filter.connect(gain);
    gain.connect(this.master);
    osc.start(now);
    osc.stop(now + duration + 0.03);
  }

  private noiseBurst(duration: number, cutoff: number, gainPeak: number): void {
    if (!this.context || !this.master) return;
    const buffer = this.context.createBuffer(1, Math.max(1, Math.floor(this.context.sampleRate * duration)), this.context.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < data.length; i += 1) {
      data[i] = (Math.random() * 2 - 1) * (1 - i / data.length);
    }
    const source = this.context.createBufferSource();
    const filter = this.context.createBiquadFilter();
    const gain = this.context.createGain();
    filter.type = 'bandpass';
    filter.frequency.value = cutoff;
    filter.Q.value = 10;
    gain.gain.setValueAtTime(gainPeak, this.context.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.0001, this.context.currentTime + duration);
    source.buffer = buffer;
    source.connect(filter);
    filter.connect(gain);
    gain.connect(this.master);
    source.start();
  }
}

declare global {
  interface Window {
    webkitAudioContext?: typeof AudioContext;
  }
}
