const createDefaultLine = () => ({ id: '1', label: '', blocks: [] });
const parseTextToLines = (text) => {
    const lines = [];
    const textLines = text.split('\n');
    
    const normalizeChordText = (text) => {
      let normalized = text
        .replace(/♭/g, 'b')
        .replace(/♯/g, '#')
        .replace(/△/g, 'maj7')
        .replace(/°/g, 'dim')
        .replace(/⁺/g, 'aug');
      
      const INVERSE_SUPER_MAP = {
        '⁰': '0', '¹': '1', '²': '2', '³': '3', '⁴': '4',
        '⁵': '5', '⁶': '6', '⁷': '7', '⁸': '8', '⁹': '9',
        '⁺': '+', '⁻': '-',
        'ᵃ': 'a', 'ᵇ': 'b', 'ᶜ': 'c', 'ᵈ': 'd', 'ᵉ': 'e',
        'ᶠ': 'f', 'ᵍ': 'g', 'ʰ': 'h', 'ⁱ': 'i', 'ʲ': 'j',
        'ᵏ': 'k', 'ˡ': 'l', 'ᵐ': 'm', 'ⁿ': 'n', 'ᵒ': 'o',
        'ᵖ': 'p', 'ʳ': 'r', 'ˢ': 's', 'ᵗ': 't', 'ᵘ': 'u',
        'ᵛ': 'v', 'ʷ': 'w', 'ˣ': 'x', 'ʸ': 'y', 'ᶻ': 'z',
        'ᴬ': 'A', 'ᴮ': 'B', 'ᴰ': 'D', 'ᴱ': 'E', 'ᴳ': 'G',
        'ᴴ': 'H', 'ᴵ': 'I', 'ᴶ': 'J', 'ᴷ': 'K', 'ᴸ': 'L',
        'ᴹ': 'M', 'ᴺ': 'N', 'ᴼ': 'O', 'ᴾ': 'P', 'ᴿ': 'R',
        'ᵀ': 'T', 'ᵁ': 'U', 'ⱽ': 'V', 'ᵂ': 'W',
      };
      
      let result = '';
      for (const char of normalized) {
        result += INVERSE_SUPER_MAP[char] || char;
      }
      return result;
    };

    for (const tLine of textLines) {
      if (!tLine.trim() || !tLine.includes('|')) continue; 
      
      let label = '';
      let content = tLine.trim();
      
      const firstBarMatch = content.match(/^(.*?):\s*(\|\|:|\|\|)(.*)$/);
      if (firstBarMatch) {
        label = firstBarMatch[1].trim();
        content = firstBarMatch[2] + firstBarMatch[3];
      } else {
        const altMatch = content.match(/^(.*?)\s+(\|\|:|\|\|)(.*)$/);
        if (altMatch && !altMatch[1].includes('|')) {
           label = altMatch[1].trim();
           if (label.endsWith(':')) label = label.slice(0, -1);
           content = altMatch[2] + altMatch[3];
        }
      }
      
      const tokens = content.split(/(\|\|:|:\|\|:|:\|\||\|\|)/).map(s => s.trim()).filter(s => s !== '');
      let blocks = [];
      let currentBlock = null;
      
      for (let i = 0; i < tokens.length; i++) {
        const token = tokens[i];
        
        if (token === '||' || token === '||:') {
          if (currentBlock) blocks.push(currentBlock);
          currentBlock = {
            id: 'id',
            startRepeat: token === '||:',
            endRepeat: false,
            bars: []
          };
        } else if (token === ':||' || token === ':||:') {
          if (currentBlock) {
            currentBlock.endRepeat = true;
            blocks.push(currentBlock);
            currentBlock = null;
          }
          if (token === ':||:') {
            currentBlock = {
              id: 'id',
              startRepeat: true,
              endRepeat: false,
              bars: []
            };
          }
        } else {
          if (!currentBlock) {
            currentBlock = {
              id: 'id',
              startRepeat: false,
              endRepeat: false,
              bars: []
            };
          }
          const bars = token.split('|').map(b => b.trim());
          currentBlock.bars.push(...bars.map(b => b === '_' || b === '' ? '' : normalizeChordText(b)));
        }
      }
      if (currentBlock) blocks.push(currentBlock);
      
      blocks = blocks.filter(b => b.bars.length > 0 || b.startRepeat || b.endRepeat);
      
      if (blocks.length > 0) {
        lines.push({
          id: 'id',
          label,
          blocks
        });
      }
    }
    
    if (lines.length === 0) {
      lines.push(createDefaultLine());
    }
    return lines;
  };
  
const input = `     Demo song      4/4      t=120
     
into: || C | D♭ | A | B || D | G | A | F ||

song: ||: Dm | Dm | Dm | Am :|| F | Gm | B♭ | B♭ ||

Bg: || Dm | Dm | Dm | Dm || Dm | Dm | Dm | Dm ||

|| Dm | Am | F | G || Gm | E♭ | A⁶ | A⁴ ||`;

console.log(JSON.stringify(parseTextToLines(input), null, 2));
