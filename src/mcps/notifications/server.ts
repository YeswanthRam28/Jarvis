#!/usr/bin/env node

import * as http from 'http';
import * as url from 'url';
import { NotificationServer } from './notifications_server';

const PORT = parseInt(process.env.MCP_NOTIFICATIONS_PORT || '9326', 10);
const HOST = process.env.MCP_NOTIFICATIONS_HOST || 'localhost';

const server = new NotificationServer();
let requestId = 0;

console.log(`MCP Notifications Server starting on localhost:${PORT}`);

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
    res.end(JSON.stringify({ status: 'ok', server: 'mcp-notifications' }));
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
  console.log(`MCP Notifications Server running on http://${HOST}:${PORT}`);
});

process.on('SIGINT', () => {
  console.log('\nShutting down MCP Notifications Server...');
  httpServer.close();
  process.exit(0);
});
