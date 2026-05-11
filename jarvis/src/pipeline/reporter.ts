import { ModelRouter } from '../ai/model_router';
import { ContextStore, TaskResult } from './context_store';
import { MCPRegistry } from '../mcps/registry';
import { Logger } from '../utils/logger';
import { NVIDIAAPIClient, ChatMessage } from '../ai/nvidia_client';
import { ProfileManager } from '../context/profile_manager';

export interface SessionReport {
  summary: string;
  spoken_summary: string;
  tasks_completed: number;
  tasks_failed: number;
  total_duration_ms: number;
  task_results: TaskResult[];
}

const REPORTER_SYSTEM_PROMPT = `You are a reporter for JARVIS, an autonomous desktop agent.

Your task is to generate a human-friendly summary of completed tasks.

## Output Format
Respond with ONLY valid JSON:
{
  "summary": "Completed 3 of 5 tasks. Successfully searched LinkedIn for jobs and saved results. Failed to send email due to authentication error.",
  "spoken_summary": "Done! I found 10 Python jobs on LinkedIn and saved them to your file. Unfortunately, I couldn't send the email to your boss."
}

## Rules
1. Keep summary concise but informative
2. spoken_summary should be natural and friendly, suitable for TTS
3. Mention specific numbers when available
4. Acknowledge failures honestly but positively
5. Total duration should be mentioned if significant (>30s)`;

export class Reporter {
  private static instance: Reporter;
  private modelRouter: ModelRouter;
  private contextStore: ContextStore;
  private mcpRegistry: MCPRegistry;
  private nvidiaClient: NVIDIAAPIClient;
  private profileManager: ProfileManager;
  private logger: Logger;

  private constructor() {
    this.modelRouter = ModelRouter.getInstance();
    this.contextStore = ContextStore.getInstance();
    this.mcpRegistry = MCPRegistry.getInstance();
    this.nvidiaClient = NVIDIAAPIClient.getInstance();
    this.profileManager = ProfileManager.getInstance();
    this.logger = Logger.getInstance();
  }

  public static getInstance(): Reporter {
    if (!Reporter.instance) {
      Reporter.instance = new Reporter();
    }
    return Reporter.instance;
  }

  public async generateReport(): Promise<SessionReport> {
    const session = this.contextStore.getSession();
    const taskResults = this.contextStore.getTaskResults();

    const completed = taskResults.filter((r) => r.success).length;
    const failed = taskResults.filter((r) => !r.success).length;
    const totalDuration = session?.end_time
      ? session.end_time - session.start_time
      : Date.now() - (session?.start_time || Date.now());

    const report: SessionReport = {
      summary: '',
      spoken_summary: '',
      tasks_completed: completed,
      tasks_failed: failed,
      total_duration_ms: totalDuration,
      task_results: taskResults,
    };

    try {
      const aiReport = await this.generateAIReport(taskResults, totalDuration);
      report.summary = aiReport.summary;
      report.spoken_summary = aiReport.spoken_summary;
    } catch (error) {
      this.logger.error(`AI report generation failed: ${error}`);
      report.summary = this.generateSimpleSummary(taskResults);
      report.spoken_summary = report.summary;
    }

    return report;
  }

  private async generateAIReport(
    taskResults: TaskResult[],
    totalDuration: number
  ): Promise<{
    summary: string;
    spoken_summary: string;
  }> {
    const messages: ChatMessage[] = [
      { role: 'system', content: REPORTER_SYSTEM_PROMPT },
      {
        role: 'user',
        content: JSON.stringify({
          task_results: taskResults.map((r) => ({
            task_id: r.task_id,
            success: r.success,
            output: r.output ? JSON.stringify(r.output).slice(0, 200) : null,
            error: r.error,
            duration_ms: r.duration_ms,
          })),
          total_duration_ms: totalDuration,
        }),
      },
    ];

    const response = await this.nvidiaClient.chat({
      model: this.modelRouter.getModelForStage('reporter'),
      messages,
      temperature: 0.7,
      max_tokens: 1024,
    });

    const content = response.choices[0]?.message?.content;
    if (!content) {
      return {
        summary: this.generateSimpleSummary(taskResults),
        spoken_summary: this.generateSimpleSummary(taskResults),
      };
    }

    try {
      const jsonMatch =
        content.match(/```(?:json)?\s*([\s\S]*?)```/) || content.match(/\{[\s\S]*\}/);

      if (jsonMatch) {
        const jsonStr = jsonMatch[1] || jsonMatch[0];
        return JSON.parse(jsonStr);
      }

      return {
        summary: content,
        spoken_summary: content,
      };
    } catch {
      return {
        summary: content,
        spoken_summary: content,
      };
    }
  }

  private generateSimpleSummary(taskResults: TaskResult[]): string {
    const completed = taskResults.filter((r) => r.success).length;
    const failed = taskResults.filter((r) => !r.success).length;

    let summary = `Completed ${completed} of ${taskResults.length} tasks.`;

    if (failed > 0) {
      summary += ` ${failed} task(s) failed.`;
      const failedTasks = taskResults.filter((r) => !r.success);
      if (failedTasks.length > 0 && failedTasks[0].error) {
        summary += ` Error: ${failedTasks[0].error}`;
      }
    }

    return summary;
  }

  public async sendNotification(message: string): Promise<boolean> {
    try {
      const result = await this.mcpRegistry.callTool('mcp-notifications', 'notify', {
        message,
      });
      return result.success;
    } catch (error) {
      this.logger.error(`Notification failed: ${error}`);
      return false;
    }
  }

  public async speak(text: string): Promise<boolean> {
    try {
      const result = await this.mcpRegistry.callTool('mcp-notifications', 'speak', {
        text,
      });
      return result.success;
    } catch (error) {
      this.logger.error(`TTS failed: ${error}`);
      return false;
    }
  }

  public async logToMemory(report: SessionReport): Promise<void> {
    try {
      await this.mcpRegistry.callTool('mcp-memory', 'append', {
        key: 'session_history',
        value: JSON.stringify({
          timestamp: Date.now(),
          summary: report.summary,
          tasks_completed: report.tasks_completed,
          tasks_failed: report.tasks_failed,
          duration_ms: report.total_duration_ms,
        }),
      });
    } catch (error) {
      this.logger.error(`Failed to log session to memory: ${error}`);
    }
  }

  public async updateProfileWithLearning(): Promise<void> {
    try {
      const session = this.contextStore.getSession();
      if (session?.raw_input) {
        this.profileManager.addToHistory(session.raw_input, session.status === 'completed');
      }
    } catch (error) {
      this.logger.error(`Failed to update profile: ${error}`);
    }
  }

  public async saveResultsToFile(filename: string = 'logs.txt'): Promise<void> {
    try {
      const taskResults = this.contextStore.getTaskResults();
      const session = this.contextStore.getSession();

      const logContent = JSON.stringify(
        {
          session_id: session?.session_id,
          timestamp: new Date().toISOString(),
          raw_input: session?.raw_input,
          status: session?.status,
          task_results: taskResults,
          tasks_completed: taskResults.filter((r) => r.success).length,
          tasks_failed: taskResults.filter((r) => !r.success).length,
        },
        null,
        2
      );

      await this.mcpRegistry.callTool('mcp-filesystem', 'write', {
        path: filename,
        content: logContent,
        append: true,
      });

      this.logger.info(`Results saved to ${filename}`);
    } catch (error) {
      this.logger.error(`Failed to save results: ${error}`);
    }
  }
}
