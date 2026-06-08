import { ContextStore, Task, TaskResult, TaskDAG } from './context_store';
import { ToolCaller, ToolCallSpec } from './tool_caller';
import { Logger } from '../utils/logger';

export interface ExecutorConfig {
  maxRetries: number;
  retryDelayMs: number;
  screenshotVerify: boolean;
}

export interface ExecutionStatus {
  task_id: string;
  status: 'pending' | 'running' | 'completed' | 'failed' | 'skipped';
  attempts: number;
  error?: string;
}

export class Executor {
  private static instance: Executor;
  private contextStore: ContextStore;
  private toolCaller: ToolCaller;
  private logger: Logger;
  private config: ExecutorConfig;

  private constructor() {
    this.contextStore = ContextStore.getInstance();
    this.toolCaller = ToolCaller.getInstance();
    this.logger = Logger.getInstance();
    this.config = {
      maxRetries: 2,
      retryDelayMs: 1000,
      screenshotVerify: true,
    };
  }

  public static getInstance(): Executor {
    if (!Executor.instance) {
      Executor.instance = new Executor();
    }
    return Executor.instance;
  }

  public async executeTaskDAG(
    taskDAG: TaskDAG,
    onProgress?: (status: ExecutionStatus) => void
  ): Promise<TaskResult[]> {
    this.logger.info(`Executing Task DAG with ${taskDAG.tasks.length} tasks`);
    const results: TaskResult[] = [];
    const completedTasks = new Set<string>();

    const taskMap = new Map(taskDAG.tasks.map(t => [t.task_id, t]));

    const groups = taskDAG.parallel_groups?.length
      ? taskDAG.parallel_groups
      : taskDAG.tasks.map(t => [t.task_id]);

    for (const groupIds of groups) {
      const groupTasks = groupIds
        .map(id => taskMap.get(id))
        .filter((t): t is Task => t !== undefined);

      const toExecute = groupTasks.filter(task => {
        const status: ExecutionStatus = { task_id: task.task_id, status: 'pending', attempts: 0 };
        onProgress?.(status);

        if (task.depends_on) {
          const depsCompleted = task.depends_on.every(dep => completedTasks.has(dep));
          if (!depsCompleted) {
            status.status = 'skipped';
            status.error = 'Dependencies not met';
            onProgress?.(status);
            results.push(this.createTaskResult(task, false, null, status.error));
            return false;
          }
        }

        if (task.requires_confirm) {
          this.logger.info(`Task ${task.task_id} requires confirmation: ${task.confirm_message}`);
        }

        return true;
      });

      if (toExecute.length === 0) continue;

      const groupResults = await Promise.all(
        toExecute.map(async (task) => {
          const result = await this.executeTask(task, onProgress);
          this.contextStore.setTaskResult(task.task_id, result);
          if (result.success) {
            completedTasks.add(task.task_id);
          }
          return result;
        })
      );

      results.push(...groupResults);
    }

    return results;
  }

  public async executeTask(
    task: Task,
    onProgress?: (status: ExecutionStatus) => void
  ): Promise<TaskResult> {
    const startTime = Date.now();
    const status: ExecutionStatus = {
      task_id: task.task_id,
      status: 'running',
      attempts: 0,
    };

    this.logger.info(`Executing task: ${task.task_id} (${task.tool})`);
    onProgress?.(status);

    for (let attempt = 0; attempt <= this.config.maxRetries; attempt++) {
      status.attempts = attempt + 1;

      try {
        const resolveResult = await this.toolCaller.resolveToolCall(task);

        if (!resolveResult.success || !resolveResult.toolCall) {
          if (attempt < this.config.maxRetries) {
            this.logger.warn(`Retry ${attempt + 1}/${this.config.maxRetries} for ${task.task_id}`);
            await this.delay(this.config.retryDelayMs);
            continue;
          }
          return this.createTaskResult(
            task,
            false,
            null,
            resolveResult.error,
            Date.now() - startTime
          );
        }

        const toolCall = resolveResult.toolCall;
        const execResult = await this.toolCaller.executeToolCall(toolCall);

        if (execResult.success) {
          status.status = 'completed';
          onProgress?.(status);
          return this.createTaskResult(
            task,
            true,
            execResult.result,
            undefined,
            Date.now() - startTime
          );
        }

        // Check if we should use browser fallback
        if (execResult.requiresFallback) {
          this.logger.info(`MCP ${task.mcp_server} not configured, falling back to browser automation`);
          
          const browserFallbackResult = await this.toolCaller.executeToolCall({
            task_id: `fallback_${task.task_id}`,
            server: 'mcp-browser',
            tool: 'automate',
            method: 'automate',
            params: {
              goal: this.buildGoalFromTask(task),
              max_steps: 15,
              context: `Original task: ${task.tool} via ${task.mcp_server}`,
            },
          });

          if (browserFallbackResult.success) {
            const resultObj = browserFallbackResult.result as Record<string, unknown> || {};
            return this.createTaskResult(task, true, { ...resultObj, fallback: 'browser' }, 'Completed via browser fallback');
          }
        }

        if (this.shouldRetry(execResult.error, attempt)) {
          this.logger.warn(
            `Retry ${attempt + 1}/${this.config.maxRetries} for ${task.task_id}: ${execResult.error}`
          );
          await this.delay(this.config.retryDelayMs * Math.pow(2, attempt));
          continue;
        }

        const fallbackResult = await this.executeFallback(task, toolCall);
        if (fallbackResult) {
          return fallbackResult;
        }

        return this.createTaskResult(task, false, null, execResult.error, Date.now() - startTime);
      } catch (error) {
        this.logger.error(`Task ${task.task_id} error: ${error}`);

        if (attempt < this.config.maxRetries) {
          await this.delay(this.config.retryDelayMs);
          continue;
        }

        return this.createTaskResult(task, false, null, String(error), Date.now() - startTime);
      }
    }

    return this.createTaskResult(task, false, null, 'Max retries exceeded', Date.now() - startTime);
  }

  private shouldRetry(error: string | undefined, attempt: number): boolean {
    if (!error) return false;
    if (attempt >= this.config.maxRetries) return false;

    const retryableErrors = [
      'timeout',
      'ECONNREFUSED',
      'ETIMEDOUT',
      'network',
      'connection',
      'temporarily unavailable',
      'too many requests',
    ];

    const lowerError = error.toLowerCase();
    return retryableErrors.some((err) => lowerError.includes(err));
  }

  private async executeFallback(task: Task, _toolCall: ToolCallSpec): Promise<TaskResult | null> {
    // Fallback is now handled in the main execution flow based on requiresFallback flag
    // This is kept for backwards compatibility with task.fallback = 'notify_user'

    if (task.fallback === 'notify_user' && !task.requires_confirm) {
      this.logger.info(`Executing fallback for ${task.task_id}: notify_user`);

      const fallbackResult = await this.toolCaller.executeToolCall({
        task_id: `fallback_${task.task_id}`,
        server: 'mcp-notifications',
        tool: 'notify',
        method: 'notify',
        params: {
          message: `Task ${task.task_id} failed: ${task.tool} operation. Please check logs.`,
        },
      });

      if (fallbackResult.success) {
        return this.createTaskResult(task, false, { fallback: 'notified' }, 'Notified user');
      }
    }

    return null;
  }

  private buildGoalFromTask(task: Task): string {
    const params = task.params || {};
    
    // Get subject from intent if available
    const intentGraph = this.contextStore.getSession()?.intent_graph;
    const intent = intentGraph?.intents.find(i => i.id === task.intent_id);
    const subject = intent?.subject || params.subject || params.title || '';
    
    switch (task.tool) {
      case 'send_email':
        return `Send an email to ${params.to || 'recipient'}${subject ? ' about ' + subject : ''}`;
      case 'create_event':
        return `Create a calendar event: ${subject || 'New Event'}${params.start ? ' at ' + params.start : ''}`;
      default:
        return `${task.tool}: ${subject || JSON.stringify(params)}`;
    }
  }

  private createTaskResult(
    task: Task,
    success: boolean,
    output: unknown,
    error?: string,
    durationMs?: number
  ): TaskResult {
    return {
      task_id: task.task_id,
      success,
      output,
      error,
      duration_ms: durationMs || 0,
    };
  }

  private delay(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }

  public setConfig(config: Partial<ExecutorConfig>): void {
    this.config = { ...this.config, ...config };
  }

  public async waitForDependencies(dependsOn: string[]): Promise<void> {
    await this.contextStore.waitForDependencies(dependsOn);
  }
}
