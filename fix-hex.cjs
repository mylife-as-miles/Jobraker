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
    content = content.replace(/from-\[#0[0-9a-fA-F]{5}(00)?\]/g, 'from-background');
    content = content.replace(/via-\[#0[0-9a-fA-F]{5}(00)?\]/g, 'via-background');
    content = content.replace(/to-\[#0[0-9a-fA-F]{5}(00)?\]/g, 'to-background');
    content = content.replace(/bg-\[#0[0-9a-fA-F]{5}(00)?\]/g, 'bg-background');
    content = content.replace(/from-\[#1[0-9a-fA-F]{5}(00)?\]/g, 'from-background');
    content = content.replace(/via-\[#1[0-9a-fA-F]{5}(00)?\]/g, 'via-background');
    content = content.replace(/to-\[#1[0-9a-fA-F]{5}(00)?\]/g, 'to-background');
    content = content.replace(/bg-\[#1[0-9a-fA-F]{5}(00)?\]/g, 'bg-background');

    // Specific fix for empty-state overrides in light mode
    if (filePath.includes('empty-state.tsx')) {
        content = content.replace(/'text-white'/g, "'text-foreground'");
    }

    // General profile page / billing fixes
    if (filePath.includes('BillingPage.tsx') || filePath.includes('ProfilePage.tsx')) {
        content = content.replace(/\btext-white\b/g, 'text-foreground');
    }

    // ApplicationPage
    if (filePath.includes('ApplicationPage.tsx')) {
        content = content.replace(/from-black\/80/g, 'from-background/80');
        content = content.replace(/via-black\/20/g, 'via-background/20');
    }

    if (content !== original) {
        fs.writeFileSync(filePath, content, 'utf-8');
        count++;
    }
});

console.log('Fixed hardcoded hex colors and text-white in ' + count + ' files.');
