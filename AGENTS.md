# Agent Instructions

To ensure consistent and high-quality assistance, all AI agents (including myself and any future agents) MUST follow these guidelines:

## Skill Discovery
Before performing any task, agents MUST check the global skills directory for available domain expertise:
- **Skills Path**: `C:\Users\MILES\.gemini\antigravity\skills\`
- **Action**: Use the `list_dir` or `view_file` tools to explore relevant skills in this directory.

## Invocation Pattern
When a specific domain or skill is relevant to a task, agents SHOULD use the corresponding skill by referencing it.
- **Pattern**: Use `@skill-name` (e.g., `@typescript-expert`, `@backend-architect`) to activate the relevant context and instructions.

## Persistent Context
This file serves as a persistent anchor for all agent interactions within this project. Always refer to this document when starting a new session or tackling a new complex task.

## Supabase Deployment
When working with Supabase functions for this project, use the following commands (project root is `backend`, i.e. the directory that contains the `supabase` folder):

```bash
npx supabase login   # or: npx supabase login --token "$SUPABASE_ACCESS_TOKEN"
cd backend
npx supabase functions deploy <function-name> --project-ref yquhsllwrwfvrwolqywh --use-api
npx supabase db push --include-all --yes
```

Use `--use-api` when Docker is not running (bundles functions on Supabase’s side).
