import { spawn } from 'child_process';
import {
  MCPRequest,
  MCPResponse,
  MCPTool,
  MCP_ERROR_CODES,
  createMCPResponse,
  createMCPError,
} from '../types';

interface RunningProcess {
  process: ReturnType<typeof spawn>;
  startTime: number;
}

const SANDBOX_ALLOWED_COMMANDS = new Set([
  'echo', 'pwd', 'cd', 'dir', 'ls', 'cat', 'type', 'find', 'grep',
  'node', 'npm', 'git', 'python', 'pip',
]);

const SANDBOX_BLOCKED_PATTERNS = [
  /rm\s+-rf\s+\//i,
  /format\s+c:/i,
  /del\s+\/f\s+\/s\s+\/q/i,
  /shutdown/i,
  /mkfs/i,
  /dd\s+if=/i,
];

export class ShellServer {
  private tools: MCPTool[];
  private runningProcesses: Map<string, RunningProcess>;

  constructor() {
    this.tools = this.defineTools();
    this.runningProcesses = new Map();
  }

  private defineTools(): MCPTool[] {
    return [
      {
        name: 'execute',
        description: 'Execute a shell command',
        inputSchema: {
          type: 'object',
          properties: {
            command: { type: 'string', description: 'The shell command to execute' },
            timeout: { type: 'number', description: 'Timeout in seconds', default: 30 },
            cwd: { type: 'string', description: 'Working directory' },
          },
          required: ['command'],
        },
      },
      {
        name: 'kill',
        description: 'Kill a running process',
        inputSchema: {
          type: 'object',
          properties: {
            processId: { type: 'string', description: 'The process ID to kill' },
          },
          required: ['processId'],
        },
      },
      {
        name: 'list_processes',
        description: 'List running shell processes',
        inputSchema: {
          type: 'object',
          properties: {},
        },
      },
    ];
  }

  public getTools(): MCPTool[] {
    return this.tools;
  }

  public async handleRequest(request: MCPRequest): Promise<MCPResponse> {
    const { id, method, params } = request;

    try {
      switch (method) {
        case 'tools/list':
          return createMCPResponse(id, { tools: this.tools });

        case 'tools/call':
          return await this.handleToolCall(id, params);

        case 'initialize':
          return createMCPResponse(id, {
            protocolVersion: '2024-11-05',
            capabilities: { tools: {} },
            serverInfo: { name: 'mcp-shell', version: '1.0.0' },
          });

        default:
          return createMCPError(id, MCP_ERROR_CODES.METHOD_NOT_FOUND, `Unknown method: ${method}`);
      }
    } catch (error) {
      return createMCPError(id, MCP_ERROR_CODES.INTERNAL_ERROR, `Internal error: ${error}`);
    }
  }

  private async handleToolCall(
    id: string | number,
    params?: Record<string, unknown>
  ): Promise<MCPResponse> {
    if (!params || typeof params !== 'object') {
      return createMCPError(id, MCP_ERROR_CODES.INVALID_PARAMS, 'Invalid params');
    }

    const { name, arguments: args } = params as {
      name: string;
      arguments: Record<string, unknown>;
    };

    try {
      switch (name) {
        case 'execute':
          return await this.toolExecute(id, args);
        case 'kill':
          return this.toolKill(id, args);
        case 'list_processes':
          return this.toolListProcesses(id);
        default:
          return createMCPError(id, MCP_ERROR_CODES.METHOD_NOT_FOUND, `Unknown tool: ${name}`);
      }
    } catch (error) {
      return createMCPError(id, MCP_ERROR_CODES.INTERNAL_ERROR, `Tool error: ${error}`);
    }
  }

  private async toolExecute(id: string | number, args: Record<string, unknown>): Promise<MCPResponse> {
    const command = args.command as string;
    const timeout = (args.timeout as number) || 30;
    const cwd = args.cwd as string | undefined;

    if (!command || typeof command !== 'string') {
      return createMCPError(id, MCP_ERROR_CODES.INVALID_PARAMS, 'Command is required');
    }

    if (!this.isCommandAllowed(command)) {
      return createMCPError(id, MCP_ERROR_CODES.INTERNAL_ERROR, 'Command blocked by security policy');
    }

    const isWindows = process.platform === 'win32';
    const shell = isWindows ? 'cmd.exe' : '/bin/bash';
    const shellArgs = isWindows ? ['/c', command] : ['-c', command];

    return new Promise((resolve) => {
      const proc = spawn(shell, shellArgs, {
        cwd: cwd || process.cwd(),
        env: { ...process.env },
        timeout: timeout * 1000,
      });

      const processId = `proc_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`;
      this.runningProcesses.set(processId, { process: proc, startTime: Date.now() });

      let stdout = '';
      let stderr = '';

      proc.stdout?.on('data', (data) => {
        stdout += data.toString();
      });

      proc.stderr?.on('data', (data) => {
        stderr += data.toString();
      });

      proc.on('close', (code) => {
        this.runningProcesses.delete(processId);
        resolve(createMCPResponse(id, {
          success: code === 0,
          exitCode: code,
          stdout: stdout.slice(0, 10000),
          stderr: stderr.slice(0, 2000),
          processId,
          duration_ms: Date.now() - (this.runningProcesses.get(processId)?.startTime || Date.now()),
        }));
      });

      proc.on('error', (error) => {
        this.runningProcesses.delete(processId);
        resolve(createMCPResponse(id, {
          success: false,
          error: error.message,
          processId,
        }));
      });

      setTimeout(() => {
        if (this.runningProcesses.has(processId)) {
          proc.kill();
          this.runningProcesses.delete(processId);
          resolve(createMCPResponse(id, {
            success: false,
            error: 'Command timed out',
            stdout: stdout.slice(0, 10000),
            stderr: stderr.slice(0, 2000),
            processId,
            timedOut: true,
          }));
        }
      }, timeout * 1000);
    });
  }

  private toolKill(id: string | number, args: Record<string, unknown>): MCPResponse {
    const processId = args.processId as string;

    if (!processId) {
      return createMCPError(id, MCP_ERROR_CODES.INVALID_PARAMS, 'processId is required');
    }

    const runningProc = this.runningProcesses.get(processId);
    if (!runningProc) {
      return createMCPResponse(id, { success: false, error: 'Process not found' });
    }

    runningProc.process.kill();
    this.runningProcesses.delete(processId);

    return createMCPResponse(id, { success: true, processId });
  }

  private toolListProcesses(id: string | number): MCPResponse {
    const processes: Array<{ processId: string; duration_ms: number }> = [];

    for (const [processId, runningProc] of this.runningProcesses) {
      processes.push({
        processId,
        duration_ms: Date.now() - runningProc.startTime,
      });
    }

    return createMCPResponse(id, { processes, count: processes.length });
  }

  private isCommandAllowed(command: string): boolean {
    for (const pattern of SANDBOX_BLOCKED_PATTERNS) {
      if (pattern.test(command)) {
        console.log(`[SHELL] Blocked dangerous command: ${command.slice(0, 50)}`);
        return false;
      }
    }

    const firstWord = command.trim().split(/\s+/)[0].toLowerCase();
    if (!SANDBOX_ALLOWED_COMMANDS.has(firstWord)) {
      console.log(`[SHELL] Command not in allowlist: ${firstWord}`);
      return false;
    }

    return true;
  }
}
