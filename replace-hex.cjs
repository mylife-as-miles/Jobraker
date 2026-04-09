const fs = require('fs');
const path = require('path');

function walkDir(dir, callback) {
  if (!fs.existsSync(dir)) return;
  fs.readdirSync(dir).forEach(f => {
    let dirPath = path.join(dir, f);
    if (dirPath.includes('node_modules')) return;
    let isDirectory = fs.statSync(dirPath).isDirectory();
    isDirectory ? walkDir(dirPath, callback) : callback(path.join(dir, f));
  });
}

let count = 0;
walkDir('src', function(filePath) {
  if (filePath.endsWith('.tsx')) {
    let original = fs.readFileSync(filePath, 'utf8');
    let content = original;

    // Replace dark gray background hex codes
    content = content.replace(/bg-\[#(0[aA]0[aA]0[aA]|121212|1[aA]1[aA]1[aA]|111111|1[eE]1[eE]1[eE])\]/g, 'bg-background');
    content = content.replace(/bg-\[#(1A261C|1a261c)\]/g, 'bg-background');
    content = content.replace(/bg-\[#(28392B|28392b)\]/g, 'bg-border');
    content = content.replace(/bg-\[#111812\]/g, 'bg-foreground');

    if (content !== original) {
      fs.writeFileSync(filePath, content, 'utf8');
      count++;
    }
  }
});
console.log('Replaced in ' + count + ' files.');
