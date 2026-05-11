import * as fs from "fs";
import * as path from "path";
import {
  MCPRequest,
  MCPResponse,
  MCPTool,
  MCP_ERROR_CODES,
  createMCPResponse,
  createMCPError,
} from "../types";

export class FilesystemServer {
  private tools: MCPTool[];
  private basePath: string;

  constructor(basePath?: string) {
    this.basePath = basePath || process.cwd();
    this.tools = this.defineTools();
  }

  private defineTools(): MCPTool[] {
    return [
      {
        name: "read",
        description: "Read file contents",
        inputSchema: {
          type: "object",
          properties: {
            path: { type: "string", description: "File path" },
            encoding: { type: "string", description: "Encoding", default: "utf-8" },
          },
          required: ["path"],
        },
      },
      {
        name: "write",
        description: "Write content to a file",
        inputSchema: {
          type: "object",
          properties: {
            path: { type: "string", description: "File path" },
            content: { type: "string", description: "Content to write" },
            encoding: { type: "string", description: "Encoding", default: "utf-8" },
          },
          required: ["path", "content"],
        },
      },
      {
        name: "append",
        description: "Append content to a file",
        inputSchema: {
          type: "object",
          properties: {
            path: { type: "string", description: "File path" },
            content: { type: "string", description: "Content to append" },
          },
          required: ["path", "content"],
        },
      },
      {
        name: "delete",
        description: "Delete a file or directory",
        inputSchema: {
          type: "object",
          properties: {
            path: { type: "string", description: "File or directory path" },
            recursive: { type: "boolean", description: "Delete recursively", default: false },
          },
          required: ["path"],
        },
      },
      {
        name: "move",
        description: "Move or rename a file",
        inputSchema: {
          type: "object",
          properties: {
            source: { type: "string", description: "Source path" },
            destination: { type: "string", description: "Destination path" },
          },
          required: ["source", "destination"],
        },
      },
      {
        name: "copy",
        description: "Copy a file",
        inputSchema: {
          type: "object",
          properties: {
            source: { type: "string", description: "Source path" },
            destination: { type: "string", description: "Destination path" },
          },
          required: ["source", "destination"],
        },
      },
      {
        name: "list",
        description: "List directory contents",
        inputSchema: {
          type: "object",
          properties: {
            path: { type: "string", description: "Directory path" },
            recursive: { type: "boolean", description: "List recursively", default: false },
          },
          required: ["path"],
        },
      },
      {
        name: "exists",
        description: "Check if path exists",
        inputSchema: {
          type: "object",
          properties: {
            path: { type: "string", description: "Path to check" },
          },
          required: ["path"],
        },
      },
      {
        name: "mkdir",
        description: "Create a directory",
        inputSchema: {
          type: "object",
          properties: {
            path: { type: "string", description: "Directory path" },
            recursive: { type: "boolean", description: "Create parent dirs", default: true },
          },
          required: ["path"],
        },
      },
      {
        name: "stat",
        description: "Get file/directory stats",
        inputSchema: {
          type: "object",
          properties: {
            path: { type: "string", description: "Path" },
          },
          required: ["path"],
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
            serverInfo: { name: "mcp-filesystem", version: "1.0.0" },
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
      return createMCPError(id, MCP_ERROR_CODES.INVALID_PARAMS, "Invalid params");
    }

    const { name, arguments: args } = params as {
      name: string;
      arguments: Record<string, unknown>;
    };

    try {
      let result: unknown;

      switch (name) {
        case "read":
          result = this.toolRead(args);
          break;
        case "write":
          result = this.toolWrite(args);
          break;
        case "append":
          result = this.toolAppend(args);
          break;
        case "delete":
          result = this.toolDelete(args);
          break;
        case "move":
          result = this.toolMove(args);
          break;
        case "copy":
          result = this.toolCopy(args);
          break;
        case "list":
          result = this.toolList(args);
          break;
        case "exists":
          result = this.toolExists(args);
          break;
        case "mkdir":
          result = this.toolMkdir(args);
          break;
        case "stat":
          result = this.toolStat(args);
          break;
        default:
          return createMCPError(id, MCP_ERROR_CODES.METHOD_NOT_FOUND, `Unknown tool: ${name}`);
      }

      return createMCPResponse(id, { result });
    } catch (error) {
      return createMCPError(id, MCP_ERROR_CODES.INTERNAL_ERROR, `Tool error: ${error}`);
    }
  }

  private resolvePath(p: string): string {
    if (path.isAbsolute(p)) return p;
    return path.resolve(this.basePath, p);
  }

  private toolRead(args: Record<string, unknown>): unknown {
    const filePath = this.resolvePath(args.path as string);
    const encoding = (args.encoding as BufferEncoding) || "utf-8";

    if (!fs.existsSync(filePath)) {
      return { success: false, error: "File not found" };
    }

    const content = fs.readFileSync(filePath, { encoding });
    return { success: true, content };
  }

  private toolWrite(args: Record<string, unknown>): unknown {
    const filePath = this.resolvePath(args.path as string);
    const content = args.content as string;
    const encoding = (args.encoding as BufferEncoding) || "utf-8";

    const dir = path.dirname(filePath);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }

    fs.writeFileSync(filePath, content, { encoding });
    return { success: true, path: filePath };
  }

  private toolAppend(args: Record<string, unknown>): unknown {
    const filePath = this.resolvePath(args.path as string);
    const content = args.content as string;

    fs.appendFileSync(filePath, content);
    return { success: true, path: filePath };
  }

  private toolDelete(args: Record<string, unknown>): unknown {
    const filePath = this.resolvePath(args.path as string);
    const recursive = (args.recursive as boolean) || false;

    if (!fs.existsSync(filePath)) {
      return { success: false, error: "Path not found" };
    }

    const stat = fs.statSync(filePath);
    if (stat.isDirectory()) {
      fs.rmSync(filePath, { recursive });
    } else {
      fs.unlinkSync(filePath);
    }

    return { success: true };
  }

  private toolMove(args: Record<string, unknown>): unknown {
    const source = this.resolvePath(args.source as string);
    const dest = this.resolvePath(args.destination as string);

    if (!fs.existsSync(source)) {
      return { success: false, error: "Source not found" };
    }

    const destDir = path.dirname(dest);
    if (!fs.existsSync(destDir)) {
      fs.mkdirSync(destDir, { recursive: true });
    }

    fs.renameSync(source, dest);
    return { success: true, source, destination: dest };
  }

  private toolCopy(args: Record<string, unknown>): unknown {
    const source = this.resolvePath(args.source as string);
    const dest = this.resolvePath(args.destination as string);

    if (!fs.existsSync(source)) {
      return { success: false, error: "Source not found" };
    }

    const destDir = path.dirname(dest);
    if (!fs.existsSync(destDir)) {
      fs.mkdirSync(destDir, { recursive: true });
    }

    fs.copyFileSync(source, dest);
    return { success: true, source, destination: dest };
  }

  private toolList(args: Record<string, unknown>): unknown {
    const dirPath = this.resolvePath(args.path as string);
    const recursive = (args.recursive as boolean) || false;

    if (!fs.existsSync(dirPath)) {
      return { success: false, error: "Directory not found" };
    }

    const items: { name: string; path: string; isDirectory: boolean }[] = [];

    const listDir = (dir: string) => {
      const entries = fs.readdirSync(dir);
      for (const entry of entries) {
        const fullPath = path.join(dir, entry);
        const stat = fs.statSync(fullPath);
        items.push({
          name: entry,
          path: path.relative(this.basePath, fullPath),
          isDirectory: stat.isDirectory(),
        });

        if (recursive && stat.isDirectory()) {
          listDir(fullPath);
        }
      }
    };

    listDir(dirPath);
    return { success: true, items, count: items.length };
  }

  private toolExists(args: Record<string, unknown>): unknown {
    const filePath = this.resolvePath(args.path as string);
    return { success: true, exists: fs.existsSync(filePath) };
  }

  private toolMkdir(args: Record<string, unknown>): unknown {
    const dirPath = this.resolvePath(args.path as string);
    const recursive = (args.recursive as boolean) ?? true;

    fs.mkdirSync(dirPath, { recursive });
    return { success: true, path: dirPath };
  }

  private toolStat(args: Record<string, unknown>): unknown {
    const filePath = this.resolvePath(args.path as string);

    if (!fs.existsSync(filePath)) {
      return { success: false, error: "Path not found" };
    }

    const stat = fs.statSync(filePath);
    return {
      success: true,
      isFile: stat.isFile(),
      isDirectory: stat.isDirectory(),
      size: stat.size,
      created: stat.birthtime.toISOString(),
      modified: stat.mtime.toISOString(),
    };
  }
}
