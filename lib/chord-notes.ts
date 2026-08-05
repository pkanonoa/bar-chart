export interface ChordVoicingInfo {
  chordName: string;      // e.g. "F#m" or "Bm/F#"
  root: string;           // e.g. "F#"
  qualityName: string;    // e.g. "Minor" or "Dominant 7th"
  notes: string[];        // e.g. ["F#", "A", "C#"]
  bassNote?: string;      // e.g. "F#" for Bm/F#
  formattedNotes: string; // e.g. "F# · A · C#" or "B · D · F# [Bass: F#]"
}

const SHARPS = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];
const FLATS  = ['C', 'Db', 'D', 'Eb', 'E', 'F', 'Gb', 'G', 'Ab', 'A', 'Bb', 'B'];

function getPitchClass(note: string): number {
  const clean = note.replace('♯', '#').replace('♭', 'b');
  let idx = SHARPS.indexOf(clean);
  if (idx !== -1) return idx;
  idx = FLATS.indexOf(clean);
  if (idx !== -1) return idx;

  // Enharmonic specials
  if (clean === 'Cb') return 11;
  if (clean === 'B#') return 0;
  if (clean === 'E#') return 5;
  if (clean === 'Fb') return 4;

  return -1;
}

const CHORD_FORMULAS: Record<string, { name: string; intervals: number[] }> = {
  // Triads
  '':      { name: 'Major', intervals: [0, 4, 7] },
  'M':     { name: 'Major', intervals: [0, 4, 7] },
  'maj':   { name: 'Major', intervals: [0, 4, 7] },
  'm':     { name: 'Minor', intervals: [0, 3, 7] },
  'min':   { name: 'Minor', intervals: [0, 3, 7] },
  '-':     { name: 'Minor', intervals: [0, 3, 7] },
  'dim':   { name: 'Diminished', intervals: [0, 3, 6] },
  '°':     { name: 'Diminished', intervals: [0, 3, 6] },
  'aug':   { name: 'Augmented', intervals: [0, 4, 8] },
  '+':     { name: 'Augmented', intervals: [0, 4, 8] },
  '5':     { name: 'Power Chord', intervals: [0, 7] },

  // Suspended & Added
  'sus':   { name: 'Sus4', intervals: [0, 5, 7] },
  'sus4':  { name: 'Sus4', intervals: [0, 5, 7] },
  'sus2':  { name: 'Sus2', intervals: [0, 2, 7] },
  'add9':  { name: 'Add9', intervals: [0, 4, 7, 2] },
  'add2':  { name: 'Add9', intervals: [0, 4, 7, 2] },
  'madd9': { name: 'Minor Add9', intervals: [0, 3, 7, 2] },
  'madd2': { name: 'Minor Add9', intervals: [0, 3, 7, 2] },
  '7sus4': { name: '7th Sus4', intervals: [0, 5, 7, 10] },
  '7sus':  { name: '7th Sus4', intervals: [0, 5, 7, 10] },

  // Sevenths & Sixths
  '6':     { name: 'Major 6th', intervals: [0, 4, 7, 9] },
  'm6':    { name: 'Minor 6th', intervals: [0, 3, 7, 9] },
  'min6':  { name: 'Minor 6th', intervals: [0, 3, 7, 9] },
  '7':     { name: 'Dominant 7th', intervals: [0, 4, 7, 10] },
  'dom7':  { name: 'Dominant 7th', intervals: [0, 4, 7, 10] },
  'maj7':  { name: 'Major 7th', intervals: [0, 4, 7, 11] },
  'M7':    { name: 'Major 7th', intervals: [0, 4, 7, 11] },
  'major7':{ name: 'Major 7th', intervals: [0, 4, 7, 11] },
  '△':     { name: 'Major 7th', intervals: [0, 4, 7, 11] },
  'm7':    { name: 'Minor 7th', intervals: [0, 3, 7, 10] },
  'min7':  { name: 'Minor 7th', intervals: [0, 3, 7, 10] },
  '-7':    { name: 'Minor 7th', intervals: [0, 3, 7, 10] },
  'mMaj7': { name: 'Minor-Major 7th', intervals: [0, 3, 7, 11] },
  'mM7':   { name: 'Minor-Major 7th', intervals: [0, 3, 7, 11] },
  'dim7':  { name: 'Diminished 7th', intervals: [0, 3, 6, 9] },
  '°7':    { name: 'Diminished 7th', intervals: [0, 3, 6, 9] },
  'm7b5':  { name: 'Half-Diminished 7th', intervals: [0, 3, 6, 10] },
  'm7♭5':  { name: 'Half-Diminished 7th', intervals: [0, 3, 6, 10] },
  'ø':     { name: 'Half-Diminished 7th', intervals: [0, 3, 6, 10] },
  'ø7':    { name: 'Half-Diminished 7th', intervals: [0, 3, 6, 10] },
  '7b5':   { name: '7♭5', intervals: [0, 4, 6, 10] },
  '7♭5':   { name: '7♭5', intervals: [0, 4, 6, 10] },
  '7#5':   { name: '7♯5', intervals: [0, 4, 8, 10] },
  '7♯5':   { name: '7♯5', intervals: [0, 4, 8, 10] },
  '+7':    { name: 'Augmented 7th', intervals: [0, 4, 8, 10] },
  'aug7':  { name: 'Augmented 7th', intervals: [0, 4, 8, 10] },

  // Extended
  '9':     { name: 'Dominant 9th', intervals: [0, 4, 7, 10, 2] },
  'maj9':  { name: 'Major 9th', intervals: [0, 4, 7, 11, 2] },
  'M9':    { name: 'Major 9th', intervals: [0, 4, 7, 11, 2] },
  'm9':    { name: 'Minor 9th', intervals: [0, 3, 7, 10, 2] },
  'min9':  { name: 'Minor 9th', intervals: [0, 3, 7, 10, 2] },
  '7b9':   { name: '7♭9', intervals: [0, 4, 7, 10, 1] },
  '7#9':   { name: '7♯9', intervals: [0, 4, 7, 10, 3] },
  '11':    { name: '11th', intervals: [0, 4, 7, 10, 2, 5] },
  'm11':   { name: 'Minor 11th', intervals: [0, 3, 7, 10, 2, 5] },
  '13':    { name: '13th', intervals: [0, 4, 7, 10, 2, 9] },
  'm13':   { name: 'Minor 13th', intervals: [0, 3, 7, 10, 2, 9] },
};

function preferFlatsForChord(root: string, quality: string): boolean {
  const clean = root.replace('♭', 'b');
  if (clean.includes('b') || clean === 'F' || clean === 'Bb' || clean === 'Eb' || clean === 'Ab' || clean === 'Db' || clean === 'Gb') {
    return true;
  }
  if ((clean === 'C' || clean === 'G') && (
    (quality.startsWith('m') && !quality.startsWith('maj')) ||
    quality.startsWith('dim') ||
    quality.startsWith('ø') ||
    quality.startsWith('°')
  )) {
    return true;
  }
  return false;
}

/**
 * Resolves any chord symbol (e.g. "F#m", "D△", "E7/A", "Bm/F#") into its musical note breakdown.
 */
export function getChordNotes(rawChord: string): ChordVoicingInfo | null {
  if (!rawChord || rawChord.trim() === '' || rawChord.trim() === '_' || rawChord.trim() === '-') {
    return null;
  }

  // Handle slash chords (e.g. "Bm/F#" or "E7/A")
  const parts = rawChord.split('/');
  const mainChord = parts[0].trim();
  const bassNote = parts.length > 1 && parts[1].trim() ? parts[1].trim().replace('b', '♭').replace('#', '♯') : undefined;

  // Extract root and quality
  const match = mainChord.match(/^([A-G](?:[#b♯♭])?)(.*)$/);
  if (!match) {
    return null;
  }

  const rootStr = match[1];
  let qualityStr = match[2].trim();

  // Clean up common visual symbols
  qualityStr = qualityStr.replace(/major/gi, 'maj').replace(/minor/gi, 'min');

  const rootPc = getPitchClass(rootStr);
  if (rootPc === -1) return null;

  let formula = CHORD_FORMULAS[qualityStr];

  // Fallback heuristic if exact string isn't in formula table
  if (!formula) {
    const lower = qualityStr.toLowerCase();
    if (lower.startsWith('m') && !lower.startsWith('maj') || qualityStr.startsWith('-')) {
      formula = { name: 'Minor', intervals: [0, 3, 7] };
    } else if (lower.startsWith('dim') || qualityStr.includes('°')) {
      formula = { name: 'Diminished', intervals: [0, 3, 6] };
    } else if (lower.startsWith('aug') || qualityStr.includes('+')) {
      formula = { name: 'Augmented', intervals: [0, 4, 8] };
    } else {
      formula = { name: 'Major', intervals: [0, 4, 7] };
    }
  }

  const useFlats = preferFlatsForChord(rootStr, qualityStr);
  const scale = useFlats ? FLATS : SHARPS;

  const notes = formula.intervals.map(interval => {
    let pc = (rootPc + interval) % 12;
    if (pc < 0) pc += 12;
    return scale[pc].replace('b', '♭').replace('#', '♯');
  });

  const displayRoot = rootStr.replace('b', '♭').replace('#', '♯');
  let formattedNotes = notes.join(' · ');
  if (bassNote && bassNote !== '_') {
    formattedNotes = `${notes.join(' · ')} [Bass: ${bassNote}]`;
  }

  return {
    chordName: rawChord,
    root: displayRoot,
    qualityName: formula.name,
    notes,
    bassNote: bassNote && bassNote !== '_' ? bassNote : undefined,
    formattedNotes
  };
}
