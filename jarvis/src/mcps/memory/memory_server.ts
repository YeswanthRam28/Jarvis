import Database from "better-sqlite3";
import * as path from "path";
import * as fs from "fs";
import * as os from "os";
import {
  MCPRequest,
  MCPResponse,
  MCPTool,
  MCP_ERROR_CODES,
  createMCPResponse,
  createMCPError,
} from "../types";

export class MemoryServer {
  private db: Database.Database;
  private dbPath: string;
  private tools: MCPTool[];

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
  }

  private initializeDB(): void {
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS memories (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        key TEXT NOT NULL UNIQUE,
        value TEXT NOT NULL,
        created_at INTEGER NOT NULL,
        updated_at INTEGER NOT NULL
      );

      CREATE INDEX IF NOT EXISTS idx_memories_key ON memories(key);
      CREATE INDEX IF NOT EXISTS idx_memories_created ON memories(created_at);
    `);
  }

  private defineTools(): MCPTool[] {
    return [
      {
        name: "get",
        description: "Get a value from memory by key",
        inputSchema: {
          type: "object",
          properties: {
            key: { type: "string", description: "The memory key" },
          },
          required: ["key"],
        },
      },
      {
        name: "set",
        description: "Set a value in memory",
        inputSchema: {
          type: "object",
          properties: {
            key: { type: "string", description: "The memory key" },
            value: { type: "string", description: "The value to store" },
          },
          required: ["key", "value"],
        },
      },
      {
        name: "delete",
        description: "Delete a key from memory",
        inputSchema: {
          type: "object",
          properties: {
            key: { type: "string", description: "The memory key to delete" },
          },
          required: ["key"],
        },
      },
      {
        name: "search",
        description: "Search memories by key prefix or pattern",
        inputSchema: {
          type: "object",
          properties: {
            pattern: { type: "string", description: "Search pattern" },
            limit: { type: "number", description: "Max results", default: 20 },
          },
          required: ["pattern"],
        },
      },
      {
        name: "append",
        description: "Append to a list in memory",
        inputSchema: {
          type: "object",
          properties: {
            key: { type: "string", description: "The list key" },
            value: { type: "string", description: "Value to append" },
          },
          required: ["key", "value"],
        },
      },
      {
        name: "list",
        description: "List all memory keys",
        inputSchema: {
          type: "object",
          properties: {
            limit: { type: "number", description: "Max results", default: 100 },
          },
        },
      },
    ];
  }

  public getTools(): MCPTool[] {
    return this.tools;
  }

  public handleRequest(request: MCPRequest): MCPResponse {
    const { id, method, params } = request;

    try {
      switch (method) {
        case "tools/list":
          return createMCPResponse(id, { tools: this.tools });

        case "tools/call":
          return this.handleToolCall(id, params);

        case "initialize":
          return createMCPResponse(id, {
            protocolVersion: "2024-11-05",
            capabilities: { tools: {} },
            serverInfo: { name: "mcp-memory", version: "1.0.0" },
          });

        default:
          return createMCPError(
            id,
            MCP_ERROR_CODES.METHOD_NOT_FOUND,
            `Unknown method: ${method}`
          );
      }
    } catch (error) {
      return createMCPError(
        id,
        MCP_ERROR_CODES.INTERNAL_ERROR,
        `Internal error: ${error}`
      );
    }
  }

  private handleToolCall(
    id: string | number,
    params?: Record<string, unknown>
  ): MCPResponse {
    if (!params || typeof params !== "object") {
      return createMCPError(
        id,
        MCP_ERROR_CODES.INVALID_PARAMS,
        "Invalid params"
      );
    }

    const { name, arguments: args } = params as {
      name: string;
      arguments: Record<string, unknown>;
    };

    try {
      switch (name) {
        case "get":
          return this.toolGet(id, args);
        case "set":
          return this.toolSet(id, args);
        case "delete":
          return this.toolDelete(id, args);
        case "search":
          return this.toolSearch(id, args);
        case "append":
          return this.toolAppend(id, args);
        case "list":
          return this.toolList(id, args);
        default:
          return createMCPError(
            id,
            MCP_ERROR_CODES.METHOD_NOT_FOUND,
            `Unknown tool: ${name}`
          );
      }
    } catch (error) {
      return createMCPError(
        id,
        MCP_ERROR_CODES.INTERNAL_ERROR,
        `Tool error: ${error}`
      );
    }
  }

  private toolGet(id: string | number, args: Record<string, unknown>): MCPResponse {
    const key = args.key as string;
    const stmt = this.db.prepare("SELECT value FROM memories WHERE key = ?");
    const row = stmt.get(key) as { value: string } | undefined;

    if (!row) {
      return createMCPResponse(id, { found: false, key, value: null });
    }

    return createMCPResponse(id, { found: true, key, value: row.value });
  }

  private toolSet(id: string | number, args: Record<string, unknown>): MCPResponse {
    const key = args.key as string;
    const value = args.value as string;
    const now = Date.now();

    const stmt = this.db.prepare(`
      INSERT INTO memories (key, value, created_at, updated_at)
      VALUES (?, ?, ?, ?)
      ON CONFLICT(key) DO UPDATE SET value = ?, updated_at = ?
    `);

    stmt.run(key, value, now, now, value, now);

    return createMCPResponse(id, { success: true, key });
  }

  private toolDelete(id: string | number, args: Record<string, unknown>): MCPResponse {
    const key = args.key as string;
    const stmt = this.db.prepare("DELETE FROM memories WHERE key = ?");
    const result = stmt.run(key);

    return createMCPResponse(id, { success: true, deleted: result.changes > 0 });
  }

  private toolSearch(id: string | number, args: Record<string, unknown>): MCPResponse {
    const pattern = (args.pattern as string).replace(/%/g, "%%");
    const limit = (args.limit as number) || 20;

    const stmt = this.db.prepare(`
      SELECT key, value, updated_at
      FROM memories
      WHERE key LIKE ?
      ORDER BY updated_at DESC
      LIMIT ?
    `);

    const rows = stmt.all(`%${pattern}%`, limit) as Array<{
      key: string;
      value: string;
      updated_at: number;
    }>;

    return createMCPResponse(id, {
      results: rows.map((r) => ({
        key: r.key,
        value: r.value,
        updated_at: r.updated_at,
      })),
      count: rows.length,
    });
  }

  private toolAppend(id: string | number, args: Record<string, unknown>): MCPResponse {
    const key = args.key as string;
    const value = args.value as string;

    const getStmt = this.db.prepare("SELECT value FROM memories WHERE key = ?");
    const existing = getStmt.get(key) as { value: string } | undefined;

    let currentList: string[] = [];
    if (existing) {
      try {
        currentList = JSON.parse(existing.value);
      } catch {
        currentList = [existing.value];
      }
    }

    currentList.push(value);

    const now = Date.now();
    const setStmt = this.db.prepare(`
      INSERT INTO memories (key, value, created_at, updated_at)
      VALUES (?, ?, ?, ?)
      ON CONFLICT(key) DO UPDATE SET value = ?, updated_at = ?
    `);
    setStmt.run(key, JSON.stringify(currentList), now, now, JSON.stringify(currentList), now);

    return createMCPResponse(id, { success: true, key, list_length: currentList.length });
  }

  private toolList(id: string | number, args: Record<string, unknown>): MCPResponse {
    const limit = (args.limit as number) || 100;

    const stmt = this.db.prepare(`
      SELECT key, value, updated_at
      FROM memories
      ORDER BY updated_at DESC
      LIMIT ?
    `);

    const rows = stmt.all(limit) as Array<{
      key: string;
      value: string;
      updated_at: number;
    }>;

    return createMCPResponse(id, {
      keys: rows.map((r) => ({
        key: r.key,
        updated_at: r.updated_at,
      })),
      count: rows.length,
    });
  }

  public close(): void {
    this.db.close();
  }
}
