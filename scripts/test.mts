import {
  transposeLine,
  transposeToken,
  parseChord,
  chordVoicing,
  keyUsesFlats,
  NOTE_INDEX,
} from '../src/lib/music.ts';
import { findChart, CHART_LIST } from '../src/lib/charts.ts';

let fails = 0;
const eq = (a: unknown, b: unknown, msg: string) => {
  if (JSON.stringify(a) !== JSON.stringify(b)) {
    console.log('FAIL', msg, '-> got', JSON.stringify(a), 'want', JSON.stringify(b));
    fails++;
  }
};

// transposition
eq(transposeToken('G', 2), 'A', 'G+2=A');
eq(transposeToken('C', -1), 'B', 'C-1=B');
eq(transposeToken('Am', 2), 'Bm', 'Am+2=Bm');
eq(transposeToken('F#m7', 1), 'Gm7', 'F#m7+1 (F#+1=G)');
eq(transposeToken('C/E', 2), 'D/F#', 'slash chord');
eq(transposeLine('G   D   Em', 2), 'A   E   F#m', 'whole line up a tone');
eq(parseChord('blah'), null, 'non-chord rejected');
eq(parseChord('Bb'), { root: 10, quality: '', bass: undefined }, 'Bb parse');
eq(keyUsesFlats(NOTE_INDEX['Bb']), true, 'Bb uses flats');
eq(keyUsesFlats(NOTE_INDEX['G']), false, 'G uses sharps');

// voicings exist for common chords
for (const name of ['C','G','D','A','E','Am','Em','Dm','F','F#m','Bb','Gm','D7','A7','E7','Cmaj7','Bm','C#m','F#','Ab','Gsus4','Cadd9','Ebm']) {
  const v = chordVoicing(name);
  if (!v) { console.log('FAIL no voicing for', name); fails++; continue; }
  if (v.frets.length !== 6) { console.log('FAIL frets length', name); fails++; }
  const min = Math.min(...v.frets.filter((f): f is number => f !== null));
  if (min < 0) { console.log('FAIL negative fret', name); fails++; }
}

// charts
eq(CHART_LIST.length, 10, '10 charts');
eq(!!findChart('Bob Dylan', "Knockin' on Heaven's Door"), true, 'chart lookup');
eq(!!findChart("Guns N' Roses", "Knockin' on Heaven's Door"), true, 'alias lookup');
eq(!!findChart('The Beatles', 'Let It Be'), true, 'beatles');
eq(findChart('Nobody', 'Nothing'), undefined, 'missing chart');

// every non-header, non-lyric chord line in every chart must parse fully
const CHORD_TOKEN = /^([A-G][b#]?)([^/\s]*)(?:\/[A-G][b#]?)?$/;
let chordLines = 0;
for (const c of CHART_LIST) {
  const chart = findChart(c.artist, c.title)!;
  for (const line of chart.body.split('\n')) {
    const t = line.trim();
    if (!t || t.startsWith('#')) continue;
    const tokens = t.split(/\s+/);
    if (tokens.every((tok) => CHORD_TOKEN.test(tok) && parseChord(tok))) chordLines++;
  }
  if (!/^#[A-G][b#]?m?$/.test(chart.body.split('\n')[0].trim())) {
    console.log('FAIL chart must start with key marker:', c.title);
    fails++;
  }
}
console.log(`checked ${chordLines} chord lines across ${CHART_LIST.length} charts`);
console.log(fails === 0 ? 'ALL TESTS PASSED' : `${fails} FAILURES`);
process.exit(fails ? 1 : 0);
