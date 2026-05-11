import { ModelRouter } from '../ai/model_router';
import { ContextStore, Task } from './context_store';
import { MCPRegistry } from '../mcps/registry';
import { Logger } from '../utils/logger';
import { NVIDIAAPIClient, ChatMessage } from '../ai/nvidia_client';

export interface ToolCallSpec {
  task_id: string;
  server: string;
  tool: string;
  method: string;
  params: Record<string, unknown>;
  requires_screenshot?: boolean;
}

export interface ToolCallResult {
  success: boolean;
  toolCall?: ToolCallSpec;
  error?: string;
  errorType?: 'retry' | 'escalate' | 'fallback';
}

const TOOL_SELECTION_PROMPT = `You are a tool selector for JARVIS, an autonomous desktop agent.

Given a task from the pipeline, select the exact MCP tool to execute.

## Output Format
Respond with ONLY valid JSON:
{
  "tool_call": {
    "task_id": "task_001",
    "server": "mcp-browser",
    "tool": "navigate",
    "method": "navigate",
    "params": {"url": "https://..."},
    "requires_screenshot": false
  },
  "confidence": 0.95,
  "reasoning": "Selected navigate because..."
}

## Server Tool Reference
- mcp-browser: navigate, extract, fill_form, submit, screenshot, search
- mcp-desktop-ui: open_app, click, type, scroll, find_element, screenshot
- mcp-filesystem: read, write, move, delete, list
- mcp-shell: execute, kill
- mcp-notifications: notify, remind, speak
- mcp-email: send_email, read_emails
- mcp-calendar: create_event, list_events
- mcp-code: run_script, run_python

## Rules
1. Match the task's action to the best-fit MCP tool
2. Extract required parameters from task.params
3. Set requires_screenshot=true for UI-heavy tasks
4. If no tool matches, return null tool_call
5. Keep params minimal and exact

## Examples

Task: {"task_id":"task_001","tool":"search","mcp_server":"mcp-browser","params":{"query":"jobs"}}
Output: {"tool_call":{"task_id":"task_001","server":"mcp-browser","tool":"search","method":"search","params":{"query":"jobs"}},"confidence":1.0}

Task: {"task_id":"task_002","tool":"write","mcp_server":"mcp-filesystem","params":{"filename":"notes.txt","content":"hello"}}
Output: {"tool_call":{"task_id":"task_002","server":"mcp-filesystem","tool":"write","method":"write","params":{"path":"notes.txt","content":"hello"}},"confidence":1.0}`;

export class ToolCaller {
  private static instance: ToolCaller;
  private modelRouter: ModelRouter;
  private contextStore: ContextStore;
  private mcpRegistry: MCPRegistry;
  private nvidiaClient: NVIDIAAPIClient;
  private logger: Logger;

  private constructor() {
    this.modelRouter = ModelRouter.getInstance();
    this.contextStore = ContextStore.getInstance();
    this.mcpRegistry = MCPRegistry.getInstance();
    this.nvidiaClient = NVIDIAAPIClient.getInstance();
    this.logger = Logger.getInstance();
  }

  public static getInstance(): ToolCaller {
    if (!ToolCaller.instance) {
      ToolCaller.instance = new ToolCaller();
    }
    return ToolCaller.instance;
  }

  public async resolveToolCall(task: Task): Promise<ToolCallResult> {
    this.logger.info(`Resolving tool call for task: ${task.task_id}`);

    try {
      const hydratedParams = this.contextStore.hydrateParams(task.params);

      const toolCall = this.selectTool(task, hydratedParams);

      if (!toolCall.tool) {
        return {
          success: false,
          error: `No tool found for action: ${task.tool}`,
          errorType: 'fallback',
        };
      }

      this.logger.info(`Selected tool: ${toolCall.server}.${toolCall.tool}`);
      return {
        success: true,
        toolCall,
      };
    } catch (error) {
      this.logger.error(`Tool resolution failed: ${error}`);
      return {
        success: false,
        error: String(error),
        errorType: 'escalate',
      };
    }
  }

  private selectTool(task: Task, params: Record<string, unknown>): ToolCallSpec {
    const tool = task.tool.toLowerCase();
    
    if (tool === 'automate') {
      const goalFromParams = params.goal || params.action || '';
      const taskDescription = task.params?.description || task.params?.action || '';
      return {
        task_id: task.task_id,
        server: 'mcp-browser',
        tool: 'automate',
        method: 'automate',
        params: {
          goal: goalFromParams || taskDescription || 'Complete the task',
          max_steps: params.max_steps || 15,
          context: params.context || '',
        },
        requires_screenshot: true,
      };
    }

    switch (tool) {
      case 'navigate':
      case 'search':
        return {
          task_id: task.task_id,
          server: 'mcp-browser',
          tool: task.tool,
          method: task.tool,
          params: params,
          requires_screenshot: false,
        };

      case 'extract':
      case 'fill_form':
      case 'submit':
        return {
          task_id: task.task_id,
          server: 'mcp-browser',
          tool: task.tool,
          method: task.tool,
          params: params,
          requires_screenshot: true,
        };

      case 'read':
        return {
          task_id: task.task_id,
          server: 'mcp-filesystem',
          tool: 'read',
          method: 'read',
          params: {
            path: params.path || params.filename || params.file,
            encoding: params.encoding || 'utf-8',
          },
        };

      case 'write':
        return {
          task_id: task.task_id,
          server: 'mcp-filesystem',
          tool: 'write',
          method: 'write',
          params: {
            path: params.path || params.filename || params.file,
            content: params.content || params.data,
          },
        };

      case 'delete':
        return {
          task_id: task.task_id,
          server: 'mcp-filesystem',
          tool: 'delete',
          method: 'delete',
          params: {
            path: params.path || params.filename || params.file,
          },
        };

      case 'execute':
      case 'run':
        return {
          task_id: task.task_id,
          server: 'mcp-shell',
          tool: 'execute',
          method: 'execute',
          params: {
            command: params.command || params.cmd || params.script,
          },
        };

      case 'calculate':
        return {
          task_id: task.task_id,
          server: 'mcp-code',
          tool: 'calculate',
          method: 'calculate',
          params: {
            expression: params.expression || params.query || params.code || params.subject,
          },
        };

      case 'notify':
      case 'remind':
        return {
          task_id: task.task_id,
          server: 'mcp-notifications',
          tool: task.tool,
          method: task.tool,
          params: {
            message: params.message || params.text || params.content,
            duration: params.duration || params.seconds,
          },
        };

      case 'screenshot':
        return {
          task_id: task.task_id,
          server: 'mcp-desktop-ui',
          tool: 'screenshot',
          method: 'screenshot',
          params: {
            path: params.path,
          },
          requires_screenshot: false,
        };

      case 'click':
      case 'type':
      case 'scroll':
        return {
          task_id: task.task_id,
          server: 'mcp-desktop-ui',
          tool: task.tool,
          method: task.tool,
          params: params,
          requires_screenshot: true,
        };

      case 'open_app':
        return {
          task_id: task.task_id,
          server: 'mcp-desktop-ui',
          tool: 'open_app',
          method: 'open_app',
          params: {
            app: params.app || params.application || params.subject || params.name,
            args: params.args,
          },
        };

      case 'desktop_automation':
        return {
          task_id: task.task_id,
          server: 'mcp-desktop-ui',
          tool: 'desktop_automation',
          method: 'desktop_automation',
          params: {
            app: params.app || params.application || params.subject,
            action: params.action || params.command || params.do || params.what,
          },
        };

      case 'automate_desktop':
        return {
          task_id: task.task_id,
          server: 'mcp-desktop-ui',
          tool: 'automate_desktop',
          method: 'automate_desktop',
          params: {
            task: params.task || params.goal || params.description || params.subject,
            max_steps: params.max_steps || params.steps || 10,
          },
        };

      case 'send_whatsapp':
        return {
          task_id: task.task_id,
          server: 'mcp-desktop-ui',
          tool: 'send_whatsapp',
          method: 'send_whatsapp',
          params: {
            phone: params.phone,
            contact: params.contact || params.recipient,
            message: params.message || params.content || params.body,
          },
        };

      case 'send_email':
        return {
          task_id: task.task_id,
          server: 'mcp-email',
          tool: 'send_email',
          method: 'send_email',
          params: {
            to: params.to || params.recipient,
            subject: params.subject,
            body: params.body || params.content,
          },
        };

      case 'create_event':
        return {
          task_id: task.task_id,
          server: 'mcp-calendar',
          tool: 'create_event',
          method: 'create_event',
          params: {
            title: params.title || params.subject,
            start: params.start || params.date,
            duration: params.duration,
            description: params.description,
          },
        };

case 'list_events':
        return {
          task_id: task.task_id,
          server: 'mcp-calendar',
          tool: 'list_events',
          method: 'list_events',
          params: {
            start_date: params.start_date,
            end_date: params.end_date,
            max_results: params.max_results || 10,
          },
        };

      case 'run_code':
      case 'CODE':
      case 'run_script':
        return {
          task_id: task.task_id,
          server: 'mcp-code',
          tool: 'run_script',
          method: 'run_script',
          params: {
            language: params.language || 'javascript',
            code: params.code || params.expression || params.script || params.subject,
          },
        };

      case 'CALCULATE':
        return {
          task_id: task.task_id,
          server: 'mcp-code',
          tool: 'calculate',
          method: 'calculate',
          params: {
            expression: params.expression || params.code || params.query || params.script,
          },
        };

      default:
        return {
          task_id: task.task_id,
          server: task.mcp_server,
          tool: task.tool,
          method: task.tool,
          params: params,
        };
    }
  }

  public async resolveWithModel(task: Task): Promise<ToolCallResult> {
    this.logger.info(`Resolving tool call with AI for task: ${task.task_id}`);

    try {
      const hydratedParams = this.contextStore.hydrateParams(task.params);

      const taskJson = JSON.stringify({
        task_id: task.task_id,
        tool: task.tool,
        mcp_server: task.mcp_server,
        params: hydratedParams,
      });

      const messages: ChatMessage[] = [
        { role: 'system', content: TOOL_SELECTION_PROMPT },
        { role: 'user', content: `Select MCP tool for:\n${taskJson}` },
      ];

      const response = await this.nvidiaClient.chat({
        model: this.modelRouter.getModelForStage('tool_caller'),
        messages,
        temperature: 0.2,
        max_tokens: 1024,
      });

      const content = response.choices[0]?.message?.content;
      if (!content) {
        return this.resolveToolCall(task);
      }

      const parsed = this.parseResponse(content);

      if (!parsed.tool_call) {
        return {
          success: false,
          error: 'AI could not determine a tool',
          errorType: 'fallback',
        };
      }

      return {
        success: true,
        toolCall: parsed.tool_call,
      };
    } catch (error) {
      this.logger.error(`AI tool resolution failed: ${error}`);
      return this.resolveToolCall(task);
    }
  }

  private parseResponse(content: string): {
    tool_call: ToolCallSpec | null;
    confidence: number;
  } {
    try {
      const jsonMatch =
        content.match(/```(?:json)?\s*([\s\S]*?)```/) || content.match(/\{[\s\S]*\}/);

      if (!jsonMatch) {
        return { tool_call: null, confidence: 0 };
      }

      const jsonStr = jsonMatch[1] || jsonMatch[0];
      const parsed = JSON.parse(jsonStr);

      return {
        tool_call: parsed.tool_call || null,
        confidence: parsed.confidence || 0,
      };
    } catch {
      return { tool_call: null, confidence: 0 };
    }
  }

  public async executeToolCall(toolCall: ToolCallSpec): Promise<{
    success: boolean;
    result?: unknown;
    error?: string;
    requiresFallback?: boolean;
  }> {
    this.logger.info(`Executing: ${toolCall.server}.${toolCall.tool}`);

    try {
      const result = await this.mcpRegistry.callTool(
        toolCall.server,
        toolCall.tool,
        toolCall.params
      );

      // Check if result indicates fallback is needed
      const resultObj = result.result as Record<string, unknown> | undefined;
      const requiresFallback = resultObj?.requires_fallback === true || result.error?.includes('not configured');
      
      if (requiresFallback) {
        return {
          success: false,
          error: 'MCP not configured - requires browser fallback',
          result: result.result,
          requiresFallback: true,
        };
      }

      if (result.success) {
        this.contextStore.set(toolCall.task_id, result.result);
        return {
          success: true,
          result: result.result,
        };
      }

      return {
        success: false,
        error: result.error,
      };
    } catch (error) {
      this.logger.error(`Tool execution failed: ${error}`);
      return {
        success: false,
        error: String(error),
      };
    }
  }
}
