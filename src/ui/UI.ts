import { AudioState } from '../audio/AudioEngine';
import { PlaylistEntry } from '../audio/PlaylistManager';
import { HIGGS_UNLOCK_SCORE, PARTICLES, ParticleId } from '../game/Particles';
import { LevelConfig } from '../game/levels/LevelConfig';
import { GameSettings, ProfileStats } from '../storage/Storage';
import { AudioDebugState } from '../audio/AudioEngine';
import { TiltDebugState } from '../input/InputManager';

function escapeHtml(value: string): string {
  return value.replace(/[&<>"']/g, (char) => {
    const map: Record<string, string> = {
      '&': '&amp;',
      '<': '&lt;',
      '>': '&gt;',
      '"': '&quot;',
      "'": '&#39;'
    };
    return map[char] ?? char;
  });
}

export interface HudState {
  score: number;
  highScore: number;
  speed: number;
  level: LevelConfig;
  particleName: string;
  username: string;
  trackName: string;
  shieldRatio: number;
  shieldSeconds: number;
  syncSeconds: number;
  syncMultiplier: number;
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
  onSetExperimentalSynth: (enabled: boolean) => void;
  onSetUltraVisuals: (enabled: boolean) => void;
  onSetSynthControl: (key: string, value: number) => void;
  onResetSynthPreset: () => void;
  onRequestTilt: () => void;
  onRecalibrateTilt: () => void;
  onSetUsername: (username: string) => void;
  onSkipUsername: () => void;
  onFixAudio: () => void;
  onTestSound: () => void;
  onOpenAdmin: () => void;
  onTrackControl: (control: 'play' | 'pause' | 'restart') => void;
}

type MenuTab = 'particle' | 'music' | 'settings' | 'experimental';

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
  private username = 'Quantum Racer';
  private needsUsername = false;
  private usernameError = '';
  private profileStats: ProfileStats = {
    highestLevel: 1,
    totalSyncOrbs: 0,
    totalNearMisses: 0,
    highScoreName: 'Quantum Racer'
  };
  private audioDebug?: AudioDebugState;
  private tiltDebug?: TiltDebugState;

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
          <span>Racer</span>
          <strong>${escapeHtml(this.username)}</strong>
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
          ${this.renderTabButton('experimental', 'Experimental')}
        </div>
        <div class="tab-panel">
          ${this.needsUsername ? this.renderUsernamePrompt() : ''}
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
        <div><span>Level</span><strong data-hud-level>1. Quantum Awakening</strong><small data-hud-level-note></small></div>
        <div><span>Speed</span><strong data-hud-speed>0.0c</strong></div>
      </div>
      <div class="hud-bottom">
        <div><span>Particle</span><strong data-hud-particle>Proton</strong></div>
        <div><span>Racer</span><strong data-hud-user>Quantum Racer</strong></div>
        <div><span>Track</span><strong data-hud-track>Procedural</strong></div>
        <div class="guard-hud"><span>Guard</span><strong data-hud-shield>empty</strong></div>
        <div class="sync-hud"><span>Sync</span><strong data-hud-sync>empty</strong></div>
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
    this.setText('[data-hud-level-note]', `${state.level.act} · ${state.level.difficultyLabel} · ${state.level.signatureMechanic}`);
    this.setText('[data-hud-speed]', `${state.speed.toFixed(1)}c`);
    this.setText('[data-hud-particle]', state.particleName);
    this.setText('[data-hud-user]', state.username);
    this.setText('[data-hud-track]', state.trackName);
    this.setText('[data-hud-shield]', state.shieldRatio > 0 ? `${Math.ceil(state.shieldSeconds)}s` : 'empty');
    this.hud.querySelector('.guard-hud')?.classList.toggle('active', state.shieldRatio > 0);
    this.setText('[data-hud-sync]', state.syncSeconds > 0 ? `${state.syncMultiplier.toFixed(1)}x ${Math.ceil(state.syncSeconds)}s` : 'empty');
    this.hud.querySelector('.sync-hud')?.classList.toggle('active', state.syncSeconds > 0);
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
        <p class="run-summary">${escapeHtml(this.username)} reached ${Math.floor(finalScore).toLocaleString()}.</p>
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

  setRuntimeStatus(audioDebug: AudioDebugState, tiltDebug: TiltDebugState): void {
    this.audioDebug = audioDebug;
    this.tiltDebug = tiltDebug;
  }

  setProfile(username: string, needsUsername: boolean, stats: ProfileStats, error = ''): void {
    this.username = username;
    this.needsUsername = needsUsername;
    this.profileStats = stats;
    this.usernameError = error;
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
        <small>${locked ? `Locked until ${HIGGS_UNLOCK_SCORE.toLocaleString()} high score` : particle.description}</small>
        <span>Speed ${particle.speed.toFixed(2)} · Handling ${particle.agility.toFixed(2)} · Hitbox ${particle.hitboxLabel}</span>
        <span>Guard ${particle.shieldBehavior} · Score ×${particle.scoreMultiplier.toFixed(2)}</span>
        <span>${particle.difficulty}: ${particle.playstyle}</span>
      </button>
    `;
  }

  private renderTrack(track: PlaylistEntry): string {
    const title = escapeHtml(track.title);
    const artist = escapeHtml(track.artist);
    const mood = escapeHtml(track.mood);
    const id = escapeHtml(track.id);
    return `
      <button class="music-card ${this.selectedTrackId === track.id ? 'selected' : ''}" data-track="${id}">
        <strong>${title}</strong>
        <span>${artist} · ${mood}${track.bpm ? ` · ${track.bpm} BPM` : ''}</span>
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
    this.menu.querySelector('[data-fix-audio]')?.addEventListener('click', this.callbacks.onFixAudio);
    this.menu.querySelector('[data-test-sound]')?.addEventListener('click', this.callbacks.onTestSound);
    this.menu.querySelector<HTMLInputElement>('[data-lane]')?.addEventListener('change', (event) => {
      const input = event.currentTarget as HTMLInputElement;
      this.callbacks.onSetLaneMode(input.checked);
    });
    this.menu.querySelector<HTMLInputElement>('[data-haptics]')?.addEventListener('change', (event) => {
      const input = event.currentTarget as HTMLInputElement;
      this.callbacks.onSetHaptics(input.checked);
    });
    this.menu.querySelector<HTMLInputElement>('[data-synth-enabled]')?.addEventListener('change', (event) => {
      const input = event.currentTarget as HTMLInputElement;
      this.callbacks.onSetExperimentalSynth(input.checked);
    });
    this.menu.querySelector<HTMLInputElement>('[data-ultra-visuals]')?.addEventListener('change', (event) => {
      const input = event.currentTarget as HTMLInputElement;
      this.callbacks.onSetUltraVisuals(input.checked);
    });
    this.menu.querySelectorAll<HTMLInputElement>('[data-synth-control]').forEach((input) => {
      input.addEventListener('input', () => this.callbacks.onSetSynthControl(input.dataset.synthControl ?? '', Number(input.value) / 100));
    });
    this.menu.querySelector('[data-reset-synth]')?.addEventListener('click', this.callbacks.onResetSynthPreset);
    this.menu.querySelector('[data-tilt]')?.addEventListener('click', this.callbacks.onRequestTilt);
    this.menu.querySelector('[data-recalibrate-tilt]')?.addEventListener('click', this.callbacks.onRecalibrateTilt);
    this.menu.querySelectorAll<HTMLFormElement>('[data-username-form]').forEach((form) => {
      form.addEventListener('submit', (event) => {
        event.preventDefault();
        const data = new FormData(form);
        this.callbacks.onSetUsername(String(data.get('username') ?? ''));
      });
    });
    this.menu.querySelector('[data-skip-username]')?.addEventListener('click', this.callbacks.onSkipUsername);
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
    if (this.activeTab === 'experimental') return this.renderExperimentalTab();
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
      <div class="how-play-panel">
        <h3>Quantum Objects</h3>
        <p><strong>Blue Sync Orb:</strong> +500 points and 1.5x scoring for 6 seconds. HUD shows the countdown.</p>
        <p><strong>Green Guard:</strong> absorbs the next red obstacle hit while its timer is active. Duration depends on particle.</p>
        <p><strong>Red Obstacles:</strong> collision ends the run unless Guard is active. Close passes score near-miss points.</p>
        <p><strong>Levels:</strong> stages advance by score through Level 30, then Quantum Drift continues endlessly.</p>
        <p><strong>Higgs Boson:</strong> unlocks after ${HIGGS_UNLOCK_SCORE.toLocaleString()} high score.</p>
      </div>
      ${this.renderProfileCard()}
    `;
  }

  private renderUsernamePrompt(): string {
    return `
      <form class="profile-prompt" data-username-form>
        <strong>Choose your racer name</strong>
        <span>Stored locally on this device only. You can skip and use Quantum Racer.</span>
        <input name="username" autocomplete="nickname" maxlength="16" placeholder="Quantum Racer" />
        ${this.usernameError ? `<p class="warning">${escapeHtml(this.usernameError)}</p>` : ''}
        <div class="button-row compact">
          <button class="primary" type="submit">Save Name</button>
          <button class="secondary" type="button" data-skip-username>Skip</button>
        </div>
      </form>
    `;
  }

  private renderProfileCard(): string {
    const higgsUnlocked = this.unlocked.includes('higgs') ? 'Unlocked' : `Locked until ${HIGGS_UNLOCK_SCORE.toLocaleString()}`;
    return `
      <div class="profile-card">
        <h3>Profile</h3>
        <p><strong>${escapeHtml(this.username)}</strong> · ${escapeHtml(this.getParticleLabel(this.selectedParticle))}</p>
        <p>High score: ${Math.floor(this.highScore).toLocaleString()} by ${escapeHtml(this.profileStats.highScoreName)}</p>
        <p>Highest level: ${this.profileStats.highestLevel} · Higgs: ${higgsUnlocked}</p>
        <p>Sync Orbs: ${this.profileStats.totalSyncOrbs.toLocaleString()} · Near-misses: ${this.profileStats.totalNearMisses.toLocaleString()}</p>
        <p class="muted small">Username is stored locally on this device only.</p>
      </div>
    `;
  }

  private renderMusicTab(): string {
    return `
      <div class="section-title compact-title">
        <h2>Music</h2>
        <span>${escapeHtml(this.audioState.trackName)}</span>
      </div>
      <label class="select-box">
        <span>Built-in / admin playlist</span>
        <select data-track-select>
          ${this.playlist
            .map(
              (track) =>
                `<option value="${escapeHtml(track.id)}" ${this.selectedTrackId === track.id ? 'selected' : ''}>${escapeHtml(track.title)} · ${escapeHtml(track.mood)}${track.bpm ? ` · ${track.bpm} BPM` : ''}</option>`
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
      <div class="button-row compact">
        <button class="secondary" type="button" data-fix-audio>Play / Fix Audio</button>
        <button class="secondary" type="button" data-test-sound>Test Sound</button>
      </div>
      <label class="upload-box">
        <span>Upload from this browser/device</span>
        <input type="file" accept="audio/mpeg,audio/mp3,audio/wav,audio/x-m4a,audio/mp4,audio/ogg,audio/*" data-upload />
      </label>
      <p class="muted small">Admin URL paths must be reachable by this browser. Local laptop files need this upload picker.</p>
      <p class="muted small">${this.renderAudioDebug()}</p>
      ${this.audioState.error ? `<p class="warning">${escapeHtml(this.audioState.error)}</p>` : ''}
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
      <div class="button-row compact">
        <button class="secondary" type="button" data-tilt>${this.settings.tiltEnabled ? 'Disable Tilt' : 'Enable Tilt Steering'}</button>
        <button class="secondary" type="button" data-recalibrate-tilt>Recalibrate Tilt</button>
      </div>
      <form class="username-edit" data-username-form>
        <label>Edit Username<input name="username" maxlength="16" value="${escapeHtml(this.username)}" /></label>
        ${this.usernameError ? `<p class="warning">${escapeHtml(this.usernameError)}</p>` : ''}
        <button class="secondary wide" type="submit">Save Username</button>
      </form>
      <p class="guard-note">Tilt steering asks for iOS motion permission when supported. Touch and keyboard controls always remain available.</p>
      <p class="muted small">${this.renderTiltDebug()}</p>
    `;
  }

  private renderExperimentalTab(): string {
    return `
      <div class="section-title compact-title">
        <h2>Experimental</h2>
        <span>optional synth + ultra visuals</span>
      </div>
      <label class="toggle"><input type="checkbox" data-synth-enabled ${this.settings.experimentalSynthEnabled ? 'checked' : ''}/> Experimental Synth Mode</label>
      <label class="toggle"><input type="checkbox" data-ultra-visuals ${this.settings.ultraVisualsEnabled ? 'checked' : ''}/> Ultra / Psychedelic Visual Mode</label>
      <p class="muted small">Both experimental modes are isolated, optional, and can be switched off independently.</p>
      ${
        this.settings.experimentalSynthEnabled
          ? `<div class="synth-panel">
        <strong>Experimental Synth Controls</strong>
        <p class="warning small">Synth Mode replaces soundtrack playback while active. It starts when gameplay starts.</p>
        <p class="muted small">Experimental Synth Mode generates audio locally. Route your device/laptop audio output to a mixer or audio interface for live performance.</p>
        ${this.renderSynthSlider('Master', 'synthMasterVolume')}
        ${this.renderSynthSlider('Drone', 'synthDroneVolume')}
        ${this.renderSynthSlider('Acid Bass', 'synthAcidVolume')}
        ${this.renderSynthSlider('FM Texture', 'synthTextureVolume')}
        ${this.renderSynthSlider('Perc / Glitch', 'synthPercussionVolume')}
        ${this.renderSynthSlider('Effects', 'synthEffectsAmount')}
        <button class="secondary wide" type="button" data-reset-synth>Reset Synth Preset</button>
      </div>`
          : '<p class="muted small">Experimental Synth Mode is off. Normal default/uploaded music remains active.</p>'
      }
      <p class="guard-note">Ultra / Psychedelic Visual Mode changes the tunnel, HUD, buttons, colors, and pulses. Performance mode returns when switched off.</p>
    `;
  }

  private renderAudioDebug(): string {
    const debug = this.audioDebug;
    if (!debug) return 'Audio: not started yet.';
    return `Audio: ${escapeHtml(debug.contextState)} · media ${debug.hasMediaElement ? 'yes' : 'no'} · buffer ${debug.hasBuffer ? 'yes' : 'no'} · muted ${debug.muted ? 'yes' : 'no'} · volume ${Math.round(debug.volume * 100)}%`;
  }

  private renderSynthSlider(label: string, key: keyof GameSettings): string {
    const value = Math.round(Number(this.settings[key]) * 100);
    return `
      <label class="slider-row compact-slider">
        <span>${label} ${value}%</span>
        <input type="range" min="0" max="100" value="${value}" data-synth-control="${key}" />
      </label>
    `;
  }

  private renderTiltDebug(): string {
    const debug = this.tiltDebug;
    if (!debug) return 'Tilt: not active yet.';
    return `Tilt: ${debug.active ? 'active' : 'inactive'} · permission ${debug.permission} · beta ${debug.beta.toFixed(1)}/${debug.calibratedBeta.toFixed(1)} · gamma ${debug.gamma.toFixed(1)}/${debug.calibratedGamma.toFixed(1)} · steering ${debug.steering.toFixed(2)}`;
  }

  private setText(selector: string, value: string): void {
    const element = this.hud.querySelector(selector);
    if (element) element.textContent = value;
  }
}
