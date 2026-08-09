import fs from 'fs';
import path from 'path';

function getEnvValue(key) {
  if (process.env[key]) return process.env[key];
  const possiblePaths = [
    path.resolve(process.cwd(), '.env'),
    path.resolve(process.cwd(), 'backend', '.env')
  ];
  for (const envPath of possiblePaths) {
    if (fs.existsSync(envPath)) {
      const content = fs.readFileSync(envPath, 'utf8');
      const match = content.match(new RegExp(`^${key}=(.*)$`, 'm'));
      if (match) return match[1].trim();
    }
  }
  return null;
}

const token = getEnvValue("SUPABASE_ACCESS_TOKEN");
const ref = getEnvValue("SUPABASE_PROJECT_REF") || "yquhsllwrwfvrwolqywh";

if (!token) {
  console.error("Error: SUPABASE_ACCESS_TOKEN not found in environment or .env files.");
  process.exit(1);
}

const sql = `
SELECT 
  timestamp, 
  event_message, 
  metadata 
FROM function_logs 
ORDER BY timestamp DESC 
LIMIT 1000
`;

const start = new Date(Date.now() - 180 * 60 * 1000).toISOString();
const end = new Date().toISOString();

const url = `https://api.supabase.com/v1/projects/${ref}/analytics/endpoints/logs.all?sql=${encodeURIComponent(sql)}&iso_timestamp_start=${encodeURIComponent(start)}&iso_timestamp_end=${encodeURIComponent(end)}`;

console.log("Fetching all logs from:", url);

async function getLogs() {
  try {
    const res = await fetch(url, {
      headers: {
        "Authorization": `Bearer ${token}`,
        "Content-Type": "application/json"
      }
    });
    
    if (!res.ok) {
      const errText = await res.text();
      console.error(`HTTP Error ${res.status}:`, errText);
      return;
    }
    
    const data = await res.json();
    console.log("Success! Logs received.\n");
    if (data && Array.isArray(data.result)) {
      for (const log of data.result) {
        const metaList = log.metadata;
        const meta = Array.isArray(metaList) ? metaList[0] : metaList;
        const funcId = meta?.function_id;
        const path = meta?.path;
        console.log(`[${log.timestamp}] [${meta?.level || 'info'}] [${path || funcId}] ${log.event_message}`);
        if (meta?.level === "error" || log.event_message.toLowerCase().includes("error") || log.event_message.toLowerCase().includes("fail")) {
          console.log("Metadata:", JSON.stringify(log.metadata, null, 2));
        }
        console.log("-".repeat(80));
      }
      console.log(`Total logs: ${data.result.length}`);
    } else {
      console.log(JSON.stringify(data, null, 2));
    }
  } catch (err) {
    console.error("Fetch failed:", err);
  }
}

getLogs();
