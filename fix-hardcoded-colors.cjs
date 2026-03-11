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

    // Replace gradients
    content = content.replace(/\bfrom-black\b/g, 'from-background');
    content = content.replace(/\bvia-black\b/g, 'via-background');
    content = content.replace(/\bto-black\b/g, 'to-background');

    // BillingPage edge cases
    if (filePath.includes('BillingPage.tsx')) {
        content = content.replace(/\btext-black\b/g, 'text-background');
        content = content.replace(/\bfrom-white\b/g, 'from-foreground');
        content = content.replace(/\bvia-white\b/g, 'via-foreground');
        content = content.replace(/\bbg-white\b/g, 'bg-background');
        content = content.replace(/\bborder-r-white\b/g, 'border-r-foreground');
        content = content.replace(/bg-gradient-to-r from-background/g, 'bg-gradient-to-r from-foreground');
        content = content.replace(/via-background to-background\/60/g, 'via-foreground to-foreground/60');
    }

    // ResumeHomePage and CoverLetterHomePage edge cases
    if (filePath.includes('ResumeHomePage.tsx') || filePath.includes('CoverLetterHomePage.tsx')) {
        if (filePath.includes('ResumeHomePage.tsx')) {
            // Background of cards
            content = content.replace(/bg-foreground\/10 border/g, 'bg-card border-border');
            content = content.replace(/bg-white/g, 'bg-muted');
            content = content.replace(/divide-white/g, 'divide-foreground');
            content = content.replace(/bg-foreground\/40/g, 'bg-muted/40');
            content = content.replace(/bg-foreground\/5 /g, 'bg-muted/50 ');
            content = content.replace(/hover:bg-foreground\/5/g, 'hover:bg-muted/80');
            content = content.replace(/bg-foreground p-1/g, 'bg-muted p-1');
            content = content.replace(/bg-foreground\/60 text-foreground/g, 'bg-background text-foreground');
            content = content.replace(/text-foreground\/60 hover:text-foreground\/60/g, 'text-muted-foreground hover:text-foreground');
            content = content.replace(/border-foreground\/5/g, 'border-border/50');
            content = content.replace(/border-foreground\/10/g, 'border-border');
        }
    }

    if (content !== original) {
        fs.writeFileSync(filePath, content, 'utf-8');
        count++;
    }
});

console.log('Fixed hardcoded colors in ' + count + ' files.');
