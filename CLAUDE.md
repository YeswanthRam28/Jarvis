# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

JARVIS (Just A Rather Very Intelligent System) is a multi-model, multi-MCP autonomous desktop agent that accepts natural language commands and executes them across applications. It uses NVIDIA NIM API for AI models with a 5-stage execution pipeline.

## Build Commands

```bash
cd jarvis
npm run build       # Compile TypeScript
npm run dev         # Build and run CLI
npm run start       # Run compiled CLI
npm run lint        # Lint with ESLint
npm run lint:fix    # Fix linting issues
npm test            # Run Jest tests
```

## Running MCP Servers

```bash
npm run mcp:memory        # Memory MCP server (SQLite)
npm run mcp:user-profile  # User profile MCP server
npm run mcp:browser       # Browser automation (Playwright)
npm run mcp:filesystem    # Filesystem operations
npm run mcp:start         # Start memory + user-profile
npm run mcp:start-all     # Start all MCP servers
```

## CLI Commands

```bash
jarvis run "<command>"    # Parse and plan (Stages 1-2)
jarvis exec "<command>"   # Full pipeline (all 5 stages)
jarvis parse "<command>" # Show intent graph only
jarvis plan "<command>"  # Show intent graph + task DAG
jarvis mcp list          # List registered MCP servers
jarvis mcp tools         # Show available MCP tools
jarvis mcp call <srv> <tool> [args]  # Call MCP tool directly
jarvis profile --get     # View user profile
jarvis profile --set '{"identity":{"name":"..."}}'  # Update profile
jarvis config --path     # Show config file location
```

## Architecture

### 5-Stage Pipeline (`src/pipeline/`)
1. **Intent Parser** (`intent_parser.ts`) - Parses natural language to structured `IntentGraph`
2. **Decision Planner** (`decision_planner.ts`) - Converts IntentGraph to ordered `TaskDAG`
3. **Tool Caller** (`tool_caller.ts`) - Maps tasks to MCP tool calls
4. **Executor** (`executor.ts`) - Executes tool calls via MCP servers
5. **Reporter** (`reporter.ts`) - Generates summaries and notifications

### MCP Servers (`src/mcps/`)
- **browser** - Playwright-based browser automation (navigate, click, fill_form, screenshot, automate)
- **filesystem** - File read/write/list operations
- **memory** - SQLite-backed persistent context storage
- **user-profile** - User preferences and contacts management
- **code** - Code execution
- **payment** - Payment processing
- **notifications** - Desktop notifications and TTS (notify, speak, alert)
- **shell** - Sandboxed shell command execution (execute, kill)
- **desktop-ui** - Native desktop UI automation (open_app, click, type, scroll, screenshot)

### AI Integration (`src/ai/`)
- **nvidia_client.ts** - NVIDIA NIM API client (OpenAI-compatible)
- **model_router.ts** - Routes requests to appropriate model per pipeline stage

### Key Models per Stage
| Stage | Model |
|-------|-------|
| Intent Parser | `nvidia/llama-3.3-nemotron-70b-instruct` |
| Decision Planner | `nvidia/llama-3.3-nemotron-70b-instruct` |
| Tool Caller | `nvidia/mixtral-8x7b-instruct-v0.1` |
| Executor | `nvidia/llama-3.1-nemotron-8b-instruct` |
| Reporter | `nvidia/llama-3.1-nemotron-8b-instruct` |

## Environment Variables

| Variable | Purpose |
|----------|---------|
| `NV_API_KEY` | NVIDIA NIM API key (required) |
| `USE_EDGE_PROFILE` | Load Edge browser profile for authenticated sessions |
| `USE_CDP` | Connect to browser via Chrome DevTools Protocol |
| `GMAIL_EMAIL` | Gmail for auto-login in browser automation |
| `GMAIL_PASSWORD` | Gmail password for auto-login |

## Data Locations

- Config: `~/.jarvis/config.yaml`
- Profile: `~/.jarvis/profile.json`
- Memory DB: `~/.jarvis/memory.db`
- Audit log: `~/.jarvis/audit.log`

## Browser Automation Notes

The browser MCP uses **Playwright with Microsoft Edge** as the browser engine. Key implementation details:

- **Browser path**: Microsoft Edge at `C:\Users\YeswanthRam\AppData\Local\Microsoft\Edge\Application\msedge.exe`
- **Edge Profile 2 support**: Can load user's logged-in Edge profile at `Profile 2` for authenticated sessions
- **CDP connection**: Can connect to already-running Edge via Chrome DevTools Protocol on port 9222
- **Auto-login flow**: If session isn't preserved, automation detects login page and auto-fills credentials from `GMAIL_EMAIL`/`GMAIL_PASSWORD` env vars

**The session persistence challenge**: Chrome/Edge security prevents Playwright from accessing authenticated sessions. Even `launchPersistentContext` with profile cookies creates an isolated context that websites detect. **Auto-login is the working solution.**

To start Edge manually for CDP debugging:
```
msedge --remote-debugging-port=9222 --user-data-dir="C:\Users\YeswanthRam\AppData\Local\Microsoft\Edge\User Data\Profile 2"
```

## Known Issues

- **Session persistence**: Chrome security prevents cookie sharing - auto-login with env vars is the working approach
- **NVIDIA API rate limiting (429)**: May cause MCP request timeouts - working models: `meta/llama-3.3-70b-instruct` and `mistralai/mixtral-8x7b-instruct-v0.1`
- **Gmail workspace redirect**: mail.google.com redirects to workspace.google.com - browser automation handles this

## Implementation Progress

- ✅ MCP browser server with Playwright
- ✅ Automation tools: navigate, search, fill_form, click, type, screenshot, extract, scroll, automate
- ✅ AI analysis loop with page state examination every step
- ✅ Decision planner with fallback selectors and stuck detection
- ✅ Edge Profile 2 loading support
- ✅ CDP connection capability
- ✅ Auto-login flow for Gmail
- ✅ NVIDIA client with exponential backoff retry for rate limits (429)
- ✅ All MCP servers implemented: browser, memory, user-profile, filesystem, code, payment, notifications, shell, desktop-ui
- 🔄 Full pipeline end-to-end testing needed
- 🔄 2FA support for Gmail (app-specific password)

## Key Entry Points

- CLI: `src/main/cli.ts` - Commander.js CLI with `run`, `exec`, `parse`, `plan`, `mcp` commands
- Pipeline: `src/pipeline/jarvis_pipeline.ts` - Orchestrates all 5 stages
- Context Store: `src/pipeline/context_store.ts` - Shared state across pipeline stages (singleton)
