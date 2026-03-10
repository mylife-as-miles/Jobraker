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
walkDir('src', function (filePath) {
    if (filePath.endsWith('.tsx') || filePath.endsWith('.js') || filePath.endsWith('.ts')) {
        let original = fs.readFileSync(filePath, 'utf8');
        let content = original;

        // Convert hex opacity colors like bg-[#ffffff10] to bg-foreground/10
        content = content.replace(/(bg|border|text|ring|shadow)-\[#ffffff([0-9a-fA-F]{2})\]/g, (match, prefix, hex) => {
            const dec = parseInt(hex, 16);
            const pct = Math.round((dec / 255) * 100);
            let closest = 50;
            const stops = [5, 10, 20, 30, 40, 50, 60, 70, 80, 90, 95];
            for (const stop of stops) {
                if (Math.abs(pct - stop) < Math.abs(pct - closest)) {
                    closest = stop;
                }
            }
            return `${prefix}-foreground/${closest}`;
        });

        // Replace text-[#ffffff] with text-foreground
        content = content.replace(/text-\[#ffffff\]/gi, 'text-foreground');
        content = content.replace(/text-\[#ffffff99\]/gi, 'text-foreground/60');

        // Replace text-white/XX with text-foreground/XX
        content = content.replace(/text-white\/([0-9]+)/gi, 'text-foreground/$1');
        content = content.replace(/border-white\/([0-9]+)/gi, 'border-foreground/$1');
        content = content.replace(/bg-white\/([0-9]+)/gi, 'bg-foreground/$1');

        content = content.replace(/text-black\/([0-9]+)/gi, 'text-background/$1');
        content = content.replace(/border-black\/([0-9]+)/gi, 'border-background/$1');
        content = content.replace(/bg-black\/([0-9]+)/gi, 'bg-background/$1');

        // Replace dark gradients
        content = content.replace(/from-\[#0a0a0a\] via-\[#0d0d0d\] to-\[#000000\]/gi, 'from-background via-background/95 to-background/90');
        content = content.replace(/from-\[#0b0b0b\] via-\[#111111\] to-\[#050505\]/gi, 'from-background via-background/98 to-background/95');
        content = content.replace(/from-\[#020202\] via-\[#050708\] to-\[#090b0c\]/gi, 'from-background via-background/98 to-background/95');
        content = content.replace(/from-\[#041206\] via-\[#050a08\] to-\[#020403\]/gi, 'from-background via-background/98 to-background/95');
        content = content.replace(/from-\[#082514\] via-\[#04140b\] to-\[#010503\]/gi, 'from-background via-background/98 to-background/95');
        content = content.replace(/from-\[#0f0f0f\] to-\[#0a0a0a\]/gi, 'from-background to-background/95');

        content = content.replace(/bg-\[#0c0c0c\]/gi, 'bg-muted');
        content = content.replace(/bg-\[#0a1a0f\]/gi, 'bg-card border border-foreground/10');

        if (content !== original) {
            fs.writeFileSync(filePath, content, 'utf8');
            count++;
        }
    }
});
console.log('Replaced in ' + count + ' files.');
