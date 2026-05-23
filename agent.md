# Agent Instructions

To ensure consistent and high-quality assistance, all AI agents (including myself and any future agents) MUST follow these guidelines:

## Skill Discovery
Before performing any task, agents MUST check the global skills directory for available domain expertise:
- **Primary Skills Path**: `C:\Users\MILES\.gemini\antigravity-ide\skills\`
- **Backup Skills Path**: `C:\Users\MILES\.gemini\antigravity-backup\skills\`
- **Action**: Use the `list_dir` or `view_file` tools to explore the primary directory first, then fall back to the backup directory if needed.

## Invocation Pattern
When a specific domain or skill is relevant to a task, agents SHOULD use the corresponding skill by referencing it.
- **Pattern**: Use `@skill-name` (e.g., `@typescript-expert`, `@backend-architect`) to activate the relevant context and instructions.

## Persistent Context
This file serves as a persistent anchor for all agent interactions within this project. Always refer to this document when starting a new session or tackling a new complex task.

## Supabase Deployment
When working with Supabase functions for this project, use the following commands (project root is `backend`, i.e. the directory that contains the `supabase` folder):

```bash
npx supabase login --token "$SUPABASE_ACCESS_TOKEN"
cd backend
npx supabase functions deploy <function-name> --project-ref yquhsllwrwfvrwolqywh --use-api
npx supabase db push --include-all --yes
```

Use `--use-api` when Docker is not running (bundles functions on Supabase's side).

Never commit Supabase access tokens, database passwords, service-role keys, or project API secrets. Store them in local environment variables such as `SUPABASE_ACCESS_TOKEN` or Supabase secrets.

## CodeGraph
CodeGraph is installed locally in this repo and exposed through the local MCP configuration in `.mcp.json`.

### Install
Run this from the project root:

```bash
npx @colbymchenry/codegraph install --target=auto --location=local -y
```

After install, restart the agent session so the `codegraph` MCP server is available.

To install CodeGraph globally for supported agents on this machine, run:

```bash
npx @colbymchenry/codegraph install --target=auto --location=global -y
```

This updates the global agent configs (for example Codex CLI and Claude Code), and those tools should be restarted afterward.

### Common commands
Use these from the project root:

```bash
npx @colbymchenry/codegraph status
npx @colbymchenry/codegraph index
npx @colbymchenry/codegraph sync
npx @colbymchenry/codegraph query "<search term>"
npx @colbymchenry/codegraph context "<task or symbol>"
npx @colbymchenry/codegraph files "<search term>"
npx @colbymchenry/codegraph affected
```

### MCP server
The local MCP server entry is:

```bash
codegraph serve --mcp
```

This repo's local install created:

```text
.mcp.json
.claude/settings.json
.claude/CLAUDE.md
.codegraph/
```
