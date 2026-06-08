#!/usr/bin/env node

import * as dotenv from 'dotenv';
import * as http from 'http';
import * as url from 'url';
import { DesktopUIServer } from './desktop_ui_server';

dotenv.config();

const PORT = parseInt(process.env.MCP_DESKTOP_UI_PORT || '9321', 10);
const HOST = process.env.MCP_DESKTOP_UI_HOST || 'localhost';

const server = new DesktopUIServer();
let requestId = 0;

console.log(`MCP Desktop UI Server starting on localhost:${PORT}`);

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
    res.end(JSON.stringify({ status: 'ok', server: 'mcp-desktop-ui' }));
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

httpServer.on('error', (e: any) => {
  if (e.code === 'EADDRINUSE') {
    console.error(`\n[ERROR] Port ${PORT} is already in use.`);
    console.error(`Please kill the process using port ${PORT} or change MCP_DESKTOP_UI_PORT in your .env file.`);
    process.exit(1);
  } else {
    console.error(`\n[ERROR] Server encountered an error: ${e.message}`);
    process.exit(1);
  }
});

httpServer.listen(PORT, HOST, () => {
  console.log(`MCP Desktop UI Server running on http://${HOST}:${PORT}`);
});

process.on('SIGINT', () => {
  console.log('\nShutting down MCP Desktop UI Server...');
  httpServer.close();
  process.exit(0);
});
