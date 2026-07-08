import { AudioState } from '../audio/AudioEngine';
import { PlaylistEntry } from '../audio/PlaylistManager';
import { HIGGS_UNLOCK_SCORE, PARTICLES, ParticleId } from '../game/Particles';
import { LevelConfig } from '../game/levels/LevelConfig';
import { GameSettings } from '../storage/Storage';

export interface HudState {
  score: number;
  highScore: number;
  speed: number;
  level: LevelConfig;
  particleName: string;
  trackName: string;
  shieldRatio: number;
  shieldSeconds: number;
  paused: boolean;
}

interface UICallbacks {
  onStart: () => void;
  onRestart: () => void;
  onPauseToggle: () => void;
  onExitGame: () => void;
  onShowMenu: () => void;
  onSelectParticle: (id: ParticleId) => void;
  onSelectTrack: (id: string) => void;
  onUploadTrack: (file: File) => void;
  onProcedural: () => void;
  onSetMuted: (muted: boolean) => void;
  onSetVolume: (volume: number) => void;
  onSetLaneMode: (laneMode: boolean) => void;
  onSetHaptics: (enabled: boolean) => void;
  onRequestTilt: () => void;
  onOpenAdmin: () => void;
  onTrackControl: (control: 'play' | 'pause' | 'restart') => void;
}

type MenuTab = 'particle' | 'music' | 'settings';

export class UI {
  private menu: HTMLDivElement;
  private hud: HTMLDivElement;
  private gameOver: HTMLDivElement;
  private toast: HTMLDivElement;
  private selectedParticle: ParticleId = 'proton';
  private selectedTrackId = 'default-track';
  private settings: GameSettings;
  private unlocked: ParticleId[] = [];
  private playlist: PlaylistEntry[] = [];
  private activeTab: MenuTab = 'particle';
  private highScore = 0;
  private audioState: AudioState = {
    trackName: 'Default Tunnel Track',
    usingUpload: false,
    usingProcedural: false
  };

  constructor(
    private root: HTMLElement,
    settings: GameSettings,
    private callbacks: UICallbacks
  ) {
    this.settings = settings;
    this.menu = document.createElement('div');
    this.hud = document.createElement('div');
    this.gameOver = document.createElement('div');
    this.toast = document.createElement('div');
    this.toast.className = 'toast hidden';
    this.root.append(this.menu, this.hud, this.gameOver, this.toast);
  }

  renderMenu(unlocked: ParticleId[], playlist: PlaylistEntry[], highScore: number): void {
    this.unlocked = unlocked;
    this.playlist = playlist;
    this.highScore = highScore;
    this.menu.className = 'screen menu-screen';
    this.hud.className = 'hud hidden';
    this.gameOver.className = 'screen hidden';
    this.menu.innerHTML = `
      <div class="hero-panel">
        <button class="gear" data-admin aria-label="Admin playlist">⚙</button>
        <div class="science-rain" aria-hidden="true">
          <span>ψ ∂ψ/∂t ℏ ∇² Ψ 101101 ΔxΔp ≥ ℏ/2</span>
          <span>E=mc² λ=h/p 010011 Φ Ω μ ν τ</span>
          <span>∑ |φ⟩ ⟨ψ| Hψ=iℏ∂tψ 001011</span>
          <span>α β γ δ η θ κ π σ χ 111001</span>
          <span>c²dt² dx² dy² dz² ∫ρ dV 010101</span>
          <span>QFT Λ Ξ ζ probability wave collapse</span>
        </div>
        <div class="equation-strip">
          <span>ψ(x,t)</span>
          <span>ℏω</span>
          <span>ΔEΔt</span>
          <span>E=mc²</span>
        </div>
        <p class="eyebrow">near-light particle racing</p>
        <h1>Quantum Tunnel</h1>
        <p class="subtitle">Race as a subatomic particle through a collapsing neon quantum field.</p>
        <div class="score-strip">
          <span>High Score</span>
          <strong>${Math.floor(highScore).toLocaleString()}</strong>
          <span>Higgs unlocks at ${HIGGS_UNLOCK_SCORE.toLocaleString()} · After Level 30: Quantum Drift endless mode</span>
        </div>
        <button class="primary start-button" data-start>Tap to Start</button>
      </div>
      <section class="menu-section cockpit-panel">
        <div class="tab-row" role="tablist" aria-label="Game setup">
          ${this.renderTabButton('particle', 'Particle')}
          ${this.renderTabButton('music', 'Music')}
          ${this.renderTabButton('settings', 'iPhone')}
        </div>
        <div class="tab-panel">
          ${this.renderActiveTab()}
        </div>
      </section>
    `;
    this.bindMenu();
  }

  showGameplay(): void {
    this.menu.classList.add('hidden');
    this.gameOver.classList.add('hidden');
    this.hud.className = 'hud';
    this.hud.innerHTML = `
      <button class="close-run" data-exit aria-label="Close game">×</button>
      <div class="hud-top">
        <div><span>Score</span><strong data-hud-score>0</strong></div>
        <div><span>Level</span><strong data-hud-level>1. Quantum Awakening</strong></div>
        <div><span>Speed</span><strong data-hud-speed>0.0c</strong></div>
      </div>
      <div class="hud-bottom">
        <div><span>Particle</span><strong data-hud-particle>Proton</strong></div>
        <div><span>Track</span><strong data-hud-track>Procedural</strong></div>
        <div class="guard-hud"><span>Guard</span><strong data-hud-shield>empty</strong></div>
        <div><span>High</span><strong data-hud-high>0</strong></div>
        <button class="pause-button" data-pause>Pause</button>
      </div>
    `;
    this.hud.querySelector('[data-pause]')?.addEventListener('click', this.callbacks.onPauseToggle);
    this.hud.querySelector('[data-exit]')?.addEventListener('click', this.callbacks.onExitGame);
  }

  updateHud(state: HudState): void {
    this.setText('[data-hud-score]', Math.floor(state.score).toLocaleString());
    this.setText('[data-hud-level]', `${state.level.level}. ${state.level.name}`);
    this.setText('[data-hud-speed]', `${state.speed.toFixed(1)}c`);
    this.setText('[data-hud-particle]', state.particleName);
    this.setText('[data-hud-track]', state.trackName);
    this.setText('[data-hud-shield]', state.shieldRatio > 0 ? `${Math.ceil(state.shieldSeconds)}s` : 'empty');
    this.hud.querySelector('.guard-hud')?.classList.toggle('active', state.shieldRatio > 0);
    this.setText('[data-hud-high]', Math.floor(state.highScore).toLocaleString());
    this.setText('[data-pause]', state.paused ? 'Resume' : 'Pause');
  }

  showGameOver(finalScore: number, highScore: number, level: LevelConfig, unlockMessage: string): void {
    this.hud.classList.add('hidden');
    this.gameOver.className = 'screen game-over-screen';
    this.gameOver.innerHTML = `
      <div class="panel game-over-panel">
        <p class="eyebrow">run collapsed</p>
        <h2>Game Over</h2>
        <div class="result-grid">
          <div><span>Final Score</span><strong>${Math.floor(finalScore).toLocaleString()}</strong></div>
          <div><span>High Score</span><strong>${Math.floor(highScore).toLocaleString()}</strong></div>
          <div><span>Level Reached</span><strong>${level.level}. ${level.name}</strong></div>
        </div>
        ${unlockMessage ? `<p class="unlock">${unlockMessage}</p>` : ''}
        <div class="button-row">
          <button class="primary" data-restart>Restart</button>
          <button class="secondary" data-menu>Change particle / music</button>
        </div>
      </div>
    `;
    this.gameOver.querySelector('[data-restart]')?.addEventListener('click', this.callbacks.onRestart);
    this.gameOver.querySelector('[data-menu]')?.addEventListener('click', this.callbacks.onShowMenu);
  }

  setAudioState(state: AudioState): void {
    this.audioState = state;
  }

  setSettings(settings: GameSettings): void {
    this.settings = settings;
  }

  setSelectedParticle(id: ParticleId): void {
    this.selectedParticle = id;
  }

  setSelectedTrack(id: string): void {
    this.selectedTrackId = id;
  }

  refreshPlaylist(playlist: PlaylistEntry[], unlocked: ParticleId[], highScore: number): void {
    this.renderMenu(unlocked, playlist, highScore);
  }

  notify(message: string): void {
    this.toast.textContent = message;
    this.toast.classList.remove('hidden');
    window.setTimeout(() => this.toast.classList.add('hidden'), 2400);
  }

  private renderParticleCard(id: ParticleId): string {
    const particle = PARTICLES.find((candidate) => candidate.id === id)!;
    const locked = !this.unlocked.includes(id);
    return `
      <button class="particle-card ${this.selectedParticle === id ? 'selected' : ''} ${locked ? 'locked' : ''}" data-particle="${id}" ${locked ? 'disabled' : ''}>
        <span class="particle-orb" style="--orb:${particle.glow}; --orb2:${particle.secondaryGlow}"></span>
        <strong>${particle.name}</strong>
        <small>${locked ? `Locked until ${HIGGS_UNLOCK_SCORE.toLocaleString()}` : particle.description}</small>
        <span>Agility ${particle.agility.toFixed(2)} · Guard ${particle.shieldDuration.toFixed(0)}s · ×${particle.scoreMultiplier.toFixed(2)}</span>
      </button>
    `;
  }

  private renderTrack(track: PlaylistEntry): string {
    return `
      <button class="music-card ${this.selectedTrackId === track.id ? 'selected' : ''}" data-track="${track.id}">
        <strong>${track.title}</strong>
        <span>${track.artist} · ${track.mood}${track.bpm ? ` · ${track.bpm} BPM` : ''}</span>
        <small>${track.source === 'admin' ? 'Admin-added local playlist' : 'Built-in game playlist'}</small>
      </button>
    `;
  }

  private bindMenu(): void {
    this.menu.querySelector('[data-start]')?.addEventListener('click', this.callbacks.onStart);
    this.menu.querySelector('[data-admin]')?.addEventListener('click', this.callbacks.onOpenAdmin);
    this.menu.querySelectorAll<HTMLButtonElement>('[data-tab]').forEach((button) => {
      button.addEventListener('click', () => {
        this.activeTab = button.dataset.tab as MenuTab;
        this.renderMenu(this.unlocked, this.playlist, this.highScore);
      });
    });
    this.menu.querySelectorAll<HTMLButtonElement>('[data-particle]').forEach((button) => {
      button.addEventListener('click', () => this.callbacks.onSelectParticle(button.dataset.particle as ParticleId));
    });
    this.menu.querySelectorAll<HTMLButtonElement>('[data-track]').forEach((button) => {
      button.addEventListener('click', () => this.callbacks.onSelectTrack(button.dataset.track ?? ''));
    });
    this.menu.querySelector<HTMLSelectElement>('[data-track-select]')?.addEventListener('change', (event) => {
      const select = event.currentTarget as HTMLSelectElement;
      this.callbacks.onSelectTrack(select.value);
    });
    this.menu.querySelector('[data-procedural]')?.addEventListener('click', this.callbacks.onProcedural);
    this.menu.querySelector('[data-default-track]')?.addEventListener('click', () => this.callbacks.onSelectTrack('default-track'));
    this.menu.querySelector<HTMLInputElement>('[data-upload]')?.addEventListener('change', (event) => {
      const input = event.currentTarget as HTMLInputElement;
      const file = input.files?.[0];
      if (file) this.callbacks.onUploadTrack(file);
    });
    this.menu.querySelector<HTMLInputElement>('[data-muted]')?.addEventListener('change', (event) => {
      const input = event.currentTarget as HTMLInputElement;
      this.callbacks.onSetMuted(input.checked);
    });
    this.menu.querySelector<HTMLInputElement>('[data-volume]')?.addEventListener('input', (event) => {
      const input = event.currentTarget as HTMLInputElement;
      this.callbacks.onSetVolume(Number(input.value) / 100);
    });
    this.menu.querySelector<HTMLInputElement>('[data-lane]')?.addEventListener('change', (event) => {
      const input = event.currentTarget as HTMLInputElement;
      this.callbacks.onSetLaneMode(input.checked);
    });
    this.menu.querySelector<HTMLInputElement>('[data-haptics]')?.addEventListener('change', (event) => {
      const input = event.currentTarget as HTMLInputElement;
      this.callbacks.onSetHaptics(input.checked);
    });
    this.menu.querySelector('[data-tilt]')?.addEventListener('click', this.callbacks.onRequestTilt);
    this.menu.querySelectorAll<HTMLButtonElement>('[data-track-control]').forEach((button) => {
      button.addEventListener('click', () => this.callbacks.onTrackControl(button.dataset.trackControl as 'play' | 'pause' | 'restart'));
    });
  }

  private getParticleLabel(id: ParticleId): string {
    return PARTICLES.find((particle) => particle.id === id)?.name ?? 'Proton';
  }

  private renderTabButton(tab: MenuTab, label: string): string {
    return `<button class="tab-button ${this.activeTab === tab ? 'selected' : ''}" data-tab="${tab}" role="tab">${label}</button>`;
  }

  private renderActiveTab(): string {
    if (this.activeTab === 'music') return this.renderMusicTab();
    if (this.activeTab === 'settings') return this.renderSettingsTab();
    return this.renderParticleTab();
  }

  private renderParticleTab(): string {
    return `
      <div class="section-title compact-title">
        <h2>Particle</h2>
        <span>${this.getParticleLabel(this.selectedParticle)}</span>
      </div>
      <div class="particle-grid compact-grid">
        ${PARTICLES.map((particle) => this.renderParticleCard(particle.id)).join('')}
      </div>
      <p class="guard-note">Guard activates when you collect the bright green horned token during a run. It lasts 15 seconds, shows a countdown, and absorbs the next red obstacle hit.</p>
    `;
  }

  private renderMusicTab(): string {
    return `
      <div class="section-title compact-title">
        <h2>Music</h2>
        <span>${this.audioState.trackName}</span>
      </div>
      <label class="select-box">
        <span>Built-in / admin playlist</span>
        <select data-track-select>
          ${this.playlist
            .map(
              (track) =>
                `<option value="${track.id}" ${this.selectedTrackId === track.id ? 'selected' : ''}>${track.title} · ${track.mood}${track.bpm ? ` · ${track.bpm} BPM` : ''}</option>`
            )
            .join('')}
        </select>
      </label>
      <div class="button-row compact-controls">
        <button class="secondary" data-default-track>Default</button>
        <button class="secondary" data-track-control="play">Play</button>
        <button class="secondary" data-track-control="pause">Pause</button>
        <button class="secondary" data-track-control="restart">Restart</button>
      </div>
      <label class="slider-row">
        <span>Volume ${Math.round(this.settings.volume * 100)}%</span>
        <input type="range" min="0" max="100" value="${Math.round(this.settings.volume * 100)}" data-volume />
      </label>
      <label class="toggle"><input type="checkbox" data-muted ${this.settings.muted ? 'checked' : ''}/> Mute audio</label>
      <label class="upload-box">
        <span>Upload from this browser/device</span>
        <input type="file" accept="audio/mpeg,audio/mp3,audio/wav,audio/x-m4a,audio/mp4,audio/ogg,audio/*" data-upload />
      </label>
      <p class="muted small">Admin URL paths must be reachable by this browser. Local laptop files need this upload picker.</p>
      ${this.audioState.error ? `<p class="warning">${this.audioState.error}</p>` : ''}
    `;
  }

  private renderSettingsTab(): string {
    return `
      <div class="section-title compact-title">
        <h2>iPhone Settings</h2>
        <span>landscape, 360 steering</span>
      </div>
      <label class="toggle"><input type="checkbox" data-lane ${this.settings.laneMode ? 'checked' : ''}/> Use 5-lane fallback instead of 360 steering</label>
      <label class="toggle"><input type="checkbox" data-haptics ${this.settings.hapticsEnabled ? 'checked' : ''}/> Haptics on obstacle impact</label>
      <button class="secondary wide" data-tilt>${this.settings.tiltEnabled ? 'Disable tilt steering' : 'Enable tilt steering'}</button>
      <p class="guard-note">Tilt steering asks for iOS motion permission when supported. Touch and keyboard controls always remain available.</p>
    `;
  }

  private setText(selector: string, value: string): void {
    const element = this.hud.querySelector(selector);
    if (element) element.textContent = value;
  }
}
