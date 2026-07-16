#!/usr/bin/env node

const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const root = path.resolve(__dirname, "..", "..");
const migrationPath = path.join(
  root,
  "backend",
  "supabase",
  "migrations",
  "20260716120000_harden_auto_apply_queue_dispatch.sql",
);
const queueAcquisitionPath = path.join(
  root,
  "backend",
  "supabase",
  "migrations",
  "20260529110000_auto_apply_queue.sql",
);
const diagnosticsPath = path.join(
  root,
  "backend",
  "supabase",
  "diagnostics",
  "auto_apply_queue_diagnostics.sql",
);
const edgeFunctionPath = path.join(
  root,
  "backend",
  "supabase",
  "functions",
  "process-auto-apply-queue",
  "index.ts",
);

const migration = fs.readFileSync(migrationPath, "utf8");
const queueAcquisitionMigration = fs.readFileSync(queueAcquisitionPath, "utf8");
const diagnostics = fs.readFileSync(diagnosticsPath, "utf8");
const edgeFunction = fs.readFileSync(edgeFunctionPath, "utf8");

function expectIncludes(text, expected, description) {
  assert.ok(text.includes(expected), `${description}: expected ${JSON.stringify(expected)}`);
}

function normalizeBaseUrl(projectUrl) {
  return projectUrl.trim().replace(/\/+$/, "").replace(/\/functions\/v1$/i, "");
}

function endpointFor(projectUrl) {
  return `${normalizeBaseUrl(projectUrl)}/functions/v1/process-auto-apply-queue`;
}

for (const projectUrl of [
  "https://example.supabase.co",
  "https://example.supabase.co/",
  "https://example.supabase.co/functions/v1",
  "https://example.supabase.co/functions/v1/",
]) {
  assert.equal(
    endpointFor(projectUrl),
    "https://example.supabase.co/functions/v1/process-auto-apply-queue",
    `normalizes ${projectUrl}`,
  );
}

expectIncludes(migration, "CREATE OR REPLACE FUNCTION public.invoke_process_auto_apply_queue", "shared dispatcher exists");
expectIncludes(migration, "timeout_milliseconds := 30000", "explicit pg_net timeout is configured");
expectIncludes(migration, "regexp_replace(v_base_url, '/functions/v1$', '', 'i')", "function URL suffix is normalized");
expectIncludes(migration, "Vault secret project_url is missing or empty", "missing project URL warns clearly");
expectIncludes(migration, "Vault secret service_role_key is missing or empty", "missing service role key warns clearly");
expectIncludes(migration, "PERFORM public.invoke_process_auto_apply_queue('trigger', NEW.id)", "trigger uses shared dispatcher");
expectIncludes(migration, "SELECT public.invoke_process_auto_apply_queue('cron', NULL)", "cron uses shared dispatcher");
expectIncludes(migration, "'* * * * *'", "cron expression remains every minute");
expectIncludes(migration, "CREATE TRIGGER trigger_auto_apply_queue_process", "trigger binding is recreated");
expectIncludes(queueAcquisitionMigration, "FOR UPDATE OF a SKIP LOCKED", "duplicate-safe queue claim remains in the active migration history");
expectIncludes(migration, "CREATE TABLE IF NOT EXISTS public.edge_function_invocation_log", "invocation diagnostics table exists");
expectIncludes(migration, "SET search_path = pg_catalog, public", "security-definer search paths are explicit");
assert.ok(!migration.includes("http://kong:8000"), "new dispatcher must not fall back to Kong");
assert.ok(!migration.includes("anon_key"), "new dispatcher must not use anon_key");
assert.ok(!migration.includes("SYSTEM_TRIGGER"), "new dispatcher must not use SYSTEM_TRIGGER");
assert.ok(!migration.includes("net.http_requests"), "new migration must not query a nonexistent pg_net relation");
assert.ok(!diagnostics.includes("net.http_requests"), "diagnostics must not query a nonexistent pg_net relation");
assert.ok(!/RAISE\s+(?:WARNING|NOTICE)[^;]*v_service_role_key/i.test(migration), "migration logs must not interpolate service-role secrets");
expectIncludes(diagnostics, "net._http_response", "diagnostics inspect pg_net responses");
expectIncludes(diagnostics, "net.http_request_queue", "diagnostics inspect pending pg_net requests");
assert.ok(!edgeFunction.includes("SYSTEM_TRIGGER"), "edge function only accepts the service-role token");
expectIncludes(edgeFunction, "QUEUE_ACQUISITION_FAILED", "edge function returns a safe acquisition error code");
expectIncludes(edgeFunction, "AUTO_APPLY_QUEUE_FAILED", "edge function returns a safe processing error code");

console.log("Auto Apply queue migration verification: OK");
