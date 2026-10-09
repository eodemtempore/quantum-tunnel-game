export type MusicalSection = 'intro' | 'groove' | 'build' | 'peak' | 'breath';
export type Quantization = 'sixteenth' | 'beat' | 'bar';

export interface MusicalPosition {
  step: number;
  bar: number;
  beat: number;
  sixteenth: number;
  phraseStep: number;
}

type ScheduledCallback = (time: number, position: MusicalPosition) => void;

export class MusicTransport {
  private context?: AudioContext;
  private timer?: number;
  private nextStepTime = 0;
  private nextStep = 0;
  private bpm = 110;
  private targetBpm = 110;
  private callback?: ScheduledCallback;
  private scheduled = new Map<number, ScheduledCallback[]>();

  start(context: AudioContext, callback: ScheduledCallback, initialBpm: number): void {
    this.context = context;
    this.callback = callback;
    if (this.timer !== undefined) return;
    if (this.nextStepTime <= context.currentTime) this.nextStepTime = context.currentTime + 0.045;
    if (this.nextStep === 0) {
      this.bpm = initialBpm;
      this.targetBpm = initialBpm;
    }
    this.timer = window.setInterval(() => this.tick(), 25);
    this.tick();
  }

  setTargetBpm(bpm: number): void {
    this.targetBpm = Math.max(88, Math.min(138, bpm));
  }

  schedule(quantization: Quantization, callback: ScheduledCallback): void {
    const quantum = quantization === 'bar' ? 16 : quantization === 'beat' ? 4 : 1;
    let target = Math.ceil(this.nextStep / quantum) * quantum;
    if (target < this.nextStep) target += quantum;
    const callbacks = this.scheduled.get(target) ?? [];
    callbacks.push(callback);
    this.scheduled.set(target, callbacks);
  }

  stop(): void {
    if (this.timer !== undefined) window.clearInterval(this.timer);
    this.timer = undefined;
    this.scheduled.clear();
    this.callback = undefined;
  }

  reset(initialBpm = 110): void {
    this.stop();
    this.nextStep = 0;
    this.nextStepTime = 0;
    this.bpm = initialBpm;
    this.targetBpm = initialBpm;
  }

  getPosition(): MusicalPosition {
    const step = Math.max(0, this.nextStep - 1);
    return this.positionForStep(step);
  }

  private tick(): void {
    const context = this.context;
    const callback = this.callback;
    if (!context || !callback || context.state !== 'running') return;

    const horizon = context.currentTime + 0.13;
    let scheduledCount = 0;
    while (this.nextStepTime < horizon && scheduledCount < 12) {
      if (this.nextStep % 16 === 0) {
        this.bpm += Math.max(-2, Math.min(2, this.targetBpm - this.bpm));
      }
      const position = this.positionForStep(this.nextStep);
      callback(this.nextStepTime, position);
      const callbacks = this.scheduled.get(this.nextStep);
      if (callbacks) {
        callbacks.forEach((scheduledCallback) => scheduledCallback(this.nextStepTime, position));
        this.scheduled.delete(this.nextStep);
      }
      this.nextStepTime += 60 / this.bpm / 4;
      this.nextStep += 1;
      scheduledCount += 1;
    }
  }

  private positionForStep(step: number): MusicalPosition {
    return {
      step,
      bar: Math.floor(step / 16),
      beat: Math.floor((step % 16) / 4),
      sixteenth: step % 4,
      phraseStep: step % 64
    };
  }
}
