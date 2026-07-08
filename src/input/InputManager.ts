export interface InputOptions {
  laneMode: boolean;
  tiltEnabled: boolean;
}

export interface TiltDebugState {
  permission: PermissionState | 'unsupported' | 'unknown';
  alpha: number;
  beta: number;
  gamma: number;
  calibratedBeta: number;
  calibratedGamma: number;
  steering: number;
  active: boolean;
}

const LANES = [-2.3, -1.15, 0, 1.15, 2.3];
const TAU = Math.PI * 2;

export class InputManager {
  private container: HTMLElement;
  private options: InputOptions;
  private pointerActive = false;
  private startX = 0;
  private lastPointerX = 0;
  private currentX = 0;
  private currentAngle = Math.PI * -0.5;
  private laneIndex = 2;
  private keyboardDirection = 0;
  private tilt = 0;
  private requestedTilt = false;
  private tiltPermission: PermissionState | 'unsupported' | 'unknown' = 'unknown';
  private alpha = 0;
  private beta = 0;
  private gamma = 0;
  private calibratedBeta = 0;
  private calibratedGamma = 0;
  private mobileLike = false;

  constructor(container: HTMLElement, options: InputOptions) {
    this.container = container;
    this.options = options;
    this.mobileLike = window.matchMedia('(pointer: coarse)').matches || navigator.maxTouchPoints > 1;
    this.syncTiltPermissionFlag();
    this.attach();
  }

  setOptions(options: InputOptions): void {
    this.options = options;
    this.syncTiltPermissionFlag();
  }

  getTargetX(currentX: number, dt: number): number {
    if (this.options.laneMode) {
      if (this.keyboardDirection !== 0) {
        this.laneIndex = Math.max(0, Math.min(LANES.length - 1, this.laneIndex + this.keyboardDirection));
        this.keyboardDirection = 0;
      }
      return LANES[this.laneIndex];
    }

    const pointerTarget = this.pointerActive ? this.currentX : currentX + this.keyboardDirection * dt * 4.2;
    const tiltTarget = this.options.tiltEnabled ? this.tilt * 2.4 : 0;
    return Math.max(-2.65, Math.min(2.65, pointerTarget + tiltTarget));
  }

  getTargetAngle(currentAngle: number, dt: number): number {
    if (this.pointerActive) {
      return this.currentAngle;
    }

    const keyboardTarget = currentAngle + this.keyboardDirection * dt * 3.4;
    const tiltTarget = this.options.tiltEnabled && this.mobileLike ? this.tilt * dt * 12.5 : 0;
    this.currentAngle = this.normalizeAngle(keyboardTarget + tiltTarget);
    return this.currentAngle;
  }

  async requestTiltPermission(): Promise<boolean> {
    const orientation = window.DeviceOrientationEvent as unknown as {
      requestPermission?: () => Promise<PermissionState>;
    };
    const motion = window.DeviceMotionEvent as unknown as {
      requestPermission?: () => Promise<PermissionState>;
    };
    this.requestedTilt = true;
    const permissions: PermissionState[] = [];
    if (typeof orientation.requestPermission === 'function') {
      permissions.push(await orientation.requestPermission());
    }
    if (typeof motion.requestPermission === 'function') {
      permissions.push(await motion.requestPermission());
    }
    if (permissions.length > 0) {
      const granted = permissions.every((permission) => permission === 'granted');
      this.tiltPermission = granted ? 'granted' : 'denied';
      if (granted) this.recalibrateTilt();
      return granted;
    }
    this.tiltPermission = 'granted';
    this.recalibrateTilt();
    return true;
  }

  recalibrateTilt(): void {
    this.calibratedBeta = this.beta;
    this.calibratedGamma = this.gamma;
    this.tilt = 0;
  }

  getTiltDebug(): TiltDebugState {
    return {
      permission: this.tiltPermission,
      alpha: this.alpha,
      beta: this.beta,
      gamma: this.gamma,
      calibratedBeta: this.calibratedBeta,
      calibratedGamma: this.calibratedGamma,
      steering: this.tilt,
      active: this.options.tiltEnabled && this.requestedTilt && this.tiltPermission === 'granted'
    };
  }

  private attach(): void {
    this.container.addEventListener('pointerdown', (event) => {
      this.pointerActive = true;
      this.startX = event.clientX;
      this.lastPointerX = event.clientX;
      this.currentX = this.mapClientX(event.clientX);
      this.container.setPointerCapture(event.pointerId);
    });

    this.container.addEventListener('pointermove', (event) => {
      if (!this.pointerActive) return;
      this.currentX = this.mapClientX(event.clientX);
      const deltaX = event.clientX - this.lastPointerX;
      this.currentAngle = this.normalizeAngle(this.currentAngle + deltaX * 0.014);
      this.lastPointerX = event.clientX;
    });

    this.container.addEventListener('pointerup', (event) => {
      if (this.options.laneMode) {
        const delta = event.clientX - this.startX;
        if (Math.abs(delta) > 24) {
          this.laneIndex = Math.max(0, Math.min(LANES.length - 1, this.laneIndex + (delta > 0 ? 1 : -1)));
        }
      }
      this.pointerActive = false;
      this.container.releasePointerCapture(event.pointerId);
    });

    window.addEventListener('keydown', (event) => {
      if (event.key === 'ArrowLeft' || event.key.toLowerCase() === 'a') {
        this.keyboardDirection = this.options.laneMode ? -1 : -1;
      }
      if (event.key === 'ArrowRight' || event.key.toLowerCase() === 'd') {
        this.keyboardDirection = this.options.laneMode ? 1 : 1;
      }
    });

    window.addEventListener('keyup', (event) => {
      if (!this.options.laneMode && ['ArrowLeft', 'ArrowRight', 'a', 'A', 'd', 'D'].includes(event.key)) {
        this.keyboardDirection = 0;
      }
    });

    window.addEventListener('deviceorientation', (event) => {
      if (!this.options.tiltEnabled || !this.requestedTilt) return;
      this.alpha = event.alpha ?? 0;
      this.beta = event.beta ?? 0;
      this.gamma = event.gamma ?? 0;
      const orientationAngle = this.getScreenOrientationAngle();
      const gammaTilt = (this.gamma - this.calibratedGamma) / 9;
      const betaTilt = (this.beta - this.calibratedBeta) / 10;
      const landscapeSign = orientationAngle === 90 ? 1 : -1;
      const rawTilt = Math.abs(orientationAngle) === 90 ? betaTilt * landscapeSign + gammaTilt * 0.25 : gammaTilt;
      const targetTilt = Math.abs(rawTilt) < 0.018 ? 0 : Math.max(-1, Math.min(1, rawTilt * 1.7));
      this.tilt = this.tilt * 0.18 + targetTilt * 0.82;
    });
  }

  private mapClientX(clientX: number): number {
    const rect = this.container.getBoundingClientRect();
    const normalized = (clientX - rect.left) / rect.width;
    return (normalized - 0.5) * 5.3;
  }

  private normalizeAngle(angle: number): number {
    return ((angle % TAU) + TAU) % TAU;
  }

  private getScreenOrientationAngle(): number {
    const angle = window.screen.orientation?.angle ?? (window.orientation as number | undefined) ?? 0;
    if (angle === 270) return -90;
    if (angle === -270) return 90;
    return Math.round(angle / 90) * 90;
  }

  private syncTiltPermissionFlag(): void {
    const orientation = window.DeviceOrientationEvent as unknown as {
      requestPermission?: () => Promise<PermissionState>;
    };
    if (this.options.tiltEnabled && typeof orientation.requestPermission !== 'function') {
      this.requestedTilt = true;
      this.tiltPermission = 'granted';
    }
  }
}
