# JARVIS — Just A Rather Very Intelligent System

JARVIS is a fully autonomous, voice-activated desktop agent powered by NVIDIA NIM AI models, Electron, and React. It understands natural language, retains long-term memories via local vector embeddings, and plans/executes multi-step tasks across desktop applications, browsers, files, and more through a modular MCP (Model Context Protocol) server architecture.

## Features

- **Cinematic Voice UI:** A beautiful, transparent overlay built with Electron, React, and WebGL (`ogl`). The central Orb pulses dynamically as JARVIS listens, thinks, and speaks.
- **Instant Voice Interaction:** Uses Hugging Face's `whisper-large-v3` for high-accuracy Speech-To-Text and zero-latency OS-native Web Speech APIs for TTS.
- **RAG & Long-Term Memory:** Features a private, 100% on-device vector database using `@xenova/transformers`. JARVIS records your preferences, contacts, and personal facts in a 3-tier memory system (Episodic, Semantic, Procedural).
- **Desktop Automation:** Uses Windows UIAutomation and PowerShell to control desktop applications, WhatsApp, Spotify, and more. 

## Architecture

JARVIS uses a **5-stage NLP pipeline** combined with 10 independent MCP microservices:

```
Voice Input → Intent Parser (+ RAG) → Decision Planner → Tool Caller → Executor → Reporter
```

1. **Intent Parser** — Converts speech into structured intents. Injects your personal facts via local vector embeddings.
2. **Decision Planner** — Builds an optimized Task DAG.
3. **Tool Caller** — Maps tasks to the correct MCP tool.
4. **Executor** — Executes via MCP servers (desktop, browser, filesystem, etc).
5. **Reporter** — Synthesizes results into spoken audio and logs new facts to memory.

## Setup

```bash
# 1. Clone the repository
# 2. Configure environment variables
cp .env.example .env
# Make sure to set NV_API_KEY and HF_TOKEN

# 3. Install dependencies
npm install

# 4. Build the backend and the React UI
npm run build

# 5. Start the Electron application
npm run dev
```

## Global Shortcuts

- Press `Ctrl + Space` (or `Cmd + Space` on Mac) anywhere on your computer to instantly summon JARVIS or hide him.
- Click the Microphone icon to speak to him.
- Click the Brain icon to view your personalized Semantic Memory board.

## MCP Servers

JARVIS's capabilities are split across dynamically loaded MCP servers:

| Server | Purpose |
|--------|---------|
| `mcp-desktop-ui` | Desktop app control, WhatsApp, and UI automation |
| `mcp-browser` | Web automation (Edge via CDP) |
| `mcp-memory` | SQLite persistent memory + Xenova Vector Embeddings |
| `mcp-user-profile` | User profile and contacts CRUD |
| `mcp-filesystem` | File operations |
| `mcp-shell` | Sandboxed shell commands |
| `mcp-code` | Sandboxed JavaScript evaluation |
| `mcp-email` | SMTP email automation |
| `mcp-calendar` | Calendar operations |
| `mcp-payment` | Payment simulation |

## Project Structure

```
├── src/
│   ├── electron/            # Electron main & preload scripts
│   ├── pipeline/            # 5-stage NLP pipeline + RAG
│   ├── mcps/                # 10 MCP server implementations
│   ├── ai/                  # NVIDIA API client + model router
│   └── scheduler/           # Nightly reasoning jobs (memory distillation)
├── ui/
│   ├── src/                 # React frontend
│   │   ├── App.tsx          # Main Voice UI & State
│   │   ├── Orb.tsx          # WebGL Orb visualizer
│   │   └── MemoryBoard.tsx  # Slide-out RAG memory manager
│   └── vite.config.ts       # Vite config
├── dist/                    # Compiled output
└── package.json
```
