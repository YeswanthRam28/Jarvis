import Database from "better-sqlite3";
import * as path from "path";
import * as fs from "fs";
import * as os from "os";
// @ts-ignore
import { pipeline } from '@xenova/transformers';
import {
  MCPRequest,
  MCPResponse,
  MCPTool,
  MCP_ERROR_CODES,
  createMCPResponse,
  createMCPError,
} from "../types";

// Cosine similarity function
function cosineSimilarity(vecA: number[], vecB: number[]): number {
  let dotProduct = 0;
  let normA = 0;
  let normB = 0;
  for (let i = 0; i < vecA.length; i++) {
    dotProduct += vecA[i] * vecB[i];
    normA += vecA[i] * vecA[i];
    normB += vecB[i] * vecB[i];
  }
  if (normA === 0 || normB === 0) return 0;
  return dotProduct / (Math.sqrt(normA) * Math.sqrt(normB));
}

export class MemoryServer {
  private db: Database.Database;
  private dbPath: string;
  private tools: MCPTool[];
  private extractor: any = null;
  private isExtractorLoading: boolean = false;

  constructor(dbPath?: string) {
    const homeDir = os.homedir();
    const jarvisDir = path.join(homeDir, ".jarvis");
    this.dbPath = dbPath || path.join(jarvisDir, "memory.db");

    if (!fs.existsSync(jarvisDir)) {
      fs.mkdirSync(jarvisDir, { recursive: true });
    }

    this.db = new Database(this.dbPath);
    this.initializeDB();
    this.tools = this.defineTools();
    
    // Start loading the embeddings model asynchronously
    this.initExtractor();
  }

  private async initExtractor() {
    if (this.extractor || this.isExtractorLoading) return;
    this.isExtractorLoading = true;
    try {
      console.log("[mcp-memory] Loading local embedding model (Xenova/all-MiniLM-L6-v2)...");
      this.extractor = await pipeline('feature-extraction', 'Xenova/all-MiniLM-L6-v2');
      console.log("[mcp-memory] Local embedding model loaded successfully.");
    } catch (e) {
      console.error("[mcp-memory] Failed to load embedding model:", e);
    } finally {
      this.isExtractorLoading = false;
    }
  }

  private async getEmbedding(text: string): Promise<number[]> {
    if (!this.extractor) {
      if (this.isExtractorLoading) {
        // Wait briefly if still loading
        for (let i = 0; i < 20; i++) {
          await new Promise(r => setTimeout(r, 500));
          if (this.extractor) break;
        }
      }
      if (!this.extractor) throw new Error("Embedding model not loaded");
    }
    const output = await this.extractor(text, { pooling: 'mean', normalize: true });
    return Array.from(output.data);
  }

  private initializeDB(): void {
    // Legacy KV Store
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS memories (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        key TEXT NOT NULL UNIQUE,
        value TEXT NOT NULL,
        created_at INTEGER NOT NULL,
        updated_at INTEGER NOT NULL
      );
      CREATE INDEX IF NOT EXISTS idx_memories_key ON memories(key);
    `);

    // Phase 2: 3-Tier Taxonomy
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS episodic_memory (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        session_id TEXT NOT NULL,
        role TEXT NOT NULL,
        content TEXT NOT NULL,
        created_at INTEGER NOT NULL
      );
      CREATE INDEX IF NOT EXISTS idx_episodic_created ON episodic_memory(created_at);

      CREATE TABLE IF NOT EXISTS semantic_memory (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        fact TEXT NOT NULL UNIQUE,
        embedding TEXT NOT NULL,
        created_at INTEGER NOT NULL
      );

      CREATE TABLE IF NOT EXISTS procedural_memory (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        rule TEXT NOT NULL UNIQUE,
        embedding TEXT NOT NULL,
        created_at INTEGER NOT NULL
      );
    `);
  }

  private defineTools(): MCPTool[] {
    return [
      // Legacy KV Tools
      { name: "get", description: "Get a value from memory by key", inputSchema: { type: "object", properties: { key: { type: "string" } }, required: ["key"] } },
      { name: "set", description: "Set a value in memory", inputSchema: { type: "object", properties: { key: { type: "string" }, value: { type: "string" } }, required: ["key", "value"] } },
      
      // Phase 2 Taxonomies
      {
        name: "log_episode",
        description: "Log a conversational turn or event to episodic memory",
        inputSchema: {
          type: "object",
          properties: {
            session_id: { type: "string" },
            role: { type: "string", description: "user, jarvis, or system" },
            content: { type: "string" }
          },
          required: ["session_id", "role", "content"]
        }
      },
      {
        name: "add_semantic",
        description: "Extract and save a long-term fact about the user (Preferences, beliefs, personal details)",
        inputSchema: {
          type: "object",
          properties: { fact: { type: "string" } },
          required: ["fact"]
        }
      },
      {
        name: "add_procedural",
        description: "Save a rule or workflow JARVIS should remember for future tasks",
        inputSchema: {
          type: "object",
          properties: { rule: { type: "string" } },
          required: ["rule"]
        }
      },
      {
        name: "semantic_search",
        description: "Perform a RAG vector search across semantic or procedural memories",
        inputSchema: {
          type: "object",
          properties: {
            query: { type: "string" },
            type: { type: "string", description: "semantic or procedural", default: "semantic" },
            limit: { type: "number", default: 3 }
          },
          required: ["query"]
        }
      },
      {
        name: "list_semantic",
        description: "List all semantic memories",
        inputSchema: {
          type: "object",
          properties: { limit: { type: "number", default: 100 } }
        }
      },
      {
        name: "delete_semantic",
        description: "Delete a semantic memory by ID",
        inputSchema: {
          type: "object",
          properties: { id: { type: "number" } },
          required: ["id"]
        }
      }
    ];
  }

  public getTools(): MCPTool[] {
    return this.tools;
  }

  public async handleRequest(request: MCPRequest): Promise<MCPResponse> {
    const { id, method, params } = request;

    try {
      switch (method) {
        case "tools/list":
          return createMCPResponse(id, { tools: this.tools });
        case "tools/call":
          return await this.handleToolCall(id, params);
        case "initialize":
          return createMCPResponse(id, {
            protocolVersion: "2024-11-05",
            capabilities: { tools: {} },
            serverInfo: { name: "mcp-memory", version: "2.0.0" },
          });
        default:
          return createMCPError(id, MCP_ERROR_CODES.METHOD_NOT_FOUND, `Unknown method: ${method}`);
      }
    } catch (error) {
      return createMCPError(id, MCP_ERROR_CODES.INTERNAL_ERROR, `Internal error: ${error}`);
    }
  }

  private async handleToolCall(id: string | number, params?: Record<string, unknown>): Promise<MCPResponse> {
    if (!params || typeof params !== "object") return createMCPError(id, MCP_ERROR_CODES.INVALID_PARAMS, "Invalid params");

    const { name, arguments: args } = params as { name: string; arguments: Record<string, unknown> };

    try {
      switch (name) {
        case "get": return this.toolGet(id, args);
        case "set": return this.toolSet(id, args);
        case "log_episode": return this.toolLogEpisode(id, args);
        case "add_semantic": return await this.toolAddSemantic(id, args);
        case "add_procedural": return await this.toolAddProcedural(id, args);
        case "semantic_search": return await this.toolSemanticSearch(id, args);
        case "list_semantic": return this.toolListSemantic(id, args);
        case "delete_semantic": return this.toolDeleteSemantic(id, args);
        default: return createMCPError(id, MCP_ERROR_CODES.METHOD_NOT_FOUND, `Unknown tool: ${name}`);
      }
    } catch (error) {
      return createMCPError(id, MCP_ERROR_CODES.INTERNAL_ERROR, `Tool error: ${error}`);
    }
  }

  private toolGet(id: string | number, args: Record<string, unknown>): MCPResponse {
    const key = args.key as string;
    const stmt = this.db.prepare("SELECT value FROM memories WHERE key = ?");
    const row = stmt.get(key) as { value: string } | undefined;
    if (!row) return createMCPResponse(id, { found: false, key, value: null });
    return createMCPResponse(id, { found: true, key, value: row.value });
  }

  private toolSet(id: string | number, args: Record<string, unknown>): MCPResponse {
    const key = args.key as string;
    const value = args.value as string;
    const now = Date.now();
    const stmt = this.db.prepare(`
      INSERT INTO memories (key, value, created_at, updated_at)
      VALUES (?, ?, ?, ?) ON CONFLICT(key) DO UPDATE SET value = ?, updated_at = ?
    `);
    stmt.run(key, value, now, now, value, now);
    return createMCPResponse(id, { success: true, key });
  }

  private toolLogEpisode(id: string | number, args: Record<string, unknown>): MCPResponse {
    const { session_id, role, content } = args as any;
    const stmt = this.db.prepare(`INSERT INTO episodic_memory (session_id, role, content, created_at) VALUES (?, ?, ?, ?)`);
    stmt.run(session_id, role, content, Date.now());
    return createMCPResponse(id, { success: true });
  }

  private async toolAddSemantic(id: string | number, args: Record<string, unknown>): Promise<MCPResponse> {
    const fact = args.fact as string;
    try {
      const embedding = await this.getEmbedding(fact);
      const stmt = this.db.prepare(`
        INSERT INTO semantic_memory (fact, embedding, created_at) VALUES (?, ?, ?)
        ON CONFLICT(fact) DO UPDATE SET embedding = excluded.embedding
      `);
      stmt.run(fact, JSON.stringify(embedding), Date.now());
      return createMCPResponse(id, { success: true, fact });
    } catch (e: any) {
      return createMCPError(id, MCP_ERROR_CODES.INTERNAL_ERROR, "Failed to embed fact: " + e.message);
    }
  }

  private async toolAddProcedural(id: string | number, args: Record<string, unknown>): Promise<MCPResponse> {
    const rule = args.rule as string;
    try {
      const embedding = await this.getEmbedding(rule);
      const stmt = this.db.prepare(`
        INSERT INTO procedural_memory (rule, embedding, created_at) VALUES (?, ?, ?)
        ON CONFLICT(rule) DO UPDATE SET embedding = excluded.embedding
      `);
      stmt.run(rule, JSON.stringify(embedding), Date.now());
      return createMCPResponse(id, { success: true, rule });
    } catch (e: any) {
      return createMCPError(id, MCP_ERROR_CODES.INTERNAL_ERROR, "Failed to embed rule: " + e.message);
    }
  }

  private async toolSemanticSearch(id: string | number, args: Record<string, unknown>): Promise<MCPResponse> {
    const query = args.query as string;
    const type = (args.type as string) === 'procedural' ? 'procedural_memory' : 'semantic_memory';
    const limit = (args.limit as number) || 3;

    try {
      const queryEmbedding = await this.getEmbedding(query);
      
      const stmt = this.db.prepare(`SELECT id, ${type === 'procedural_memory' ? 'rule' : 'fact'} as text, embedding FROM ${type}`);
      const rows = stmt.all() as any[];

      const scored = rows.map(row => {
        const rowEmb = JSON.parse(row.embedding);
        const score = cosineSimilarity(queryEmbedding, rowEmb);
        return { id: row.id, text: row.text, score };
      });

      scored.sort((a, b) => b.score - a.score);
      const topK = scored.slice(0, limit);

      return createMCPResponse(id, { results: topK });
    } catch (e: any) {
      return createMCPError(id, MCP_ERROR_CODES.INTERNAL_ERROR, "Search failed: " + e.message);
    }
  }

  private toolListSemantic(id: string | number, args: Record<string, unknown>): MCPResponse {
    const limit = (args.limit as number) || 100;
    const stmt = this.db.prepare('SELECT id, fact, created_at FROM semantic_memory ORDER BY created_at DESC LIMIT ?');
    const rows = stmt.all(limit) as any[];
    return createMCPResponse(id, { results: rows });
  }

  private toolDeleteSemantic(id: string | number, args: Record<string, unknown>): MCPResponse {
    const memoryId = args.id as number;
    const stmt = this.db.prepare('DELETE FROM semantic_memory WHERE id = ?');
    const result = stmt.run(memoryId);
    return createMCPResponse(id, { success: true, deleted: result.changes > 0 });
  }

  public close(): void {
    this.db.close();
  }
}
