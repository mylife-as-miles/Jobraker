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

const DEFAULT_URL = 'http://127.0.0.1:54321';
const DEFAULT_KEY = 'sb_publishable_ACJWlzQHlZjBrEguHvfOxg_3BJgxAaH';

const supabaseUrl = mergedEnv.VITE_SUPABASE_URL || mergedEnv.SUPABASE_URL || DEFAULT_URL;
const supabaseKey = mergedEnv.VITE_SUPABASE_ANON_KEY || mergedEnv.SUPABASE_ANON_KEY || DEFAULT_KEY;

const supabase = createClient(supabaseUrl, supabaseKey);

async function check() {
    console.log('Querying profiles...');
    const { data: profiles, error: pError } = await supabase
        .from('profiles')
        .select('id, first_name, last_name, subscription_tier');
    
    if (pError) {
        console.error('Error fetching profiles:', pError);
    } else {
        console.log(`Found ${profiles.length} profiles:`);
        profiles.forEach(p => {
            console.log(`- ID: ${p.id}, Name: ${p.first_name} ${p.last_name}, Tier: ${p.subscription_tier}`);
        });
    }

    console.log('\nQuerying user_subscriptions...');
    const { data: subs, error: sError } = await supabase
        .from('user_subscriptions')
        .select('id, user_id, status, current_period_end, plan_id, subscription_plans(name)');

    if (sError) {
        console.error('Error fetching user_subscriptions:', sError);
    } else {
        console.log(`Found ${subs.length} subscriptions:`);
        subs.forEach(s => {
            console.log(`- User: ${s.user_id}, Status: ${s.status}, End: ${s.current_period_end}, Plan: ${s.subscription_plans?.name || 'Unknown'}`);
        });
    }
}

check();
