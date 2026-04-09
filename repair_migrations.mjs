import fs from 'fs';
import path from 'path';
import { execSync } from 'child_process';

const migrationsDir = path.join(process.cwd(), 'backend', 'supabase', 'migrations');
const files = fs.readdirSync(migrationsDir).filter(f => f.endsWith('.sql'));

console.log(`Found ${files.length} migration files.`);

const newMigration = '20260218120000_add_public_share.sql';

for (const file of files) {
    if (file === newMigration) {
        console.log(`Skipping new migration: ${file}`);
        continue;
    }

    const version = file.split('_')[0];
    if (!/^\d+$/.test(version)) {
        console.log(`Skipping non-versioned file: ${file}`);
        continue;
    }

    console.log(`Marking ${version} as applied...`);
    try {
        // Use cmd /c for Windows compatibility from Node if needed, but execSync usually handles it.
        // We strictly use npx supabase migration repair
        execSync(`npx supabase migration repair --status applied ${version}`, {
            cwd: path.join(process.cwd(), 'backend', 'supabase'), // Run in supabase dir to find config
            stdio: 'inherit',
            shell: 'cmd.exe' // Explicit shell for Windows
        });
    } catch (e) {
        console.error(`Failed to repair ${version}:`, e.message);
        // Don't exit, try to continue
    }
}

console.log('Migration history repair complete.');
