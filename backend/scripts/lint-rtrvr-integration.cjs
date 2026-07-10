const fs = require("node:fs");
const path = require("node:path");

const root = process.cwd();

const files = [
  ".env.example",
  "package.json",
  "backend/automation-worker/src/requestBuilder.ts",
  "backend/automation-worker/src/rtrvrClient.ts",
  "backend/automation-worker/src/server.ts",
  "backend/automation-worker/src/workerAuth.ts",
  "backend/automation-worker/src/worker.ts",
  "backend/automation-worker/src/__tests__/rtrvrAutomation.test.ts",
  "backend/supabase/functions/apply-to-jobs/index.ts",
  "backend/supabase/functions/rtrvr-tools/index.ts",
  "backend/supabase/functions/process-auto-apply-queue/index.ts",
  "backend/supabase/migrations/20260705101554_rtrvr_automation_provider.sql",
  "docs/RTRVR_AUTOMATION.md",
];

const forbiddenPatterns = [
  /RTRVR_[A-Z_]*WORKFLOW_ID/g,
  /\brtrvrWorkflowId\b/g,
  /when\s+undefined_object\s+then\s+null/gi,
];

const failures = [];

for (const file of files) {
  const fullPath = path.join(root, file);
  if (!fs.existsSync(fullPath)) continue;
  const text = fs.readFileSync(fullPath, "utf8");
  for (const pattern of forbiddenPatterns) {
    pattern.lastIndex = 0;
    const match = pattern.exec(text);
    if (match) {
      failures.push(`${file}: forbidden rtrvr integration pattern "${match[0]}"`);
    }
  }
}

const packageJson = JSON.parse(fs.readFileSync(path.join(root, "package.json"), "utf8"));
if (packageJson.dependencies?.["@rtrvr-ai/sdk"] !== "0.2.1") {
  failures.push('package.json: @rtrvr-ai/sdk must be pinned to exactly "0.2.1"');
}

if (failures.length > 0) {
  console.error(failures.join("\n"));
  process.exit(1);
}

console.log("rtrvr integration lint passed");
