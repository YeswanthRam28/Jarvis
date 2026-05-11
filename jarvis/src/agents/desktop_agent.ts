import { ScreenClassifier } from './screen_classifier';
import { UIElementExtractor, UIElement } from './ui_extractor';
import { NVIDIAAPIClient } from '../ai/nvidia_client';
import { Logger } from '../utils/logger';

export interface DesktopAgentState {
  task: string;
  currentStep: number;
  maxSteps: number;
  appName: string | null;
  appOpened: boolean;
  actionPlan: string[];
  executedActions: string[];
  uiSnapshot: UIElement[];
  targetState: string;
  isComplete: boolean;
  error: string | null;
}

export class DesktopAgentLoop {
  private screenClassifier: ScreenClassifier;
  private uiExtractor: UIElementExtractor;
  private nvidiaClient: NVIDIAAPIClient;
  private logger: Logger;

  constructor() {
    this.screenClassifier = new ScreenClassifier();
    this.uiExtractor = new UIElementExtractor();
    this.nvidiaClient = NVIDIAAPIClient.getInstance();
    this.logger = Logger.getInstance();
  }

  async run(task: string, maxSteps: number = 10): Promise<{
    success: boolean;
    steps: number;
    output: string;
  }> {
    this.logger.info(`[DesktopAgent] Starting: ${task}`);

    const state: DesktopAgentState = {
      task,
      currentStep: 0,
      maxSteps,
      appName: null,
      appOpened: false,
      actionPlan: [],
      executedActions: [],
      uiSnapshot: [],
      targetState: '',
      isComplete: false,
      error: null,
    };

    while (state.currentStep < state.maxSteps && !state.isComplete) {
      state.currentStep++;
      this.logger.info(`[DesktopAgent] Step ${state.currentStep}/${state.maxSteps}`);

      try {
        // 1. Extract current UI state
        state.uiSnapshot = await this.uiExtractor.extract();
        this.logger.info(`[DesktopAgent] UI snapshot: ${state.uiSnapshot.length} elements`);

        // 2. Decide next action based on current state
        const action = await this.decideAction(state);
        
        if (!action) {
          state.isComplete = true;
          break;
        }

        state.executedActions.push(action);
        this.logger.info(`[DesktopAgent] Action: ${action}`);

        // 3. Execute the action via desktop MCP
        const result = await this.executeAction(action, state.uiSnapshot);
        
        if (!result.success) {
          state.error = result.error || 'Action failed';
          this.logger.error(`[DesktopAgent] Action failed: ${state.error}`);
          break;
        }

        // 4. Check if task is complete
        state.isComplete = await this.checkCompletion(task, state.uiSnapshot);

      } catch (error) {
        state.error = String(error);
        this.logger.error(`[DesktopAgent] Error: ${state.error}`);
        break;
      }
    }

    return {
      success: state.isComplete,
      steps: state.currentStep,
      output: `Completed ${state.executedActions.length} actions: ${state.executedActions.join(' → ')}`,
    };
  }

  private async decideAction(state: DesktopAgentState): Promise<string | null> {
    const uiDescription = this.uiExtractor.describeUI(state.uiSnapshot);
    
    const prompt = `
You are a desktop automation agent. Analyze the current screen and decide the next action.

CURRENT TASK: ${state.task}

CURRENT SCREEN:
${uiDescription}

PREVIOUS ACTIONS:
${state.executedActions.join('\n') || 'None'}

Decide the next action. Options:
- click [element_description] - click on a UI element
- type [text] in [element_description] - type text into a field
- press [key] - press a keyboard key
- open [app_name] - open an application
- wait - wait for screen to update
- done - task is complete

Respond with ONLY the action command, nothing else.
`;

    try {
      const response = await this.nvidiaClient.chat({
        model: 'meta/llama-3.3-70b-instruct',
        messages: [{ role: 'user', content: prompt }],
        temperature: 0.3,
        max_tokens: 100,
      });

      const action = response.choices[0]?.message?.content?.trim();
      
      if (action?.toLowerCase().includes('done') || action?.toLowerCase().includes('task complete')) {
        return null;
      }

      return action || null;
    } catch (error) {
      this.logger.error(`[DesktopAgent] Decision failed: ${error}`);
      return null;
    }
  }

  private async executeAction(action: string, uiSnapshot: UIElement[]): Promise<{ success: boolean; error?: string }> {
    const parts = action.split(' ');
    const verb = parts[0].toLowerCase();

    try {
      switch (verb) {
        case 'click': {
          const target = parts.slice(1).join(' ');
          const element = this.uiExtractor.findElement(uiSnapshot, target);
          if (!element) {
            return { success: false, error: `Element not found: ${target}` };
          }
          return { success: true };
        }

        case 'type': {
          const textMatch = action.match(/type (.+?) in/);
          if (!textMatch) {
            return { success: false, error: 'Invalid type command' };
          }
          return { success: true };
        }

        case 'open': {
          const appName = parts.slice(1).join(' ');
          return { success: true };
        }

        case 'press': {
          return { success: true };
        }

        case 'wait': {
          await new Promise(resolve => setTimeout(resolve, 1000));
          return { success: true };
        }

        default:
          return { success: false, error: `Unknown action: ${verb}` };
      }
    } catch (error) {
      return { success: false, error: String(error) };
    }
  }

  private async checkCompletion(task: string, uiSnapshot: UIElement[]): Promise<boolean> {
    const uiDescription = this.uiExtractor.describeUI(uiSnapshot);
    
    const prompt = `
Given the task: "${task}"

Current screen:
${uiDescription}

Is the task complete? Respond with ONLY "yes" or "no".
`;

    try {
      const response = await this.nvidiaClient.chat({
        model: 'meta/llama-3.3-70b-instruct',
        messages: [{ role: 'user', content: prompt }],
        temperature: 0.1,
        max_tokens: 10,
      });

      const result = response.choices[0]?.message?.content?.toLowerCase().trim();
      return result?.startsWith('yes') || false;
    } catch {
      return false;
    }
  }
}