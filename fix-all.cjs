const fs = require('fs');
const path = require('path');

const filePath = path.join(__dirname, 'src/context/LanguageContext.tsx');
let content = fs.readFileSync(filePath, 'utf8');

// Helper: extract a block starting with a pattern (e.g. 'const en = {')
function dedupeBlock(pattern) {
  const startIdx = content.indexOf(pattern);
  if (startIdx === -1) return false;

  const startPos = startIdx + pattern.length;
  let braceCount = 0;
  let endIdx = startPos;
  for (let i = startPos; i < content.length; i++) {
    const ch = content[i];
    if (ch === '{') braceCount++;
    else if (ch === '}') {
      if (braceCount === 0) {
        endIdx = i + 1;
        break;
      }
      braceCount--;
    }
  }

  const block = content.substring(startIdx, endIdx);
  const inner = block.substring(block.indexOf('{') + 1, block.lastIndexOf('}'));
  const lines = inner.split('\n');
  const keyMap = {};
  for (const line of lines) {
    const trimmed = line.trim();
    const match = trimmed.match(/^([a-zA-Z_][a-zA-Z0-9_]*)\s*:/);
    if (match) {
      const key = match[1];
      keyMap[key] = line; // keep last occurrence
    }
  }
  // Rebuild with unique keys
  const indentMatch = block.match(/^(\s*)/);
  const indent = indentMatch ? indentMatch[1] : '';
  let newBlock = pattern + '{\n';
  for (const [key, line] of Object.entries(keyMap)) {
    newBlock += indent + '  ' + line + '\n';
  }
  newBlock += indent + '}';
  content = content.substring(0, startIdx) + newBlock + content.substring(endIdx);
  return true;
}

// Process each language object
['const sw = ', 'const en = ', 'const zh = '].forEach(p => {
  if (dedupeBlock(p)) console.log(`✅ Deduplicated ${p.trim()}`);
});

fs.writeFileSync(filePath, content, 'utf8');
console.log('🎉 LanguageContext.tsx cleaned.');