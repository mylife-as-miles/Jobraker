import { createClient } from '@supabase/supabase-js';
import fs from 'fs';
import path from 'path';

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

const env = loadEnv(path.resolve(process.cwd(), '.env'));
const envLocal = loadEnv(path.resolve(process.cwd(), '.env.local'));
const mergedEnv = { ...process.env, ...env, ...envLocal };

const supabaseUrl = mergedEnv.VITE_SUPABASE_URL || mergedEnv.SUPABASE_URL;
const supabaseKey = mergedEnv.VITE_SUPABASE_ANON_KEY || mergedEnv.SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseKey) {
    console.error('Supabase URL or Key missing in .env');
    process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

async function check() {
    // Let's get the authenticated user or just check total jobs in table
    const { data: userData, error: userError } = await supabase.auth.getUser();
    console.log('User status:', { userData, userError });

    const { data: jobs, error } = await supabase
        .from('jobs')
        .select('id, title, company, canonical_status, hidden, created_at, user_id');

    if (error) {
        console.error('Error fetching jobs:', error);
        return;
    }

    console.log(`Total jobs in DB: ${jobs.length}`);
    const byUser = {};
    const byStatus = {};
    jobs.forEach(job => {
        byUser[job.user_id] = (byUser[job.user_id] || 0) + 1;
        byStatus[job.canonical_status] = (byStatus[job.canonical_status] || 0) + 1;
    });

    console.log('Jobs by User ID:', byUser);
    console.log('Jobs by Canonical Status:', byStatus);
    console.log('Hidden jobs count:', jobs.filter(j => j.hidden).length);
    console.log('Sample jobs:', jobs.slice(0, 5).map(j => ({ title: j.title, company: j.company, status: j.canonical_status })));
}

check();
