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

    // Only match dark generic colors like #000, #0a0a0a, #030303
    content = content.replace(/from-\[#0[0-9a-fA-F]{5}(00)?\]/g, 'from-background');
    content = content.replace(/via-\[#0[0-9a-fA-F]{5}(00)?\]/g, 'via-background');
    content = content.replace(/to-\[#0[0-9a-fA-F]{5}(00)?\]/g, 'to-background');
    content = content.replace(/bg-\[#0[0-9a-fA-F]{5}(00)?\]/g, 'bg-background');

    // Fix BillingPage edge cases causing white gaps
    if (filePath.includes('BillingPage.tsx')) {
        content = content.replace(/from-black/g, 'from-background');
        content = content.replace(/from-white\b/g, 'from-foreground');
        content = content.replace(/via-white\b/g, 'via-foreground');
        content = content.replace(/bg-white\b/g, 'bg-background');
        content = content.replace(/border-r-white\b/g, 'border-r-foreground');
        // Specifically fix the hero section background wrapper
        content = content.replace(/bg-gradient-to-br from-background via-\[#0a0a0a\] to-background/g, 'bg-gradient-to-br from-background via-background/90 to-background');
    }

    // ProfilePage and EmptyState fixes for 'text-white' overriding light mode
    if (filePath.includes('empty-state.tsx')) {
        content = content.replace(/accent: 'text-white'/g, "accent: 'text-foreground'");
        content = content.replace(/icon: 'text-white'/g, "icon: 'text-foreground'");
    }

    if (content !== original) {
        fs.writeFileSync(filePath, content, 'utf-8');
        count++;
    }
});

console.log('Fixed safe hex colors in ' + count + ' files.');
