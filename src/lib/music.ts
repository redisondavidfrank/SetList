// Music theory helpers: transposition, chord diagrams, scale rendering.

const SHARPS = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];
const FLATS = ['C', 'Db', 'D', 'Eb', 'E', 'F', 'Gb', 'G', 'Ab', 'A', 'Bb', 'B'];

export const NOTE_INDEX: Record<string, number> = {};
SHARPS.forEach((n, i) => (NOTE_INDEX[n] = i));
FLATS.forEach((n, i) => (NOTE_INDEX[n] = i));

// Chord token: root [quality…] [/ bass]
const CHORD_RE = /^([A-G][b#]?)([^/\s]*)(?:\/([A-G][b#]?))?$/;

export interface ParsedChord {
  root: number; // 0-11
  quality: string;
  bass?: number;
}

export function parseChord(token: string): ParsedChord | null {
  const m = token.match(CHORD_RE);
  if (!m) return null;
  return {
    root: NOTE_INDEX[m[1]],
    quality: m[2],
    bass: m[3] ? NOTE_INDEX[m[3]] : undefined,
  };
}

/** Transpose a single chord token by `steps` semitones. Returns input if unparseable. */
export function transposeToken(token: string, steps: number, useFlats = false): string {
  const p = parseChord(token);
  if (p === null) return token;
  const names = useFlats ? FLATS : SHARPS;
  const root = names[(p.root + steps + 120) % 12];
  const bass = p.bass !== undefined ? `/${names[(p.bass + steps + 120) % 12]}` : '';
  return `${root}${p.quality}${bass}`;
}

/** Transpose a chord line (tokens separated by whitespace, spacing preserved-ish). */
export function transposeLine(line: string, steps: number, useFlats = false): string {
  if (!steps) return line;
  return line.replace(/[A-G][b#]?[^/\s]*(?:\/[A-G][b#]?)?/g, (t) =>
    parseChord(t) ? transposeToken(t, steps, useFlats) : t
  );
}

/** Prefer flats for keys like F, Bb, Eb, Ab, Db, Gm, Cm… */
export function keyUsesFlats(keyRoot: number): boolean {
  const flatSet = new Set([1, 3, 5, 6, 8, 10]); // Db Eb F Gb Ab Bb
  return flatSet.has(((keyRoot % 12) + 12) % 12);
}

/* ---------------- chord diagrams ---------------- */

export interface Voicing {
  /** fret per string, low E → high e; null = muted */
  frets: (number | null)[];
  base: number; // first fret shown (>1 when diagram starts up the neck)
}

/**
 * Chord voicings for common qualities using movable E-shape / A-shape barre
 * patterns plus a table of comfortable open shapes.
 */
const OPEN_SHAPES: Record<string, Record<string, Voicing>> = {
  // exact-name open chords (low E → high e)
  C: { frets: [null, 3, 2, 0, 1, 0], base: 1 },
  D: { frets: [null, null, 0, 2, 3, 2], base: 1 },
  E: { frets: [0, 2, 2, 1, 0, 0], base: 1 },
  G: { frets: [3, 2, 0, 0, 0, 3], base: 1 },
  A: { frets: [null, 0, 2, 2, 2, 0], base: 1 },
  Am: { frets: [null, 0, 2, 2, 1, 0], base: 1 },
  Em: { frets: [0, 2, 2, 0, 0, 0], base: 1 },
  Dm: { frets: [null, null, 0, 2, 3, 1], base: 1 },
  E7: { frets: [0, 2, 0, 1, 0, 0], base: 1 },
  A7: { frets: [null, 0, 2, 0, 2, 0], base: 1 },
  D7: { frets: [null, null, 0, 2, 1, 2], base: 1 },
  G7: { frets: [3, 2, 0, 0, 0, 1], base: 1 },
  C7: { frets: [null, 3, 2, 3, 1, 0], base: 1 },
  F: { frets: [1, 3, 3, 2, 1, 1], base: 1 },
  Fmaj7: { frets: [null, null, 3, 2, 1, 0], base: 1 },
  Em7: { frets: [0, 2, 0, 0, 0, 0], base: 1 },
  Am7: { frets: [null, 0, 2, 0, 1, 0], base: 1 },
  Dsus4: { frets: [null, null, 0, 2, 3, 3], base: 1 },
  Dsus2: { frets: [null, null, 0, 2, 3, 0], base: 1 },
  Asus4: { frets: [null, 0, 2, 2, 3, 0], base: 1 },
  Asus2: { frets: [null, 0, 2, 2, 0, 0], base: 1 },
  Eadd9: { frets: [0, 2, 2, 1, 0, 2], base: 1 },
  Cadd9: { frets: [null, 3, 2, 0, 3, 0], base: 1 },
};

// Movable shapes, relative to barre fret, low E → high e (null = muted).
type Shape = (number | null)[];
const E_SHAPES: Record<string, Shape> = {
  '': [0, 2, 2, 1, 0, 0], // major
  m: [0, 2, 2, 0, 0, 0],
  '7': [0, 2, 0, 1, 0, 0],
  maj7: [0, 2, 1, 1, 0, 0],
  m7: [0, 2, 0, 0, 0, 0],
  sus4: [0, 2, 2, 2, 0, 0],
  dim: [0, 1, 2, 0, 2, 0],
  m7b5: [0, 1, 0, 0, 3, 0],
};
const A_SHAPES: Record<string, Shape> = {
  '': [null, 0, 2, 2, 2, 0],
  m: [null, 0, 2, 2, 1, 0],
  '7': [null, 0, 2, 0, 2, 0],
  maj7: [null, 0, 2, 1, 2, 0],
  m7: [null, 0, 2, 0, 1, 0],
  sus4: [null, 0, 2, 2, 3, 0],
  sus2: [null, 0, 2, 2, 0, 0],
  6: [null, 0, 2, 2, 2, 2],
  m6: [null, 0, 2, 2, 1, 2],
  add9: [null, 0, 2, 2, 0, 2],
  dim: [null, 0, 1, 2, 1, 0],
  aug: [null, 0, 3, 2, 1, 0],
};

/** Find a reasonable voicing for a chord name like "F#m7" or "Bb". */
export function chordVoicing(name: string): Voicing | null {
  const open = OPEN_SHAPES[name];
  if (open) return open;

  const p = parseChord(name);
  if (!p) return null;

  // Try movable shapes rooted on the E string then A string.
  const eFret = p.root; // E string open = E(4) → offset handled below
  const aFret = (p.root - 9 + 12) % 12; // A = 9
  const eRoot = (p.root - 4 + 12) % 12; // semitones above E

  const candidates: Array<{ shape: Shape; fret: number }> = [];
  const es = E_SHAPES[p.quality];
  const as = A_SHAPES[p.quality];
  if (es) candidates.push({ shape: es, fret: eRoot });
  if (as) candidates.push({ shape: as, fret: aFret });
  if (!candidates.length) return null;

  // Prefer the lower position, but keep barre ≥ fret 1 unless open works.
  candidates.sort((x, y) => {
    const fx = x.fret === 0 ? 1 : x.fret;
    const fy = y.fret === 0 ? 1 : y.fret;
    return fx - fy;
  });
  const best = candidates[0];
  const frets = best.shape.map((f) => (f === null ? null : f + best.fret));
  const min = Math.min(...frets.filter((f): f is number => f !== null));
  return { frets, base: min <= 1 ? 1 : min };
}

/** Render an SVG chord diagram. */
export function chordDiagramSVG(name: string, width = 120): string {
  const v = chordVoicing(name);
  if (!v) return `<div class="hint">No diagram for “${name}”</div>`;
  const w = width;
  const h = width * 1.25;
  const left = 18;
  const right = w - 14;
  const top = 26;
  const bottom = h - 26;
  const sw = (right - left) / 5; // string gap
  const fh = (bottom - top) / 4; // fret gap

  const x = (i: number) => left + i * sw;
  const y = (fret: number) => top + (fret - v.base) * fh + fh / 2;

  let s = `<svg class="chord-diagram" width="${w}" height="${h}" viewBox="0 0 ${w} ${h}" xmlns="http://www.w3.org/2000/svg">`;
  // nut or base fret label
  if (v.base <= 1) {
    s += `<rect x="${left - 2}" y="${top - 5}" width="${right - left + 4}" height="5" rx="2" fill="currentColor"/>`;
  } else {
    s += `<text x="${left - 8}" y="${top + fh / 2 + 4}" font-size="11" fill="currentColor" text-anchor="end">${v.base}</text>`;
  }
  // frets
  for (let f = 1; f <= 4; f++) {
    const yy = top + f * fh;
    if (yy > bottom) break;
    s += `<line x1="${left}" y1="${yy}" x2="${right}" y2="${yy}" stroke="currentColor" stroke-width="1" opacity="0.45"/>`;
  }
  // strings
  for (let i = 0; i < 6; i++) {
    s += `<line x1="${x(i)}" y1="${top}" x2="${x(i)}" y2="${bottom}" stroke="currentColor" stroke-width="1" opacity="0.45"/>`;
  }
  // dots / open / muted
  v.frets.forEach((f, i) => {
    if (f === null) {
      s += `<circle cx="${x(i)}" cy="${top - 13}" r="4" fill="none" stroke="currentColor" stroke-width="1.4"/>`;
    } else if (f === 0) {
      s += `<circle cx="${x(i)}" cy="${top - 13}" r="4" fill="currentColor"/>`;
    } else {
      s += `<circle cx="${x(i)}" cy="${y(f)}" r="6" fill="var(--accent)"/>`;
    }
  });
  s += '</svg>';
  return s;
}

/* ---------------- scales ---------------- */

export const SCALES: Record<string, number[]> = {
  'Major (Ionian)': [0, 2, 4, 5, 7, 9, 11],
  'Natural minor': [0, 2, 3, 5, 7, 8, 10],
  'Harmonic minor': [0, 2, 3, 5, 7, 8, 11],
  'Melodic minor': [0, 2, 3, 5, 7, 9, 11],
  'Major pentatonic': [0, 2, 4, 7, 9],
  'Minor pentatonic': [0, 3, 5, 7, 10],
  Blues: [0, 3, 5, 6, 7, 10],
  Dorian: [0, 2, 3, 5, 7, 9, 10],
  Phrygian: [0, 1, 3, 5, 7, 8, 10],
  Lydian: [0, 2, 4, 6, 7, 9, 11],
  Mixolydian: [0, 2, 4, 5, 7, 9, 10],
  Locrian: [0, 1, 3, 5, 6, 8, 10],
};

/** Horizontal fretboard (low E on bottom) with scale dots. */
export function fretboardSVG(root: number, intervals: number[], frets = 12): string {
  const strings = ['E', 'A', 'D', 'G', 'B', 'e'];
  const openPitches = [4, 9, 2, 7, 11, 4]; // low E → high e
  const w = 16 + (frets + 1) * 34;
  const h = 6 * 30 + 34;
  const left = 44;
  const top = 10;
  const x = (f: number) => left + f * 34;
  const y = (s: number) => top + s * 30 + 15;

  const inScale = (p: number) => intervals.includes(((p - root) % 12 + 12) % 12);

  let s = `<svg width="${w}" height="${h}" viewBox="0 0 ${w} ${h}" xmlns="http://www.w3.org/2000/svg" style="max-width:100%;height:auto">`;
  // nut
  s += `<rect x="${left - 5}" y="${top - 3}" width="5" height="${6 * 30 + 6}" rx="2" fill="currentColor"/>`;
  // fret lines + numbers
  for (let f = 1; f <= frets; f++) {
    s += `<line x1="${x(f)}" y1="${top}" x2="${x(f)}" y2="${top + 6 * 30}" stroke="currentColor" stroke-width="1" opacity="0.4"/>`;
    if ([3, 5, 7, 9, 12].includes(f)) {
      s += `<text x="${x(f)}" y="${h - 8}" font-size="11" fill="currentColor" opacity="0.6" text-anchor="middle">${f}</text>`;
    }
  }
  // strings + labels
  strings.forEach((lbl, si) => {
    s += `<line x1="${left}" y1="${y(si)}" x2="${x(frets)}" y2="${y(si)}" stroke="currentColor" stroke-width="1.4" opacity="0.55"/>`;
    s += `<text x="${left - 14}" y="${y(si) + 4}" font-size="12" fill="currentColor" text-anchor="middle">${lbl}</text>`;
    for (let f = 0; f <= frets; f++) {
      const p = (openPitches[si] + f) % 12;
      if (inScale(p)) {
        const isRoot = p === root % 12;
        s += `<circle cx="${x(f)}" cy="${y(si)}" r="9" fill="${isRoot ? 'var(--accent)' : 'var(--muted)'}" ${isRoot ? '' : 'opacity="0.75"'}/>`;
        if (f === 0) {
          s += `<circle cx="${x(0) - 26}" cy="${y(si)}" r="7" fill="${isRoot ? 'var(--accent)' : 'var(--muted)'}" ${isRoot ? '' : 'opacity="0.75"'}/>`;
        }
      }
    }
  });
  s += '</svg>';
  return s;
}
