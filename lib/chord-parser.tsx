import React from 'react';

const SUPER_MAP: Record<string, string> = {
  '0': '⁰', '1': '¹', '2': '²', '3': '³', '4': '⁴',
  '5': '⁵', '6': '⁶', '7': '⁷', '8': '⁸', '9': '⁹',
  '+': '⁺', '-': '⁻',
  'a': 'ᵃ', 'b': 'ᵇ', 'c': 'ᶜ', 'd': 'ᵈ', 'e': 'ᵉ',
  'f': 'ᶠ', 'g': 'ᵍ', 'h': 'ʰ', 'i': 'ⁱ', 'j': 'ʲ',
  'k': 'ᵏ', 'l': 'ˡ', 'm': 'ᵐ', 'n': 'ⁿ', 'o': 'ᵒ',
  'p': 'ᵖ', 'r': 'ʳ', 's': 'ˢ', 't': 'ᵗ', 'u': 'ᵘ',
  'v': 'ᵛ', 'w': 'ʷ', 'x': 'ˣ', 'y': 'ʸ', 'z': 'ᶻ',
  'A': 'ᴬ', 'B': 'ᴮ', 'D': 'ᴰ', 'E': 'ᴱ', 'G': 'ᴳ',
  'H': 'ᴴ', 'I': 'ᴵ', 'J': 'ᴶ', 'K': 'ᴷ', 'L': 'ᴸ',
  'M': 'ᴹ', 'N': 'ᴺ', 'O': 'ᴼ', 'P': 'ᴾ', 'R': 'ᴿ',
  'T': 'ᵀ', 'U': 'ᵁ', 'V': 'ⱽ', 'W': 'ᵂ',
};

function toSuperscript(str: string): string {
  return str.split('').map(c => SUPER_MAP[c] || c).join('');
}

function parseSingleChord(raw: string) {
  const match = raw.match(/^([A-G])([#b])?(.*)$/);
  if (!match) {
    return <span>{raw}</span>;
  }
  
  const [, root, accidental, rest] = match;
  const nodes: React.ReactNode[] = [];
  
  nodes.push(<span key="root">{root}</span>);
  
  if (accidental === '#') nodes.push(<sup key="acc" className="relative -top-[0.4em] text-[0.65em] -ml-[0.1em] -mr-[0.3em]">♯</sup>);
  else if (accidental === 'b') nodes.push(<sup key="acc" className="relative -top-[0.4em] text-[0.65em] -ml-[0.1em] -mr-[0.3em]">♭</sup>);
  
  if (rest) {
    const regex = /(maj7|major7|M7|dim|aug|sus|add|m|b|#|\d+|.)/gi;
    let m;
    let i = 0;
    while ((m = regex.exec(rest)) !== null) {
      const token = m[1];
      const lower = token.toLowerCase();
      let content = token;
      let isSuper = true;
      
      if (lower === 'm') {
        isSuper = false;
      }
      
      if (token === 'm') {
        isSuper = false;
      } else if (token === 'maj7' || token === 'major7' || token === 'M7') {
        content = '△';
      } else if (token === 'dim') {
        content = '°';
      } else if (token === 'aug') {
        content = '+';
      } else if (token === 'b') {
        content = '♭';
      } else if (token === '#') {
        content = '♯';
      }
      
      if (isSuper) {
        nodes.push(<sup key={`mod-${i}`} className="relative -top-[0.4em] text-[0.65em] -ml-[0.1em]">{content}</sup>);
      } else {
        nodes.push(<span key={`mod-${i}`}>{content}</span>);
      }
      i++;
    }
  }
  
  return <>{nodes}</>;
}

export function parseChord(raw: string): React.ReactNode {
  if (!raw || raw.trim() === '') return null;
  
  // If it doesn't start with A-G, just return it
  if (!/^[A-G]/.test(raw)) {
    return <span>{raw}</span>;
  }
  
  const parts = raw.split('/');
  const nodes: React.ReactNode[] = [];
  
  nodes.push(<React.Fragment key="main">{parseSingleChord(parts[0])}</React.Fragment>);
  
  for (let i = 1; i < parts.length; i++) {
    nodes.push(<span key={`slash-${i}`}>/</span>);
    nodes.push(<React.Fragment key={`bass-${i}`}>{parseSingleChord(parts[i])}</React.Fragment>);
  }
  
  return <>{nodes}</>;
}

export function parseSingleChordToText(raw: string): string {
  const match = raw.match(/^([A-G])([#b])?(.*)$/);
  if (!match) {
    return raw;
  }
  
  const [, root, accidental, rest] = match;
  let text = root;
  
  if (accidental === '#') text += '♯';
  else if (accidental === 'b') text += '♭';
  
  if (rest) {
    const regex = /(maj7|major7|M7|dim|aug|sus|add|m|b|#|\d+|.)/gi;
    let m;
    while ((m = regex.exec(rest)) !== null) {
      const token = m[1];
      const lower = token.toLowerCase();
      let content = token;
      let isSuper = true;
      
      if (lower === 'm') {
        isSuper = false;
      }
      
      if (token === 'maj7' || token === 'major7' || token === 'M7') {
        content = '△';
      } else if (token === 'dim') {
        content = '°';
      } else if (token === 'aug') {
        content = '+';
      } else if (token === 'b') {
        content = '♭';
      } else if (token === '#') {
        content = '♯';
      }
      
      if (isSuper) {
        text += toSuperscript(content);
      } else {
        text += content;
      }
    }
  }
  
  return text;
}

export function parseChordToText(raw: string): string {
  if (!raw || raw.trim() === '') return '';
  
  if (!/^[A-G]/.test(raw)) {
    return raw;
  }
  
  const parts = raw.split('/');
  let text = parseSingleChordToText(parts[0]);
  
  for (let i = 1; i < parts.length; i++) {
    text += '/' + parseSingleChordToText(parts[i]);
  }
  
  return text;
}
