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

        // Convert hex opacity colors like from-[#ffffff10] to from-foreground/10
        content = content.replace(/(from|via|to)-\[#ffffff([0-9a-fA-F]{2})\]/g, (match, prefix, hex) => {
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

        if (content !== original) {
            fs.writeFileSync(filePath, content, 'utf8');
            count++;
        }
    }
});
console.log('Replaced in ' + count + ' files.');
