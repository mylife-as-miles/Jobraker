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

// Fallback to local defaults from supabaseClient.ts
const DEFAULT_URL = 'http://127.0.0.1:54321';
const DEFAULT_KEY = 'sb_publishable_ACJWlzQHlZjBrEguHvfOxg_3BJgxAaH'; // Pulled from supabaseClient.ts

const supabaseUrl = mergedEnv.VITE_SUPABASE_URL || mergedEnv.SUPABASE_URL || DEFAULT_URL;
const supabaseKey = mergedEnv.VITE_SUPABASE_ANON_KEY || mergedEnv.SUPABASE_ANON_KEY || DEFAULT_KEY;

console.log(`Connecting to ${supabaseUrl}`);

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
