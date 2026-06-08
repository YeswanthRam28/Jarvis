#!/usr/bin/env node

import * as http from 'http';
import * as url from 'url';
import * as path from 'path';
import { BrowserServer } from './browser_server';
import { MCPRequest, MCPResponse, MCP_ERROR_CODES, createMCPError } from '../types';

const PORT = parseInt(process.env.MCP_BROWSER_PORT || '9320', 10);
const HOST = process.env.MCP_BROWSER_HOST || 'localhost';
const HEADLESS = process.env.MCP_BROWSER_HEADLESS === 'true';
const USE_CDP = process.env.USE_CDP === 'true';

const userProfile = process.env.USERPROFILE || 'C:\\Users\\YeswanthRam';
const defaultProfilePath = path.join(userProfile, 'AppData', 'Local', 'Microsoft', 'Edge', 'User Data', 'Profile 2');

const useProfile = process.env.USE_EDGE_PROFILE === 'true' ? defaultProfilePath : undefined;
const cdpEndpoint = process.env.CDP_ENDPOINT || 'http://localhost:9222';

const server = new BrowserServer({ 
  headless: HEADLESS,
  userDataDir: useProfile,
  useCDP: USE_CDP,
  cdpEndpoint
});
let requestId = 0;

console.log(`MCP Browser Server starting on localhost:${PORT}`);
console.log(`Headless mode: ${HEADLESS}`);
console.log(`Browser: Microsoft Edge`);
if (USE_CDP) {
  console.log(`CDP mode: Enabled (connecting to ${cdpEndpoint})`);
  console.log('NOTE: Start Edge with --remote-debugging-port=9222 first!');
} else if (useProfile) {
  console.log(`Edge profile: ${useProfile}`);
  console.log('(Set USE_EDGE_PROFILE=false to disable)');
} else {
  console.log('(Set USE_EDGE_PROFILE=true to use your Edge profile)');
}

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
        const request: MCPRequest = JSON.parse(body);
        const response: MCPResponse = await server.handleRequest(request);

        res.writeHead(200, {
          'Content-Type': 'application/json',
          'Access-Control-Allow-Origin': '*',
        });
        res.end(JSON.stringify(response));
      } catch (error) {
        const errorResponse = createMCPError(
          0,
          MCP_ERROR_CODES.PARSE_ERROR,
          `Invalid JSON: ${error}`
        );
        res.writeHead(400, {
          'Content-Type': 'application/json',
          'Access-Control-Allow-Origin': '*',
        });
        res.end(JSON.stringify(errorResponse));
      }
    });

    return;
  }

  if (req.method === 'GET' && parsedUrl.pathname === '/health') {
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ status: 'ok', server: 'mcp-browser' }));
    return;
  }

  if (req.method === 'GET' && parsedUrl.pathname === '/tools') {
    const tools = server.getTools();
    res.writeHead(200, {
      'Content-Type': 'application/json',
      'Access-Control-Allow-Origin': '*',
    });
    res.end(JSON.stringify({ tools }));
    return;
  }

  res.writeHead(404);
  res.end('Not found');
});

httpServer.listen(PORT, HOST, () => {
  console.log(`MCP Browser Server running on http://${HOST}:${PORT}`);
  console.log(`SSE endpoint: http://${HOST}:${PORT}/sse`);
  console.log(`MCP endpoint: http://${HOST}:${PORT}/mcp`);
});

process.on('SIGINT', async () => {
  console.log('\nShutting down MCP Browser Server...');
  await server.close();
  httpServer.close();
  process.exit(0);
});
