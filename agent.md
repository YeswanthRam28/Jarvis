# JARVIS — Just A Rather Very Intelligent System
### Autonomous Desktop Agent · OpenCode Specification

> "You said it. I'll do it. Every app. Every task. No questions asked."

---

## 0. Vision

JARVIS is a **multi-model, multi-MCP autonomous desktop agent** that accepts natural language commands and executes them across any application on your computer — browser, WhatsApp, email, file system, calendar, IDE, terminal — exactly like a human would, but faster.

A single utterance like:

```
"Scrape the web for internships, apply to my favourites, and WhatsApp mom that I applied to all of them"
```

…triggers a full pipeline: **Intent Parsing → Decision Planning → Tool Assignment → Sequential Execution → Reporting**.

Each stage runs on its own dedicated AI model, with its own MCP servers, so every layer is best-in-class.

---

## 1. Architecture Overview

```
┌─────────────────────────────────────────────────────────────────────┐
│                          USER UTTERANCE                             │
└─────────────────────────────────┬───────────────────────────────────┘
                                  │
                    ┌─────────────▼──────────────┐
                    │   STAGE 1 · INTENT PARSER   │
                    │   Model: claude-opus-4-5    │
                    │   MCP: memory, context      │
                    └─────────────┬───────────────┘
                                  │  Structured Intent JSON
                    ┌─────────────▼──────────────┐
                    │  STAGE 2 · DECISION PLANNER │
                    │   Model: claude-opus-4-5    │
                    │   MCP: filesystem, memory   │
                    └─────────────┬───────────────┘
                                  │  Ordered Task DAG
                    ┌─────────────▼──────────────┐
                    │  STAGE 3 · TOOL CALLER      │
                    │   Model: claude-sonnet-4-5  │
                    │   MCP: all registered MCPs  │
                    └─────────────┬───────────────┘
                                  │  Tool Calls + Params
                    ┌─────────────▼──────────────┐
                    │  STAGE 4 · EXECUTOR         │
                    │   Model: claude-haiku-4-5   │
                    │   MCP: browser, desktop UI  │
                    └─────────────┬───────────────┘
                                  │  Results
                    ┌─────────────▼──────────────┐
                    │  STAGE 5 · REPORTER         │
                    │   Model: claude-haiku-4-5   │
                    │   MCP: notifications, TTS   │
                    └────────────────────────────┘
```

---

## 2. Stage-by-Stage Specification

### Stage 1 — Intent Parser
**Model:** `claude-opus-4-5` (deep reasoning, nuanced understanding)
**MCPs:** `memory`, `user-profile`

**Responsibilities:**
- Parse raw natural language into a structured `IntentGraph`
- Resolve ambiguities using user profile and conversation history
- Extract entities: targets, conditions, preferences, constraints
- Detect implicit intentions ("apply to my favourites" → load saved preference list)
- Assign urgency / priority level
- Detect compound commands and split them into atomic intents

**Output Schema:**
```json
{
  "session_id": "uuid",
  "raw_input": "scrape web for internships...",
  "intents": [
    {
      "id": "intent_001",
      "action": "WEB_SCRAPE",
      "subject": "internships",
      "filters": { "field": "software engineering", "location": "remote" },
      "output_label": "internship_list"
    },
    {
      "id": "intent_002",
      "action": "APPLY",
      "subject": "internship_list",
      "filter": "user.preferences.internship_favourites",
      "depends_on": ["intent_001"],
      "output_label": "application_results"
    },
    {
      "id": "intent_003",
      "action": "SEND_MESSAGE",
      "channel": "whatsapp",
      "recipient": "Mom",
      "content_template": "Hey mom! I applied to all these internships: {{application_results.names}}",
      "depends_on": ["intent_002"]
    }
  ],
  "user_context": {
    "preferences_loaded": true,
    "profile_used": ["internship_favourites", "contacts.Mom"]
  }
}
```

---

### Stage 2 — Decision Planner
**Model:** `claude-opus-4-5` (strategic, multi-step reasoning)
**MCPs:** `filesystem`, `memory`, `calendar`, `system-info`

**Responsibilities:**
- Receive the `IntentGraph` and convert it to an **ordered Task DAG**
- Resolve tool assignments for each intent
- Check dependencies and enforce execution order
- Handle conditional branching (e.g., "if no internships found, notify user")
- Assign fallback strategies for each task
- Estimate time-cost and warn user if task will take long
- Batch parallel tasks that have no inter-dependencies
- Insert checkpoint tasks ("confirm before sending WhatsApp")

**Output Schema:**
```json
{
  "plan_id": "uuid",
  "tasks": [
    {
      "task_id": "task_001",
      "intent_id": "intent_001",
      "tool": "browser_use",
      "mcp_server": "mcp-browser",
      "executor_model": "claude-haiku-4-5",
      "params": { "query": "software engineering internships remote 2025", "sites": ["linkedin", "internshala", "wellfound"] },
      "output_key": "internship_list",
      "fallback": "notify_user",
      "requires_confirm": false,
      "estimated_seconds": 30
    },
    {
      "task_id": "task_002",
      "intent_id": "intent_002",
      "tool": "form_fill",
      "mcp_server": "mcp-browser",
      "depends_on": ["task_001"],
      "params": { "items": "{{internship_list.favourites}}", "profile": "user.resume_profile" },
      "output_key": "application_results",
      "requires_confirm": true,
      "confirm_message": "Found 5 internships matching your favourites. Apply to all?",
      "estimated_seconds": 180
    },
    {
      "task_id": "task_003",
      "intent_id": "intent_003",
      "tool": "whatsapp_send",
      "mcp_server": "mcp-desktop-ui",
      "depends_on": ["task_002"],
      "params": { "contact": "Mom", "message": "Hey mom! Applied to: {{application_results.names}}" },
      "requires_confirm": false,
      "estimated_seconds": 5
    }
  ],
  "total_estimated_seconds": 215,
  "parallel_groups": [],
  "checkpoints": ["task_002"]
}
```

---

### Stage 3 — Tool Caller
**Model:** `claude-sonnet-4-5` (precise, fast tool selection)
**MCPs:** All registered MCPs (see Section 4)

**Responsibilities:**
- Receive each task from the DAG one-by-one
- Select the exact MCP tool + method to call
- Hydrate parameters from context store
- Validate params before calling
- Handle MCP authentication flows silently
- Emit structured tool calls
- On failure: classify error → retry / escalate / fallback

**Tool Selection Logic:**
```
WEB_SCRAPE        → mcp-browser::navigate + extract
FORM_FILL         → mcp-browser::fill_form + submit
FILE_OPERATION    → mcp-filesystem::read / write / move
EMAIL             → mcp-email::compose + send
WHATSAPP          → mcp-desktop-ui::open_app("WhatsApp") + type + send
CALENDAR          → mcp-calendar::create_event
TERMINAL_CMD      → mcp-shell::execute
APP_CONTROL       → mcp-desktop-ui::launch / click / type
SCREENSHOT        → mcp-desktop-ui::screenshot + analyze
CODE              → mcp-code::run_script
```

---

### Stage 4 — Executor
**Model:** `claude-haiku-4-5` (fast, reactive, action-focused)
**MCPs:** `mcp-browser`, `mcp-desktop-ui`, `mcp-filesystem`, `mcp-shell`

**Responsibilities:**
- Execute tool calls one at a time
- Navigate UIs via screenshot → analyze → click/type loop
- Fill forms using user profile data
- Handle pop-ups, CAPTCHAs (flag for human), 2FA flows
- Write execution logs to context store
- Emit task result back to pipeline
- Self-heal on minor failures (element not found → scroll → retry)

**UI Navigation Loop:**
```
screenshot() → analyze_ui(model=haiku) → identify_action → 
click/type/scroll → screenshot() → verify_success → next_step
```

---

### Stage 5 — Reporter
**Model:** `claude-haiku-4-5`
**MCPs:** `mcp-notifications`, `mcp-tts`, `mcp-memory`

**Responsibilities:**
- Generate human-friendly summary of all completed tasks
- Push OS notification with result
- Optionally speak result via TTS ("All done! Applied to 5 internships and WhatsApp'd mom.")
- Log full session to memory for future reference
- Update user profile with learned preferences
- Flag any tasks that failed or need follow-up

---

## 3. User Profile System

JARVIS maintains a rich, evolving user profile stored in `~/.jarvis/profile.json`:

```json
{
  "identity": {
    "name": "Your Name",
    "email": "you@email.com",
    "phone": "+91XXXXXXXXXX"
  },
  "contacts": {
    "Mom": { "whatsapp": "+91XXXXXXXXXX", "email": "mom@email.com" },
    "Boss": { "email": "boss@company.com" }
  },
  "preferences": {
    "internship_favourites": ["Google", "Microsoft", "Anthropic", "OpenAI"],
    "internship_fields": ["AI/ML", "Software Engineering", "Full Stack"],
    "internship_location": "remote or Bangalore"
  },
  "resume_profile": {
    "name": "Your Name",
    "skills": ["Python", "React", "Node.js"],
    "resume_path": "~/Documents/resume.pdf",
    "cover_letter_template": "~/Documents/cover_letter.md"
  },
  "app_credentials": {
    "linkedin": { "stored_session": true },
    "gmail": { "oauth": true },
    "github": { "token_stored": true }
  },
  "learned_preferences": {},
  "command_history": []
}
```

JARVIS learns from every session — if you always pick "remote" internships, it starts assuming that by default.

---

## 4. MCP Server Registry

| MCP Server         | Purpose                              | Tools Exposed                                      |
|--------------------|--------------------------------------|----------------------------------------------------|
| `mcp-browser`      | Web navigation & scraping            | `navigate`, `extract`, `fill_form`, `submit`, `screenshot` |
| `mcp-desktop-ui`   | Native app control via UI            | `open_app`, `click`, `type`, `scroll`, `screenshot`, `find_element` |
| `mcp-filesystem`   | File operations                      | `read`, `write`, `move`, `delete`, `list`, `watch` |
| `mcp-shell`        | Terminal commands                    | `execute`, `stream_output`, `kill`                 |
| `mcp-email`        | Email (Gmail/Outlook)                | `compose`, `send`, `read`, `search`, `reply`       |
| `mcp-calendar`     | Calendar management                  | `create_event`, `list_events`, `delete`, `update`  |
| `mcp-memory`       | Persistent context & profile         | `get`, `set`, `search`, `append`, `summarize`      |
| `mcp-notifications`| OS notifications & TTS               | `notify`, `speak`, `alert`                         |
| `mcp-code`         | Code execution (Python, JS, etc.)    | `run_script`, `install_package`, `read_output`     |
| `mcp-user-profile` | User preference store                | `get_preference`, `set_preference`, `get_contact`  |

---

## 5. Feature List (Peak Potential)

### 🧠 Intelligence Features
- **Intent Memory** — Remembers past commands; "do what I did last Tuesday" works
- **Preference Learning** — Learns your habits over time and pre-fills assumptions
- **Ambiguity Resolution** — Asks ONE clarifying question maximum; never interrogates
- **Multi-intent Parsing** — Handles long compound commands with 10+ sub-tasks
- **Contextual Pronouns** — "apply to those" refers to results from the last task
- **Implicit Task Chaining** — Infers missing steps ("apply" implies "find the form first")

### ⚡ Execution Features
- **Parallel Task Groups** — Tasks with no dependencies run simultaneously
- **Checkpoint Confirmations** — JARVIS pauses and asks before irreversible actions
- **Live Progress Feed** — Real-time terminal UI showing each step as it executes
- **Self-Healing Executor** — Retries failed UI actions with different strategies
- **CAPTCHA Detection** — Pauses, notifies user, waits for manual solve, then resumes
- **2FA Handling** — Pauses for OTP input, continues automatically
- **Screenshot Verification** — After every action, verifies visually that it worked
- **App State Awareness** — Knows if WhatsApp is already open or needs launching

### 📋 Task Features
- **Task Queue** — Queue multiple macro commands; JARVIS runs them in order
- **Scheduled Tasks** — "Apply to internships every Monday morning"
- **Trigger-based Tasks** — "When I get an email from recruiters, save it to Notion"
- **Conditional Logic** — "If found more than 10, shortlist top 5 by match score"
- **Loop Tasks** — "Apply to all 20, one by one"
- **Rollback** — On failure mid-chain, undo what's possible and report what's not

### 🎤 Interface Features
- **Voice Input** — Speak commands via mic; Whisper transcribes → pipeline runs
- **Text Input** — Type commands in a minimal floating HUD
- **HUD Mode** — Always-on-top minimal overlay showing current task status
- **TTS Output** — JARVIS speaks back results ("Done! Applied to 5 companies.")
- **Hotkey Activation** — `Alt+J` → JARVIS HUD opens
- **Command Palette** — Type `/` to see recent commands, templates, and shortcuts
- **Natural Follow-ups** — "Actually skip Google" mid-execution works

### 🔐 Security Features
- **Credential Vault** — All passwords/tokens in OS keychain, never in plain text
- **Action Preview** — Before destructive actions, shows exactly what will happen
- **Audit Log** — Full log of every action taken, stored locally
- **Sandboxed Execution** — Shell commands run in restricted env by default
- **Privacy Mode** — Disable memory/logging for sensitive sessions

### 📊 Analytics & Reporting
- **Session Summary** — After each run, full report of what was done
- **Success/Failure Breakdown** — Per-task status with reason for failures
- **Time Tracking** — How long each task took
- **Learned Shortcuts** — "You run this every Monday. Want to schedule it?"
- **Weekly Digest** — What JARVIS did for you this week

---

## 6. Example Command Flows

### Example A: Internship Apply + WhatsApp
```
INPUT: "Scrape the web for internships, apply to my most favourite and 
        whatsapp mom that I applied to all those"

PARSED INTENTS:
  1. Scrape → LinkedIn, Internshala, WellFound for internships
  2. Filter → match against user.preferences.internship_favourites
  3. Confirm → "Found 5 matching. Apply?" [CHECKPOINT]
  4. Apply → fill & submit forms for each, one by one
  5. WhatsApp → open WhatsApp Desktop, find Mom, send message with list

EXECUTION ORDER: 1 → 2 → [WAIT] → 3 → 4 → 5
MODELS USED: opus-4-5 (parse), opus-4-5 (plan), sonnet-4-5 (tool call), haiku-4-5 (execute × N), haiku-4-5 (report)
```

### Example B: Morning Routine
```
INPUT: "Do my morning routine"

LEARNED MACRO (from profile):
  1. Check Gmail, summarize important emails
  2. Check calendar for today's meetings
  3. Open Notion, update daily log
  4. Send "Good morning!" to team Slack

PARALLEL: tasks 1 & 2 run simultaneously
```

### Example C: Code + Deploy
```
INPUT: "Run my tests, fix any failures, push to GitHub, and tweet that I shipped it"

INTENTS:
  1. Shell → run `npm test`
  2. Conditional → if failures: read error, fix code (Claude Code), re-run
  3. Shell → git add . && git commit -m "..." && git push
  4. Browser → open Twitter, compose tweet, post
```

---

## 7. Configuration File (`~/.jarvis/config.yaml`)

```yaml
jarvis:
  name: "JARVIS"
  wake_hotkey: "alt+j"
  voice_enabled: true
  tts_enabled: true
  hud_position: "top-right"

models:
  intent_parser: "claude-opus-4-5"
  decision_planner: "claude-opus-4-5"
  tool_caller: "claude-sonnet-4-5"
  executor: "claude-haiku-4-5"
  reporter: "claude-haiku-4-5"

mcps:
  browser: { server: "mcp-browser", transport: "stdio" }
  desktop: { server: "mcp-desktop-ui", transport: "stdio" }
  filesystem: { server: "mcp-filesystem", transport: "stdio" }
  shell: { server: "mcp-shell", transport: "stdio" }
  email: { server: "mcp-email", transport: "stdio", auth: "oauth" }
  calendar: { server: "mcp-calendar", transport: "stdio", auth: "oauth" }
  memory: { server: "mcp-memory", transport: "stdio", db: "~/.jarvis/memory.db" }
  notifications: { server: "mcp-notifications", transport: "stdio" }
  code: { server: "mcp-code", transport: "stdio" }

safety:
  require_confirm_for: ["delete", "send_message", "post", "submit_form", "payment"]
  sandbox_shell: true
  audit_log: true
  audit_log_path: "~/.jarvis/audit.log"

execution:
  max_parallel_tasks: 3
  task_timeout_seconds: 120
  retry_attempts: 2
  screenshot_verify: true

learning:
  enable_preference_learning: true
  enable_command_history: true
  suggest_macros: true
```

---

## 8. Directory Structure

```
jarvis/
├── agent.md                    ← this file
├── src/
│   ├── pipeline/
│   │   ├── intent_parser.ts    ← Stage 1
│   │   ├── decision_planner.ts ← Stage 2
│   │   ├── tool_caller.ts      ← Stage 3
│   │   ├── executor.ts         ← Stage 4
│   │   └── reporter.ts         ← Stage 5
│   ├── context/
│   │   ├── context_store.ts    ← In-memory pipeline state
│   │   └── profile_manager.ts  ← User profile CRUD
│   ├── mcps/
│   │   ├── registry.ts         ← MCP server registry
│   │   └── adapters/           ← One file per MCP
│   ├── ui/
│   │   ├── hud.tsx             ← Floating HUD overlay
│   │   ├── voice.ts            ← Mic input + Whisper
│   │   └── progress.tsx        ← Live task feed
│   ├── safety/
│   │   ├── checkpoint.ts       ← Confirmation gates
│   │   ├── sandbox.ts          ← Shell sandboxing
│   │   └── audit.ts            ← Audit logger
│   └── scheduler/
│       ├── queue.ts            ← Task queue manager
│       └── cron.ts             ← Scheduled macro runner
├── config.yaml
└── profile.json
```

---

## 9. Execution Pipeline Pseudocode

```typescript
async function runJARVIS(userInput: string): Promise<void> {
  const ctx = new ContextStore();

  // Stage 1 — Intent Parser (opus)
  const intentGraph = await intentParser.parse(userInput, ctx.getUserProfile());
  ctx.set("intent_graph", intentGraph);

  // Stage 2 — Decision Planner (opus)
  const taskDAG = await decisionPlanner.plan(intentGraph, ctx);
  ctx.set("task_dag", taskDAG);

  // Show plan to user in HUD
  hud.showPlan(taskDAG);

  // Stage 3 + 4 — Tool Caller + Executor (sonnet + haiku, per task)
  for (const task of taskDAG.tasks) {
    await ctx.waitForDependencies(task.depends_on);

    if (task.requires_confirm) {
      const confirmed = await hud.askConfirmation(task.confirm_message);
      if (!confirmed) { ctx.skipTask(task.task_id); continue; }
    }

    hud.setActiveTask(task);
    const toolCall = await toolCaller.resolve(task, ctx);     // sonnet
    const result   = await executor.execute(toolCall, ctx);   // haiku

    ctx.setTaskResult(task.task_id, result);
    hud.markTaskDone(task.task_id, result.success);
  }

  // Stage 5 — Reporter (haiku)
  const report = await reporter.summarize(ctx);
  notifications.push(report.short_summary);
  if (config.tts_enabled) tts.speak(report.spoken_summary);
  memory.saveSession(ctx.getFullLog());
}
```

---

## 10. Build Instructions for OpenCode

### Stack
- **Runtime:** Node.js 20+ / Bun
- **Language:** TypeScript
- **UI:** Electron (HUD overlay) or Tauri (lighter)
- **MCP Transport:** stdio or SSE
- **Voice:** OpenAI Whisper API or local `whisper.cpp`
- **TTS:** ElevenLabs API or OS native (`say` / `espeak`)
- **Storage:** SQLite via `better-sqlite3` for memory MCP

### Implementation Order
1. Build `ContextStore` — the backbone shared across all stages
2. Build `IntentParser` — Stage 1, test with 20 sample commands
3. Build `DecisionPlanner` — Stage 2, hardcode tool→MCP mappings first
4. Build `ToolCaller` — Stage 3, start with browser + filesystem MCPs
5. Build `Executor` — Stage 4, implement UI navigation loop
6. Build `Reporter` — Stage 5, simple at first
7. Build `HUD` — minimal floating window showing live progress
8. Wire pipeline end-to-end with one test command
9. Add voice input
10. Add user profile & preference learning

### Testing Commands for OpenCode Agent
```
"Open Chrome and search for TypeScript tutorials"
"Create a file called notes.txt on my Desktop with today's date"
"Send an email to test@test.com saying hello"
"Find internships on LinkedIn and save them to a file"
"Set a reminder for 6pm today: take a break"
```

---

*Built to be a buddy, not just a bot. JARVIS remembers you, learns from you, and gets things done so you don't have to.*
