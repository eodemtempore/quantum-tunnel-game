import { HIGGS_UNLOCK_SCORE, ParticleId } from '../game/Particles';
import { PlaylistEntry } from '../audio/PlaylistManager';

const HIGH_SCORE_KEY = 'qt.highScore';
const UNLOCKS_KEY = 'qt.unlocks';
const ADMIN_PLAYLIST_KEY = 'qt.adminPlaylist';
const SETTINGS_KEY = 'qt.settings';
const USERNAME_KEY = 'qt.username';
const PROFILE_STATS_KEY = 'qt.profileStats';

export interface GameSettings {
  muted: boolean;
  volume: number;
  laneMode: boolean;
  tiltEnabled: boolean;
  hapticsEnabled: boolean;
}

export interface ProfileStats {
  highestLevel: number;
  totalSyncOrbs: number;
  totalNearMisses: number;
  highScoreName: string;
}

const defaultSettings: GameSettings = {
  muted: false,
  volume: 0.72,
  laneMode: false,
  tiltEnabled: false,
  hapticsEnabled: true
};

const defaultProfileStats: ProfileStats = {
  highestLevel: 1,
  totalSyncOrbs: 0,
  totalNearMisses: 0,
  highScoreName: 'Quantum Racer'
};

export function normalizeUsername(value: string): string {
  return value.trim().replace(/\s+/g, ' ').slice(0, 16);
}

export function isValidUsername(value: string): boolean {
  const normalized = normalizeUsername(value);
  return normalized.length >= 3 && normalized.length <= 16 && /^[A-Za-z0-9 _-]+$/.test(normalized);
}

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
  getUsername(): string {
    return localStorage.getItem(USERNAME_KEY) || 'Quantum Racer';
  },

  hasUsername(): boolean {
    return localStorage.getItem(USERNAME_KEY) !== null;
  },

  setUsername(username: string): void {
    const normalized = normalizeUsername(username);
    if (!isValidUsername(normalized)) {
      throw new Error('Use 3-16 letters, numbers, spaces, underscores, or hyphens.');
    }
    localStorage.setItem(USERNAME_KEY, normalized);
  },

  skipUsername(): void {
    localStorage.setItem(USERNAME_KEY, 'Quantum Racer');
  },

  getHighScore(): number {
    return Number(localStorage.getItem(HIGH_SCORE_KEY) ?? 0);
  },

  setHighScore(score: number): void {
    const current = this.getHighScore();
    if (score > current) {
      localStorage.setItem(HIGH_SCORE_KEY, String(Math.floor(score)));
      const stats = this.getProfileStats();
      stats.highScoreName = this.getUsername();
      this.setProfileStats(stats);
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

  getProfileStats(): ProfileStats {
    return { ...defaultProfileStats, ...readJson<ProfileStats>(PROFILE_STATS_KEY, defaultProfileStats) };
  },

  setProfileStats(stats: ProfileStats): void {
    writeJson(PROFILE_STATS_KEY, {
      highestLevel: Math.max(1, Math.floor(stats.highestLevel)),
      totalSyncOrbs: Math.max(0, Math.floor(stats.totalSyncOrbs)),
      totalNearMisses: Math.max(0, Math.floor(stats.totalNearMisses)),
      highScoreName: normalizeUsername(stats.highScoreName || 'Quantum Racer') || 'Quantum Racer'
    });
  },

  recordRunProgress(level: number, syncOrbs: number, nearMisses: number): void {
    const stats = this.getProfileStats();
    stats.highestLevel = Math.max(stats.highestLevel, level);
    stats.totalSyncOrbs += Math.max(0, syncOrbs);
    stats.totalNearMisses += Math.max(0, nearMisses);
    this.setProfileStats(stats);
  },

  getAdminPlaylist(): PlaylistEntry[] {
    return readJson<PlaylistEntry[]>(ADMIN_PLAYLIST_KEY, []);
  },

  setAdminPlaylist(entries: PlaylistEntry[]): void {
    writeJson(ADMIN_PLAYLIST_KEY, entries);
  }
};
