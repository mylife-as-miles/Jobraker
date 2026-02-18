import { createClient } from '@supabase/supabase-js';

import fs from 'fs';
import path from 'path';

// Manual env parser
function loadEnv(filePath) {
    if (!fs.existsSync(filePath)) return {};
    const content = fs.readFileSync(filePath, 'utf-8');
    const env = {};
    content.split('\n').forEach(line => {
        const trimmed = line.trim();
        if (!trimmed || trimmed.startsWith('#')) return;
        const [key, ...val] = trimmed.split('=');
        if (key && val) {
            env[key.trim()] = val.join('=').trim().replace(/^["'](.*)["']$/, '$1');
        }
    });
    return env;
}

const envLocal = loadEnv(path.resolve(process.cwd(), '.env.local'));
const env = loadEnv(path.resolve(process.cwd(), '.env'));

// Merge envs (local overrides base)
const mergedEnv = { ...process.env, ...env, ...envLocal };

const supabaseUrl = mergedEnv.VITE_SUPABASE_URL || mergedEnv.SUPABASE_URL;
const supabaseKey = mergedEnv.VITE_SUPABASE_ANON_KEY || mergedEnv.SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseKey) {
    console.error('Missing Supabase URL or Key');
    process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

async function check() {
    console.log('Checking applications table...');
    const { data: apps, error } = await supabase.from('applications').select('id, job_title, match_score');

    if (error) {
        console.error('Error fetching applications:', error);
        return;
    }

    console.log(`Total Applications: ${apps.length}`);
    const withScore = apps.filter(a => a.match_score !== null && a.match_score !== undefined);
    console.log(`Applications with Match Score: ${withScore.length}`);

    if (withScore.length > 0) {
        console.log('Sample Scores:', withScore.slice(0, 5).map(a => a.match_score));
    } else {
        console.log('No applications have match scores.');
    }
}

check();
