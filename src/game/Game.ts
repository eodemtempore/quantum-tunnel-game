import * as THREE from 'three';
import { AudioEngine } from '../audio/AudioEngine';
import { PlaylistEntry, PlaylistManager } from '../audio/PlaylistManager';
import { InputManager } from '../input/InputManager';
import { AdminPlaylist } from '../ui/AdminPlaylist';
import { UI } from '../ui/UI';
import { Storage } from '../storage/Storage';
import { GameSettings } from '../storage/Storage';
import { getParticle, HIGGS_UNLOCK_SCORE, ParticleDefinition, ParticleId } from './Particles';
import { Collectibles } from './Collectibles';
import { Obstacles } from './Obstacles';
import { Player } from './Player';
import { Tunnel } from './Tunnel';
import { getStageForScore, LEVELS, LevelConfig } from './levels/LevelConfig';

type GameMode = 'menu' | 'playing' | 'paused' | 'over';

export class Game {
  private shell!: HTMLDivElement;
  private canvasHost!: HTMLDivElement;
  private adminHost!: HTMLDivElement;
  private renderer!: THREE.WebGLRenderer;
  private resizeObserver?: ResizeObserver;
  private scene!: THREE.Scene;
  private camera!: THREE.PerspectiveCamera;
  private tunnel!: Tunnel;
  private player!: Player;
  private obstacles = new Obstacles();
  private collectibles = new Collectibles();
  private input!: InputManager;
  private ui!: UI;
  private admin!: AdminPlaylist;
  private audio = new AudioEngine();
  private playlist = new PlaylistManager();
  private mode: GameMode = 'menu';
  private particle: ParticleDefinition = getParticle('proton');
  private selectedTrack?: PlaylistEntry;
  private score = 0;
  private highScore = 0;
  private speed = 14;
  private elapsed = 0;
  private lastFrame = 0;
  private animationId = 0;
  private level: LevelConfig = LEVELS[0];
  private glitch = 0;
  private unlockMessage = '';
  private higgsAnnounced = false;
  private currentTrackName = 'Default Tunnel Track';
  private settings!: GameSettings;

  constructor(private root: HTMLElement) {}

  boot(): void {
    this.highScore = Storage.getHighScore();
    this.shell = document.createElement('div');
    this.shell.className = 'game-shell';
    this.canvasHost = document.createElement('div');
    this.canvasHost.className = 'canvas-host';
    this.adminHost = document.createElement('div');
    this.adminHost.className = 'admin-host hidden';
    this.shell.append(this.canvasHost);
    this.root.append(this.shell, this.adminHost);

    this.scene = new THREE.Scene();
    this.scene.background = new THREE.Color(this.level.palette.background);
    this.scene.fog = new THREE.FogExp2(this.level.palette.background, 0.018);
    this.camera = new THREE.PerspectiveCamera(66, 1, 0.1, 140);
    this.camera.position.set(0, 0.1, 7.2);
    this.camera.lookAt(0, -0.7, -16);

    this.renderer = new THREE.WebGLRenderer({ antialias: false, alpha: false, powerPreference: 'high-performance' });
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 1.6));
    this.renderer.setSize(this.canvasHost.clientWidth, this.canvasHost.clientHeight);
    this.canvasHost.append(this.renderer.domElement);

    this.tunnel = new Tunnel(this.level);
    this.player = new Player(this.particle);
    this.scene.add(this.tunnel.group, this.obstacles.group, this.collectibles.group, this.player.group);

    this.settings = Storage.getSettings();
    this.audio.setMuted(this.settings.muted);
    this.audio.setVolume(this.settings.volume);
    this.input = new InputManager(this.canvasHost, {
      laneMode: this.settings.laneMode,
      tiltEnabled: this.settings.tiltEnabled
    });

    this.ui = new UI(this.shell, this.settings, {
      onStart: () => void this.startRun(),
      onRestart: () => void this.startRun(),
      onPauseToggle: () => this.togglePause(),
      onExitGame: () => this.exitToMenu(),
      onShowMenu: () => this.renderMenu(),
      onSelectParticle: (id) => this.selectParticle(id),
      onSelectTrack: (id) => void this.selectTrack(id),
      onUploadTrack: (file) => void this.uploadTrack(file),
      onProcedural: () => this.useProcedural(),
      onSetMuted: (muted) => this.updateSettings({ muted }),
      onSetVolume: (volume) => this.updateSettings({ volume }),
      onSetLaneMode: (laneMode) => this.updateSettings({ laneMode }),
      onSetHaptics: (hapticsEnabled) => this.updateSettings({ hapticsEnabled }),
      onRequestTilt: () => void this.enableTilt(),
      onOpenAdmin: () => this.openAdmin(),
      onTrackControl: (control) => void this.trackControl(control)
    });
    this.admin = new AdminPlaylist(
      this.adminHost,
      this.playlist,
      () => this.ui.refreshPlaylist(this.playlist.getPublicPlaylist(), Storage.getUnlockedParticles(), this.highScore),
      () => this.mode === 'menu' && this.renderMenu()
    );

    this.selectedTrack = this.playlist.getDefaultPlaylist()[0];
    this.ui.setSelectedTrack(this.selectedTrack.id);
    this.renderMenu();
    this.resize();
    const requestResize = () => requestAnimationFrame(() => this.resize());
    window.addEventListener('resize', requestResize);
    window.addEventListener('orientationchange', requestResize);
    window.visualViewport?.addEventListener('resize', requestResize);
    this.resizeObserver = new ResizeObserver(requestResize);
    this.resizeObserver.observe(this.canvasHost);
    document.addEventListener('visibilitychange', () => {
      if (document.hidden && this.mode === 'playing') this.togglePause(true);
    });
    if (location.pathname === '/admin' || location.hash === '#admin') {
      this.openAdmin();
    }
    this.loop(0);
  }

  private renderMenu(): void {
    this.highScore = Storage.getHighScore();
    this.ui.renderMenu(Storage.getUnlockedParticles(), this.playlist.getPublicPlaylist(), this.highScore);
  }

  private async startRun(): Promise<void> {
    await this.audio.ensureStarted();
    if (this.selectedTrack) {
      const state = await this.audio.usePlaylistTrack(this.selectedTrack);
      this.currentTrackName = state.trackName;
      this.ui.setAudioState(state);
    } else {
      await this.audio.playTrack();
    }
    this.score = 0;
    this.elapsed = 0;
    this.speed = 14;
    this.mode = 'playing';
    this.unlockMessage = '';
    this.higgsAnnounced = Storage.getUnlockedParticles().includes('higgs');
    this.level = LEVELS[0];
    this.scene.background = new THREE.Color(this.level.palette.background);
    this.scene.fog = new THREE.FogExp2(this.level.palette.background, 0.018);
    this.tunnel.setLevel(this.level);
    this.obstacles.clear();
    this.collectibles.clear();
    this.player.setParticle(this.particle);
    this.ui.showGameplay();
  }

  private selectParticle(id: ParticleId): void {
    if (!Storage.getUnlockedParticles().includes(id)) return;
    this.particle = getParticle(id);
    this.ui.setSelectedParticle(id);
    this.renderMenu();
  }

  private async selectTrack(id: string): Promise<void> {
    const track = this.playlist.getPublicPlaylist().find((entry) => entry.id === id);
    if (!track) return;
    this.selectedTrack = track;
    this.ui.setSelectedTrack(id);
    const state = await this.audio.usePlaylistTrack(track);
    this.currentTrackName = state.trackName;
    this.ui.setAudioState(state);
    this.renderMenu();
  }

  private async uploadTrack(file: File): Promise<void> {
    const state = await this.audio.useUpload(file);
    this.selectedTrack = undefined;
    this.currentTrackName = state.trackName;
    this.ui.setSelectedTrack('');
    this.ui.setAudioState(state);
    this.renderMenu();
  }

  private useProcedural(): void {
    this.selectedTrack = undefined;
    this.currentTrackName = 'Procedural Soundtrack';
    this.ui.setSelectedTrack('');
    this.ui.setAudioState(this.audio.useProcedural());
    this.renderMenu();
  }

  private updateSettings(partial: Partial<ReturnType<typeof Storage.getSettings>>): void {
    this.settings = { ...Storage.getSettings(), ...partial };
    Storage.setSettings(this.settings);
    this.audio.setMuted(this.settings.muted);
    this.audio.setVolume(this.settings.volume);
    this.input.setOptions({ laneMode: this.settings.laneMode, tiltEnabled: this.settings.tiltEnabled });
    this.ui.setSettings(this.settings);
    this.renderMenu();
  }

  private async enableTilt(): Promise<void> {
    if (this.settings.tiltEnabled) {
      this.updateSettings({ tiltEnabled: false });
      this.ui.notify('Tilt steering disabled.');
      return;
    }

    const granted = await this.input.requestTiltPermission();
    if (granted) {
      this.updateSettings({ tiltEnabled: true });
      this.ui.notify('Tilt steering enabled.');
    } else {
      this.ui.notify('Tilt permission was not granted. Touch and keyboard controls remain active.');
    }
  }

  private openAdmin(): void {
    this.mode = this.mode === 'playing' ? 'paused' : this.mode;
    this.admin.show();
  }

  private async trackControl(control: 'play' | 'pause' | 'restart'): Promise<void> {
    if (control === 'play') await this.audio.playTrack();
    if (control === 'pause') this.audio.pauseTrack();
    if (control === 'restart') this.audio.restartTrack();
  }

  private togglePause(forcePause = false): void {
    if (this.mode === 'playing' || forcePause) {
      this.mode = 'paused';
      this.audio.pauseTrack();
      this.pushHudState();
    } else if (this.mode === 'paused') {
      this.mode = 'playing';
      void this.audio.playTrack();
      this.lastFrame = performance.now();
      this.pushHudState();
    }
  }

  private exitToMenu(): void {
    if (this.mode === 'playing' || this.mode === 'paused') {
      Storage.setHighScore(this.score);
      this.highScore = Storage.getHighScore();
    }
    this.mode = 'menu';
    this.audio.stopTrack();
    this.obstacles.clear();
    this.collectibles.clear();
    this.renderMenu();
  }

  private loop(time: number): void {
    this.animationId = requestAnimationFrame((next) => this.loop(next));
    const dt = Math.min(0.033, Math.max(0.001, (time - this.lastFrame) / 1000 || 0.016));
    this.lastFrame = time;

    const energy = this.audio.getEnergy();
    if (this.mode === 'playing') {
      this.update(dt, energy);
    } else {
      this.tunnel.update(dt * 0.35, 5, this.level, energy, 0);
    }

    const circular = !this.settings?.laneMode;
    const cameraFollow = circular ? 0.42 : 0.12;
    const targetCameraX = this.player.group.position.x * cameraFollow;
    const targetCameraY = 0.1 + this.player.group.position.y * (circular ? 0.36 : 0.04);
    this.camera.position.x = THREE.MathUtils.lerp(this.camera.position.x, targetCameraX, dt * 3.4);
    this.camera.position.y = THREE.MathUtils.lerp(this.camera.position.y, targetCameraY, dt * 3.4);
    if (circular) {
      const upTarget = new THREE.Vector3(-Math.cos(this.player.angle), -Math.sin(this.player.angle), 0).normalize();
      this.camera.up.lerp(upTarget, Math.min(1, dt * 4.2)).normalize();
    } else {
      this.camera.up.lerp(new THREE.Vector3(0, 1, 0), Math.min(1, dt * 4.2)).normalize();
    }
    this.camera.lookAt(this.player.group.position.x * 0.18, this.player.group.position.y * 0.18 - 0.45, -18);
    this.renderer.render(this.scene, this.camera);
  }

  private update(dt: number, energy: number): void {
    this.elapsed += dt;
    const nextLevel = getStageForScore(this.score);
    if (nextLevel.level !== this.level.level || nextLevel.name !== this.level.name) {
      this.level = nextLevel;
      this.scene.background = new THREE.Color(this.level.palette.background);
      this.scene.fog = new THREE.FogExp2(this.level.palette.background, 0.018);
      this.tunnel.setLevel(this.level);
      this.ui.notify(`Level ${this.level.level}: ${this.level.name}`);
    }

    const speedRatio = Math.min(1.8, this.elapsed / 90);
    this.speed = (13.5 + this.elapsed * 0.12) * this.level.speedMultiplier * this.particle.speed;
    this.audio.setLevel(this.level, speedRatio);
    const circular = !this.settings.laneMode;
    const target = circular ? this.input.getTargetAngle(this.player.angle, dt) : this.input.getTargetX(this.player.x, dt);
    this.player.update(dt, target, energy, circular);

    const collected = this.collectibles.update(
      dt,
      this.level,
      this.speed,
      this.player.x,
      this.player.angle,
      this.player.getHitbox(),
      circular
    );
    for (const item of collected) {
      if (item === 'sync') {
        this.score += 680 * this.particle.scoreMultiplier;
        this.glitch = Math.max(this.glitch, 0.35);
      } else {
        this.player.activateShield();
        this.haptic([22, 20, 22]);
        this.ui.notify('Green Guard online: 15 seconds.');
      }
    }

    const hits = this.obstacles.update(
      dt,
      this.level,
      this.speed,
      this.player.x,
      this.player.angle,
      this.player.getHitbox(),
      energy,
      circular
    );
    for (const hit of hits) {
      if (hit.type === 'nearMiss') {
        this.score += 240 * this.particle.scoreMultiplier;
        this.glitch = 1;
      } else if (this.player.consumeShield()) {
        this.obstacles.remove(hit.obstacle);
        this.score += 120;
        this.haptic([24, 30, 24]);
        this.ui.notify('Guard absorbed a red instability.');
      } else if (this.player.isInvulnerable()) {
        this.obstacles.remove(hit.obstacle);
        this.score += 60;
      } else {
        this.haptic([80, 40, 120]);
        this.endRun();
        return;
      }
    }

    this.score += dt * this.speed * 64 * this.particle.scoreMultiplier;
    if (!this.higgsAnnounced && Math.max(this.score, this.highScore, Storage.getHighScore()) >= HIGGS_UNLOCK_SCORE) {
      this.higgsAnnounced = true;
      Storage.unlockParticle('higgs');
      this.unlockMessage = 'Higgs Boson unlocked: mass-field aura available in particle select.';
      this.ui.notify(this.unlockMessage);
    }

    this.highScore = Math.max(this.highScore, this.score, Storage.getHighScore());
    this.glitch = Math.max(0, this.glitch - dt * 1.9);
    this.tunnel.update(dt, this.speed, this.level, energy, this.glitch);
    this.ui.updateHud({
      score: this.score,
      highScore: this.highScore,
      speed: this.speed / 10,
      level: this.level,
      particleName: this.particle.name,
      trackName: this.currentTrackName,
      shieldRatio: this.player.getShieldRatio(),
      shieldSeconds: this.player.getShieldSeconds(),
      paused: this.mode === 'paused'
    });
  }

  private pushHudState(): void {
    this.ui.updateHud({
      score: this.score,
      highScore: this.highScore,
      speed: this.speed / 10,
      level: this.level,
      particleName: this.particle.name,
      trackName: this.currentTrackName,
      shieldRatio: this.player.getShieldRatio(),
      shieldSeconds: this.player.getShieldSeconds(),
      paused: this.mode === 'paused'
    });
  }

  private endRun(): void {
    this.mode = 'over';
    this.audio.stopTrack(true);
    Storage.setHighScore(this.score);
    if (this.score >= HIGGS_UNLOCK_SCORE) {
      Storage.unlockParticle('higgs');
      this.unlockMessage ||= 'Higgs Boson unlocked: mass-field aura available in particle select.';
    }
    this.highScore = Storage.getHighScore();
    this.ui.showGameOver(this.score, this.highScore, this.level, this.unlockMessage);
  }

  private resize(): void {
    const viewportWidth = window.visualViewport?.width ?? window.innerWidth;
    const viewportHeight = window.visualViewport?.height ?? window.innerHeight;
    document.documentElement.style.setProperty('--app-width', `${viewportWidth}px`);
    document.documentElement.style.setProperty('--app-height', `${viewportHeight}px`);
    const width = Math.max(1, Math.floor(viewportWidth));
    const height = Math.max(1, Math.floor(viewportHeight));
    const aspect = width / height;
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 1.6));
    this.camera.fov = aspect < 1.35 ? 74 : 66;
    this.camera.position.z = aspect < 1.35 ? 8.2 : 7.2;
    this.camera.aspect = width / height;
    this.camera.updateProjectionMatrix();
    this.renderer.setSize(width, height, false);
  }

  private haptic(pattern: VibratePattern): void {
    if (!this.settings.hapticsEnabled) return;
    navigator.vibrate?.(pattern);
  }
}
