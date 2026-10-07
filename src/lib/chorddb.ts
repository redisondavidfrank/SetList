// Chord database: search + on-demand chart building from the HuggingFace
// "jammai/chords_and_lyrics" dataset (135k+ songs, free, CORS-enabled).
//
// A compact search index is bundled at build time (public/data/chordidx.json);
// the full chord/lyric dicts are fetched per-song from the datasets-server
// `rows` endpoint by row index, converted here into the app's chart format.

const DATASET = 'jammai/chords_and_lyrics';
const rowsURL = (offset: number) =>
  `https://datasets-server.huggingface.co/rows?dataset=${encodeURIComponent(DATASET)}&config=default&split=train&offset=${offset}&length=1`;

const BASE_URL = (
  typeof (import.meta as unknown as { env?: { BASE_URL?: string } }).env?.BASE_URL === 'string'
    ? (import.meta as unknown as { env: { BASE_URL: string } }).env.BASE_URL
    : ''
);

/* ---------------- Harte -> chord name conversion ---------------- */

const QUAL: Record<string, string> = {
  maj: '', min: 'm', '7': '7', min7: 'm7', maj7: 'maj7', maj6: '6', min6: 'm6',
  dim: 'dim', dim7: 'dim7', hdim: 'm7b5', aug: 'aug', sus2: 'sus2', sus4: 'sus4',
  '9': '9', maj9: 'maj9', min9: 'm9', 'maj(9)': 'add9', 'min(9)': 'madd9',
  '6/9': '6', 'aug(b7)': '7#5', 'min7(4)': 'm7', 'maj7(6)': 'maj7',
  maj2: 'add9', minmaj7: 'mMaj7',
};
const SHARPS = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];
const FLATS = ['C', 'Db', 'D', 'Eb', 'E', 'F', 'Gb', 'G', 'Ab', 'A', 'Bb', 'B'];
const NOTE: Record<string, number> = {};
SHARPS.forEach((n, i) => (NOTE[n] = i));
FLATS.forEach((n, i) => (NOTE[n] = i));
const DEGREE: Record<number, number> = { 1: 0, 2: 2, 3: 4, 4: 5, 5: 7, 6: 9, 7: 11 };

/** Convert a Harte chord token ('A:min7/b7', 'D:(*3,*5)', 'N') to an app chord token. */
export function harteName(name: string): string | null {
  name = name.trim();
  if (!name || name === 'N') return null;
  name = name.replace(/\(\*[^)]*\)/g, ''); // finger positions
  const m = /^([A-G][b#]*?)(?::([^/]*))?(?:\/(.*))?$/.exec(name);
  if (!m) return null;
  const root = m[1];
  const qual = m[2] ?? '';
  const bass = m[3] ?? '';
  if (!(root in NOTE)) return null; // garbage roots (Ebb, Gbbbb …)
  let q = QUAL[qual];
  if (q === undefined) {
    q = qual.replace(/\([^)]*\)/g, '');
  }
  let token = `${root}${q}`;
  if (bass) {
    const bm = /^([b#]?)(\d)$/.exec(bass);
    if (bm) {
      const deg = DEGREE[Number(bm[2])];
      if (deg !== undefined) {
        const off = deg + (bm[1] === 'b' ? -1 : bm[1] === '#' ? 1 : 0);
        const names = root.includes('b') ? FLATS : SHARPS;
        token += `/${names[(NOTE[root] + off) % 12]}`;
      }
    } else if (bass in NOTE) {
      token += `/${bass}`;
    }
  }
  return token;
}

/* ---------------- Python dict literal parsing ---------------- */

function unescapePy(s: string): string {
  let out = '';
  let i = 0;
  while (i < s.length) {
    const c = s[i];
    if (c === '\\' && i + 1 < s.length) {
      const n = s[i + 1];
      if (n === 'n') out += '\n';
      else if (n === 't') out += '\t';
      else if (n === 'r') out += '\r';
      else if (n === "'") out += "'";
      else if (n === '"') out += '"';
      else if (n === '\\') out += '\\';
      else out += n;
      i += 2;
    } else {
      out += c;
      i++;
    }
  }
  return out;
}

/** Parse a Python dict literal like `{0: 'a', 2: ['b', 'c']}`. Values are strings or string arrays. */
export function parsePyDict(s: string): Map<number, string | string[]> {
  const out = new Map<number, string | string[]>();
  let i = 0;
  const skipWs = () => {
    while (i < s.length && /\s/.test(s[i])) i++;
  };
  const parseString = (): string | null => {
    skipWs();
    const q = s[i];
    if (q !== "'" && q !== '"') return null;
    i++;
    let buf = '';
    while (i < s.length && s[i] !== q) {
      const c = s[i];
      if (c === '\\' && i + 1 < s.length) {
        buf += unescapePy(s.slice(i, i + 2));
        i += 2;
      } else {
        buf += c;
        i++;
      }
    }
    i++; // closing quote
    return buf;
  };
  const expect = (c: string) => {
    skipWs();
    if (s[i] === c) i++;
  };
  skipWs();
  expect('{');
  skipWs();
  if (s[i] === '}') return out;
  for (;;) {
    skipWs();
    let k = '';
    while (i < s.length && /\d/.test(s[i])) {
      k += s[i];
      i++;
    }
    const key = Number(k);
    expect(':');
    skipWs();
    if (s[i] === '[') {
      i++;
      const arr: string[] = [];
      skipWs();
      while (i < s.length && s[i] !== ']') {
        const v = parseString();
        if (v !== null) arr.push(v);
        expect(',');
      }
      i++; // ]
      out.set(key, arr);
    } else {
      const v = parseString();
      if (v !== null) out.set(key, v);
    }
    skipWs();
    if (s[i] === ',') {
      i++;
      continue;
    }
    if (s[i] === '}') break;
    break;
  }
  return out;
}

/* ---------------- key detection ---------------- */

const MINOR_IF = new Set(['m', 'm7', 'm6', 'm9', 'madd9', 'mMaj7', 'm7b5', 'dim', 'dim7']);

export function detectKey(chords: Map<number, string | string[]>): string {
  const counts = new Map<string, Map<string, number>>();
  for (const v of chords.values()) {
    const toks = Array.isArray(v) ? v : [v];
    for (const raw of toks) {
      const h = harteName(raw);
      if (!h) continue;
      const m = /^([A-G][b#]?)/.exec(h);
      if (!m) continue;
      const r = m[1];
      const q = h.slice(r.length).split('/')[0] || '';
      const c = counts.get(r) ?? new Map<string, number>();
      c.set(q, (c.get(q) ?? 0) + 1);
      counts.set(r, c);
    }
  }
  if (counts.size === 0) return 'C';
  let bestRoot = '';
  let bestN = -1;
  for (const [r, c] of counts) {
    const n = [...c.values()].reduce((a, b) => a + b, 0);
    if (n > bestN) {
      bestN = n;
      bestRoot = r;
    }
  }
  const quals = counts.get(bestRoot)!;
  const topQ = [...quals.entries()].sort((a, b) => b[1] - a[1])[0][0];
  const isMinor = MINOR_IF.has(topQ) || (topQ.startsWith('m') && !topQ.startsWith('maj'));
  return `${bestRoot}${isMinor ? 'm' : ''}`;
}

/* ---------------- chart building ---------------- */

const SECTION_RE =
  /^(Verse|Chorus|Bridge|Intro|Outro|Pre-Chorus|Solo|Interlude|Break(?:down)?|Riff|Instrumental|Refrain|Tag|Ending|Part)\s*[0-9IVXL]*:?$/i;
const JUNK_RE = /^(capo|tuning|strumm|recommended|transcrib|tabbed)/i;

export interface ChordRow {
  artist: string;
  title: string;
  chords: Map<number, string | string[]>;
  lyrics: Map<number, string | string[]>;
}

/** Build the app chart body (#Key, #Sections, chord lines + lyric lines) from a dataset row. */
export function chartFromRow(row: ChordRow): { keyName: string; body: string } {
  const keyName = detectKey(row.chords);
  const bodies: string[] = [`#${keyName}`];
  // chord line at index N pairs with lyric line at N+1
  const chordLine = new Map<number, string[]>();
  for (const [idx, v] of row.chords) {
    const toks = (Array.isArray(v) ? v : [v])
      .map(harteName)
      .filter((t): t is string => t !== null);
    if (toks.length) chordLine.set(idx, toks);
  }
  const lyricText = new Map<number, string>();
  for (const [idx, v] of row.lyrics) {
    if (Array.isArray(v)) continue;
    const t = v.trim();
    if (!t) continue;
    if (JUNK_RE.test(t)) continue;
    lyricText.set(idx, t);
  }
  // walk lyric indices in order; print the chord line above when present
  const indices = [...new Set([...lyricText.keys(), ...chordLine.keys()])].sort((a, b) => a - b);
  for (const idx of indices) {
    const chord = chordLine.get(idx);
    const lyric = lyricText.get(idx);
    if (chord) bodies.push(chord.join('  '));
    if (lyric) {
      if (SECTION_RE.test(lyric)) {
        bodies.push(`#${lyric.replace(/:\s*$/, '')}`);
      } else {
        bodies.push(lyric.replace(/\s+/g, ' '));
      }
    }
  }
  return { keyName, body: bodies.join('\n') };
}

/* ---------------- index loading + search ---------------- */

export interface ChordHit {
  artist: string;
  title: string;
  row: number;
  key: string;
}

const norm = (s: string) => s.toLowerCase().replace(/[^a-z0-9]/g, '');

/** Normalized key for matching (mirrors the dedupe key used at build time). */
export const normalizeKey = norm;

let indexPromise: Promise<ChordHit[] | null> | null = null;

export function loadChordIndex(): Promise<ChordHit[] | null> {
  if (!indexPromise) {
    indexPromise = loadIndexFile();
  }
  return indexPromise;
}

async function loadIndexFile(): Promise<ChordHit[] | null> {
  try {
    const gzResp = await fetch(`${BASE_URL}data/chordidx.json.gz`);
    if (gzResp.ok) {
      const enc = (gzResp.headers.get('content-encoding') ?? '').toLowerCase();
      if (enc.includes('gzip')) {
        // The network layer already transparently decompressed it.
        return parseIndex(await gzResp.text());
      }
      // Raw gzip bytes (static hosts that serve .gz as application/gzip).
      if ('DecompressionStream' in globalThis) {
        const buf = await gzResp.arrayBuffer();
        const ds = new DecompressionStream('gzip');
        const stream = new Response(buf).body!.pipeThrough(ds);
        const out = await new Response(stream).arrayBuffer();
        return parseIndex(new TextDecoder().decode(out));
      }
      return null;
    }
    const resp = await fetch(`${BASE_URL}data/chordidx.json`);
    if (!resp.ok) return null;
    return parseIndex(await resp.text());
  } catch {
    return null;
  }
}

function parseIndex(text: string): ChordHit[] | null {
  try {
    const arr = JSON.parse(text) as Array<[string, string, number, string]>;
    if (!Array.isArray(arr)) return null;
    return arr.map(([artist, title, row, key]) => ({ artist, title, row, key }));
  } catch {
    return null;
  }
}

/** Find the dataset row (if any) matching an artist+title pair. */
export async function findChordRow(artist: string, title: string): Promise<ChordHit | null> {
  const idx = await loadChordIndex();
  if (!idx) return null;
  const a = norm(artist);
  const t = norm(title);
  let exact: ChordHit | null = null;
  let titleOnly: ChordHit | null = null;
  for (const h of idx) {
    const ha = norm(h.artist);
    const ht = norm(h.title);
    if (ha === a && ht === t) {
      exact = h;
      break;
    }
    if (ht === t && !titleOnly) titleOnly = h;
  }
  return exact ?? titleOnly;
}

/** Search the bundled index by a free-text query. */
export async function searchChordDB(
  q: string,
  limit = 15
): Promise<ChordHit[]> {
  const idx = await loadChordIndex();
  if (!idx) return [];
  const needle = norm(q);
  if (!needle) return [];
  const scored: Array<ChordHit & { s: number }> = [];
  for (const h of idx) {
    const t = norm(h.title);
    const a = norm(h.artist);
    let s = -1;
    if (t === needle) s = 100;
    else if (t.startsWith(needle)) s = 70;
    else if (t.includes(needle)) s = 40;
    else if (a === needle) s = 60;
    else if (a.startsWith(needle)) s = 45;
    else if (a.includes(needle)) s = 25;
    if (s > 0) scored.push({ ...h, s });
  }
  scored.sort((x, y) => y.s - x.s || norm(x.title).localeCompare(norm(y.title)));
  return scored.slice(0, limit).map(({ s: _s, ...h }) => h);
}

let chordMapPromise: Promise<Map<string, ChordHit> | null> | null = null;

/** Full normalized "artist|title" -> hit map, for marking iTunes results that have chords. */
export function getChordMap(): Promise<Map<string, ChordHit> | null> {
  if (!chordMapPromise) {
    chordMapPromise = loadChordIndex().then((idx) => {
      if (!idx) return null;
      const m = new Map<string, ChordHit>();
      for (const h of idx) m.set(`${norm(h.artist)}|${norm(h.title)}`, h);
      return m;
    });
  }
  return chordMapPromise;
}

/* ---------------- per-song fetch ---------------- */

export async function fetchChordRow(row: number): Promise<ChordRow | null> {
  try {
    const res = await fetch(rowsURL(row));
    if (!res.ok) return null;
    const data = (await res.json()) as {
      rows?: Array<{
        row: {
          artist_name: string;
          song_name: string;
          verse_to_harte_chords: string;
          verse_to_lyrics: string;
        };
      }>;
    };
    const r = data.rows?.[0]?.row;
    if (!r) return null;
    return {
      artist: r.artist_name,
      title: r.song_name,
      chords: parsePyDict(r.verse_to_harte_chords),
      lyrics: parsePyDict(r.verse_to_lyrics),
    };
  } catch {
    return null;
  }
}

/** Convenience: fetch row + build chart in one step. */
export async function loadChartByRow(row: number): Promise<{ artist: string; title: string; keyName: string; body: string } | null> {
  const r = await fetchChordRow(row);
  if (!r) return null;
  const { keyName, body } = chartFromRow(r);
  return { artist: r.artist, title: r.title, keyName, body };
}