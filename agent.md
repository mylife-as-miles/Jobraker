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

## Marketing Skills
The `coreyhaines31/marketingskills` skills pack is installed for this project.

### Install
Run this from the project root:

```bash
npx skills add coreyhaines31/marketingskills
```

This installs the project-scoped skills into `.agents/skills/` and links or copies them into supported agents.

### Useful commands
Use these from the project root:

```bash
npx skills list
npx skills find marketing
npx skills update
npx skills remove
```

To install the same pack globally instead of project-level:

```bash
npx skills add coreyhaines31/marketingskills -g
```

To list global skills:

```bash
npx skills list -g
```

Current project install includes marketing skills such as:

```text
analytics
pricing
product-marketing
seo-audit
copywriting
social
signup
paywalls
popups
launch
```

## Interface Review Skills
The `jakubkrehel/skills` collection is installed in `.agents/skills/` and has been audited as documentation-only. It includes seven coordinated interface skills: `better-interface`, `better-accessibility`, `better-layout`, `better-writing`, `better-typography`, `better-colors`, and `better-ui`.

Use `better-interface` for a holistic interface review; it coordinates the other six skills. Use the individual `better-*` skill when the task is limited to that discipline. Invoke the review explicitly with `$better-interface` (optionally followed by `quick` or `full` and a screen, flow, or feature).

The audited source is `jakubkrehel/skills`; the project install is tracked in `skills-lock.json`. Refresh it with:

```bash
npx skills update better-interface better-accessibility better-layout better-writing better-typography better-colors better-ui
```

## Emil Kowalski Design Skills
The `emilkowalski/skills` collection is installed in `.agents/skills/` and has been audited as documentation-only. It includes `emil-design-eng`, `review-animations`, `improve-animations`, `find-animation-opportunities`, `animation-vocabulary`, `apple-design`, `pick-ui-library`, and `prototype`.

Use `emil-design-eng` for general design-engineering guidance. Invoke `review-animations`, `improve-animations`, `find-animation-opportunities`, `animation-vocabulary`, `pick-ui-library`, or `prototype` explicitly when that specialized workflow is requested. `prototype` must remain isolated until a specific variant is selected for promotion.

The audited source is `emilkowalski/skills`; the project install is tracked in `skills-lock.json`. Refresh it with:

```bash
npx skills update emil-design-eng review-animations improve-animations find-animation-opportunities animation-vocabulary apple-design pick-ui-library prototype
```

## Taste Skill v2 (Experimental)
The `Leonxlnx/taste-skill` v2 experimental `design-taste-frontend` skill is installed in `.agents/skills/`. It is for landing pages, portfolios, marketing pages, and redesigns, not dashboards, dense product UI, admin panels, data tables, or multi-step product workflows.

Before frontend generation, declare a one-line Design Read, infer and state `DESIGN_VARIANCE`, `MOTION_INTENSITY`, and `VISUAL_DENSITY`, choose an honest design system or aesthetic, and run the Section 14 pre-flight checklist. For redesigns, audit brand tokens, information architecture, content blocks, SEO, and existing accessibility before editing. Preserve routes, navigation labels, form fields, analytics events, and brand assets unless explicitly asked to change them.

The v2 brief workflow and anti-slop rules are in `.agents/skills/design-taste-frontend/SKILL.md`. Refresh it with:

```bash
npx skills update design-taste-frontend
```

## Taste Skill Bundle

The full `Leonxlnx/taste-skill` bundle is installed in `.agents/skills/` and
synced to the global Codex and Antigravity skill directories. The available
skills are:

- `design-taste-frontend` — v2 experimental brief inference and anti-slop frontend
- `design-taste-frontend-v1` — legacy behavior for compatibility-sensitive work
- `gpt-taste` — high-variance editorial UX/UI and motion direction
- `redesign-existing-projects` — audit-first upgrades to existing interfaces
- `high-end-visual-design` — premium agency-level visual systems
- `industrial-brutalist-ui` — dense tactical/telemetry and brutalist interfaces
- `minimalist-ui` — warm editorial minimalism
- `full-output-enforcement` — complete, non-placeholder output handling
- `stitch-design-taste` — semantic `DESIGN.md` guidance for Google Stitch
- `image-to-code` — image-first website reference and implementation workflow
- `imagegen-frontend-web` — section-by-section web design reference generation
- `imagegen-frontend-mobile` — mobile screen and flow image generation
- `brandkit` — premium identity and brand-kit image generation

Use the most specific skill that matches the request. The taste frontend skills
are primarily for landing pages, portfolios, marketing surfaces, and redesigns;
do not apply them indiscriminately to Jobraker's dashboard or dense product
workflows. Preserve existing routes, semantics, analytics, brand assets, and
the current stack unless the user explicitly asks for a change. Review every
skill's `SKILL.md` before invoking it because skills run with full agent
permissions.

Refresh the bundle with:

```bash
npx skills add Leonxlnx/taste-skill --copy -y
```

## Remediate Feedback Widget

The `fvckprth/remediate` setup skill is installed in `.agents/skills/remediate`
and synced to the global Codex and Antigravity skill directories. It supports
the React widget plus a server-side `parseFeedback` route for screenshots,
recordings, voice notes, text notes, and element annotations.

This repository is a Vite + React app with Supabase auth and Edge Functions.
Before running Remediate setup, choose and document the feedback destination;
the skill must not silently create local disk storage or an unprotected route.
When wiring the widget, pass only the minimum user context in `metadata`, keep
auth headers separate from metadata, and validate the authenticated user in the
server route. Never commit webhook URLs, tokens, or captured feedback files.

Use the skill's lifecycle commands for setup, integrations, auth, endpoint tests,
capture gating, upgrades, dashboards, and removal. Do not mount more than one
`<Remediate>` instance. Review its `SKILL.md` before each operation because it
runs with full agent permissions.

Refresh it with:

```bash
npx skills add fvckprth/remediate --copy -y
```

## Addy Osmani Agent Skills

The full `addyosmani/agent-skills` collection is installed in
`.agents/skills/` and synced to the global Codex and Antigravity skill
directories. It provides 24 focused workflows:

- `using-agent-skills`, `context-engineering`, `interview-me`, `idea-refine`
- `planning-and-task-breakdown`, `spec-driven-development`,
  `incremental-implementation`, `test-driven-development`
- `source-driven-development`, `doubt-driven-development`,
  `debugging-and-error-recovery`, `code-simplification`
- `frontend-ui-engineering`, `api-and-interface-design`,
  `security-and-hardening`, `observability-and-instrumentation`
- `code-review-and-quality`, `git-workflow-and-versioning`,
  `documentation-and-adrs`, `deprecation-and-migration`
- `browser-testing-with-devtools`, `performance-optimization`,
  `ci-cd-and-automation`, `shipping-and-launch`

Use the narrowest matching workflow and review its `SKILL.md` before invoking
it. The browser-testing skill requires Chrome DevTools MCP and carries a
Medium Risk/one Socket alert from the installer; keep its restrictions against
external requests and credential access. Never commit secrets or generated
browser captures. Refresh with:

```bash
npx skills add addyosmani/agent-skills --copy -y
```

## Reverse Skill Collection Safety Note

`zhaoxuya520/reverse-skill` was audited but is intentionally not installed or
committed. Its installer reported Critical Risk for the router and critical
Snyk findings, and the collection includes credential dumping, exploit and C2
playbooks, EDR/AMSI/ETW bypass, privilege escalation, and offensive scanning
guidance. Do not enable or sync it globally. Any future use requires explicit
scope, authorization, and a narrowly selected defensive/research skill after
fresh review; never use the offensive workflows against Jobraker or third-party
  systems.

## i-have-adhd Output Mode

The `ayghri/i-have-adhd` skill is installed in `.agents/skills/i-have-adhd` and
synced to the global Codex and Antigravity skill directories. It is opt-in:
invoke `/i-have-adhd` when the user wants action-first, numbered, low-tangent
output with visible progress and concrete next steps. It stays active until
`stop adhd mode` or `normal mode`; do not apply it as a project-wide default.

## Model and Stack Restrictions
- **CRITICAL**: Never change any model name (e.g., `gemini-embedding-2`), model configurations, or tech stack components (libraries, databases, architecture) without explicit user permission or telling the user first.

## Environment and Credential Handling
- For Supabase work, read the project-specific `JOBBREAKER_SUPABASE_ACCESS_TOKEN` and expose it only in-process as `SUPABASE_ACCESS_TOKEN` for the command that requires it.
- Never print, persist, commit, or store the token value in logs, shell history, source files, documentation examples, or generated artifacts.
- For GitHub merges and repository operations, prefer the connected GitHub integration and never expose or store a GitHub access token in the repository.
