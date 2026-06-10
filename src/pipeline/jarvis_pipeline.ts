import { IntentParser } from './intent_parser';
import { DecisionPlanner } from './decision_planner';
import { Executor } from './executor';
import { Reporter, SessionReport } from './reporter';
import { ContextStore, IntentGraph, TaskDAG } from './context_store';
import { MCPRegistry } from '../mcps/registry';
import { Logger } from '../utils/logger';

export interface PipelineConfig {
  startMCPServers: boolean;
  sendNotifications: boolean;
  useTTS: boolean;
  logToMemory: boolean;
  updateProfile: boolean;
}

export interface PipelineResult {
  success: boolean;
  sessionId: string;
  intentGraph?: IntentGraph;
  taskDAG?: TaskDAG;
  report?: SessionReport;
  error?: string;
  clarificationQuestion?: string;
}

export class JARVISPipeline {
  private static instance: JARVISPipeline;
  private intentParser: IntentParser;
  private decisionPlanner: DecisionPlanner;
  private executor: Executor;
  private reporter: Reporter;
  private contextStore: ContextStore;
  private mcpRegistry: MCPRegistry;
  private logger: Logger;
  private config: PipelineConfig;

  private constructor() {
    this.intentParser = IntentParser.getInstance();
    this.decisionPlanner = DecisionPlanner.getInstance();
    this.executor = Executor.getInstance();
    this.reporter = Reporter.getInstance();
    this.contextStore = ContextStore.getInstance();
    this.mcpRegistry = MCPRegistry.getInstance();
    this.logger = Logger.getInstance();
    this.config = {
      startMCPServers: true,
      sendNotifications: true,
      useTTS: false,
      logToMemory: true,
      updateProfile: true,
    };
  }

  public static getInstance(): JARVISPipeline {
    if (!JARVISPipeline.instance) {
      JARVISPipeline.instance = new JARVISPipeline();
    }
    return JARVISPipeline.instance;
  }

  public setConfig(config: Partial<PipelineConfig>): void {
    this.config = { ...this.config, ...config };
  }

  private mcpServersStarted: boolean = false;

  public async run(
    userInput: string,
    onProgress?: (stage: string, message: string) => void
  ): Promise<PipelineResult> {
    this.logger.info(`Starting JARVIS pipeline for: "${userInput}"`);

    const session = this.contextStore.getSession();
    const result: PipelineResult = {
      success: false,
      sessionId: session?.session_id || '',
    };

    try {
      // Step 0: RAG - Fetch semantic context
      let ragContext = '';
      try {
        onProgress?.('setup', 'Retrieving memory context...');
        const searchRes = await this.mcpRegistry.callTool('mcp-memory', 'semantic_search', {
          query: userInput,
          type: 'semantic',
          limit: 3
        });
        
        const ragResult = searchRes.result as any;
        if (searchRes.success && ragResult?.results && ragResult.results.length > 0) {
          const memories = ragResult.results.map((r: any) => `- ${r.text}`);
          ragContext = memories.join('\n');
          this.logger.info(`RAG found ${ragResult.results.length} relevant memories.`);
        }
      } catch (e) {
        this.logger.warn(`Failed to retrieve RAG context: ${e}`);
      }

      onProgress?.('intent_parser', 'Parsing your command...');
      const parseResult = await this.intentParser.parse(userInput, ragContext);

      if (!parseResult.success) {
        result.error = parseResult.error;
        return result;
      }

      if (parseResult.clarificationQuestion) {
        result.success = true;
        result.clarificationQuestion = parseResult.clarificationQuestion;
        return result;
      }

      if (!parseResult.intentGraph) {
        result.error = 'No intent graph generated';
        return result;
      }

      result.intentGraph = parseResult.intentGraph;

      onProgress?.('decision_planner', 'Planning task execution...');
      
      // Parallel: Intent Parser and Decision Planner work simultaneously
      const [planResult, draftResult] = await Promise.all([
        this.decisionPlanner.plan(parseResult.intentGraph),
        this.decisionPlanner.draftPlan(userInput).catch(() => null),
      ]);

      // Decision dominates: use draft to validate/refine intent
      if (draftResult && typeof draftResult === 'object') {
        const tool = (draftResult as any).tool;
        const mcp = (draftResult as any).mcp;
        
        // If decision says different tool, override intent
        if (tool && parseResult.intentGraph?.intents?.[0]) {
          const intent = parseResult.intentGraph.intents[0];
          
          // Override tool selection in intent
          (intent as any).forceTool = tool;
          (intent as any).forceMCP = mcp;
          
          this.logger.info(`Decision override: ${tool} via ${mcp}`);
        }
      }

      if (!planResult.success || !planResult.taskDAG) {
        result.error = planResult.error;
        return result;
      }

      result.taskDAG = planResult.taskDAG;

      onProgress?.('executor', `Executing ${planResult.taskDAG.tasks.length} tasks...`);
      await this.executor.executeTaskDAG(planResult.taskDAG, (status) => {
        onProgress?.('executor', `Task ${status.task_id}: ${status.status}`);
      });

      onProgress?.('reporter', 'Generating report...');
      const report = await this.reporter.generateReport();
      result.report = report;

      if (this.config.sendNotifications) {
        await this.reporter.sendNotification(report.summary);
      }

      if (this.config.useTTS) {
        await this.reporter.speak(report.spoken_summary);
      }

      if (this.config.logToMemory) {
        await this.reporter.logToMemory(report);
      }

      if (this.config.updateProfile) {
        await this.reporter.updateProfileWithLearning();
      }

      await this.reporter.saveResultsToFile('logs.txt');

      result.success = true;
      this.logger.info('Pipeline completed successfully');

      return result;
    } catch (error) {
      this.logger.error(`Pipeline failed: ${error}`);
      result.error = String(error);
      return result;
    }
  }

  public async startMCPServers(): Promise<void> {
    if (!this.config.startMCPServers || this.mcpServersStarted) return;
    this.mcpServersStarted = true;
    const servers = [
      'mcp-memory',
      'mcp-user-profile',
      'mcp-browser',
      'mcp-filesystem',
      'mcp-code',
      'mcp-payment',
      'mcp-email',
      'mcp-calendar',
      'mcp-desktop-ui',
      'mcp-shell',
    ];

    for (const server of servers) {
      try {
        await this.mcpRegistry.registerServer(server);
        await this.mcpRegistry.startServer(server);
      } catch (error) {
        this.logger.warn(`Failed to start ${server}: ${error}`);
      }
    }
  }

  public async shutdown(): Promise<void> {
    this.logger.info('Shutting down JARVIS pipeline...');
    await this.mcpRegistry.shutdown();
  }
}
