const fs = require('fs');

const styles = JSON.parse(fs.readFileSync('extracted_styles.json', 'utf8'));

function camelToDash(str) {
  return str.replace(/([A-Z])/g, '-$1').toLowerCase();
}

function toTw(key, val) {
  if (typeof val === 'number') {
    // try to match specific spacing 
    const spacingMap = {
      0: '0', 2: '0.5', 4: '1', 6: '1.5', 8: '2', 10: '2.5', 12: '3', 
      14: '3.5', 16: '4', 20: '5', 24: '6', 28: '7', 32: '8', 40: '10',
      48: '12', 56: '14', 64: '16'
    };
    
    if (key === 'flex') return `flex-[${val}]`;
    if (key.includes('flexGrow')) return `grow-[${val}]`;
    if (key.includes('opacity')) return val === 1 ? 'opacity-100' : val === 0 ? 'opacity-0' : `opacity-[${val}]`;
    
    const isSpacing = ['margin', 'padding', 'width', 'height', 'top', 'bottom', 'left', 'right', 'gap', 'borderRadius', 'borderWidth'].some(prefix => key.startsWith(prefix));
    const prefixMap = {
      marginTop: 'mt', marginBottom: 'mb', marginLeft: 'ml', marginRight: 'mr',
      marginVertical: 'my', marginHorizontal: 'mx', margin: 'm',
      paddingTop: 'pt', paddingBottom: 'pb', paddingLeft: 'pl', paddingRight: 'pr',
      paddingVertical: 'py', paddingHorizontal: 'px', padding: 'p',
      width: 'w', height: 'h', minHeight: 'min-h', minWidth: 'min-w',
      top: 'top', bottom: 'bottom', left: 'left', right: 'right', gap: 'gap',
      rowGap: 'gap-y', columnGap: 'gap-x',
      borderRadius: 'rounded', borderTopLeftRadius: 'rounded-tl', borderTopRightRadius: 'rounded-tr',
      borderBottomLeftRadius: 'rounded-bl', borderBottomRightRadius: 'rounded-br',
      borderWidth: 'border', borderTopWidth: 'border-t', borderBottomWidth: 'border-b',
      borderLeftWidth: 'border-l', borderRightWidth: 'border-r',
      fontSize: 'text'
    };

    const prefix = prefixMap[key] || camelToDash(key);
    
    // font size mappings
    if (key === 'fontSize') {
      const fsMap = { 10: 'text-[10px]', 11: 'text-[11px]', 12: 'text-xs', 13: 'text-[13px]', 14: 'text-sm', 15: 'text-[15px]', 16: 'text-base', 18: 'text-lg', 20: 'text-xl', 22: 'text-[22px]', 24: 'text-2xl', 28: 'text-[28px]', 32: 'text-3xl' };
      return fsMap[val] || `text-[${val}px]`;
    }

    if (isSpacing && prefixMap[key]) {
      return spacingMap[val] ? `${prefixMap[key]}-${spacingMap[val]}` : `${prefixMap[key]}-[${val}px]`;
    }
    
    return `${prefix}-[${val}]`;
  } else if (typeof val === 'string') {
    if (key === 'backgroundColor') return `bg-[${val}]`;
    if (key === 'color') return `text-[${val}]`;
    if (key === 'borderColor') return `border-[${val}]`;
    if (key === 'borderTopColor') return `border-t-[${val}]`;
    if (key === 'borderBottomColor') return `border-b-[${val}]`;
    
    if (key === 'flexDirection') return val === 'row' ? 'flex-row' : val === 'column' ? 'flex-col' : `flex-${val}`;
    if (key === 'justifyContent') return `justify-${val.replace('flex-', '')}`;
    if (key === 'alignItems') return `items-${val.replace('flex-', '')}`;
    if (key === 'alignSelf') return `self-${val.replace('flex-', '')}`;
    if (key === 'flexWrap') return `flex-${val}`;
    
    if (key === 'position') return val;
    if (key === 'textAlign') return `text-${val}`;
    if (key === 'fontWeight') {
      const fwMap = { '400': 'font-normal', '500': 'font-medium', '600': 'font-semibold', '700': 'font-bold', '800': 'font-extrabold', '900': 'font-black' };
      return fwMap[val] || `font-[${val}]`;
    }
    
    if (val.includes('%')) {
      const prefixMap = { width: 'w', height: 'h' };
      if (prefixMap[key]) return `${prefixMap[key]}-[${val}]`;
    }
    
    return `${camelToDash(key)}-[${val}]`;
  }
  return '';
}

const tailwindClasses = {};

for (const [className, rules] of Object.entries(styles)) {
  const twClasses = [];
  for (const [k, v] of Object.entries(rules)) {
    if (['shadowColor', 'shadowOffset', 'shadowOpacity', 'shadowRadius', 'elevation'].includes(k)) continue;
    twClasses.push(toTw(k, v));
  }
  
  // Custom elevation/shadow handling
  if (rules.elevation || rules.shadowOpacity) {
    if (rules.elevation <= 2) twClasses.push('shadow-sm');
    else if (rules.elevation <= 4) twClasses.push('shadow');
    else if (rules.elevation <= 6) twClasses.push('shadow-md');
    else twClasses.push('shadow-lg');
  }
  
  tailwindClasses[className] = twClasses.filter(Boolean).join(' ');
}

fs.writeFileSync('tailwind_map.json', JSON.stringify(tailwindClasses, null, 2));

// Now replace in App.js
let appContent = fs.readFileSync('App.js', 'utf8');

// Replace style={styles.xyz}
appContent = appContent.replace(/style=\{styles\.([a-zA-Z0-9_]+)\}/g, (match, key) => {
  if (tailwindClasses[key]) return `className="${tailwindClasses[key]}"`;
  return match;
});

// Replace style={[styles.a, styles.b]}
appContent = appContent.replace(/style=\{\[\s*styles\.([a-zA-Z0-9_]+),\s*styles\.([a-zA-Z0-9_]+)\s*\]\}/g, (match, key1, key2) => {
  if (tailwindClasses[key1] && tailwindClasses[key2]) {
    return `className="${tailwindClasses[key1]} ${tailwindClasses[key2]}"`;
  }
  return match;
});

// Replace style={[styles.a, cond && styles.b]}
appContent = appContent.replace(/style=\{\[\s*styles\.([a-zA-Z0-9_]+),\s*([a-zA-Z0-9_]+)\s*&&\s*styles\.([a-zA-Z0-9_]+)\s*\]\}/g, (match, key1, cond, key2) => {
  if (tailwindClasses[key1] && tailwindClasses[key2]) {
    return `className={\`${tailwindClasses[key1]} \${${cond} ? "${tailwindClasses[key2]}" : ""}\`}`;
  }
  return match;
});

// Replace style={[styles.a, cond ? styles.b : styles.c]}
appContent = appContent.replace(/style=\{\[\s*styles\.([a-zA-Z0-9_]+),\s*([a-zA-Z0-9_]+)\s*\?\s*styles\.([a-zA-Z0-9_]+)\s*:\s*styles\.([a-zA-Z0-9_]+)\s*\]\}/g, (match, key1, cond, key2, key3) => {
  if (tailwindClasses[key1] && tailwindClasses[key2] && tailwindClasses[key3]) {
    return `className={\`${tailwindClasses[key1]} \${${cond} ? "${tailwindClasses[key2]}" : "${tailwindClasses[key3]}"}\`}`;
  }
  return match;
});

// Replace inline merges: style={[styles.a, { ... }]}
appContent = appContent.replace(/style=\{\[\s*styles\.([a-zA-Z0-9_]+),\s*(\{.*?\})\s*\]\}/g, (match, key1, inline) => {
  if (tailwindClasses[key1]) {
    return `className="${tailwindClasses[key1]}" style={${inline}}`;
  }
  return match;
});

// Remove StyleSheet import
appContent = appContent.replace(/StyleSheet,?\s*/, '');

// Remove style block completely
const styleStart = appContent.indexOf('const styles = StyleSheet.create({');
const styleEnd = appContent.lastIndexOf('});', appContent.indexOf('const App ='));
if (styleStart !== -1 && styleEnd !== -1) {
  appContent = appContent.slice(0, styleStart) + appContent.slice(styleEnd + 3);
}

fs.writeFileSync('App.js', appContent);
console.log('App.js updated');
