const fs = require('fs');
let content = fs.readFileSync('App.js', 'utf8');
const tailwindClasses = JSON.parse(fs.readFileSync('tailwind_map.json', 'utf8'));

// Handle trailing commas in conditional arrays
content = content.replace(/style=\{\[\s*styles\.([a-zA-Z0-9_]+),\s*([a-zA-Z0-9_]+)\s*&&\s*styles\.([a-zA-Z0-9_]+),?\s*\]\}/g, (match, key1, cond, key2) => {
  if (tailwindClasses[key1] && tailwindClasses[key2]) {
    return `className={\`${tailwindClasses[key1]} \${${cond} ? "${tailwindClasses[key2]}" : ""}\`}`;
  }
  return match;
});

// Handle simple multiple styles with trailing commas
content = content.replace(/style=\{\[\s*styles\.([a-zA-Z0-9_]+),\s*styles\.([a-zA-Z0-9_]+),?\s*\]\}/g, (match, key1, key2) => {
  if (tailwindClasses[key1] && tailwindClasses[key2]) {
    return `className="${tailwindClasses[key1]} ${tailwindClasses[key2]}"`;
  }
  return match;
});

// Handle ternary with trailing comma
content = content.replace(/style=\{\[\s*styles\.([a-zA-Z0-9_]+),\s*([a-zA-Z0-9_]+)\s*\?\s*styles\.([a-zA-Z0-9_]+)\s*:\s*styles\.([a-zA-Z0-9_]+),?\s*\]\}/g, (match, key1, cond, key2, key3) => {
  if (tailwindClasses[key1] && tailwindClasses[key2] && tailwindClasses[key3]) {
    return `className={\`${tailwindClasses[key1]} \${${cond} ? "${tailwindClasses[key2]}" : "${tailwindClasses[key3]}"}\`}`;
  }
  return match;
});

// For contentContainerStyle={styles.xyz}
content = content.replace(/contentContainerStyle=\{styles\.([a-zA-Z0-9_]+)\}/g, (match, key) => {
  if (tailwindClasses[key]) return `contentContainerStyle={{...}} /* replaced to class */ className="${tailwindClasses[key]}"`;
  return match;
});

// Let's just do a brute force replacement for any remaining styles.xyz
for (const [key, val] of Object.entries(tailwindClasses)) {
  // Replace standalone style={styles.xyz}
  content = content.replace(new RegExp(`style=\\{styles\\.${key}\\}`, 'g'), `className="${val}"`);
  
  // Replace inline objects style={[styles.xyz, { ... }]}
  content = content.replace(new RegExp(`style=\\{\\[\\s*styles\\.${key},\\s*(\\{.*?\\}),?\\s*\\]\\}`, 'g'), `className="${val}" style={$1}`);
}

// Write back
fs.writeFileSync('App.js', content);
console.log('Cleanup done');
