import { v4 as uuidv4 } from 'uuid';
import { IntentGraph, Intent, TaskDAG, Task } from './context_store';
import { Logger } from '../utils/logger';
import { NVIDIAAPIClient, ChatMessage } from '../ai/nvidia_client';
import { ConfigLoader } from '../config/loader';

export interface DecisionPlanResult {
  success: boolean;
  taskDAG?: TaskDAG;
  error?: string;
}

const TOOL_MAPPINGS: Record<string, { tool: string; mcp_server: string; default_seconds: number }> =
  {
    WEB_SCRAPE: { tool: 'navigate_and_extract', mcp_server: 'mcp-browser', default_seconds: 30 },
    WEB_SEARCH: { tool: 'search', mcp_server: 'mcp-browser', default_seconds: 15 },
    WEATHER: { tool: 'search', mcp_server: 'mcp-browser', default_seconds: 20 },
    PAYMENT: { tool: 'payment_op', mcp_server: 'mcp-payment', default_seconds: 30 },
    BROWSER_AUTOMATE: { tool: 'automate', mcp_server: 'mcp-browser', default_seconds: 90 },
    FORM_FILL: { tool: 'fill_form', mcp_server: 'mcp-browser', default_seconds: 60 },
    FILE_READ: { tool: 'read', mcp_server: 'mcp-filesystem', default_seconds: 5 },
    FILE_WRITE: { tool: 'write', mcp_server: 'mcp-filesystem', default_seconds: 5 },
    FILE_DELETE: { tool: 'delete', mcp_server: 'mcp-filesystem', default_seconds: 3 },
    FILE_OPERATION: { tool: 'file_op', mcp_server: 'mcp-filesystem', default_seconds: 5 },
    EMAIL: { tool: 'send_email', mcp_server: 'mcp-email', default_seconds: 30 },
    WHATSAPP: { tool: 'send_whatsapp', mcp_server: 'mcp-desktop-ui', default_seconds: 30 },
    CALENDAR: { tool: 'create_event', mcp_server: 'mcp-calendar', default_seconds: 30 },
    TERMINAL_CMD: { tool: 'execute', mcp_server: 'mcp-shell', default_seconds: 30 },
    APP_CONTROL: { tool: 'open_app', mcp_server: 'mcp-desktop-ui', default_seconds: 15 },
    DESKTOP_ACTION: { tool: 'desktop_automation', mcp_server: 'mcp-desktop-ui', default_seconds: 30 },
    SCREENSHOT: { tool: 'screenshot', mcp_server: 'mcp-desktop-ui', default_seconds: 3 },
    CODE: { tool: 'run_code', mcp_server: 'mcp-code', default_seconds: 60 },
    NOTIFY: { tool: 'notify', mcp_server: 'mcp-notifications', default_seconds: 2 },
    REMIND: { tool: 'remind', mcp_server: 'mcp-notifications', default_seconds: 5 },
    CALCULATE: { tool: 'calculate', mcp_server: 'mcp-code', default_seconds: 1 },
    CLIPBOARD: { tool: 'clipboard_op', mcp_server: 'mcp-desktop-ui', default_seconds: 2 },
    DESKTOP_AI_AUTOMATE: { tool: 'automate_desktop', mcp_server: 'mcp-desktop-ui', default_seconds: 60 },
  };

const CONFIRM_ACTIONS = new Set([
  'delete',
  'send_message',
  'post',
  'submit_form',
  'payment',
  'EMAIL',
  'WHATSAPP',
  'FILE_DELETE',
  'PAYMENT',
]);

const SYSTEM_PROMPT = `You are a decision planner for JARVIS, an autonomous desktop agent.

Your task is to convert an Intent Graph into an optimized Task DAG (Directed Acyclic Graph).

## Output Format
Respond with ONLY valid JSON matching this schema:
{
  "tasks": [
    {
      "task_id": "task_001",
      "intent_id": "intent_001",
      "tool": "tool_name",
      "mcp_server": "server_name",
      "executor_model": "meta/llama-3.1-70b-instruct",
      "params": {"key": "value"},
      "output_key": "output_label",
      "fallback": "notify_user",
      "requires_confirm": false,
      "confirm_message": null,
      "estimated_seconds": 30,
      "depends_on": ["task_001"]
    }
  ],
  "total_estimated_seconds": 45,
  "parallel_groups": [["task_001", "task_002"]],
  "checkpoints": ["task_003"]
}

## Rules
1. Map each intent to the appropriate tool and MCP server
2. Ensure dependencies are correctly ordered based on depends_on
3. Identify parallel groups - tasks with NO dependencies on each other can run together
4. Insert checkpoints before destructive or irreversible actions (delete, send, post, payment)
5. Estimate time in seconds for each task
6. Set fallback to "notify_user" for all tasks
7. Use appropriate executor_model: "meta/llama-3.1-70b-instruct"
8. Hydrate params using {{output_label.field}} syntax from previous task outputs
9. Keep params minimal and focused on the specific task

## Tool Mappings
- WEB_SCRAPE → navigate_and_extract (mcp-browser)
- WEB_SEARCH → search (mcp-browser)
- WEATHER → search (mcp-browser) - use query like "weather in [location] [day]"
- PAYMENT → payment_op (mcp-payment)
- BROWSER_AUTOMATE → automate (mcp-browser) - AI-powered browser automation for complex tasks
- FORM_FILL → fill_form (mcp-browser)
- FILE_READ → read (mcp-filesystem)
- FILE_WRITE → write (mcp-filesystem)
- FILE_DELETE → delete (mcp-filesystem)
- EMAIL → send_email (mcp-email) - direct email, falls back to browser automate if SMTP not configured
- WHATSAPP → automate (mcp-browser) - use browser automation
- CALENDAR → create_event (mcp-calendar) - direct calendar API, falls back to browser if not configured
- TERMINAL_CMD → execute (mcp-shell)
- APP_CONTROL → open_app (mcp-desktop-ui) - open desktop applications like notepad, calculator, etc
- SCREENSHOT → screenshot (mcp-desktop-ui)
- NOTIFY → notify (mcp-notifications)
- REMIND → remind (mcp-notifications)
- CODE → run_code (mcp-code)
- DESKTOP_AI_AUTOMATE → automate_desktop (mcp-desktop-ui) - AI-powered desktop automation using LangGraph loop for complex multi-step tasks inside desktop apps
 
## Example

Intent Graph:
{"intents":[
  {"id":"intent_001","action":"WEB_SEARCH","subject":"jobs","output_label":"job_results"},
  {"id":"intent_002","action":"FILE_WRITE","subject":"jobs","depends_on":["intent_001"],"output_label":"saved_jobs"}
]}

Output:
{"tasks":[
  {"task_id":"task_001","intent_id":"intent_001","tool":"search","mcp_server":"mcp-browser","executor_model":"nvidia/llama-3.1-nemotron-8b-instruct","params":{"query":"jobs"},"output_key":"job_results","fallback":"notify_user","requires_confirm":false,"estimated_seconds":15},
  {"task_id":"task_002","intent_id":"intent_002","tool":"write","mcp_server":"mcp-filesystem","executor_model":"nvidia/llama-3.1-nemotron-8b-instruct","params":{"filename":"jobs.txt","content":"{{job_results.summary}}"},"output_key":"saved_jobs","depends_on":["task_001"],"fallback":"notify_user","requires_confirm":false,"estimated_seconds":5}
],"total_estimated_seconds":20,"parallel_groups":[],"checkpoints":[]}`;

export class DecisionPlanner {
  private static instance: DecisionPlanner;
  private nvidiaClient: NVIDIAAPIClient;
  private configLoader: ConfigLoader;
  private logger: Logger;

  private constructor() {
    this.nvidiaClient = NVIDIAAPIClient.getInstance();
    this.configLoader = ConfigLoader.getInstance();
    this.logger = Logger.getInstance();
  }

  public static getInstance(): DecisionPlanner {
    if (!DecisionPlanner.instance) {
      DecisionPlanner.instance = new DecisionPlanner();
    }
    return DecisionPlanner.instance;
  }

  public async draftPlan(userInput: string): Promise<string | null> {
    const config = this.configLoader.getConfig();
    const prompt = `Quick decision: What tool should handle this? JSON: {"tool": "name", "mcp": "server", "reason": "brief"}
Input: ${userInput}
Respond ONLY with JSON.`;
    
    try {
      const response = await this.nvidiaClient.chat({
        model: config.models.decision_planner,
        messages: [{ role: 'user', content: prompt }],
        temperature: 0.2,
        max_tokens: 256,
      });
      
      const content = response.choices[0]?.message?.content;
      if (content) {
        const parsed = JSON.parse(content);
        return parsed;
      }
    } catch (e) {
      this.logger.error(`Draft failed: ${e}`);
    }
    return null;
  }

  public async plan(intentGraph: IntentGraph): Promise<DecisionPlanResult> {
    this.logger.info(`Planning tasks for ${intentGraph.intents.length} intents`);

    try {
      const messages = this.buildPlanningMessages(intentGraph);
      const config = this.configLoader.getConfig();

      const response = await this.nvidiaClient.chat({
        model: config.models.decision_planner,
        messages,
        temperature: 0.4,
        max_tokens: 4096,
      });

      const content = response.choices[0]?.message?.content;
      if (!content) {
        return { success: false, error: 'No response from model' };
      }

      const parsed = this.parseResponse(content);

      if (!parsed.tasks || parsed.tasks.length === 0) {
        return { success: false, error: 'Failed to generate task plan' };
      }

      this.tasks = parsed.tasks as Task[];
      const validatedTasks = this.validateAndEnrichTasks(parsed.tasks, intentGraph);
      const consolidatedTasks = this.consolidateDesktopTasks(validatedTasks);
      const parallelGroups = this.identifyParallelGroups(consolidatedTasks);
      const checkpoints = this.identifyCheckpoints(consolidatedTasks);

      const taskDAG: TaskDAG = {
        plan_id: uuidv4(),
        tasks: consolidatedTasks,
        total_estimated_seconds:
          parsed.total_estimated_seconds || this.calculateTotalTime(consolidatedTasks),
        parallel_groups: parallelGroups,
        checkpoints,
      };

      this.logger.info(
        `Generated ${taskDAG.tasks.length} tasks, ${parallelGroups.length} parallel groups`
      );
      return { success: true, taskDAG };
    } catch (error) {
      this.logger.error(`Planning failed: ${error}`);
      return { success: false, error: String(error) };
    }
  }

  private consolidateDesktopTasks(tasks: Task[]): Task[] {
    if (tasks.length <= 1) {
      return tasks;
    }

    // Find tasks that interact with the same app (desktop or browser)
    const desktopRelated = tasks.filter(t => 
      (t.tool === 'open_app' || 
       t.tool === 'desktop_automation' || 
       t.mcp_server === 'mcp-desktop-ui' ||
       (t.params?.app && typeof t.params.app === 'string')) &&
      t.tool !== 'automate_desktop' // Don't consolidate AI-powered automation
    );

    // Also include browser tasks if they seem to be for the same operation
    const relatedTasks = tasks.filter(t => {
      const app = tasks[0]?.params?.app || '';
      return (
        t.tool === 'search' || 
        t.tool === 'navigate' ||
        t.tool === 'automate' ||
        (t.params?.query && typeof t.params.query === 'string')
      );
    });

    const allRelated = [...desktopRelated, ...relatedTasks];

    if (allRelated.length <= 1) {
      return tasks;
    }

    // Build action combining all related tasks
    // Priority: find open_app tasks first, they contain the app to open
    let app = '';
    let actions: string[] = [];
    
    // First, find the app to open (from open_app or desktop_automation tasks)
    for (const task of allRelated) {
      if (task.tool === 'open_app' || task.tool === 'desktop_automation') {
        if (task.params?.app) {
          app = task.params.app as string;
          break;
        }
      }
    }
    
    // If no app found, try first task
    if (!app && allRelated[0]?.params?.app) {
      app = allRelated[0].params.app as string;
    }
    
    // Collect actions from all tasks except the one that opened the app
    for (const task of allRelated) {
      if (task.tool === 'open_app' || task.tool === 'desktop_automation') continue;
      
      if (task.params?.action) {
        actions.push(task.params.action as string);
      }
      if (task.params?.query) {
        actions.push(`search for ${task.params.query}`);
      }
      if (task.params?.search) {
        actions.push(`search for ${task.params.search}`);
      }
      if (task.params?.target) {
        actions.push(`click ${task.params.target}`);
      }
      // Also check subject/action in intent-level params
      const sub = task.params?.subject as string;
      if (sub && sub !== app) {
        actions.push(sub);
      }
    }

    // If no app, try to get from first task
    if (!app && allRelated[0]?.params?.app) {
      app = allRelated[0].params.app as string;
    }

    // If still no app, extract from the user input context (rough guess)
    if (!app) {
      app = allRelated[0]?.params?.subject as string || 'unknown';
    }

    const actionStr = actions.length > 0 ? actions.join(' and ') : 'perform actions';
    const first = allRelated[0];
    const consolidated: Task = {
      task_id: first.task_id,
      intent_id: first.intent_id,
      tool: 'automate_desktop',
      mcp_server: 'mcp-desktop-ui',
      executor_model: first.executor_model,
      params: {
        task: `open ${app} and ${actionStr}`,
        max_steps: 15,
      },
      output_key: first.output_key,
      requires_confirm: first.requires_confirm,
      estimated_seconds: first.estimated_seconds,
      depends_on: first.depends_on,
    };

    const remaining = tasks.filter(t => !allRelated.includes(t));
    const result = [...remaining, consolidated];

    this.logger.info(`Consolidated ${allRelated.length} tasks into desktop_automation`);
    return result;
  }

  private buildPlanningMessages(intentGraph: IntentGraph): ChatMessage[] {
    const messages: ChatMessage[] = [{ role: 'system', content: SYSTEM_PROMPT }];

    messages.push({
      role: 'user',
      content: `Create task plan for this intent graph:\n${JSON.stringify(intentGraph, null, 2)}`,
    });

    return messages;
  }

  private parseResponse(content: string): {
    tasks: Partial<Task>[];
    total_estimated_seconds: number;
    parallel_groups: string[][];
    checkpoints: string[];
  } {
    try {
      const jsonMatch =
        content.match(/```(?:json)?\s*([\s\S]*?)```/) || content.match(/\{[\s\S]*\}/);

      if (!jsonMatch) {
        this.logger.warn('No JSON found in planning response');
        return {
          tasks: [],
          total_estimated_seconds: 0,
          parallel_groups: [],
          checkpoints: [],
        };
      }

      const jsonStr = jsonMatch[1] || jsonMatch[0];
      return JSON.parse(jsonStr);
    } catch (error) {
      this.logger.error(`Failed to parse planning response: ${error}`);
      return {
        tasks: [],
        total_estimated_seconds: 0,
        parallel_groups: [],
        checkpoints: [],
      };
    }
  }

  private validateAndEnrichTasks(tasks: Partial<Task>[], intentGraph: IntentGraph): Task[] {
    return tasks.map((task, index) => {
      const intent = intentGraph.intents.find((i) => i.id === task.intent_id);
      const toolMapping = intent ? TOOL_MAPPINGS[intent.action] : null;
      const isAutomate = toolMapping?.tool === 'automate';
      const isOpenApp = toolMapping?.tool === 'open_app';
      const isAutoDesktop = toolMapping?.tool === 'automate_desktop';

      let params = task.params || {};
      let dependsOn = task.depends_on || this.convertDependencies(intent?.depends_on);

      if (isAutomate && intent) {
        const recipient = intent.recipient ? ` to ${intent.recipient}` : '';
        const subject = intent.subject || 'email';
        const content = intent.content_template || '';
        params = {
          goal: `Send ${subject}${recipient}: ${content}`.trim(),
          max_steps: 15,
          context: '',
        };

        if (!dependsOn && intent.content_template?.includes('{{')) {
          const prevTask = tasks.slice(0, index).find(t => 
            intentGraph.intents.find(i => i.id === t.intent_id)?.action === 'WEB_SEARCH'
          );
          if (prevTask) {
            dependsOn = [prevTask.task_id || ''];
          }
        }
      }

      if (isOpenApp && intent) {
        params = {
          app: intent.subject || params.app || params.application,
          args: params.args,
        };
      }

      if (isAutoDesktop) {
        const rawInput = intentGraph.raw_input;
        params = {
          task: rawInput || params.task || intent?.subject || 'Complete the desktop task',
          max_steps: 15,
        };
      }

      if (toolMapping?.tool === 'send_whatsapp' && intent) {
        params = {
          contact: params.contact || params.recipient || intent.recipient,
          message: params.message || params.content || intent.content_template || intent.subject,
          phone: params.phone,
        };
      }

      return {
        task_id: task.task_id || `task_${String(index + 1).padStart(3, '0')}`,
        intent_id: task.intent_id || '',
        tool: this.forceToolMapping(intent?.action || '', task.tool || toolMapping?.tool || 'unknown', intent),
        mcp_server: this.forceMcpServerMapping(intent?.action || '', task.mcp_server || toolMapping?.mcp_server || 'unknown', intent),
        executor_model: task.executor_model || 'meta/llama-3.1-70b-instruct',
        params,
        output_key: task.output_key || task.intent_id || `output_${index}`,
        fallback: task.fallback || 'notify_user',
        requires_confirm: task.requires_confirm ?? this.shouldConfirm(intent?.action || ''),
        confirm_message: task.confirm_message || this.generateConfirmMessage(intent),
        estimated_seconds: task.estimated_seconds || toolMapping?.default_seconds || 10,
        depends_on: dependsOn,
      };
    });
  }

  private forceToolMapping(action: string, currentTool: string, intent?: Intent): string {
    // If intent mentions opening an app AND doing UI actions inside, use desktop_automation
    if (intent?.subject) {
      const combined = `${intent.action} ${intent.subject}`.toLowerCase();
      if ((action === 'APP_CONTROL' || action === 'OPEN') && 
          (combined.includes(' and ') || combined.includes(' then ') || combined.includes(' click ') || combined.includes(' search ') || combined.includes(' type '))) {
        return 'automate_desktop';
      }
    }
    const toolOverride: Record<string, string> = {
      'WHATSAPP': 'send_whatsapp',
      'EMAIL': 'send_email',
      'CALENDAR': 'create_event',
      'APP_CONTROL': 'open_app',
      'SCREENSHOT': 'screenshot',
      'FILE_READ': 'read',
      'FILE_WRITE': 'write',
      'CODE': 'run_code',
      'CALCULATE': 'calculate',
      'WEB_SEARCH': 'search',
      'WEB_SCRAPE': 'navigate_and_extract',
    };
    return toolOverride[action] || currentTool;
  }

  private forceMcpServerMapping(action: string, currentServer: string, intent?: Intent): string {
    // If intent mentions opening an app AND doing UI actions inside, use desktop_automation
    if (intent?.subject) {
      const combined = `${intent.action} ${intent.subject}`.toLowerCase();
      if ((action === 'APP_CONTROL' || action === 'OPEN') && 
          (combined.includes(' and ') || combined.includes(' then ') || combined.includes(' click ') || combined.includes(' search '))) {
        return 'mcp-desktop-ui';
      }
    }
    const serverOverride: Record<string, string> = {
      'WHATSAPP': 'mcp-desktop-ui',
      'EMAIL': 'mcp-email',
      'CALENDAR': 'mcp-calendar',
      'APP_CONTROL': 'mcp-desktop-ui',
      'DESKTOP_ACTION': 'mcp-desktop-ui',
      'DESKTOP_AI_AUTOMATE': 'mcp-desktop-ui',
      'SCREENSHOT': 'mcp-desktop-ui',
      'FILE_READ': 'mcp-filesystem',
      'FILE_WRITE': 'mcp-filesystem',
      'CODE': 'mcp-code',
      'CALCULATE': 'mcp-code',
      'WEB_SEARCH': 'mcp-browser',
      'WEB_SCRAPE': 'mcp-browser',
    };
    return serverOverride[action] || currentServer;
  }

  private shouldConfirm(action: string): boolean {
    return CONFIRM_ACTIONS.has(action.toUpperCase());
  }

  private generateConfirmMessage(intent: Intent | undefined): string | undefined {
    if (!intent) return undefined;

    switch (intent.action) {
      case 'WHATSAPP':
        return `Send WhatsApp message to ${intent.recipient || 'contact'}?`;
      case 'EMAIL':
        return `Send email to ${intent.recipient || 'recipient'}?`;
      case 'FILE_DELETE':
        return `Delete ${intent.subject}?`;
      case 'FORM_FILL':
        return `Submit ${intent.subject} application?`;
      default:
        return undefined;
    }
  }

  private tasks: Task[] = [];

  private convertDependencies(intentDeps: string[] | undefined): string[] | undefined {
    if (!intentDeps || intentDeps.length === 0) return undefined;

    return intentDeps.map((dep) => {
      const taskForIntent = this.tasks.find(t => t.intent_id === dep);
      if (taskForIntent) return taskForIntent.task_id;

      const num = dep.match(/\d+/)?.[0] || '1';
      return `task_${num.padStart(3, '0')}`;
    });
  }

  private identifyParallelGroups(tasks: Task[]): string[][] {
    const completed = new Set<string>();
    const groups: string[][] = [];

    const remaining = [...tasks];

    while (remaining.length > 0) {
      const group: Task[] = [];

      for (let i = remaining.length - 1; i >= 0; i--) {
        const task = remaining[i];
        const depsMet = !task.depends_on || task.depends_on.every((d) => completed.has(d));

        const noConflicts = group.every((existing) => {
          const existingDeps = existing.depends_on || [];
          const taskDeps = task.depends_on || [];
          return !existingDeps.includes(task.task_id) && !taskDeps.includes(existing.task_id);
        });

        if (depsMet && noConflicts && group.length < 3) {
          group.push(task);
          remaining.splice(i, 1);
        }
      }

      if (group.length === 0 && remaining.length > 0) {
        groups.push([remaining[0].task_id]);
        remaining.splice(0, 1);
      } else if (group.length > 0) {
        groups.push(group.map((t) => t.task_id));
        group.forEach((t) => completed.add(t.task_id));
      } else {
        break;
      }
    }

    return groups;
  }

  private identifyCheckpoints(tasks: Task[]): string[] {
    return tasks.filter((task) => task.requires_confirm).map((task) => task.task_id);
  }

  private calculateTotalTime(tasks: Task[]): number {
    return tasks.reduce((sum, task) => sum + task.estimated_seconds, 0);
  }

  public getToolMapping(
    action: string
  ): { tool: string; mcp_server: string; default_seconds: number } | null {
    return TOOL_MAPPINGS[action] || null;
  }
}
