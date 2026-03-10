const fs = require('fs');
const path = require('path');

function walkDir(dir, callback) {
  if (!fs.existsSync(dir)) return;
  fs.readdirSync(dir).forEach(f => {
    let dirPath = path.join(dir, f);
    let isDirectory = fs.statSync(dirPath).isDirectory();
    isDirectory ? walkDir(dirPath, callback) : callback(path.join(dir, f));
  });
}

let count = 0;
walkDir('src/components', function(filePath) {
  if (filePath.endsWith('.tsx')) {
    let original = fs.readFileSync(filePath, 'utf8');
    let content = original;

    // Special edge cases
    content = content.replace(/min-h-screen grid place-items-center bg-black/g, 'min-h-screen grid place-items-center bg-background');
    content = content.replace(/min-h-screen bg-black/g, 'min-h-screen bg-background');
    
    // Replace text-white variations but avoid doing it randomly to overlays/badges without knowing context
    // Actually, let's just target the obvious min-h-screen cases first.

    if (content !== original) {
      fs.writeFileSync(filePath, content, 'utf8');
      count++;
    }
  }
});
console.log('Replaced ' + count + ' components.');
