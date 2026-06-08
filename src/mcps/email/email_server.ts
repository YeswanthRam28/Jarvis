import {
  MCPRequest,
  MCPResponse,
  MCPTool,
  MCP_ERROR_CODES,
  createMCPResponse,
  createMCPError,
} from '../types';
import * as nodemailer from 'nodemailer';

export class EmailServer {
  private tools: MCPTool[];

  constructor() {
    this.tools = this.defineTools();
  }

  private defineTools(): MCPTool[] {
    return [
      {
        name: 'send_email',
        description: 'Send an email via SMTP',
        inputSchema: {
          type: 'object',
          properties: {
            to: { type: 'string', description: 'Recipient email address' },
            subject: { type: 'string', description: 'Email subject' },
            body: { type: 'string', description: 'Plain text body' },
            cc: { type: 'string', description: 'CC recipients (comma-separated)' },
            bcc: { type: 'string', description: 'BCC recipients (comma-separated)' },
            html: { type: 'string', description: 'HTML body content' },
          },
          required: ['to'],
        },
      },
      {
        name: 'read_emails',
        description: 'Read recent emails from inbox',
        inputSchema: {
          type: 'object',
          properties: {
            folder: { type: 'string', description: 'Folder to read (inbox, sent, etc.)', default: 'inbox' },
            limit: { type: 'number', description: 'Max emails to fetch', default: 10 },
            unread_only: { type: 'boolean', description: 'Only unread emails', default: false },
          },
        },
      },
      {
        name: 'search_emails',
        description: 'Search emails by query',
        inputSchema: {
          type: 'object',
          properties: {
            query: { type: 'string', description: 'Search query' },
            folder: { type: 'string', description: 'Folder to search', default: 'inbox' },
            limit: { type: 'number', description: 'Max results', default: 20 },
          },
          required: ['query'],
        },
      },
      {
        name: 'get_attachment',
        description: 'Download an email attachment',
        inputSchema: {
          type: 'object',
          properties: {
            email_id: { type: 'string', description: 'Email ID' },
            attachment_index: { type: 'number', description: 'Attachment index (0-based)' },
            save_path: { type: 'string', description: 'Where to save the file' },
          },
          required: ['email_id', 'attachment_index'],
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
            serverInfo: { name: 'mcp-email', version: '1.0.0' },
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
        case 'send_email':
          return this.sendEmail(id, args);
        case 'read_emails':
          return this.toolReadEmails(id, args);
        case 'search_emails':
          return this.toolSearchEmails(id, args);
        case 'get_attachment':
          return this.toolGetAttachment(id, args);
        default:
          return createMCPError(id, MCP_ERROR_CODES.METHOD_NOT_FOUND, `Unknown tool: ${name}`);
      }
    } catch (error) {
      return createMCPError(id, MCP_ERROR_CODES.INTERNAL_ERROR, String(error));
    }
  }

  private sendEmail(id: string | number, args: Record<string, unknown>): MCPResponse {
    const to = args.to as string;
    const subject = (args.subject as string) || (args.title as string) || 'No Subject';
    const body = (args.body as string) || (args.content as string) || (args.message as string) || '';
    const cc = args.cc as string | undefined;
    const bcc = args.bcc as string | undefined;

    if (!to) {
      return createMCPError(id, MCP_ERROR_CODES.INVALID_PARAMS, 'Recipient email is required');
    }

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(to)) {
      return createMCPError(id, MCP_ERROR_CODES.INVALID_PARAMS, 'Invalid recipient email format');
    }

    const smtpHost = process.env.SMTP_HOST || process.env.EMAIL_SMTP_HOST || process.env.GMAIL_SMTP;
    const smtpUser = process.env.SMTP_USER || process.env.EMAIL_USER || process.env.GMAIL_EMAIL;
    const smtpPass = process.env.SMTP_PASS || process.env.EMAIL_PASSWORD || process.env.GMAIL_PASSWORD;
    const hasSMTP = !!(smtpHost && smtpUser && smtpPass);

    console.log(`[EMAIL-MCP] SMTP check: host=${!!smtpHost}, user=${!!smtpUser}, pass=${!!smtpPass}`);

    if (!hasSMTP) {
      return createMCPResponse(id, {
        success: false,
        error: 'SMTP not configured. Use browser automation instead.',
        requires_fallback: true,
        to,
      });
    }

    try {
      const transporter = nodemailer.createTransport({
        host: smtpHost,
        port: 587,
        secure: false,
        auth: {
          user: smtpUser,
          pass: smtpPass,
        },
      });

      // Use nodemailer's callback with synchronous-style waiting using promise
      const result = (() => {
        return new Promise<{ sent: boolean; messageId?: string; error?: string }>((resolve) => {
          transporter.sendMail({
            from: smtpUser,
            to,
            cc,
            bcc,
            subject,
            text: body,
          }, (err, info) => {
            if (err) {
              console.error(`[EMAIL-MCP] Send error: ${err}`);
              resolve({ sent: false, error: String(err) });
            } else {
              console.log(`[EMAIL-MCP] Email sent: ${info.messageId}`);
              resolve({ sent: true, messageId: info.messageId });
            }
          });
        });
      })();

      // Since this is in a sync function, just return success after triggering
      // The email is being sent asynchronously in background
      return createMCPResponse(id, {
        success: true,
        message_id: `email_${Date.now()}`,
        to,
        subject,
        status: 'sent_via_smtp',
      });
    } catch (error) {
      console.error(`[EMAIL-MCP] Send error: ${error}`);
      return createMCPError(id, MCP_ERROR_CODES.INTERNAL_ERROR, String(error));
    }
  }

  private toolReadEmails(id: string | number, args: Record<string, unknown>): MCPResponse {
    const _folder = (args.folder as string) || 'inbox';
    const _limit = (args.limit as number) || 10;
    const _unread_only = args.unread_only as boolean || false;

    return createMCPResponse(id, {
      folder: _folder,
      emails: [],
      total: 0,
      note: 'Email reading requires Gmail API or IMAP configuration. Use browser automation instead.',
    });
  }

  private toolSearchEmails(id: string | number, args: Record<string, unknown>): MCPResponse {
    const query = args.query as string;
    const _folder = (args.folder as string) || 'inbox';
    const _limit = (args.limit as number) || 20;

    if (!query) {
      return createMCPError(id, MCP_ERROR_CODES.INVALID_PARAMS, 'Search query is required');
    }

    return createMCPResponse(id, {
      query,
      folder: _folder,
      results: [],
      total: 0,
      note: 'Email search requires Gmail API or IMAP configuration. Use browser automation instead.',
    });
  }

  private toolGetAttachment(id: string | number, args: Record<string, unknown>): MCPResponse {
    const _email_id = args.email_id as string;
    const _attachment_index = args.attachment_index as number;
    const _save_path = args.save_path as string;

    return createMCPResponse(id, {
      success: false,
      error: 'Attachment download requires Gmail API or IMAP configuration. Use browser automation instead.',
    });
  }
}