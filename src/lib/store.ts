// localStorage-backed persistence: offline songs, set lists, recents, bookmarks.

export interface Song {
  id: string; // iTunes trackId (or "offline-<slug>" fallback)
  title: string;
  artist: string;
  artwork?: string;
}

export interface OfflineSong extends Song {
  lyrics: string; // plain lyrics text ("" when unavailable)
  hasChart: boolean; // a bundled chord chart exists
  savedAt: number;
  scroll?: number; // saved scroll position (px)
}

export interface SetList {
  id: string;
  name: string;
  songs: Song[];
  createdAt: number;
}

const K = {
  offline: 'setlist.offline',
  sets: 'setlist.sets',
  recents: 'setlist.recents',
};

function read<T>(key: string, fallback: T): T {
  try {
    const raw = localStorage.getItem(key);
    return raw ? (JSON.parse(raw) as T) : fallback;
  } catch {
    return fallback;
  }
}

function write(key: string, value: unknown) {
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch {
    /* quota — ignore */
  }
}

export const songKey = (s: Pick<Song, 'title' | 'artist'>) =>
  `${s.artist}|${s.title}`.toLowerCase().replace(/\s+/g, ' ').trim();

/* ---------- offline songs ---------- */

export const getOffline = (): OfflineSong[] => read<OfflineSong[]>(K.offline, []);

export function isOffline(id: string): boolean {
  return getOffline().some((s) => s.id === id);
}

export function saveOffline(song: OfflineSong): void {
  const list = getOffline().filter((s) => s.id !== song.id);
  list.unshift(song);
  write(K.offline, list);
}

export function removeOffline(id: string): void {
  write(K.offline, getOffline().filter((s) => s.id !== id));
}

export function getOfflineSong(id: string): OfflineSong | undefined {
  return getOffline().find((s) => s.id === id);
}

export function saveScroll(id: string, scroll: number): void {
  const list = getOffline();
  const hit = list.find((s) => s.id === id);
  if (hit) {
    hit.scroll = scroll;
    write(K.offline, list);
  }
}

/* ---------- set lists ---------- */

export const getSets = (): SetList[] => read<SetList[]>(K.sets, []);

function writeSets(sets: SetList[]) {
  write(K.sets, sets);
}

export function createSet(name: string): SetList {
  const set: SetList = {
    id: Math.random().toString(36).slice(2, 10),
    name: name.trim() || 'Untitled set',
    songs: [],
    createdAt: Date.now(),
  };
  writeSets([set, ...getSets()]);
  return set;
}

export function deleteSet(id: string): void {
  writeSets(getSets().filter((s) => s.id !== id));
}

export function getSet(id: string): SetList | undefined {
  return getSets().find((s) => s.id === id);
}

export function addToSet(setId: string, song: Song): boolean {
  const sets = getSets();
  const set = sets.find((s) => s.id === setId);
  if (!set) return false;
  if (set.songs.some((s) => s.id === song.id)) return false;
  set.songs.push(song);
  writeSets(sets);
  return true;
}

export function removeFromSet(setId: string, songId: string): void {
  const sets = getSets();
  const set = sets.find((s) => s.id === setId);
  if (!set) return;
  set.songs = set.songs.filter((s) => s.id !== songId);
  writeSets(sets);
}

export function moveSong(setId: string, songId: string, dir: -1 | 1): void {
  const sets = getSets();
  const set = sets.find((s) => s.id === setId);
  if (!set) return;
  const i = set.songs.findIndex((s) => s.id === songId);
  const j = i + dir;
  if (i < 0 || j < 0 || j >= set.songs.length) return;
  [set.songs[i], set.songs[j]] = [set.songs[j], set.songs[i]];
  writeSets(sets);
}

/* ---------- recent searches ---------- */

export const getRecents = (): string[] => read<string[]>(K.recents, []);

export function pushRecent(term: string): void {
  const t = term.trim();
  if (!t) return;
  const list = [t, ...getRecents().filter((x) => x.toLowerCase() !== t.toLowerCase())].slice(0, 8);
  write(K.recents, list);
}
