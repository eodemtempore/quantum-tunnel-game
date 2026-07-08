import { Storage } from '../storage/Storage';

export type TrackMood = 'dark' | 'fast' | 'chill' | 'boss' | 'quantum';
export type PlaylistSource = 'procedural' | 'built-in' | 'admin' | 'upload';
export type BassPattern = 'offbeat' | 'progressive' | 'rolling';

export interface ProceduralProfile {
  root: number;
  drive: number;
  bassPattern: BassPattern;
  arpEvery: 1 | 2 | 4;
  delayTime: number;
}

export interface PlaylistEntry {
  id: string;
  title: string;
  artist: string;
  url: string;
  bpm?: number;
  mood: TrackMood;
  source: PlaylistSource;
  profile?: ProceduralProfile;
}

export const DEFAULT_PLAYLIST: PlaylistEntry[] = [
  {
    id: 'default-track',
    title: 'Default Tunnel Track',
    artist: 'Local default',
    url: `${import.meta.env.BASE_URL}tracks/default.mp3`,
    mood: 'quantum',
    source: 'built-in'
  }
];

export class PlaylistManager {
  getDefaultPlaylist(): PlaylistEntry[] {
    return DEFAULT_PLAYLIST;
  }

  getAdminPlaylist(): PlaylistEntry[] {
    return Storage.getAdminPlaylist();
  }

  getPublicPlaylist(): PlaylistEntry[] {
    return [...DEFAULT_PLAYLIST, ...this.getAdminPlaylist()];
  }

  saveAdminEntry(entry: Omit<PlaylistEntry, 'id' | 'source'>, id?: string): PlaylistEntry[] {
    const entries = this.getAdminPlaylist();
    const next: PlaylistEntry = {
      ...entry,
      id: id ?? crypto.randomUUID(),
      source: 'admin'
    };
    const index = entries.findIndex((candidate) => candidate.id === next.id);
    if (index >= 0) {
      entries[index] = next;
    } else {
      entries.push(next);
    }
    Storage.setAdminPlaylist(entries);
    return entries;
  }

  removeAdminEntry(id: string): PlaylistEntry[] {
    const entries = this.getAdminPlaylist().filter((entry) => entry.id !== id);
    Storage.setAdminPlaylist(entries);
    return entries;
  }
}
