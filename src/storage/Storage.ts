import { HIGGS_UNLOCK_SCORE, ParticleId } from '../game/Particles';
import { PlaylistEntry } from '../audio/PlaylistManager';

const HIGH_SCORE_KEY = 'qt.highScore';
const UNLOCKS_KEY = 'qt.unlocks';
const ADMIN_PLAYLIST_KEY = 'qt.adminPlaylist';
const SETTINGS_KEY = 'qt.settings';

export interface GameSettings {
  muted: boolean;
  volume: number;
  laneMode: boolean;
  tiltEnabled: boolean;
  hapticsEnabled: boolean;
}

const defaultSettings: GameSettings = {
  muted: false,
  volume: 0.72,
  laneMode: false,
  tiltEnabled: false,
  hapticsEnabled: true
};

function readJson<T>(key: string, fallback: T): T {
  try {
    const raw = localStorage.getItem(key);
    return raw ? (JSON.parse(raw) as T) : fallback;
  } catch {
    return fallback;
  }
}

function writeJson<T>(key: string, value: T): void {
  localStorage.setItem(key, JSON.stringify(value));
}

export const Storage = {
  getHighScore(): number {
    return Number(localStorage.getItem(HIGH_SCORE_KEY) ?? 0);
  },

  setHighScore(score: number): void {
    const current = this.getHighScore();
    if (score > current) {
      localStorage.setItem(HIGH_SCORE_KEY, String(Math.floor(score)));
    }
  },

  getUnlockedParticles(): ParticleId[] {
    const stored = readJson<ParticleId[]>(UNLOCKS_KEY, ['proton', 'electron', 'neutron']);
    if (this.getHighScore() >= HIGGS_UNLOCK_SCORE && !stored.includes('higgs')) {
      stored.push('higgs');
      writeJson(UNLOCKS_KEY, stored);
    }
    return stored;
  },

  unlockParticle(id: ParticleId): void {
    const unlocked = this.getUnlockedParticles();
    if (!unlocked.includes(id)) {
      unlocked.push(id);
      writeJson(UNLOCKS_KEY, unlocked);
    }
  },

  getSettings(): GameSettings {
    return { ...defaultSettings, ...readJson<GameSettings>(SETTINGS_KEY, defaultSettings) };
  },

  setSettings(settings: GameSettings): void {
    writeJson(SETTINGS_KEY, settings);
  },

  getAdminPlaylist(): PlaylistEntry[] {
    return readJson<PlaylistEntry[]>(ADMIN_PLAYLIST_KEY, []);
  },

  setAdminPlaylist(entries: PlaylistEntry[]): void {
    writeJson(ADMIN_PLAYLIST_KEY, entries);
  }
};
