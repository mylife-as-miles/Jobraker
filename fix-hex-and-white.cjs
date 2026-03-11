const fs = require('fs');
const path = require('path');

function walkDir(dir, callback) {
  if (!fs.existsSync(dir)) return;
  const files = fs.readdirSync(dir);
  for (const f of files) {
    const dirPath = path.join(dir, f);
    if (dirPath.includes('node_modules') || dirPath.includes('.git') || dirPath.includes('build')) continue;
    if (fs.statSync(dirPath).isDirectory()) {
      walkDir(dirPath, callback);
    } else {
      callback(dirPath);
    }
  }
}

let count = 0;
walkDir('src', (filePath) => {
  if (!filePath.endsWith('.tsx') && !filePath.endsWith('.ts')) return;
  
  let original = fs.readFileSync(filePath, 'utf-8');
  let content = original;

  // Replace Hex dark colors that are supposed to be backgrounds
  content = content.replace(/from-\[#0a0a0a(00)?\]/gi, 'from-background');
  content = content.replace(/via-\[#0a0a0a(00)?\]/gi, 'via-background');
  content = content.replace(/to-\[#0a0a0a(00)?\]/gi, 'to-background');
  content = content.replace(/bg-\[#0a0a0a(00)?\]/gi, 'bg-background');

  content = content.replace(/from-\[#0[0-9a-f]{5}(00)?\]/gi, 'from-background');
  content = content.replace(/via-\[#0[0-9a-f]{5}(00)?\]/gi, 'via-background');
  content = content.replace(/to-\[#0[0-9a-f]{5}(00)?\]/gi, 'to-background');
  content = content.replace(/bg-\[#0[0-9a-f]{5}(00)?\]/gi, 'bg-background');

  // Fix empty-state text-white overriding Light Mode
  if (filePath.includes('empty-state.tsx')) {
    content = content.replace(/'text-white'/g, "'text-foreground'");
    content = content.replace(/text-white/g, 'text-foreground');
  }

  // ProfilePage
  if (filePath.includes('ProfilePage.tsx')) {
    // text-white -> text-foreground? It's not in ProfilePage specifically, but let's make sure
    content = content.replace(/\btext-white\b/g, 'text-foreground');
  }

  if (content !== original) {
    fs.writeFileSync(filePath, content, 'utf-8');
    count++;
  }
});

console.log('Fixed hardcoded hex colors and text-white in ' + count + ' files.');
