const fs = require('fs');
const path = require('path');

function walkDir(dir, callback) {
  fs.readdirSync(dir).forEach(f => {
    let dirPath = path.join(dir, f);
    let isDirectory = fs.statSync(dirPath).isDirectory();
    isDirectory ? walkDir(dirPath, callback) : callback(path.join(dir, f));
  });
}

let count = 0;
walkDir('src/screens', function(filePath) {
  if (filePath.endsWith('.tsx')) {
    let original = fs.readFileSync(filePath, 'utf8');
    let content = original;

    // Replace text-white variations with safe regex boundary
    content = content.replace(/\btext-white\b/g, 'text-foreground');
    content = content.replace(/\btext-white\/(\d+)\b/g, 'text-foreground/');
    content = content.replace(/\bbg-white\/5\b/g, 'bg-muted/50');
    content = content.replace(/\bbg-white\/10\b/g, 'bg-muted');

    if (content !== original) {
      fs.writeFileSync(filePath, content, 'utf8');
      count++;
    }
  }
});
console.log('Replaced text-white in ' + count + ' files.');
