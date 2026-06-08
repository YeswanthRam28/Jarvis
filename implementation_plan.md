# Personal OS — Implementation Plan

This document outlines the strategy to evolve the current Jarvis TypeScript/MCP project into a full-fledged "Personal OS" with an Electron GUI, multi-tiered memory, background integrations, and a proactive reasoning engine.

## 1. Current State vs. Vision

Currently, Jarvis is a headless **Node.js/TypeScript** application utilizing a 5-stage NLP pipeline and the Model Context Protocol (MCP) to interact with desktop apps, browser, email, calendar, and SQLite memory.

Your vision introduces a graphical desktop shell (Electron + React), a local-first AI stack (Ollama + Gemini API), a robust multi-tiered memory system, background watchers, and proactive task generation. 

---

## 2. Phase-by-Phase Breakdown

### Phase 1 — Core Shell (Weeks 1–3)
**Goal:** Electron app with React/Vite renderer, floating chat window, hotkey wake, local LLMs.

*   **Already Done:** Basic agent planning loop, context storage, and SQLite connection (`mcp-memory`).
*   **To Be Modified:** 
    *   Change LLM provider from NVIDIA NIM to **Ollama** (Llama 3.1 8B) with **Gemini API** as a fallback.
*   **Yet to Do:** 
    *   Initialize **Electron + React/Vite** project.
    *   Implement global hotkey (`Ctrl+Space`) and system tray icon.
    *   Build the floating chat UI window.
    *   Wire the UI to the backend engine to maintain session context.

### Phase 2 — Intelligence Layer (Weeks 4–6)
**Goal:** Three-tier memory (episodic, semantic, procedural), nightly reasoning, RAG pipeline, Permission board UI.

*   **Already Done:** Basic SQLite database integration exists.
*   **To Be Modified:** 
    *   Expand the SQLite schema to support the taxonomy (Episodic, Semantic, Procedural).
*   **Yet to Do:** 
    *   Integrate Vector Embeddings (RAG Pipeline) so queries pull relevant chunks.
    *   Build the "Nightly Reasoning Job" to extract insights from the day's logs.
    *   Develop the **Permission Board UI** (a dashboard to audit, view, and delete learned knowledge).

### Phase 3 — Integrations (Weeks 7–10)
**Goal:** OAuth2 connectors, file watcher, Chrome extension, Bank CSV, normalized event schema, Plugin interface.

*   **Already Done:** We already have robust MCP servers for **Gmail**, **Google Calendar**, and **Filesystem**. The "Plugin interface" conceptually exists via your MCP architecture!
*   **To Be Modified:** 
    *   Refactor the database layer to ingest all MCP data into a **single normalized event schema**.
    *   Update email/calendar tools to use proper OAuth2 (if currently relying on basic auth/cookies).
*   **Yet to Do:** 
    *   Implement an active **File Watcher** daemon (chokidar/watchdog).
    *   Build a **Chrome Extension** for background URL logging and page summarization.
    *   Develop **Bank CSV ingestion** logic.

### Phase 4 — Proactive Engine (Weeks 11–14)
**Goal:** Nightly briefing, goal tracker, auto-action scaffolding, publish Plugin SDK.

*   **Already Done:** Tool execution framework (the pipeline can already execute actions).
*   **Yet to Do:** 
    *   **Nightly Briefing Generator**: Cron-triggered job to render a Markdown summary at 7 AM.
    *   **Goal Tracker**: Logic to cross-reference inferred deadlines with calendar/email data.
    *   **Auto-action Scaffolding**: System to draft responses and stage actions for 1-click user approval.
    *   Publish an Open Source **Plugin SDK** (which will just be a wrapper around building new MCP servers).

---

## 3. Architectural Recommendations (To Make Work Easier)

To accelerate development and reduce long-term maintenance, I highly recommend the following adjustments to your proposed stack:

> [!TIP]
> **1. Keep the Backend in Node.js (Avoid Python FastAPI)**
> Your proposal mentions a Python FastAPI backend. However, Jarvis currently has thousands of lines of robust TypeScript code handling the 5-stage pipeline and MCP servers. Since Electron uses Node.js natively, building the local backend in **Node.js (Express/Fastify)** or even directly within Electron's Main Process will save weeks of rewrite effort and eliminate complex cross-language IPC bridging.

> [!TIP]
> **2. Use `sqlite-vec` instead of ChromaDB**
> Instead of running a separate heavy ChromaDB instance for vector storage, you can use the `sqlite-vec` extension. This keeps all structured data (SQLite) and unstructured embeddings in a **single `.sqlite` file**. It is drastically easier to manage, backup, and query using SQL JOINs.

> [!TIP]
> **3. Double Down on the MCP Standard**
> You mentioned building a "Plugin interface". You have already implemented the Model Context Protocol (MCP)! Instead of inventing a new plugin standard, we can officially document and publish your MCP implementation as the SDK. Any community member can write an MCP server in any language to extend your Personal OS.

---

## User Review Required

> [!IMPORTANT]
> Please review and clarify the following before we begin coding:
> 1. **Backend Language:** Are you open to keeping the backend in **TypeScript/Node.js** to reuse the existing Jarvis pipeline, or do you strictly want to rewrite the backend in **Python FastAPI**?
> 2. **Vector Database:** Are you comfortable using a SQLite vector extension (`sqlite-vec`) instead of ChromaDB to keep the app lightweight and self-contained?
> 3. **Electron Initialization:** For Phase 1, do you want the Electron app to be embedded inside the current repository, or created as a separate repository?
