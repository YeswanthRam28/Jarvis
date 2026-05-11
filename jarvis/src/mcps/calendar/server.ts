#!/usr/bin/env node

import { createServer } from 'http';
import { CalendarServer } from './calendar_server';

const PORT = process.env.MCP_CALENDAR_PORT || 9325;

const calendarServer = new CalendarServer();

const server = createServer(async (req, res) => {
  const url = new URL(req.url || '/', `http://localhost:${PORT}`);

  // MCP protocol endpoints
  if (url.pathname === '/mcp' || url.pathname === '/') {
    if (req.method === 'POST') {
      let body = '';
      for await (const chunk of req) {
        body += chunk;
      }

      try {
        const request = JSON.parse(body);
        const response = calendarServer.handleRequest(request);
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify(response));
      } catch (error) {
        res.writeHead(500, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: String(error) }));
      }
      return;
    }

    if (req.method === 'GET') {
      const response = calendarServer.handleRequest({
        jsonrpc: '2.0',
        id: 0,
        method: 'tools/list',
        params: {},
      });
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify(response));
      return;
    }
  }

  if (url.pathname === '/sse') {
    res.writeHead(200, {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      'Connection': 'keep-alive',
    });

    const clientId = Date.now();
    console.log(`[CALENDAR-MCP] Client connected: ${clientId}`);

    res.write(`event: connected\ndata: ${JSON.stringify({ clientId })}\n\n`);

    const heartbeat = setInterval(() => {
      res.write(`event: heartbeat\ndata: ${JSON.stringify({ time: Date.now() })}\n\n`);
    }, 30000);

    req.on('close', () => {
      clearInterval(heartbeat);
      console.log(`[CALENDAR-MCP] Client disconnected: ${clientId}`);
    });
    return;
  }

  if (url.pathname === '/health') {
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ status: 'healthy', server: 'mcp-calendar' }));
    return;
  }

  res.writeHead(404);
  res.end('Not found');
});

server.listen(PORT, () => {
  console.log(`[CALENDAR-MCP] Server running on http://localhost:${PORT}/mcp`);
  console.log(`[CALENDAR-MCP] Tools: ${calendarServer.getTools().map(t => t.name).join(', ')}`);
});

process.on('SIGTERM', () => {
  console.log('[CALENDAR-MCP] Shutting down...');
  server.close();
  process.exit(0);
});