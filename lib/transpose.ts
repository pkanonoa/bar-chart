import { ChartData } from './chart-types';

const SHARPS = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];
const FLATS = ['C', 'Db', 'D', 'Eb', 'E', 'F', 'Gb', 'G', 'Ab', 'A', 'Bb', 'B'];

function getPitchClass(note: string): number {
  const indexSharp = SHARPS.indexOf(note);
  if (indexSharp !== -1) return indexSharp;
  const indexFlat = FLATS.indexOf(note);
  if (indexFlat !== -1) return indexFlat;
  
  if (note === 'Cb') return 11;
  if (note === 'B#') return 0;
  if (note === 'E#') return 5;
  if (note === 'Fb') return 4;
  
  return -1;
}

export function transposeSingleChord(raw: string, semitones: number, preferFlats: boolean): string {
  const match = raw.match(/^([A-G][#b]?)(.*)$/);
  if (!match) return raw;
  
  const [, root, rest] = match;
  const pc = getPitchClass(root);
  if (pc === -1) return raw;
  
  let newPc = (pc + semitones) % 12;
  if (newPc < 0) newPc += 12;
  
  const newRoot = preferFlats ? FLATS[newPc] : SHARPS[newPc];
  return `${newRoot}${rest}`;
}

export function transposeChordString(raw: string, semitones: number, preferFlats: boolean): string {
  if (!raw || !/^[A-G]/.test(raw)) return raw;
  
  const parts = raw.split('/');
  const newParts = parts.map(p => transposeSingleChord(p, semitones, preferFlats));
  return newParts.join('/');
}

export function transposeChart(chart: ChartData, deltaSemitones: number, newPreferFlats: boolean): ChartData {
  const newLines = chart.lines.map(line => ({
    ...line,
    blocks: line.blocks.map(block => ({
      ...block,
      bars: block.bars.map(bar => transposeChordString(bar, deltaSemitones, newPreferFlats))
    }))
  }));
  
  return {
    ...chart,
    semitone_offset: chart.semitone_offset + deltaSemitones,
    prefer_flats: newPreferFlats,
    lines: newLines
  };
}

export function resetChartTranspose(chart: ChartData): ChartData {
  if (chart.semitone_offset === 0) return chart;
  return transposeChart(chart, -chart.semitone_offset, chart.prefer_flats);
}
