# AGENTS.md

This file provides opencode-specific guidance for the JARVIS project.

## Directory Structure

- **Project root**: `D:\Projects\extras\jarvis` (NOT `jarvis/`)
- **Source code**: `jarvis/src/` - all TypeScript source
- **Compiled output**: `jarvis/dist/` - build artifacts
- **Run commands from**: `jarvis/` subdirectory (NOT the root)

## Essential Commands

```bash
# Build and run (always run from jarvis/ subdirectory)
cd jarvis
npm run build          # Compile TypeScript
npm run dev            # Build + run CLI
npm run start          # Run compiled CLI
npm run lint           # ESLint
npm run lint:fix       # Fix lint issues

# Run MCP servers (these are separate processes - run alongside main CLI)
npm run mcp:start         # Memory + user-profile servers
npm run mcp:start-all     # All MCP servers

# Test (run from jarvis/ directory)
npm test
```

## Pipeline Architecture

JARVIS uses a **5-stage pipeline** that each agent should understand:

1. **Intent Parser** (`src/pipeline/intent_parser.ts`) - NL → IntentGraph
2. **Decision Planner** (`src/pipeline/decision_planner.ts`) - IntentGraph → TaskDAG  
3. **Tool Caller** (`src/pipeline/tool_caller.ts`) - Tasks → MCP tool calls
4. **Executor** (`src/pipeline/executor.ts`) - Execute via MCP
5. **Reporter** (`src/pipeline/reporter.ts`) - Summarize results

## Browser Automation

Uses **Microsoft Edge** (not Chrome):
- Path: `C:\Users\YeswanthRam\AppData\Local\Microsoft\Edge\Application\msedge.exe`
- Session persistence is broken - use **auto-login** with `GMAIL_EMAIL`/`GMAIL_PASSWORD` env vars
- Manual Edge for CDP: `msedge --remote-debugging-port=9222 --user-data-dir="...\Profile 2"`

## Known Issues

- **429 rate limits** on NVIDIA API - use fallback models: `meta/llama-3.3-70b-instruct` or `mistralai/mixtral-8x7b-instruct-v0.1`
- Chrome/Edge block cookie sharing - always use auto-login approach

## Context Store

`src/pipeline/context_store.ts` is a **singleton** - shared across all pipeline stages. Each stage retrieves previous results via this store.

## Environment Variables

| Variable | Required | Purpose |
|----------|----------|---------|
| `NV_API_KEY` | Yes | NVIDIA NIM API key |
| `GMAIL_EMAIL` | No | For auto-login in browser |
| `GMAIL_PASSWORD` | No | For auto-login in browser |
| `USE_EDGE_PROFILE` | No | Load Edge profile |
| `USE_CDP` | No | Chrome DevTools Protocol |

## Data Locations (runtime)

- Config: `~/.jarvis/config.yaml`
- Profile: `~/.jarvis/profile.json`
- Memory DB: `~/.jarvis/memory.db`
- Audit log: `~/.jarvis/audit.log`