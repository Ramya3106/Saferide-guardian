const fs = require('fs');
let content = fs.readFileSync('App.js', 'utf8');
const tailwindClasses = JSON.parse(fs.readFileSync('tailwind_map.json', 'utf8'));

// A more aggressive parser
content = content.replace(/style=\{\[([\s\S]*?)\]\}/g, (match, inner) => {
  // inner could look like:
  // styles.opsStatusChip,
  // item.status === "Item Found" && styles.opsStatusFound,
  // { width: 100 }
  
  const parts = inner.split(',').map(s => s.trim()).filter(Boolean);
  
  const classNames = [];
  const stylesObj = [];
  
  for (const part of parts) {
    if (part.startsWith('styles.')) {
      const key = part.split('.')[1];
      if (tailwindClasses[key]) {
        classNames.push(`"${tailwindClasses[key]}"`);
      }
    } else if (part.includes('&&') && part.includes('styles.')) {
      // e.g. cond && styles.key
      const [cond, stylePart] = part.split('&&').map(s => s.trim());
      const key = stylePart.replace('styles.', '');
      if (tailwindClasses[key]) {
        classNames.push(`${cond} ? "${tailwindClasses[key]}" : ""`);
      }
    } else if (part.includes('?') && part.includes('styles.')) {
      // e.g. cond ? styles.key1 : styles.key2
      const [cond, rest] = part.split('?').map(s => s.trim());
      const [style1, style2] = rest.split(':').map(s => s.trim());
      const key1 = style1.replace('styles.', '');
      const key2 = style2.replace('styles.', '');
      if (tailwindClasses[key1] && tailwindClasses[key2]) {
        classNames.push(`${cond} ? "${tailwindClasses[key1]}" : "${tailwindClasses[key2]}"`);
      }
    } else if (part.startsWith('{') && part.endsWith('}')) {
      stylesObj.push(part);
    } else {
      // Something else, just skip or handle
      console.log('Skipping part:', part);
    }
  }
  
  if (classNames.length > 0) {
    let result = `className={\`${classNames.map(c => `\${${c}}`).join(' ')}\`}`;
    if (stylesObj.length > 0) {
      result += ` style={[${stylesObj.join(', ')}]}`;
    }
    return result;
  }
  
  return match;
});

fs.writeFileSync('App.js', content);
console.log('Cleanup 2 done');
