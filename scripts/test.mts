import {
  transposeLine,
  transposeToken,
  parseChord,
  chordVoicing,
  keyUsesFlats,
  NOTE_INDEX,
} from '../src/lib/music.ts';
import { findChart, CHART_LIST } from '../src/lib/charts.ts';
import {
  harteName,
  parsePyDict,
  detectKey,
  chartFromRow,
  getChordMap,
  normalizeKey,
  type ChordRow,
} from '../src/lib/chorddb.ts';

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

// chord database conversion
eq(harteName('G:maj'), 'G', 'harte maj');
eq(harteName('A:min'), 'Am', 'harte min');
eq(harteName('F#:min7'), 'F#m7', 'harte min7');
eq(harteName('D:(*3,*5)'), 'D', 'harte fingerpos stripped');
eq(harteName('N'), null, 'harte N no chord');
eq(harteName('A:min7/b7'), 'Am7/G', 'harte slash degree b7');
eq(harteName('G:maj/5'), 'G/D', 'harte slash degree 5');
eq(harteName('A:maj/3'), 'A/C#', 'harte slash degree 3');
eq(harteName('C:aug(b7)'), 'C7#5', 'harte aug(b7)');
eq(harteName('Ebb:maj'), null, 'harte garbage root dropped');

const py = parsePyDict(`{0: 'Verse 1:', 1: "don't ", 3: ['G:maj', 'A:min7']}`);
eq(py.get(0), 'Verse 1:', 'pydict string key 0');
eq(py.get(1), "don't ", 'pydict quoted apostrophe');
eq(JSON.stringify(py.get(3)), JSON.stringify(['G:maj', 'A:min7']), 'pydict list value');

// chart from a real-shaped row
const row: ChordRow = {
  artist: 'Test',
  title: 'Song',
  chords: parsePyDict(`{3: ['G:maj', 'C:maj', 'D:maj'], 9: ['E:min']}`),
  lyrics: parsePyDict(`{2: 'Verse 1:', 4: 'Hello world', 10: 'Just a line'}`),
};
const built = chartFromRow(row);
eq(built.keyName, 'G', 'chartFromRow key');
eq(built.body.split('\n')[0], '#G', 'chartFromRow key marker');
eq(built.body.includes('#Verse 1'), true, 'chartFromRow section');
eq(built.body.includes('G  C  D'), true, 'chartFromRow chord line');
eq(built.body.includes('Hello world'), true, 'chartFromRow lyric');
eq(built.body.includes('Just a line'), true, 'chartFromRow lyric2');

// section detection + junk line skipping
const row2: ChordRow = {
  artist: 'Test',
  title: 'Song2',
  chords: parsePyDict(`{1: ['C:maj'], 5: ['F:maj', 'G:maj']}`),
  lyrics: parsePyDict(`{0: '\\nCapo on 3rd fret\\n', 2: 'Chorus:', 3: '  De do do de da  ', 6: 'End line'}`),
};
const built2 = chartFromRow(row2);
eq(built2.body.includes('Capo'), false, 'junk capo line dropped');
eq(built2.body.includes('#Chorus'), true, 'chorus section marker');
eq(built2.body.includes('De do do de da'), true, 'lyric whitespace trimmed');

// escaped apostrophe inside a single-quoted python string
const py2 = parsePyDict(`{0: 'I don\\'t know'}`);
eq(py2.get(0), "I don't know", 'escaped apostrophe');

// normalizeKey matches build-time dedupe
eq(normalizeKey('Bob Dylan'), 'bobdylan', 'normalize key');
eq(normalizeKey('10,000 Hours'), '10000hours', 'normalize key strips punctuation');

console.log(fails === 0 ? 'ALL TESTS PASSED' : `${fails} FAILURES`);
process.exit(fails ? 1 : 0);
