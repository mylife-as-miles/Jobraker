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

  if (filePath.includes('BillingPage.tsx')) {
    // Overlays should use foreground otherwise they vanish in light mode (bg-background on bg-background)
    content = content.replace(/bg-white\/\[0\.02\]/g, 'bg-foreground/[0.02]');
    content = content.replace(/bg-white\/\[0\.04\]/g, 'bg-foreground/[0.04]');
    content = content.replace(/bg-white\/\[0\.03\]/g, 'bg-foreground/[0.03]');
  }

  if (filePath.includes('Onboarding.tsx')) {
    content = content.replace(/bg-white\/\[0\.03\]/g, 'bg-foreground/[0.03]');
  }

  if (content !== original) {
    fs.writeFileSync(filePath, content, 'utf-8');
    count++;
  }
});

console.log('Fixed opacity cards in ' + count + ' files.');
