const fs = require('fs');

let appContent = fs.readFileSync('App.js', 'utf8');

const styleStart = appContent.indexOf('const styles = StyleSheet.create({');
const styleEnd = appContent.lastIndexOf('});', appContent.indexOf('const App ='));

if (styleStart === -1 || styleEnd === -1) {
  console.log('Could not find style block');
  process.exit(1);
}

const styleStr = appContent.slice(styleStart, styleEnd + 3);
const justObj = styleStr.replace('const styles = StyleSheet.create(', '').slice(0, -2);

const stylesObj = eval('(' + justObj + ')');
console.log('Successfully extracted', Object.keys(stylesObj).length, 'styles');

fs.writeFileSync('extracted_styles.json', JSON.stringify(stylesObj, null, 2));
