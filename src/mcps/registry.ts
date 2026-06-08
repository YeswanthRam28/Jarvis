import { ChildProcess, spawn } from 'child_process';
import * as path from 'path';
import * as http from 'http';
import { MCPClient, MCPClientConfig, ToolCallResult } from './mcp_client';
import { SSEClient } from './sse_client';
import { MCPTool } from './types';
import { Logger } from '../utils/logger';

export interface ServerInfo {
  name: string;
  status: 'stopped' | 'starting' | 'running' | 'error';
  client: MCPClient | null;
  sseClient: SSEClient | null;
  process: ChildProcess | null;
  tools: MCPTool[];
  lastHealthCheck: number;
  error?: string;
}

export interface RegistryConfig {
  autoStart?: boolean;
  healthCheckInterval?: number;
  startTimeout?: number;
}

export class MCPRegistry {
  private static instance: MCPRegistry;
  private servers: Map<string, ServerInfo> = new Map();
  private logger: Logger;
  private config: RegistryConfig;
  private healthCheckTimer: NodeJS.Timeout | null = null;
  private initialized: boolean = false;

  private readonly DEFAULT_PORTS: Record<string, number> = {
    'mcp-memory': 9310,
    'mcp-user-profile': 9311,
    'mcp-browser': 9320,
    'mcp-desktop-ui': 9321,
    'mcp-filesystem': 9322,
    'mcp-shell': 9323,
    'mcp-email': 9324,
    'mcp-calendar': 9325,
    'mcp-notifications': 9326,
    'mcp-code': 9327,
    'mcp-payment': 9328,
  };

  private readonly SERVER_SCRIPTS: Record<string, string> = {
    'mcp-memory': 'mcps/memory/server.js',
    'mcp-user-profile': 'mcps/user-profile/server.js',
    'mcp-browser': 'mcps/browser/server.js',
    'mcp-filesystem': 'mcps/filesystem/server.js',
    'mcp-notifications': 'mcps/notifications/server.js',
    'mcp-code': 'mcps/code/server.js',
    'mcp-payment': 'mcps/payment/server.js',
    'mcp-email': 'mcps/email/server.js',
    'mcp-calendar': 'mcps/calendar/server.js',
    'mcp-desktop-ui': 'mcps/desktop/server.js',
    'mcp-shell': 'mcps/shell/server.js',
  };

  private constructor() {
    this.logger = Logger.getInstance();
    this.config = {
      autoStart: false,
      healthCheckInterval: 30000,
      startTimeout: 10000,
    };
  }

  public static getInstance(): MCPRegistry {
    if (!MCPRegistry.instance) {
      MCPRegistry.instance = new MCPRegistry();
    }
    return MCPRegistry.instance;
  }

  public async initialize(config?: RegistryConfig): Promise<void> {
    if (this.initialized) {
      return;
    }

    this.config = { ...this.config, ...config };
    this.initialized = true;
    this.logger.info('MCP Registry initialized');

    if (this.config.healthCheckInterval) {
      this.startHealthCheck();
    }
  }

  public async registerServer(
    name: string,
    host: string = 'localhost',
    port?: number,
    serverPath?: string
  ): Promise<void> {
    const resolvedPort = port || this.DEFAULT_PORTS[name] || 9300;

    this.logger.info(`Registering MCP server: ${name} at ${host}:${resolvedPort}`);

    const serverInfo: ServerInfo = {
      name,
      status: 'stopped',
      client: null,
      sseClient: null,
      process: null,
      tools: [],
      lastHealthCheck: 0,
    };

    this.servers.set(name, serverInfo);

    if (this.config.autoStart) {
      await this.startServer(name, serverPath);
    }
  }

  public async startServer(name: string, serverPath?: string): Promise<void> {
    const serverInfo = this.servers.get(name);
    if (!serverInfo) {
      throw new Error(`Server ${name} not registered`);
    }

    if (serverInfo.status === 'running') {
      this.logger.debug(`Server ${name} already running`);
      return;
    }

    serverInfo.status = 'starting';

    try {
      const port = this.DEFAULT_PORTS[name] || 9300;

      if (this.SERVER_SCRIPTS[name] && !serverPath) {
        serverPath = this.SERVER_SCRIPTS[name];
      }

      if (serverPath) {
        const fullPath = path.resolve(process.cwd(), 'dist', serverPath);
        serverInfo.process = spawn('node', [fullPath], {
          env: {
            ...process.env,
            [`MCP_${name.replace('mcp-', '').toUpperCase()}_PORT`]: String(port),
          },
          stdio: ['pipe', 'pipe', 'pipe'],
        });

        serverInfo.process.on('error', (error) => {
          this.logger.error(`Server ${name} process error: ${error}`);
          serverInfo.status = 'error';
          serverInfo.error = String(error);
        });

        serverInfo.process.on('exit', (code) => {
          this.logger.info(`Server ${name} exited with code ${code}`);
          serverInfo.status = 'stopped';
          serverInfo.process = null;
        });

        serverInfo.process.stderr?.on('data', (data) => {
          this.logger.error(`Server ${name} stderr: ${data}`);
        });

        serverInfo.process.stdout?.on('data', (data) => {
          this.logger.debug(`Server ${name} stdout: ${data}`);
        });

        this.logger.info(`Starting server ${name} from ${fullPath}`);

        await new Promise((resolve) => setTimeout(resolve, 2000));
      }

      await this.connectToServer(name, port);

      serverInfo.status = 'running';
      this.logger.info(`Server ${name} started successfully`);
    } catch (error) {
      serverInfo.status = 'error';
      serverInfo.error = String(error);
      this.logger.error(`Failed to start server ${name}: ${error}`);
      throw error;
    }
  }

  private async connectToServer(name: string, port: number): Promise<void> {
    const serverInfo = this.servers.get(name);
    if (!serverInfo) return;

    const config: MCPClientConfig = {
      host: 'localhost',
      port,
    };

    serverInfo.client = new MCPClient(config);
    await serverInfo.client.initialize();

    serverInfo.sseClient = new SSEClient(`http://localhost:${port}/sse`);
    serverInfo.sseClient.on('heartbeat', () => {
      serverInfo.lastHealthCheck = Date.now();
    });

    try {
      serverInfo.sseClient.connect().catch(() => {});
    } catch {
      // SSE connection is optional
    }

    serverInfo.tools = await serverInfo.client.listTools();
    this.logger.info(`Server ${name} connected with ${serverInfo.tools.length} tools`);
  }

  public async stopServer(name: string): Promise<void> {
    const serverInfo = this.servers.get(name);
    if (!serverInfo) {
      return;
    }

    if (serverInfo.sseClient) {
      serverInfo.sseClient.disconnect();
      serverInfo.sseClient = null;
    }

    serverInfo.client = null;

    if (serverInfo.process) {
      serverInfo.process.kill('SIGTERM');
      serverInfo.process = null;
    }

    serverInfo.status = 'stopped';
    this.logger.info(`Server ${name} stopped`);
  }

  public async callTool(
    serverName: string,
    toolName: string,
    args: Record<string, unknown>
  ): Promise<ToolCallResult> {
    const serverInfo = this.servers.get(serverName);

    if (!serverInfo || !serverInfo.client) {
      return {
        success: false,
        error: `Server ${serverName} not connected`,
      };
    }

    if (serverInfo.status !== 'running') {
      return {
        success: false,
        error: `Server ${serverName} is not running (status: ${serverInfo.status})`,
      };
    }

    return serverInfo.client.callTool(toolName, args);
  }

  public async healthCheck(serverName: string): Promise<boolean> {
    const serverInfo = this.servers.get(serverName);
    if (!serverInfo) {
      return false;
    }

    const port = this.DEFAULT_PORTS[serverName] || 9300;

    return new Promise((resolve) => {
      const urlObj = new URL(`http://localhost:${port}/health`);
      const req = http.get(urlObj, (res) => {
        if (res.statusCode === 200) {
          serverInfo.lastHealthCheck = Date.now();
          resolve(true);
        } else {
          resolve(false);
        }
      });

      req.on('error', () => {
        resolve(false);
      });

      req.setTimeout(5000, () => {
        req.destroy();
        resolve(false);
      });
    });
  }

  private async performHealthCheck(): Promise<void> {
    for (const [name, serverInfo] of this.servers) {
      if (serverInfo.status !== 'running') continue;

      const healthy = await this.healthCheck(name);

      if (!healthy && serverInfo.status === 'running') {
        this.logger.warn(`Server ${name} health check failed, attempting reconnect`);
        try {
          await this.stopServer(name);
          await this.startServer(name);
        } catch (error) {
          this.logger.error(`Failed to reconnect to ${name}: ${error}`);
        }
      }
    }
  }

  private startHealthCheck(): void {
    if (this.healthCheckTimer) {
      clearInterval(this.healthCheckTimer);
    }

    this.healthCheckTimer = setInterval(() => {
      this.performHealthCheck().catch((error) => {
        this.logger.error(`Health check error: ${error}`);
      });
    }, this.config.healthCheckInterval || 30000);
  }

  public stopHealthCheck(): void {
    if (this.healthCheckTimer) {
      clearInterval(this.healthCheckTimer);
      this.healthCheckTimer = null;
    }
  }

  public getServerInfo(name: string): ServerInfo | undefined {
    return this.servers.get(name);
  }

  public getAllServers(): Map<string, ServerInfo> {
    return new Map(this.servers);
  }

  public getTool(serverName: string, toolName: string): MCPTool | undefined {
    const serverInfo = this.servers.get(serverName);
    if (!serverInfo) return undefined;
    return serverInfo.tools.find((t) => t.name === toolName);
  }

  public findTool(toolName: string): { server: string; tool: MCPTool } | null {
    for (const [serverName, serverInfo] of this.servers) {
      const tool = serverInfo.tools.find((t) => t.name === toolName);
      if (tool) {
        return { server: serverName, tool };
      }
    }
    return null;
  }

  public async shutdown(): Promise<void> {
    this.stopHealthCheck();

    for (const name of this.servers.keys()) {
      await this.stopServer(name);
    }

    this.servers.clear();
    this.initialized = false;
    this.logger.info('MCP Registry shutdown complete');
  }
}
