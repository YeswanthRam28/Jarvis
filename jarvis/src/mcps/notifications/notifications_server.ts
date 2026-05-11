import { exec } from 'child_process';
import * as os from 'os';
import {
  MCPRequest,
  MCPResponse,
  MCPTool,
  MCP_ERROR_CODES,
  createMCPResponse,
  createMCPError,
} from '../types';

export class NotificationServer {
  private tools: MCPTool[];

  constructor() {
    this.tools = this.defineTools();
  }

  private defineTools(): MCPTool[] {
    return [
      {
        name: 'notify',
        description: 'Send a desktop notification',
        inputSchema: {
          type: 'object',
          properties: {
            message: { type: 'string', description: 'The notification message' },
            title: { type: 'string', description: 'Notification title', default: 'JARVIS' },
          },
          required: ['message'],
        },
      },
      {
        name: 'speak',
        description: 'Speak text using text-to-speech',
        inputSchema: {
          type: 'object',
          properties: {
            text: { type: 'string', description: 'Text to speak' },
            rate: { type: 'number', description: 'Speech rate (words per minute)', default: 150 },
          },
          required: ['text'],
        },
      },
      {
        name: 'alert',
        description: 'Send an urgent alert notification',
        inputSchema: {
          type: 'object',
          properties: {
            message: { type: 'string', description: 'Alert message' },
            urgency: { type: 'string', description: 'Urgency level: low, normal, critical', default: 'normal' },
          },
          required: ['message'],
        },
      },
    ];
  }

  public getTools(): MCPTool[] {
    return this.tools;
  }

  public async handleRequest(request: MCPRequest): Promise<MCPResponse> {
    const { id, method, params } = request;

    try {
      switch (method) {
        case 'tools/list':
          return createMCPResponse(id, { tools: this.tools });

        case 'tools/call':
          return await this.handleToolCall(id, params);

        case 'initialize':
          return createMCPResponse(id, {
            protocolVersion: '2024-11-05',
            capabilities: { tools: {} },
            serverInfo: { name: 'mcp-notifications', version: '1.0.0' },
          });

        default:
          return createMCPError(id, MCP_ERROR_CODES.METHOD_NOT_FOUND, `Unknown method: ${method}`);
      }
    } catch (error) {
      return createMCPError(id, MCP_ERROR_CODES.INTERNAL_ERROR, `Internal error: ${error}`);
    }
  }

  private async handleToolCall(
    id: string | number,
    params?: Record<string, unknown>
  ): Promise<MCPResponse> {
    if (!params || typeof params !== 'object') {
      return createMCPError(id, MCP_ERROR_CODES.INVALID_PARAMS, 'Invalid params');
    }

    const { name, arguments: args } = params as {
      name: string;
      arguments: Record<string, unknown>;
    };

    try {
      switch (name) {
        case 'notify':
          return this.toolNotify(id, args);
        case 'speak':
          return this.toolSpeak(id, args);
        case 'alert':
          return this.toolAlert(id, args);
        default:
          return createMCPError(id, MCP_ERROR_CODES.METHOD_NOT_FOUND, `Unknown tool: ${name}`);
      }
    } catch (error) {
      return createMCPError(id, MCP_ERROR_CODES.INTERNAL_ERROR, `Tool error: ${error}`);
    }
  }

  private toolNotify(id: string | number, args: Record<string, unknown>): MCPResponse {
    const message = args.message as string;
    const title = (args.title as string) || 'JARVIS';

    if (os.platform() === 'win32') {
      const psScript = `
        [Windows.UI.Notifications.ToastNotificationManager, Windows.UI.Notifications, ContentType = WindowsRuntime] | Out-Null
        $template = [Windows.UI.Notifications.ToastNotificationManager]::GetTemplateContent([Windows.UI.Notifications.ToastTemplateType]::ToastText02)
        $textNodes = $template.GetElementsByTagName("text")
        $textNodes.Item(0).AppendChild($template.CreateTextNode("${title.replace(/"/g, '`"')}")) | Out-Null
        $textNodes.Item(1).AppendChild($template.CreateTextNode("${message.replace(/"/g, '`"')}")) | Out-Null
        $toast = [Windows.UI.Notifications.ToastNotification]::new($template)
        [Windows.UI.Notifications.ToastNotificationManager]::CreateToastNotifier("JARVIS").Show($toast)
      `;
      exec(`powershell -Command "${psScript}"`, (error) => {
        if (error) {
          console.error('[NOTIFICATIONS] Toast failed:', error.message);
        }
      });
    } else if (os.platform() === 'darwin') {
      exec(`osascript -e 'display notification "${message}" with title "${title}"'`);
    } else {
      exec(`notify-send "${title}" "${message}"`);
    }

    return createMCPResponse(id, { success: true, message, title });
  }

  private toolSpeak(id: string | number, args: Record<string, unknown>): MCPResponse {
    const text = args.text as string;
    const rate = (args.rate as number) || 150;

    if (os.platform() === 'win32') {
      const speakRate = Math.round(rate * 1.5);
      const escapedText = text.replace(/"/g, '""');
      exec(`powershell -Command "Add-Type -AssemblyName System.Speech; $synth = New-Object System.Speech.Synthesis.SpeechSynthesizer; $synth.Rate = ${speakRate}; $synth.Speak('${escapedText}')"`, (error) => {
        if (error) {
          console.error('[TTS] Speak failed:', error.message);
        }
      });
    } else if (os.platform() === 'darwin') {
      exec(`say -r ${rate} "${text}"`);
    } else {
      exec(`espeak -s ${rate} "${text}"`);
    }

    return createMCPResponse(id, { success: true, text, rate });
  }

  private toolAlert(id: string | number, args: Record<string, unknown>): MCPResponse {
    const message = args.message as string;
    const urgency = (args.urgency as string) || 'normal';

    if (os.platform() === 'win32') {
      exec(`powershell -Command "[System.Reflection.Assembly]::LoadWithPartialName('System.Windows.Forms'); [System.Windows.Forms.MessageBox]::Show('${message.replace(/'/g, "''")}', 'JARVIS Alert', [System.Windows.Forms.MessageBoxButtons]::OK, [System.Windows.Forms.MessageBoxIcon]::Warning)"`);
    } else {
      exec(`notify-send -u ${urgency} "JARVIS Alert" "${message}"`);
    }

    return createMCPResponse(id, { success: true, message, urgency });
  }
}
