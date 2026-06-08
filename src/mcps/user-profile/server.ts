#!/usr/bin/env node

import * as http from "http";
import * as url from "url";
import { UserProfileServer } from "./user_profile_server";
import {
  MCPRequest,
  MCPResponse,
  MCP_ERROR_CODES,
  createMCPError,
} from "../types";

const PORT = parseInt(process.env.MCP_USER_PROFILE_PORT || "9311", 10);
const HOST = process.env.MCP_USER_PROFILE_HOST || "localhost";

const server = new UserProfileServer();
let requestId = 0;

const httpServer = http.createServer((req, res) => {
  const parsedUrl = url.parse(req.url || "", true);

  if (req.method === "GET" && parsedUrl.pathname === "/sse") {
    res.writeHead(200, {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache",
      Connection: "keep-alive",
      "Access-Control-Allow-Origin": "*",
    });

    const clientId = ++requestId;
    const heartbeat = setInterval(() => {
      res.write(`event: heartbeat\ndata: ${Date.now()}\n\n`);
    }, 30000);

    res.write(`event: connected\ndata: ${clientId}\n\n`);

    req.on("close", () => {
      clearInterval(heartbeat);
    });

    return;
  }

  if (req.method === "POST" && parsedUrl.pathname === "/mcp") {
    let body = "";

    req.on("data", (chunk) => {
      body += chunk.toString();
    });

    req.on("end", () => {
      try {
        const request: MCPRequest = JSON.parse(body);
        const response: MCPResponse = server.handleRequest(request);

        res.writeHead(200, {
          "Content-Type": "application/json",
          "Access-Control-Allow-Origin": "*",
        });
        res.end(JSON.stringify(response));
      } catch (error) {
        const errorResponse = createMCPError(
          0,
          MCP_ERROR_CODES.PARSE_ERROR,
          `Invalid JSON: ${error}`
        );
        res.writeHead(400, {
          "Content-Type": "application/json",
          "Access-Control-Allow-Origin": "*",
        });
        res.end(JSON.stringify(errorResponse));
      }
    });

    return;
  }

  if (req.method === "GET" && parsedUrl.pathname === "/health") {
    res.writeHead(200, { "Content-Type": "application/json" });
    res.end(JSON.stringify({ status: "ok", server: "mcp-user-profile" }));
    return;
  }

  res.writeHead(404);
  res.end("Not found");
});

httpServer.listen(PORT, HOST, () => {
  console.log(`MCP User Profile Server running on http://${HOST}:${PORT}`);
  console.log(`SSE endpoint: http://${HOST}:${PORT}/sse`);
  console.log(`MCP endpoint: http://${HOST}:${PORT}/mcp`);
});

process.on("SIGINT", () => {
  console.log("\nShutting down MCP User Profile Server...");
  httpServer.close();
  process.exit(0);
});
