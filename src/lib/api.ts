// External data sources (all free, no API key, CORS-enabled).
// - iTunes Search API: song metadata + search
// - LRCLIB: plain lyrics

import type { Song } from './store';

export interface SearchResult extends Song {
  artwork?: string;
  album?: string;
  year?: string;
  genre?: string;
}

interface ITunesItem {
  trackId?: number;
  trackName?: string;
  artistName?: string;
  artworkUrl100?: string;
  collectionName?: string;
  releaseDate?: string;
  primaryGenreName?: string;
}

function toResult(i: ITunesItem): SearchResult | null {
  if (!i.trackId || !i.trackName || !i.artistName) return null;
  return {
    id: String(i.trackId),
    title: i.trackName,
    artist: i.artistName,
    artwork: i.artworkUrl100?.replace('100x100bb', '300x300bb'),
    album: i.collectionName,
    year: i.releaseDate?.slice(0, 4),
    genre: i.primaryGenreName,
  };
}

export async function searchSongs(term: string, limit = 25): Promise<SearchResult[]> {
  const url = `https://itunes.apple.com/search?term=${encodeURIComponent(term)}&entity=song&limit=${limit}`;
  const res = await fetch(url);
  if (!res.ok) throw new Error(`search failed: ${res.status}`);
  const data = (await res.json()) as { results: ITunesItem[] };
  return data.results.map(toResult).filter((x): x is SearchResult => x !== null);
}

export async function lookupSong(id: string): Promise<SearchResult | null> {
  const url = `https://itunes.apple.com/lookup?id=${encodeURIComponent(id)}&entity=song`;
  const res = await fetch(url);
  if (!res.ok) return null;
  const data = (await res.json()) as { results: ITunesItem[] };
  return data.results.length ? toResult(data.results[0]) : null;
}

/** Fetch plain lyrics from LRCLIB. Returns "" when unavailable. */
export async function fetchLyrics(artist: string, title: string): Promise<string> {
  try {
    const get = await fetch(
      `https://lrclib.net/api/get?artist_name=${encodeURIComponent(artist)}&track_name=${encodeURIComponent(title)}`,
      { headers: { 'X-Client-User-Agent': 'SetListApp/1.0' } }
    );
    if (get.ok) {
      const d = (await get.json()) as { plainLyrics?: string };
      if (d.plainLyrics) return d.plainLyrics;
    }
    const search = await fetch(
      `https://lrclib.net/api/search?q=${encodeURIComponent(`${title} ${artist}`)}`,
      { headers: { 'X-Client-User-Agent': 'SetListApp/1.0' } }
    );
    if (!search.ok) return '';
    const arr = (await search.json()) as Array<{ plainLyrics?: string }>;
    return arr.find((x) => x.plainLyrics)?.plainLyrics ?? '';
  } catch {
    return '';
  }
}
