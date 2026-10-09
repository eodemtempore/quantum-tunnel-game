import { GameSettings } from '../storage/Storage';
import { ParticleId } from '../game/Particles';
import { midiToFrequency } from './MusicTheory';

interface VoiceChannel {
  input: GainNode;
  filter: BiquadFilterNode;
  panner: StereoPannerNode;
  gain: GainNode;
  send: GainNode;
}

export interface VoicePerformance {
  time: number;
  particleId: ParticleId;
  speedRatio: number;
  steering: number;
  energy: number;
  tension: number;
  shieldActive: boolean;
}

export class SynthVoices {
  private channels: Record<'bass' | 'lead' | 'pad' | 'perc' | 'fx', VoiceChannel>;
  private activeSources = new Set<AudioScheduledSourceNode>();
  private noiseBuffer: AudioBuffer;

  constructor(
    private context: AudioContext,
    master: GainNode,
    delay: DelayNode,
    private delayFeedback: GainNode
  ) {
    this.channels = {
      bass: this.createChannel(master, delay, 'lowpass'),
      lead: this.createChannel(master, delay, 'lowpass'),
      pad: this.createChannel(master, delay, 'lowpass'),
      perc: this.createChannel(master, delay, 'lowpass'),
      fx: this.createChannel(master, delay, 'lowpass')
    };
    this.channels.bass.filter.frequency.value = 780;
    this.channels.bass.filter.Q.value = 1.65;
    this.channels.lead.filter.frequency.value = 3_600;
    this.channels.pad.filter.frequency.value = 1_300;
    this.channels.perc.filter.frequency.value = 12_000;
    this.channels.fx.filter.frequency.value = 2_100;
    this.noiseBuffer = this.createNoiseBuffer(0.5);
  }

  applySettings(settings: GameSettings): void {
    const now = this.context.currentTime;
    this.channels.pad.gain.gain.setTargetAtTime(settings.synthDroneVolume * 0.28, now, 0.08);
    this.channels.bass.gain.gain.setTargetAtTime(settings.synthAcidVolume * 0.68, now, 0.05);
    this.channels.lead.gain.gain.setTargetAtTime(settings.synthTextureVolume * 0.42, now, 0.05);
    this.channels.fx.gain.gain.setTargetAtTime(settings.synthTextureVolume * 0.2, now, 0.05);
    this.channels.perc.gain.gain.setTargetAtTime(settings.synthPercussionVolume * 0.92, now, 0.05);
    const effects = Math.max(0, Math.min(1, settings.synthEffectsAmount));
    this.delayFeedback.gain.setTargetAtTime(0.08 + effects * 0.24, now, 0.08);
    for (const channel of Object.values(this.channels)) {
      channel.send.gain.setTargetAtTime(effects * 0.11, now, 0.08);
    }
  }

  updatePerformance(performance: VoicePerformance): void {
    const { time, speedRatio, steering, energy, tension, shieldActive, particleId } = performance;
    const steeringAmount = Math.abs(steering);
    const characterBrightness = particleId === 'electron' ? 1.22 : particleId === 'neutron' ? 0.72 : particleId === 'higgs' ? 1.12 : 1;
    this.channels.lead.filter.frequency.setTargetAtTime((1_000 + speedRatio * 1_450 + energy * 1_050 + steeringAmount * 850) * characterBrightness, time, 0.09);
    this.channels.lead.filter.Q.setTargetAtTime(0.7 + tension * 3.2 + steeringAmount * 1.6, time, 0.12);
    this.channels.lead.panner.pan.setTargetAtTime(Math.max(-0.42, Math.min(0.42, steering * 0.28)), time, 0.12);
    this.channels.bass.filter.frequency.setTargetAtTime(620 + energy * 420 + (shieldActive ? 100 : 0), time, 0.12);
    this.channels.pad.filter.frequency.setTargetAtTime((800 + energy * 650 + (shieldActive ? 380 : 0)) * (particleId === 'neutron' ? 0.75 : 1), time, 0.2);
    this.channels.pad.panner.pan.setTargetAtTime(Math.max(-0.34, Math.min(0.34, steering * 0.18)), time, 0.2);
    this.channels.fx.filter.frequency.setTargetAtTime(1_200 + energy * 2_500, time, 0.14);
  }

  playKick(time: number, velocity: number): void {
    const oscillator = this.context.createOscillator();
    const envelope = this.context.createGain();
    oscillator.type = 'sine';
    oscillator.frequency.setValueAtTime(132, time);
    oscillator.frequency.exponentialRampToValueAtTime(42, time + 0.115);
    this.envelope(envelope, time, 0.008, Math.min(0.85, velocity * 0.82), 0.105, 0.12);
    oscillator.connect(envelope);
    envelope.connect(this.channels.perc.input);
    this.startSources([oscillator], time, 0.24, [envelope]);
  }

  playHat(time: number, velocity: number): void {
    this.playNoise(time, 0.042, velocity * 0.55, 7_500, 'highpass');
  }

  playSnare(time: number, velocity: number): void {
    this.playNoise(time, 0.14, velocity * 0.42, 1_800, 'bandpass');
    this.playKick(time, velocity * 0.28);
  }

  playBass(midi: number, time: number, duration: number, velocity: number, particleId: ParticleId): void {
    const frequency = midiToFrequency(midi);
    const envelope = this.context.createGain();
    const body = this.context.createOscillator();
    const sub = this.context.createOscillator();
    const subGain = this.context.createGain();
    body.type = particleId === 'neutron' ? 'triangle' : 'sawtooth';
    body.frequency.setValueAtTime(frequency, time);
    sub.type = 'sine';
    sub.frequency.setValueAtTime(frequency * 0.5, time);
    subGain.gain.value = particleId === 'neutron' ? 0.28 : 0.18;
    this.envelope(envelope, time, Math.min(0.025, duration * 0.22), velocity * 0.72, duration, 0.1);
    body.connect(envelope);
    sub.connect(subGain);
    subGain.connect(envelope);
    envelope.connect(this.channels.bass.input);
    this.startSources([body, sub], time, duration + 0.14, [envelope, subGain]);
  }

  playLead(midi: number, time: number, duration: number, velocity: number, pan: number, particleId: ParticleId): void {
    const frequency = midiToFrequency(midi);
    const carrier = this.context.createOscillator();
    const envelope = this.context.createGain();
    const notePan = this.context.createStereoPanner();
    const filter = this.context.createBiquadFilter();
    carrier.type = particleId === 'neutron' ? 'triangle' : 'sawtooth';
    carrier.frequency.setValueAtTime(frequency, time);
    filter.type = 'lowpass';
    filter.frequency.setValueAtTime(particleId === 'neutron' ? 1_800 : 1_650, time);
    filter.frequency.exponentialRampToValueAtTime(particleId === 'neutron' ? 3_400 : 7_200, time + Math.min(0.09, duration * 0.72));
    filter.Q.setValueAtTime(particleId === 'neutron' ? 1.1 : 5.2, time);
    notePan.pan.setValueAtTime(Math.max(-0.8, Math.min(0.8, pan)), time);
    this.envelope(envelope, time, 0.014, velocity * 0.62, duration, 0.12);
    carrier.connect(envelope);
    envelope.connect(filter);
    filter.connect(notePan);
    notePan.connect(this.channels.lead.input);

    const sources: OscillatorNode[] = [carrier];
    const nodes: AudioNode[] = [envelope, filter, notePan];
    if (particleId === 'electron' || particleId === 'higgs') {
      const modulator = this.context.createOscillator();
      const modDepth = this.context.createGain();
      modulator.type = 'sine';
      modulator.frequency.setValueAtTime(particleId === 'electron' ? 68 : 43, time);
      modDepth.gain.setValueAtTime(frequency * (particleId === 'electron' ? 0.1 : 0.055), time);
      modulator.connect(modDepth);
      modDepth.connect(carrier.frequency);
      sources.push(modulator);
      nodes.push(modDepth);
    }
    this.startSources(sources, time, duration + 0.14, nodes);
  }

  playPad(notes: number[], time: number, duration: number, velocity: number, particleId: ParticleId): void {
    const width = particleId === 'higgs' ? 0.52 : 0.3;
    notes.forEach((midi, index) => {
      const oscillator = this.context.createOscillator();
      const envelope = this.context.createGain();
      const pan = this.context.createStereoPanner();
      oscillator.type = particleId === 'neutron' ? 'sine' : 'triangle';
      oscillator.frequency.setValueAtTime(midiToFrequency(midi), time);
      oscillator.detune.setValueAtTime((index - (notes.length - 1) / 2) * (particleId === 'higgs' ? 4 : 2), time);
      pan.pan.setValueAtTime(notes.length > 1 ? ((index / (notes.length - 1)) * 2 - 1) * width : 0, time);
      this.envelope(envelope, time, 0.32, velocity * 0.28, duration, 0.4);
      oscillator.connect(envelope);
      envelope.connect(pan);
      pan.connect(this.channels.pad.input);
      this.startSources([oscillator], time, duration + 0.42, [envelope, pan]);
    });
  }

  playAccent(midi: number, time: number, velocity: number, particleId: ParticleId): void {
    this.playLead(midi, time, 0.24, velocity, 0.15, particleId);
  }

  playSweep(startMidi: number, endMidi: number, time: number, duration: number, velocity: number): void {
    const oscillator = this.context.createOscillator();
    const envelope = this.context.createGain();
    oscillator.type = 'sine';
    oscillator.frequency.setValueAtTime(midiToFrequency(startMidi), time);
    oscillator.frequency.exponentialRampToValueAtTime(midiToFrequency(endMidi), time + duration);
    this.envelope(envelope, time, 0.025, velocity * 0.44, duration, 0.14);
    oscillator.connect(envelope);
    envelope.connect(this.channels.fx.input);
    this.startSources([oscillator], time, duration + 0.16, [envelope]);
  }

  playImpact(time: number, particleId: ParticleId): void {
    this.playKick(time, 0.92);
    this.playNoise(time, 0.2, 0.52, 460, 'bandpass');
    this.playSweep(particleId === 'neutron' ? 43 : 50, 31, time, 0.24, 0.42);
  }

  stopAll(time = this.context.currentTime): void {
    for (const source of this.activeSources) {
      try {
        source.stop(Math.max(time, this.context.currentTime));
      } catch {
        // A source may have reached its scheduled end already.
      }
    }
  }

  disconnect(): void {
    this.stopAll();
    for (const channel of Object.values(this.channels)) {
      channel.input.disconnect();
      channel.filter.disconnect();
      channel.panner.disconnect();
      channel.gain.disconnect();
      channel.send.disconnect();
    }
  }

  private createChannel(master: GainNode, delay: DelayNode, filterType: BiquadFilterType): VoiceChannel {
    const input = this.context.createGain();
    const filter = this.context.createBiquadFilter();
    const panner = this.context.createStereoPanner();
    const gain = this.context.createGain();
    const send = this.context.createGain();
    filter.type = filterType;
    filter.Q.value = 0.72;
    input.connect(filter);
    filter.connect(panner);
    panner.connect(gain);
    gain.connect(master);
    panner.connect(send);
    send.connect(delay);
    return { input, filter, panner, gain, send };
  }

  private playNoise(time: number, duration: number, velocity: number, cutoff: number, filterType: BiquadFilterType): void {
    const source = this.context.createBufferSource();
    const filter = this.context.createBiquadFilter();
    const envelope = this.context.createGain();
    source.buffer = this.noiseBuffer;
    filter.type = filterType;
    filter.frequency.setValueAtTime(cutoff, time);
    filter.Q.setValueAtTime(filterType === 'bandpass' ? 1.2 : 0.7, time);
    const release = Math.min(0.055, duration * 0.6);
    this.envelope(envelope, time, 0.003, velocity, duration, release);
    source.connect(filter);
    filter.connect(envelope);
    envelope.connect(this.channels.perc.input);
    this.startSources([source], time, duration + release + 0.005, [filter, envelope]);
  }

  private envelope(gain: GainNode, time: number, attack: number, peak: number, sustain: number, release: number): void {
    const safePeak = Math.max(0.0002, peak);
    const end = time + Math.max(0.02, sustain);
    gain.gain.setValueAtTime(0.0001, time);
    gain.gain.linearRampToValueAtTime(safePeak, time + Math.max(0.003, attack));
    gain.gain.setValueAtTime(safePeak, end);
    gain.gain.exponentialRampToValueAtTime(0.0001, end + Math.max(0.035, release));
  }

  private startSources(sources: AudioScheduledSourceNode[], time: number, duration: number, nodes: AudioNode[]): void {
    const stopAt = time + Math.max(0.05, duration);
    sources.forEach((source) => {
      this.activeSources.add(source);
      source.onended = () => {
        this.activeSources.delete(source);
        source.disconnect();
      };
      source.start(time);
      source.stop(stopAt);
    });
    const lastSource = sources[sources.length - 1];
    if (lastSource) {
      const disconnect = lastSource.onended;
      lastSource.onended = (event) => {
        disconnect?.call(lastSource, event);
        nodes.forEach((node) => node.disconnect());
      };
    }
  }

  private createNoiseBuffer(duration: number): AudioBuffer {
    const buffer = this.context.createBuffer(1, Math.floor(this.context.sampleRate * duration), this.context.sampleRate);
    const data = buffer.getChannelData(0);
    for (let index = 0; index < data.length; index += 1) {
      const decay = 0.82 + 0.18 * Math.sin(index * 0.017);
      data[index] = (Math.random() * 2 - 1) * decay;
    }
    return buffer;
  }
}
