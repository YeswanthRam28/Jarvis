import { ModelRouter } from "../ai/model_router";
import { MCPRegistry } from "../mcps/registry";
import { Logger } from "../utils/logger";
import { NVIDIAAPIClient } from "../ai/nvidia_client";

export interface AutomationStep {
  action: string;
  target?: string;
  params?: Record<string, unknown>;
  reasoning: string;
  screenshot?: string;
}

export interface AutomationResult {
  success: boolean;
  steps: AutomationStep[];
  finalResult?: unknown;
  error?: string;
}

export class AutomationAgent {
  private static instance: AutomationAgent;
  private modelRouter: ModelRouter;
  private mcpRegistry: MCPRegistry;
  private nvidiaClient: NVIDIAAPIClient;
  private logger: Logger;
  private maxSteps: number = 15;

  private constructor() {
    this.modelRouter = ModelRouter.getInstance();
    this.mcpRegistry = MCPRegistry.getInstance();
    this.nvidiaClient = NVIDIAAPIClient.getInstance();
    this.logger = Logger.getInstance();
  }

  public static getInstance(): AutomationAgent {
    if (!AutomationAgent.instance) {
      AutomationAgent.instance = new AutomationAgent();
    }
    return AutomationAgent.instance;
  }

  public setMaxSteps(max: number): void {
    this.maxSteps = max;
  }

  public async execute(task: string, initialContext?: Record<string, unknown>): Promise<AutomationResult> {
    this.logger.info(`Starting automation agent for task: ${task}`);
    
    const steps: AutomationStep[] = [];
    let currentContext = { ...initialContext };
    let completed = false;
    let stepCount = 0;

    const initialState = await this.captureState("initial");
    if (initialState.screenshot) {
      currentContext.screenshot = initialState.screenshot;
      currentContext.pageUrl = initialState.url;
      currentContext.pageTitle = initialState.title;
    }

    const initialPlan = await this.planSteps(task, currentContext);
    this.logger.info(`Initial plan: ${initialPlan.steps.length} steps`);

    for (const plannedStep of initialPlan.steps) {
      if (completed || stepCount >= this.maxSteps) break;

      stepCount++;
      this.logger.info(`Executing step ${stepCount}: ${plannedStep.action}`);

      const result = await this.executeStep(plannedStep, currentContext);
      
      steps.push({
        action: plannedStep.action,
        target: plannedStep.target,
        params: plannedStep.params,
        reasoning: plannedStep.reasoning,
      });

      if (result.success) {
        currentContext = { ...currentContext, ...result.context };
        
        if (result.screenshot) {
          currentContext.screenshot = result.screenshot;
        }

        if (result.completed) {
          completed = true;
          this.logger.info(`Task completed at step ${stepCount}`);
          break;
        }

        const shouldContinue = await this.evaluateProgress(task, steps, currentContext);
        if (!shouldContinue) {
          this.logger.info(`AI determined task is complete`);
          completed = true;
          break;
        }
      } else {
        this.logger.warn(`Step ${stepCount} failed: ${String(result.error)}`);
        
        const recovery = await this.handleFailure(plannedStep, String(result.error), currentContext);
        if (!recovery) {
          this.logger.error(`Failed to recover from error`);
          break;
        }
      }
    }

    if (!completed && stepCount >= this.maxSteps) {
      this.logger.warn(`Reached max steps limit (${this.maxSteps})`);
    }

    return {
      success: completed,
      steps,
      finalResult: currentContext.lastResult,
    };
  }

  private async captureState(reason: string): Promise<{ screenshot?: string; url?: string; title?: string }> {
    try {
      const screenshotResult = await this.mcpRegistry.callTool("mcp-browser", "screenshot", {});
      const urlResult = await this.mcpRegistry.callTool("mcp-browser", "get_url", {});
      
      return {
        screenshot: screenshotResult.success ? screenshotResult.result as string : undefined,
        url: urlResult.success ? (urlResult.result as { url?: string })?.url : undefined,
        title: urlResult.success ? (urlResult.result as { title?: string })?.title : undefined,
      };
    } catch (error) {
      this.logger.warn(`Failed to capture state (${reason}): ${error}`);
      return {};
    }
  }

  private async planSteps(task: string, context: Record<string, unknown>): Promise<{ steps: Array<{ action: string; target?: string; params?: Record<string, unknown>; reasoning: string }> }> {
    const contextStr = JSON.stringify(context, null, 2);
    
    const prompt = `You are a task planning agent for web automation.

Given a task and current context, break it down into specific action steps.

Task: ${task}

Current Context:
${contextStr}

Available Actions:
- navigate(url) - Go to a specific URL
- click(selector) - Click an element by CSS selector
- type(selector, text) - Type text into an element
- select(selector, option) - Select an option from dropdown
- submit(selector) - Submit a form
- extract(selector) - Extract content from elements
- search(query) - Search the web
- wait(seconds) - Wait for a duration
- screenshot - Capture current screen

Output as JSON:
{
  "steps": [
    {"action": "navigate", "target": "https://mail.google.com", "reasoning": "Need to open Gmail first"},
    {"action": "click", "target": "#compose", "reasoning": "Click compose button to write new email"},
    {"action": "type", "target": "input[name='to']", "params": {"text": "logesh.r2024@vitsudent.ac.in"}, "reasoning": "Enter recipient email"},
    {"action": "type", "target": "input[name='subject']", "params": {"text": "Weather Update"}, "reasoning": "Enter email subject"},
    {"action": "type", "target": "div[contenteditable='true']", "params": {"text": "Tomorrow's weather forecast..."}, "reasoning": "Write email body"},
    {"action": "click", "target": "button[type='submit']", "reasoning": "Send the email"}
  ]
}

Break the task into specific, actionable steps. Be specific with selectors when possible.`;

    try {
      const response = await this.nvidiaClient.chatSimple(
        this.modelRouter.getModelForStage("decision_planner"),
        "You are a task planning agent. Output ONLY valid JSON.",
        prompt,
        0.3,
        2048
      );

      const jsonMatch = response.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        const parsed = JSON.parse(jsonMatch[0]);
        return { steps: parsed.steps || [] };
      }
    } catch (error) {
      this.logger.error(`Failed to plan steps: ${error}`);
    }

    return { steps: [] };
  }

  private async executeStep(plannedStep: { action: string; target?: string; params?: Record<string, unknown>; reasoning: string }, context: Record<string, unknown>): Promise<{ success: boolean; context: Record<string, unknown>; completed?: boolean; screenshot?: string; error?: string }> {
    const { action, target, params } = plannedStep;

    try {
      let result: { success: boolean; result?: unknown; error?: string };

      switch (action) {
        case "navigate":
          result = await this.mcpRegistry.callTool("mcp-browser", "navigate", { url: target });
          break;

        case "click":
          if (!target) throw new Error("Click requires a target selector");
          result = await this.mcpRegistry.callTool("mcp-browser", "click", { selector: target });
          break;

        case "type":
          if (!target || !params?.text) throw new Error("Type requires target and text");
          result = await this.mcpRegistry.callTool("mcp-browser", "type", { selector: target, text: params.text });
          break;

        case "select":
          if (!target || !params?.option) throw new Error("Select requires target and option");
          result = await this.mcpRegistry.callTool("mcp-browser", "select", { selector: target, option: params.option });
          break;

        case "submit":
          if (!target) throw new Error("Submit requires a target selector");
          result = await this.mcpRegistry.callTool("mcp-browser", "submit", { selector: target });
          break;

        case "extract":
          if (!target) throw new Error("Extract requires a selector");
          result = await this.mcpRegistry.callTool("mcp-browser", "extract", { selector: target });
          break;

        case "search":
          if (!target) throw new Error("Search requires a query");
          result = await this.mcpRegistry.callTool("mcp-browser", "search", { query: target });
          break;

        case "screenshot":
          result = await this.mcpRegistry.callTool("mcp-browser", "screenshot", {});
          break;

        case "wait":
          await new Promise(resolve => setTimeout(resolve, (params?.seconds as number || 2) * 1000));
          result = { success: true };
          break;

        default:
          throw new Error(`Unknown action: ${action}`);
      }

      const newContext: Record<string, unknown> = { ...context, lastResult: result.result };

      const stateAfter = await this.captureState(`after ${action}`);
      if (stateAfter.screenshot) {
        newContext.screenshot = stateAfter.screenshot;
        newContext.pageUrl = stateAfter.url;
        newContext.pageTitle = stateAfter.title;
      }

      const completed = this.checkCompletion(result, action, newContext);

      return {
        success: result.success,
        context: newContext,
        completed,
        error: result.success ? undefined : result.error,
      };
    } catch (error) {
      return {
        success: false,
        context: context,
        error: String(error),
      };
    }
  }

  private checkCompletion(result: { success: boolean }, action: string, context: Record<string, unknown>): boolean {
    if (!result.success) return false;

    const lastUrl = context.pageUrl as string || "";
    
    if (action === "submit" && lastUrl.includes("sent")) {
      return true;
    }

    if (lastUrl.includes("inbox") || lastUrl.includes("sent") || lastUrl.includes("mail.google")) {
      return false;
    }

    return false;
  }

  private async evaluateProgress(task: string, steps: AutomationStep[], context: Record<string, unknown>): Promise<boolean> {
    const stepsStr = steps.map(s => s.action).join(" -> ");
    
    const prompt = `Evaluate if the task is complete.

Original Task: ${task}
Steps Executed: ${stepsStr}
Current URL: ${context.pageUrl || "unknown"}

Return JSON:
{"complete": true/false, "reasoning": "..."}`;

    try {
      const response = await this.nvidiaClient.chatSimple(
        this.modelRouter.getModelForStage("reporter"),
        "You are a completion checker. Output ONLY valid JSON.",
        prompt,
        0.3,
        256
      );

      const jsonMatch = response.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        const parsed = JSON.parse(jsonMatch[0]);
        return parsed.complete !== true;
      }
    } catch (error) {
      this.logger.warn(`Completion check failed: ${error}`);
    }

    return true;
  }

  private async handleFailure(step: { action: string; target?: string }, error: string, context: Record<string, unknown>): Promise<boolean> {
    this.logger.warn(`Handling failure: ${error}`);

    const screenshot = await this.captureState("after failure");
    context.screenshot = screenshot.screenshot;

    const prompt = `A step failed. Suggest a recovery action.

Failed: ${step.action} on ${step.target}
Error: ${error}
Current URL: ${context.pageUrl || "unknown"}

Recovery Options:
- retry - Try the same action again
- navigate(url) - Go to a different URL
- click(selector) - Try clicking something else
- wait - Wait and try again
- skip - Move to next step
- abort - Stop the automation

Return JSON:
{"recovery": "action", "target": "...", "reasoning": "..."}`;

    try {
      await this.nvidiaClient.chatSimple(
        this.modelRouter.getModelForStage("decision_planner"),
        "You are a recovery agent. Output ONLY valid JSON.",
        prompt,
        0.3,
        512
      );

      this.logger.info(`Recovery suggestion received`);
      return true;
    } catch (err) {
      this.logger.error(`Recovery failed: ${err}`);
      return false;
    }
  }
}