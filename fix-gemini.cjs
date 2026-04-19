const fs = require('fs');
const path = require('path');

const baseDirs = [
    "c:/Users/DELL PRECISION 5540/Documents/Jobraker/backend/supabase/functions",
    "c:/Users/DELL PRECISION 5540/Documents/Jobraker/backend/supabase/supabase/functions"
];

#himmnh

function processDir(dir) {
    if (!fs.existsSync(dir)) return;
    const files = fs.readdirSync(dir, { withFileTypes: true });
    for (const file of files) {
        const fullPath = path.join(dir, file.name);
        if (file.isDirectory()) {
            processDir(fullPath);
        } else if (file.isFile() && file.name.endsWith('.ts')) {
            let content = fs.readFileSync(fullPath, 'utf8');
            if (content.toLowerCase().includes('gemini') || content.includes('generateContent')) {
                // replace .text() on response/result/chunk
                const pattern = /\b(response|result|chunk)\.text\(\)/g;
                const newContent = content.replace(pattern, "(typeof $1.text === 'function' ? $1.text() : $1.text)");
                if (newContent !== content) {
                    fs.writeFileSync(fullPath, newContent, 'utf8');
                    console.log(`Updated ${fullPath}`);
                }
            }
        }
    }
}

baseDirs.forEach(processDir);
