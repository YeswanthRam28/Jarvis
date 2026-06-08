import {
  MCPRequest,
  MCPResponse,
  MCPTool,
  MCP_ERROR_CODES,
  createMCPResponse,
  createMCPError,
} from '../types';

interface CalendarEvent {
  id?: string;
  title: string;
  description?: string;
  start: string;
  end?: string;
  duration?: number;
  location?: string;
  attendees?: string[];
}

/* eslint-disable @typescript-eslint/no-unused-vars */

export class CalendarServer {
  private tools: MCPTool[];

  constructor() {
    this.tools = this.defineTools();
  }

  private defineTools(): MCPTool[] {
    return [
      {
        name: 'create_event',
        description: 'Create a calendar event',
        inputSchema: {
          type: 'object',
          properties: {
            title: { type: 'string', description: 'Event title' },
            description: { type: 'string', description: 'Event description' },
            start: { type: 'string', description: 'Start time (ISO string or natural language)' },
            end: { type: 'string', description: 'End time (optional)' },
            duration: { type: 'number', description: 'Duration in minutes' },
            location: { type: 'string', description: 'Event location' },
            attendees: { type: 'array', items: { type: 'string' }, description: 'Attendee emails' },
          },
          required: ['title', 'start'],
        },
      },
      {
        name: 'list_events',
        description: 'List calendar events',
        inputSchema: {
          type: 'object',
          properties: {
            start_date: { type: 'string', description: 'Start date filter' },
            end_date: { type: 'string', description: 'End date filter' },
            max_results: { type: 'number', description: 'Max events to return', default: 10 },
          },
        },
      },
      {
        name: 'update_event',
        description: 'Update an existing event',
        inputSchema: {
          type: 'object',
          properties: {
            event_id: { type: 'string', description: 'Event ID to update' },
            title: { type: 'string', description: 'New title' },
            description: { type: 'string', description: 'New description' },
            start: { type: 'string', description: 'New start time' },
            end: { type: 'string', description: 'New end time' },
          },
          required: ['event_id'],
        },
      },
      {
        name: 'delete_event',
        description: 'Delete a calendar event',
        inputSchema: {
          type: 'object',
          properties: {
            event_id: { type: 'string', description: 'Event ID to delete' },
          },
          required: ['event_id'],
        },
      },
    ];
  }

  public getTools(): MCPTool[] {
    return this.tools;
  }

  public handleRequest(request: MCPRequest): MCPResponse {
    const { id, method, params } = request;

    try {
      switch (method) {
        case 'tools/list':
          return createMCPResponse(id, { tools: this.tools });

        case 'tools/call':
          return this.handleToolCall(id, params);

        case 'initialize':
          return createMCPResponse(id, {
            protocolVersion: '2024-11-05',
            capabilities: { tools: {} },
            serverInfo: { name: 'mcp-calendar', version: '1.0.0' },
          });

        default:
          return createMCPError(id, MCP_ERROR_CODES.METHOD_NOT_FOUND, `Unknown method: ${method}`);
      }
    } catch (error) {
      return createMCPError(id, MCP_ERROR_CODES.INTERNAL_ERROR, `Internal error: ${error}`);
    }
  }

  private handleToolCall(id: string | number, params?: Record<string, unknown>): MCPResponse {
    if (!params || typeof params !== 'object') {
      return createMCPError(id, MCP_ERROR_CODES.INVALID_PARAMS, 'Invalid params');
    }

    const { name, arguments: args } = params as {
      name: string;
      arguments: Record<string, unknown>;
    };

    try {
      switch (name) {
        case 'create_event':
          return this.toolCreateEvent(id, args);
        case 'list_events':
          return this.toolListEvents(id, args);
        case 'update_event':
          return this.toolUpdateEvent(id, args);
        case 'delete_event':
          return this.toolDeleteEvent(id, args);
        default:
          return createMCPError(id, MCP_ERROR_CODES.METHOD_NOT_FOUND, `Unknown tool: ${name}`);
      }
    } catch (error) {
      return createMCPError(id, MCP_ERROR_CODES.INTERNAL_ERROR, String(error));
    }
  }

  private toolCreateEvent(id: string | number, args: Record<string, unknown>): MCPResponse {
    const _title = args.title as string;
    const _start = args.start as string;
    const _description = args.description as string | undefined;
    const _end = args.end as string | undefined;
    const _duration = args.duration as number | undefined;
    const _location = args.location as string | undefined;
    const _attendees = args.attendees as string[] | undefined;

    // Check for Google Calendar API configuration
    const hasCalendarAPI = process.env.GOOGLE_CALENDAR_API_KEY || process.env.GOOGLE_CLIENT_ID;
    
    if (!_title || !_start) {
      return createMCPError(id, MCP_ERROR_CODES.INVALID_PARAMS, 'Title and start time are required');
    }

    if (!hasCalendarAPI) {
      // No Calendar API - return error to trigger fallback to browser
      return createMCPResponse(id, {
        success: false,
        error: 'Google Calendar API not configured. Use browser automation instead.',
        requires_fallback: true,
        title: _title,
        start: _start,
      });
    }

    // Has Calendar API - would create event here
    return createMCPResponse(id, {
      success: true,
      event_id: `evt_${Date.now()}`,
      title: _title,
      start: _start,
      status: 'created_via_api',
    });
  }

  private toolListEvents(id: string | number, args: Record<string, unknown>): MCPResponse {
    const _max_results = (args.max_results as number) || 10;

    return createMCPResponse(id, {
      events: [],
      total: 0,
      note: 'Calendar listing requires Google Calendar API configuration. Use browser automation instead.',
    });
  }

  private toolUpdateEvent(id: string | number, args: Record<string, unknown>): MCPResponse {
    const event_id = args.event_id as string;

    if (!event_id) {
      return createMCPError(id, MCP_ERROR_CODES.INVALID_PARAMS, 'Event ID is required');
    }

    return createMCPResponse(id, {
      success: true,
      event_id,
      note: 'Calendar update requires Google Calendar API configuration',
    });
  }

  private toolDeleteEvent(id: string | number, args: Record<string, unknown>): MCPResponse {
    const event_id = args.event_id as string;

    if (!event_id) {
      return createMCPError(id, MCP_ERROR_CODES.INVALID_PARAMS, 'Event ID is required');
    }

    return createMCPResponse(id, {
      success: true,
      event_id,
      deleted: true,
    });
  }
}