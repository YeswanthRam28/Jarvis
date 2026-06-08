# JARVIS — Just A Rather Very Intelligent System

JARVIS is an **autonomous desktop agent** powered by NVIDIA NIM AI models. It understands natural language commands, plans and executes multi-step tasks across desktop applications, browsers, files, email, and more through a modular MCP (Model Context Protocol) server architecture.

## Architecture

JARVIS uses a **5-stage pipeline** to process commands end-to-end:

```
User Input → Intent Parser → Decision Planner → Tool Caller → Executor → Reporter
```

1. **Intent Parser** — Converts natural language into structured intents
2. **Decision Planner** — Builds an optimized task DAG (Directed Acyclic Graph)
3. **Tool Caller** — Maps tasks to the correct MCP tool
4. **Executor** — Executes via MCP servers (desktop, browser, filesystem, shell, etc.)
5. **Reporter** — Summarizes results, logs to memory, sends notifications

## Setup

```bash
cp .env.example .env    # Configure NV_API_KEY and other settings
npm install
npm run build
```

## Usage

```bash
# Run the full pipeline
node dist/main/cli.js exec "open notepad and type hello"

# Parse a command (stage 1 only)
node dist/main/cli.js parse "send email to mom"

# Start individual MCP servers
node dist/main/cli.js mcp start mcp-desktop-ui
node dist/main/cli.js mcp start mcp-browser

# Start all servers
npm run mcp:start-all
```

## MCP Servers

| Server | Port | Purpose |
|--------|------|---------|
| mcp-desktop-ui | 9321 | Desktop app control, UI automation |
| mcp-browser | 9320 | Web automation (Edge via CDP) |
| mcp-memory | 9310 | SQLite persistent memory |
| mcp-user-profile | 9311 | User profile CRUD |
| mcp-filesystem | 9322 | File operations |
| mcp-shell | 9323 | Sandboxed shell commands |
| mcp-email | 9324 | SMTP email |
| mcp-notifications | 9326 | Desktop notifications + TTS |
| mcp-code | 9327 | Sandboxed JS eval |
| mcp-calendar | 9325 | Calendar operations |
| mcp-payment | 9328 | Payment simulation |

## Desktop Automation

Uses **UIAutomation** (Windows) to extract the full UI accessibility tree as XML, giving the AI agent exact element positions, names, types, and states — no OCR or screenshot parsing needed.

Two automation modes:
- **`desktop_automation`** — Rule-based scripted actions via PowerShell SendKeys
- **`automate_desktop`** — AI-powered LangGraph loop: extract UI → LLM reasons → execute → verify

## Configuration

Environment variables (see `.env.example`):
- `NV_API_KEY` — NVIDIA NIM API key (required)
- `GMAIL_EMAIL` / `GMAIL_PASSWORD` — For browser auto-login
- SMTP settings for email server

## Project Structure

```
├── src/
│   ├── main/cli.ts          # Commander.js CLI
│   ├── pipeline/            # 5-stage pipeline
│   ├── agents/              # Desktop agent, UI extractor, automation agent
│   ├── mcps/                # MCP server implementations
│   ├── ai/                  # NVIDIA API client + model router
│   ├── config/              # Config loader
│   ├── context/             # Profile manager, context store
│   └── utils/               # Logger
├── dist/                    # Compiled output
├── tests/
└── package.json
```
