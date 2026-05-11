# JARVIS Walkthrough

A complete guide to using JARVIS CLI and its MCP tools.

---

## CLI Commands

All commands run from the `jarvis/` subdirectory:

```bash
cd jarvis
npm run dev -- "your command"
```

### Core Execution Commands

| Command | Description |
|---------|-------------|
| `jarvis run "<command>"` | Parse and plan (Stages 1-2) - shows intent graph and task DAG without executing |
| `jarvis exec "<command>"` | **Full pipeline** - executes all 5 stages: Intent Parser → Decision Planner → Tool Caller → Executor → Reporter |
| `jarvis parse "<command>"` | Parse natural language and show intent graph (JSON) |
| `jarvis plan "<command>"` | Parse + generate task DAG - shows full execution plan (JSON) |

**Options:**
- `-s, --silent` - Suppress output except results
- `--no-notify` - Disable desktop notifications (for `exec`)
- `--no-tts` - Disable text-to-speech (for `exec`)

### Configuration & Profile

| Command | Description |
|---------|-------------|
| `jarvis init` | Initialize JARVIS config and profile files |
| `jarvis config` | View current configuration |
| `jarvis config --path` | Show config file path |
| `jarvis profile --get` | View user profile |
| `jarvis profile --set '{"identity":{"name":"John"}}'` | Update profile (supports identity, contacts, preferences) |

### MCP Server Management

| Command | Description |
|---------|-------------|
| `jarvis mcp list` | List all registered MCP servers and their status |
| `jarvis mcp tools` | Show all available MCP tools from all servers |
| `jarvis mcp tools <server>` | Show tools from a specific server |
| `jarvis mcp start <server>` | Start a specific MCP server |
| `jarvis mcp stop <server>` | Stop a specific MCP server |
| `jarvis mcp start-all` | Start all core MCP servers (memory, user-profile) |
| `jarvis mcp call <server> <tool> [args]` | Call an MCP tool directly with JSON args |

---

## MCP Tools Reference

### Browser MCP (`mcp-browser`)

Automated browser control using Microsoft Edge + Playwright.

| Tool | Description | Parameters |
|------|-------------|------------|
| **automate** | AI-powered browser automation. Give a goal like "login to facebook" - AI analyzes page, decides actions, executes | `goal` (string), `max_steps` (number, default 15), `context` (string) |
| **navigate** | Navigate to a URL | `url` (string), `wait_until` (load\|domcontentloaded\|networkidle) |
| **search** | Search the web | `query` (string), `engine` (google\|bing\|duckduckgo), `max_results` (number), `fetch_content` (boolean) |
| **fetch** | Navigate to URL and extract main content | `url` (string), `max_length` (number) |
| **extract** | Extract content from current page | `selector` (CSS), `attribute` (text\|href\|src), `all` (boolean) |
| **fill_form** | Fill form fields | `fields` (object: selector → value) |
| **submit** | Submit a form | `selector` (optional) |
| **click** | Click an element | `selector` (CSS), `timeout` (ms) |
| **type** | Type text into an element | `selector` (CSS), `text` (string), `delay` (ms) |
| **screenshot** | Take a screenshot | `path` (file path), `full_page` (boolean) |
| **get_text** | Get text from element | `selector` (CSS) |
| **get_attribute** | Get attribute value | `selector` (CSS), `attribute` (string) |
| **wait_for_selector** | Wait for element | `selector` (CSS), `timeout` (ms) |
| **scroll** | Scroll page/element | `selector` (optional), `x` (number), `y` (number) |
| **close** | Close the browser | - |

### Memory MCP (`mcp-memory`)

SQLite-backed persistent storage for context and session data.

### User Profile MCP (`mcp-user-profile`)

User preferences and contacts management.

### Filesystem MCP (`mcp-filesystem`)

File read/write/list operations.

### Shell MCP (`mcp-shell`)

Sandboxed shell command execution.

| Tool | Description |
|------|-------------|
| **execute** | Run a shell command |
| **kill** | Kill a running process |

### Notifications MCP (`mcp-notifications`)

Desktop notifications and text-to-speech.

| Tool | Description |
|------|-------------|
| **notify** | Desktop notification |
| **speak** | Text-to-speech |
| **alert** | Alert dialog |

### Desktop UI MCP (`mcp-desktop-ui`)

Native desktop UI automation (open app, click, type, scroll, screenshot).

### Code MCP (`mcp-code`)

Code execution in sandbox.

### Payment MCP (`mcp-payment`)

Payment processing integration.

---

## Example Commands

### Browser Automation
```bash
jarvis exec "search for weather in New York"
jarvis exec "go to github and open issues"
jarvis exec "send an email to john@example.com about meeting"
jarvis exec "take a screenshot of wikipedia"
```

### Configuration
```bash
jarvis config --path
jarvis profile --get
jarvis profile --set '{"identity":{"name":"Jarvis User"}}'
```

### MCP Management
```bash
jarvis mcp list
jarvis mcp tools browser
jarvis mcp start memory
```

---

## Environment Variables

| Variable | Description |
|----------|-------------|
| `NV_API_KEY` | NVIDIA NIM API key (required) |
| `GMAIL_EMAIL` | Gmail for auto-login in browser |
| `GMAIL_PASSWORD` | Gmail password for auto-login |
| `USE_EDGE_PROFILE` | Load Edge browser profile |
| `USE_CDP` | Connect via Chrome DevTools Protocol |

---

## 5-Stage Pipeline

Understanding what happens when you run `jarvis exec`:

1. **Intent Parser** - Converts natural language to structured `IntentGraph`
2. **Decision Planner** - Converts IntentGraph to ordered `TaskDAG`
3. **Tool Caller** - Maps tasks to MCP tool calls
4. **Executor** - Executes tool calls via MCP servers
5. **Reporter** - Generates summary and notifications

Use `jarvis run` to see stages 1-2 only (planning), or `jarvis parse` / `jarvis plan` for detailed JSON output.