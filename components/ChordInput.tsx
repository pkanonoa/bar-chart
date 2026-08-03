'use client';

import { useState } from 'react';
import { parseChord } from '@/lib/chord-parser';

interface Props {
  value: string;
  onChange: (val: string) => void;
  onKeyDown?: (e: React.KeyboardEvent<HTMLInputElement>) => void;
  className?: string;
}

export function ChordInput({ value, onChange, onKeyDown, className = '' }: Props) {
  const [focused, setFocused] = useState(false);

  return (
    <div className={`relative flex items-center justify-center ${className}`}>
      {/* Background/overlay that renders the styled chord */}
      <div 
        className="absolute inset-0 pointer-events-none flex items-center justify-center whitespace-pre overflow-hidden"
        aria-hidden="true"
      >
        <span className="font-semibold text-lg text-white">
          {parseChord(value)}
        </span>
      </div>
      
      {/* Actual input: invisible text, but visible caret */}
      <input
        type="text"
        value={value}
        onChange={e => onChange(e.target.value)}
        onKeyDown={onKeyDown}
        onFocus={() => setFocused(true)}
        onBlur={() => setFocused(false)}
        className="w-full h-full bg-transparent text-transparent caret-white outline-none border-none text-center font-semibold text-lg focus:ring-2 focus:ring-indigo-500 rounded px-1 transition-shadow chord-input-field"
        spellCheck={false}
        autoComplete="off"
        style={{
          // A tiny hack to make the selection highlight visible since text is transparent
          textShadow: focused ? 'none' : 'none'
        }}
      />
    </div>
  );
}
