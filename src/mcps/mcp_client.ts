import * as http from 'http';
import * as https from 'https';
import { v4 as uuidv4 } from 'uuid';
import { MCPRequest, MCPResponse, MCPTool } from './types';
import { Logger } from '../utils/logger';

export interface MCPClientConfig {
  host: string;
  port: number;
  path?: string;
  useHttps?: boolean;
}

export interface ToolCallResult {
  success: boolean;
  result?: unknown;
  error?: string;
}

export class MCPClient {
  private config: MCPClientConfig;
  private tools: MCPTool[] = [];
  private initialized: boolean = false;
  private logger: Logger;

  constructor(config: MCPClientConfig) {
    this.config = {
      path: '/mcp',
      useHttps: false,
      ...config,
    };
    this.logger = Logger.getInstance();
  }

  private getUrl(): string {
    const protocol = this.config.useHttps ? 'https' : 'http';
    return `${protocol}://${this.config.host}:${this.config.port}${this.config.path}`;
  }

  private async request(req: MCPRequest): Promise<MCPResponse> {
    return new Promise((resolve, reject) => {
      const urlObj = new URL(this.getUrl());
      const client = urlObj.protocol === 'https:' ? https : http;

      const options: http.RequestOptions = {
        hostname: urlObj.hostname,
        port: urlObj.port,
        path: urlObj.pathname,
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        timeout: 30000,
      };

      const request = client.request(options, (res) => {
        let body = '';

        res.on('data', (chunk: Buffer) => {
          body += chunk.toString();
        });

        res.on('end', () => {
          if (res.statusCode !== 200) {
            reject(new Error(`MCP request failed with status ${res.statusCode}: ${body}`));
            return;
          }

          try {
            const response = JSON.parse(body) as MCPResponse;
            resolve(response);
          } catch (error) {
            reject(new Error(`Failed to parse MCP response: ${error}`));
          }
        });
      });

      request.on('error', (error) => {
        reject(error);
      });

      request.on('timeout', () => {
        request.destroy();
        reject(new Error('MCP request timeout'));
      });

      request.write(JSON.stringify(req));
      request.end();
    });
  }

  public async initialize(): Promise<void> {
    if (this.initialized) {
      return;
    }

    try {
      const req: MCPRequest = {
        jsonrpc: '2.0',
        id: uuidv4(),
        method: 'initialize',
        params: {
          protocolVersion: '2024-11-05',
          capabilities: { tools: {} },
          clientInfo: {
            name: 'jarvis',
            version: '0.1.0',
          },
        },
      };

      const response = await this.request(req);

      if (response.error) {
        throw new Error(`Initialization failed: ${response.error.message}`);
      }

      this.initialized = true;
      this.logger.info(`MCP client initialized: ${this.config.host}:${this.config.port}`);
    } catch (error) {
      this.logger.error(`Failed to initialize MCP client: ${error}`);
      throw error;
    }
  }

  public async listTools(): Promise<MCPTool[]> {
    try {
      const req: MCPRequest = {
        jsonrpc: '2.0',
        id: uuidv4(),
        method: 'tools/list',
      };

      const response = await this.request(req);

      if (response.error) {
        throw new Error(`List tools failed: ${response.error.message}`);
      }

      const result = response.result as { tools: MCPTool[] };
      this.tools = result.tools || [];
      return this.tools;
    } catch (error) {
      this.logger.error(`Failed to list tools: ${error}`);
      throw error;
    }
  }

  public async callTool(name: string, args: Record<string, unknown>): Promise<ToolCallResult> {
    try {
      const req: MCPRequest = {
        jsonrpc: '2.0',
        id: uuidv4(),
        method: 'tools/call',
        params: {
          name,
          arguments: args,
        },
      };

      const response = await this.request(req);

      if (response.error) {
        return {
          success: false,
          error: response.error.message,
        };
      }

      console.log('[MCP CLIENT] Response:', JSON.stringify(response).slice(0, 300));
      return {
        success: true,
        result: response.result,
      };
    } catch (error) {
      this.logger.error(`Tool call failed: ${error}`);
      return {
        success: false,
        error: String(error),
      };
    }
  }

  public getTools(): MCPTool[] {
    return this.tools;
  }

  public isInitialized(): boolean {
    return this.initialized;
  }

  public getConfig(): MCPClientConfig {
    return { ...this.config };
  }
}
