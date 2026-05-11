# JARVIS Implementation Plan

**Version:** 1.0  
**Date:** 2026-04-16  
**Based on:** `agent.md` specification

---

## 1. Project Overview

JARVIS is a multi-model, multi-MCP autonomous desktop agent that accepts natural language commands and executes them across any application. The MVP will be a CLI-first implementation with the full 5-stage pipeline.

### Stack Decisions
| Component | Choice |
|-----------|--------|
| Runtime | Node.js 20+ |
| Language | TypeScript |
| AI Models | NVIDIA NIM (AI Foundation Models) |
| MCP Transport | SSE |
| Browser Automation | Playwright |
| Desktop UI | Playwright + Windows UIAutomation |
| Distribution | Standalone Electron installer |
| Storage | SQLite (`better-sqlite3`) |
| Platform | Windows-first |

### NVIDIA AI Model Mapping
| Stage | Model | Purpose |
|-------|-------|---------|
| Stage 1 - Intent Parser | `nvidia/llama-3.3-nemotron-70b-instruct` | Deep reasoning, nuanced understanding |
| Stage 2 - Decision Planner | `nvidia/llama-3.3-nemotron-70b-instruct` | Strategic, multi-step reasoning |
| Stage 3 - Tool Caller | `nvidia/mixtral-8x7b-instruct-v0.1` | Precise, fast tool selection |
| Stage 4 - Executor | `nvidia/llama-3.1-nemotron-8b-instruct` | Fast, reactive, action-focused |
| Stage 5 - Reporter | `nvidia/llama-3.1-nemotron-8b-instruct` | Summary generation, TTS/notifications |

> **Note:** Uses NVIDIA NIM API (`https://integrate.api.nvidia.com/v1`) with `NV_API_KEY` environment variable.

---

## 2. Project Structure

```
jarvis/
├── package.json
├── tsconfig.json
├── electron-builder.json
├── src/
│   ├── main/                     # Electron main process
│   │   ├── index.ts              # Entry point
│   │   └── ipc.ts                # IPC handlers
│   ├── pipeline/                 # Core 5-stage pipeline
│   │   ├── context_store.ts      # Shared pipeline state
│   │   ├── intent_parser.ts      # Stage 1
│   │   ├── decision_planner.ts   # Stage 2
│   │   ├── tool_caller.ts        # Stage 3
│   │   ├── executor.ts           # Stage 4
│   │   └── reporter.ts           # Stage 5
│   ├── ai/                       # AI Model integrations
│   │   ├── nvidia_client.ts      # NVIDIA NIM API client
│   │   └── model_router.ts       # Routes requests to correct model
│   ├── mcps/                     # MCP Server implementations
│   │   ├── registry.ts           # MCP registry & connection manager
│   │   ├── browser/              # mcp-browser (Playwright)
│   │   ├── desktop/               # mcp-desktop-ui (UIAutomation)
│   │   ├── filesystem/            # mcp-filesystem
│   │   ├── shell/                 # mcp-shell
│   │   ├── memory/                 # mcp-memory (SQLite)
│   │   ├── notifications/          # mcp-notifications
│   │   └── user-profile/          # mcp-user-profile
│   ├── context/
│   │   ├── profile_manager.ts     # User profile CRUD
│   │   └── session_manager.ts     # Session & history management
│   ├── ui/                       # Electron UI (future)
│   │   └── hud.tsx
│   ├── safety/
│   │   ├── checkpoint.ts          # Confirmation gates
│   │   ├── sandbox.ts            # Shell sandboxing
│   │   └── audit.ts              # Audit logger
│   ├── scheduler/
│   │   ├── queue.ts              # Task queue
│   │   └── cron.ts               # Scheduled tasks
│   ├── config/
│   │   └── loader.ts             # Config YAML loader
│   └── utils/
│       ├── logger.ts             # Winston logger
│       └── validators.ts         # Input validation
├── mcp-servers/                  # Standalone MCP server processes
│   ├── browser-server/
│   ├── desktop-server/
│   ├── filesystem-server/
│   ├── shell-server/
│   ├── memory-server/
│   ├── notifications-server/
│   └── user-profile-server/
├── ~/.jarvis/                    # User data (created at runtime)
│   ├── config.yaml
│   ├── profile.json
│   ├── memory.db
│   └── audit.log
└── tests/
    ├── unit/
    └── integration/
```

---

## 3. Implementation Phases

### Phase 1: Foundation (Week 1)
**Goal:** Project scaffolding, config system, logging, context store

**Tasks:**
1. Initialize Node.js project with TypeScript
2. Set up ESLint + Prettier
3. Create config loader (`~/.jarvis/config.yaml`)
4. Implement `NVIDIAAPIClient` — wrapper for NVIDIA NIM API
   - OpenAI-compatible API (`https://integrate.api.nvidia.com/v1`)
   - Support for chat completions endpoint
   - Streaming support for long outputs
   - API key management via `NV_API_KEY` env var
5. Implement `ModelRouter` — routes requests to appropriate model per stage
6. Implement `ContextStore` — shared state across pipeline stages
7. Set up Winston logger with file rotation
8. Create directory structure
9. Implement basic CLI entry point (`jarvis "command"`)

**Deliverables:**
- `package.json`, `tsconfig.json` configured
- `ConfigLoader` class reading YAML
- `ContextStore` with get/set/watch methods
- Working CLI: `npx jarvis "hello world"` → logs "received command"

---

### Phase 2: User Profile & Memory (Week 1-2)
**Goal:** Profile management and persistent memory

**Tasks:**
1. Create `ProfileManager` class
   - Load/save `~/.jarvis/profile.json`
   - CRUD operations for all profile sections
   - Validate profile schema on load
2. Implement `mcp-memory-server` (standalone Node process)
   - SQLite database with `better-sqlite3`
   - SSE endpoints for `get`, `set`, `search`, `append`, `summarize`
   - Vector storage for semantic search (optional, Phase 3)
3. Implement `mcp-user-profile-server` (standalone Node process)
   - Read from `profile.json`, write back on changes
   - SSE endpoints matching MCP spec

**Deliverables:**
- Profile persists across sessions
- Memory stores conversation history
- Both MCP servers run as separate processes communicating via SSE

---

### Phase 3: Intent Parser (Week 2)
**Goal:** Stage 1 — Parse natural language to structured IntentGraph

**Tasks:**
1. Implement `IntentParser` class
   - Connect to NVIDIA NIM API (`nvidia/llama-3.3-nemotron-70b-instruct`)
   - System prompt based on agent.md Stage 1 spec
   - Handle ambiguous inputs by asking ONE clarifying question
2. Implement output schema matching agent.md
3. Add entity extraction (targets, conditions, preferences)
4. Add compound command splitting
5. Write unit tests with 10+ sample commands

**Deliverables:**
- `IntentParser` outputs valid `IntentGraph` JSON
- Test cases: "open chrome", "scrape internships and whatsapp mom"

---

### Phase 4: Decision Planner (Week 2-3)
**Goal:** Stage 2 — Convert IntentGraph to ordered Task DAG

**Tasks:**
1. Implement `DecisionPlanner` class
   - Connect to NVIDIA NIM API (`nvidia/llama-3.3-nemotron-70b-instruct`)
   - System prompt based on agent.md Stage 2 spec
2. Implement DAG builder
   - Dependency resolution
   - Parallel group identification
   - Checkpoint insertion
3. Add fallback strategy assignment
4. Add time-cost estimation
5. Implement conditional branching logic

**Deliverables:**
- `DecisionPlanner` outputs valid `TaskDAG` JSON
- Parallel tasks correctly grouped
- Checkpoints inserted before destructive actions

---

### Phase 5: MCP Server Registry (Week 3)
**Goal:** Framework for registering and calling MCP servers

**Tasks:**
1. Implement `MCPRegistry` class
   - SSE connection management to all MCP servers
   - Health check ping/pong
   - Tool discovery (fetch available tools from each MCP)
2. Implement SSE client wrapper for Node.js
3. Create MCP protocol types
4. Add auth flow handling (OAuth tokens, API keys)

**Deliverables:**
- All MCP servers can be registered dynamically
- Health monitoring for each server
- Tool registry with capabilities

---

### Phase 6: Tool Caller (Week 3-4)
**Goal:** Stage 3 — Map tasks to exact MCP tool calls

**Tasks:**
1. Implement `ToolCaller` class
   - Connect to NVIDIA NIM API (`nvidia/mixtral-8x7b-instruct-v0.1`)
   - Tool selection logic per agent.md spec
   - Parameter hydration from context store
   - Validation before calling
2. Implement tool mapping table:
   - `WEB_SCRAPE` → `mcp-browser::navigate + extract`
   - `FORM_FILL` → `mcp-browser::fill_form + submit`
   - `FILE_OPERATION` → `mcp-filesystem::read/write/move`
   - `WHATSAPP` → `mcp-desktop-ui::*`
   - etc.
3. Add error classification (retry / escalate / fallback)

**Deliverables:**
- `ToolCaller` resolves tasks to MCP calls
- Parameter hydration works with `{{variable}}` syntax
- Error handling with retry logic

---

### Phase 7: Executor (Week 4-5)
**Goal:** Stage 4 — Execute tool calls

**Tasks:**
1. Implement `Executor` class
   - Connect to NVIDIA NIM API (`nvidia/llama-3.1-nemotron-8b-instruct`)
   - Sequential task execution
   - Dependency waiting logic
2. Implement UI navigation loop
   - Screenshot → analyze → click/type → verify
3. Add self-healing logic
   - Element not found → scroll → retry
   - Timeout → alert → skip or retry
4. Implement `mcp-browser-server` (Playwright-based)
   - `navigate`, `extract`, `fill_form`, `submit`, `screenshot`
5. Implement `mcp-desktop-ui-server` (Windows UIAutomation)
   - `open_app`, `click`, `type`, `scroll`, `screenshot`, `find_element`

**Deliverables:**
- Browser automation works (navigate, fill, submit)
- Desktop app control works (open app, click, type)
- UI verification loop functional
- Self-healing retries work

---

### Phase 8: Reporter (Week 5)
**Goal:** Stage 5 — Generate summaries and notifications

**Tasks:**
1. Implement `Reporter` class
   - Connect to NVIDIA NIM API (`nvidia/llama-3.1-nemotron-8b-instruct`)
   - Generate human-friendly summary
2. Implement `mcp-notifications-server`
   - OS notification via `node-notifier`
   - TTS via OS native (`say` on macOS, SAPI on Windows)
3. Implement `mcp-filesystem-server`
   - `read`, `write`, `move`, `delete`, `list`
4. Implement `mcp-shell-server`
   - `execute`, `stream_output`, `kill`
   - Sandboxed execution

**Deliverables:**
- Session summaries generated
- OS notifications work
- TTS output works
- Full CLI pipeline end-to-end functional

---

### Phase 9: Safety & Audit (Week 5-6)
**Goal:** Security features and logging

**Tasks:**
1. Implement `CheckpointManager`
   - Pause pipeline for confirmation
   - `requires_confirm` detection
2. Implement `SandboxManager`
   - Restrict shell commands
   - Environment variable filtering
3. Implement `AuditLogger`
   - Log all actions with timestamps
   - Write to `~/.jarvis/audit.log`
   - Include user consent records

**Deliverables:**
- Confirmation prompts before destructive actions
- Shell commands sandboxed
- Full audit trail

---

### Phase 10: Scheduler & Queue (Week 6)
**Goal:** Task queue and scheduling

**Tasks:**
1. Implement `TaskQueue`
   - Enqueue multiple commands
   - Process FIFO
   - Status tracking
2. Implement `CronScheduler`
   - Parse cron expressions
   - Run scheduled macros
   - `node-cron` library
3. Add condition evaluation (if/else logic)

**Deliverables:**
- Task queue functional
- Scheduled tasks work ("every Monday 9am")

---

### Phase 11: Electron HUD (Week 6-7)
**Goal:** GUI overlay for live progress

**Tasks:**
1. Set up Electron project
   - Main process + renderer process
   - IPC communication
2. Implement HUD overlay
   - Always-on-top window
   - Task progress display
   - Mini console output
3. Add hotkey activation (`Alt+J`)
4. Add system tray icon

**Deliverables:**
- HUD overlay appears when activated
- Live task progress visible
- System tray integration

---

### Phase 12: Voice Input (Week 7-8)
**Goal:** Voice commands via microphone

**Tasks:**
1. Set up microphone input
   - `mic` npm package
2. Integrate Whisper API
   - Transcribe audio to text
   - Feed to pipeline
3. Add voice activation detection
4. Optional: Local whisper.cpp

**Deliverables:**
- Voice commands work
- Whisper transcription accurate

---

### Phase 13: Build & Distribution (Week 8)
**Goal:** Package as standalone installer

**Tasks:**
1. Configure `electron-builder`
   - Windows NSIS installer
   - Auto-updater setup
2. Bundle MCP servers with app
3. Create installation script
4. Set up app data directories
5. Test clean install/uninstall

**Deliverables:**
- `.exe` installer generated
- JARVIS installs like a normal app

---

## 4. Testing Strategy

### Unit Tests (per module)
- `NVIDIAAPIClient` — API calls, streaming, error handling
- `ModelRouter` — Correct model routing per stage
- `IntentParser` — 20 sample commands
- `DecisionPlanner` — DAG building logic
- `ToolCaller` — Tool selection accuracy
- `ProfileManager` — CRUD operations
- `ContextStore` — State management

### Integration Tests
- Full pipeline with mock MCP servers
- MCP server communication (SSE)
- CLI end-to-end

### E2E Test Commands
```
"Open Chrome and search for TypeScript tutorials"
"Create a file called notes.txt with today's date"
"Send a test notification"
"List files in Documents folder"
```

---

## 5. Risks & Mitigations

| Risk | Impact | Mitigation |
|------|--------|------------|
| Playwright browser automation unstable | High | Add retry + screenshot verification |
| SSE MCP communication latency | Medium | Connection pooling, timeout handling |
| NVIDIA NIM API rate limits/availability | High | Queue + backoff, local fallback model, quota monitoring |
| Desktop UI element detection fails | High | Multiple strategies (UIA, image recognition) |
| Windows UIAutomation permission issues | Medium | Run with appropriate permissions, admin fallback |
| NVIDIA API key management | Medium | Store securely, never log, support env var rotation |

---

## 6. Out of Scope (Phase 1+)

These features are deferred to post-MVP:
- Multi-account support
- Remote MCP servers
- Vector/embedding-based memory search
- Mobile companion app
- Plugin marketplace
- Team/shared JARVIS instances

---

## 7. Success Criteria

MVP is complete when:
1. `jarvis "search for python jobs on linkedin"` → Opens browser, navigates, returns results
2. `jarvis "create a todo.txt with: buy milk"` → Creates file
3. `jarvis "remind me in 5 minutes to take a break"` → Sends notification
4. All 5 stages execute in sequence using NVIDIA NIM models
5. Audit log captures all actions
6. Electron HUD shows live progress
7. `.exe` installer generated and functional

### Prerequisites
- `NV_API_KEY` environment variable set with NVIDIA NIM API key
- API key obtained from https://developer.nvidia.com/nim

---

*Plan draft complete. Ready for implementation.*
