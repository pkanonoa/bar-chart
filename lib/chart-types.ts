export type Block = {
  id: string;
  bars: string[];
  startRepeat?: boolean;
  endRepeat?: boolean;
};

export type Line = {
  id: string;
  label: string;
  labelRight?: string;
  blocks: Block[];
};

export type ChartData = {
  id: string;
  title: string;
  tempo: number | null;
  time_sig: string | null;
  lines: Line[];
  semitone_offset: number;
  prefer_flats: boolean;
  folder_id: string | null;
  custom_text?: string | null;
  created_by: string;
  updated_at: string;
};

// Initial default: 1 line with 2 blocks of 4 bars each.
export const createDefaultLine = (): Line => ({
  id: crypto.randomUUID(),
  label: '',
  blocks: [
    { id: crypto.randomUUID(), bars: ['', '', '', ''] },
    { id: crypto.randomUUID(), bars: ['', '', '', ''] }
  ]
});

export const createDefaultBlock = (): Block => ({
  id: crypto.randomUUID(),
  bars: ['', '']
});
