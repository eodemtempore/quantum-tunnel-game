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

const VALID_MOODS: TrackMood[] = ['dark', 'fast', 'chill', 'boss', 'quantum'];
const DIRECT_AUDIO_EXTENSIONS = /\.(mp3|wav|m4a|mp4|aac|ogg|oga|webm)(\?.*)?$/i;

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
    const title = this.cleanText(entry.title, 'Track title');
    const artist = this.cleanText(entry.artist, 'Artist/name');
    const url = this.cleanAudioUrl(entry.url);
    const mood = VALID_MOODS.includes(entry.mood) ? entry.mood : 'quantum';
    const bpm = Number.isFinite(entry.bpm) && entry.bpm ? Math.max(40, Math.min(240, Math.round(entry.bpm))) : undefined;
    const next: PlaylistEntry = {
      title,
      artist,
      url,
      bpm,
      mood,
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

  private cleanText(value: string, label: string): string {
    const trimmed = value.trim().replace(/\s+/g, ' ').slice(0, 96);
    if (!trimmed) throw new Error(`${label} is required.`);
    return trimmed;
  }

  private cleanAudioUrl(value: string): string {
    const trimmed = value.trim().slice(0, 2048);
    if (!trimmed) throw new Error('Direct audio file URL is required.');
    let parsed: URL;
    try {
      parsed = new URL(trimmed, window.location.origin);
    } catch {
      throw new Error('Audio URL is not valid.');
    }
    if (!['http:', 'https:'].includes(parsed.protocol)) {
      throw new Error('Use a same-site path or an http/https direct audio URL.');
    }
    if (!DIRECT_AUDIO_EXTENSIONS.test(parsed.pathname)) {
      throw new Error('Use a direct audio file URL ending in mp3, wav, m4a, mp4, aac, ogg, or webm.');
    }
    return parsed.origin === window.location.origin ? `${parsed.pathname}${parsed.search}` : parsed.toString();
  }
}
