#!/usr/bin/env node

import * as http from 'http';
import * as url from 'url';
import { CodeServer } from './code_server';
import { MCPRequest, MCPResponse, MCP_ERROR_CODES } from '../types';

const PORT = parseInt(process.env.MCP_CODE_PORT || '9327', 10);
const HOST = process.env.MCP_CODE_HOST || 'localhost';

const server = new CodeServer();
let requestId = 0;

const httpServer = http.createServer((req, res) => {
  const parsedUrl = url.parse(req.url || '', true);

  if (req.method === 'GET' && parsedUrl.pathname === '/sse') {
    res.writeHead(200, {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      Connection: 'keep-alive',
      'Access-Control-Allow-Origin': '*',
    });

    const clientId = ++requestId;
    const heartbeat = setInterval(() => {
      res.write(`event: heartbeat\ndata: ${Date.now()}\n\n`);
    }, 30000);

    res.write(`event: connected\ndata: ${clientId}\n\n`);

    req.on('close', () => {
      clearInterval(heartbeat);
    });

    return;
  }

  if (req.method === 'POST' && parsedUrl.pathname === '/mcp') {
    let body = '';

    req.on('data', (chunk) => {
      body += chunk.toString();
    });

    req.on('end', async () => {
      try {
        const mcpRequest: MCPRequest = JSON.parse(body);
        const { method, params, id } = mcpRequest;

        let result: unknown;

        switch (method) {
          case 'tools/list':
            result = {
              tools: [
                {
                  name: 'run_script',
                  description: 'Run JavaScript code',
                  inputSchema: {
                    type: 'object',
                    properties: {
                      language: { type: 'string', default: 'javascript' },
                      code: { type: 'string' },
                    },
                    required: ['code'],
                  },
                },
                {
                  name: 'calculate',
                  description: 'Evaluate a mathematical expression',
                  inputSchema: {
                    type: 'object',
                    properties: {
                      expression: { type: 'string' },
                    },
                    required: ['expression'],
                  },
                },
              ],
            };
            break;

          case 'tools/call': {
            const toolName = (params?.name as string) || '';
            const toolArgs = (params?.arguments as Record<string, unknown>) || {};

            switch (toolName) {
              case 'run_script':
                result = await server.runScript(
                  (toolArgs?.language as string) || 'javascript',
                  (toolArgs?.code as string) || (toolArgs?.script as string) || ''
                );
                break;
              case 'calculate':
                result = await server.calculate(toolArgs?.expression as string);
                break;
              default:
                result = {
                  success: false,
                  output: '',
                  error: `Unknown tool: ${toolName}`,
                };
            }
            break;
          }

          case 'run_script':
          case 'run_code':
            result = await server.runScript(
              (params?.language as string) || 'javascript',
              (params?.code as string) || (params?.script as string) || ''
            );
            break;

          case 'run_python':
            result = await server.runScript('python', params?.code as string);
            break;

          case 'calculate':
            result = await server.calculate(params?.expression as string);
            break;

          default:
            result = {
              success: false,
              output: '',
              error: `Unknown method: ${method}`,
            };
        }

        const response: MCPResponse = {
          jsonrpc: '2.0',
          id: id ?? 0,
          result,
        };

        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify(response));
      } catch (error) {
        const response = {
          jsonrpc: '2.0',
          id: 0,
          error: {
            code: MCP_ERROR_CODES.INTERNAL_ERROR,
            message: String(error),
          },
        };

        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify(response));
      }
    });

    return;
  }

  if (req.method === 'GET' && parsedUrl.pathname === '/') {
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ status: 'ok', server: 'mcp-code' }));
    return;
  }

  res.writeHead(404);
  res.end();
});

httpServer.listen(PORT, HOST, () => {
  console.log(`MCP Code Server starting on http://${HOST}:${PORT}`);
  console.log(`MCP Code Server running on http://${HOST}:${PORT}`);
  console.log(`SSE endpoint: http://${HOST}:${PORT}/sse`);
  console.log(`MCP endpoint: http://${HOST}:${PORT}/mcp`);
});

process.on('SIGTERM', () => {
  httpServer.close();
  process.exit(0);
});

process.on('SIGINT', () => {
  httpServer.close();
  process.exit(0);
});
