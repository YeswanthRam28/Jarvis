#!/usr/bin/env node

import * as dotenv from 'dotenv';
import * as http from 'http';
import * as url from 'url';
import { ShellServer } from './shell_server';

dotenv.config();

const PORT = parseInt(process.env.MCP_SHELL_PORT || '9323', 10);
const HOST = process.env.MCP_SHELL_HOST || 'localhost';

const server = new ShellServer();
let requestId = 0;

console.log(`MCP Shell Server starting on localhost:${PORT}`);

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
        const request = JSON.parse(body);
        const response = await server.handleRequest(request);

        res.writeHead(200, {
          'Content-Type': 'application/json',
          'Access-Control-Allow-Origin': '*',
        });
        res.end(JSON.stringify(response));
      } catch (error) {
        res.writeHead(400, {
          'Content-Type': 'application/json',
          'Access-Control-Allow-Origin': '*',
        });
        res.end(JSON.stringify({ error: `Invalid JSON: ${error}` }));
      }
    });

    return;
  }

  if (req.method === 'GET' && parsedUrl.pathname === '/health') {
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ status: 'ok', server: 'mcp-shell' }));
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
  console.log(`MCP Shell Server running on http://${HOST}:${PORT}`);
});

process.on('SIGINT', () => {
  console.log('\nShutting down MCP Shell Server...');
  httpServer.close();
  process.exit(0);
});
