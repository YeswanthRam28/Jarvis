import { execSync } from 'child_process';
import { NVIDIAAPIClient } from '../ai/nvidia_client';
import { Logger } from '../utils/logger';
import { UIElementExtractor, UIElement } from './ui_extractor';

interface AgentState {
  task: string;
  targetApp: string;
  currentStep: number;
  maxSteps: number;
  history: ActionRecord[];
  uiElements: UIElement[];
  screenshotBefore: Buffer | null;
  screenshotAfter: Buffer | null;
  previousAction: string;
  error: string | null;
  isComplete: boolean;
  result: string;
}

interface ActionRecord {
  step: number;
  action: string;
  actionType: string;
  actionParams: Record<string, unknown>;
  reasoning: string;
  success: boolean;
  verifyResult: string;
}

interface AgentAction {
  type: 'click' | 'type' | 'keypress' | 'scroll' | 'wait' | 'done';
  params: Record<string, unknown>;
  reasoning: string;
}

export class DesktopAgentGraph {
  private nvidiaClient: NVIDIAAPIClient;
  private uiExtractor: UIElementExtractor;
  private logger: Logger;

  constructor() {
    this.nvidiaClient = NVIDIAAPIClient.getInstance();
    this.uiExtractor = new UIElementExtractor();
    this.logger = Logger.getInstance();
  }

  async run(task: string, maxSteps: number = 10): Promise<{
    success: boolean;
    steps: number;
    output: string;
    history: ActionRecord[];
  }> {
    let state: AgentState = {
      task,
      targetApp: this.extractTargetApp(task),
      currentStep: 0,
      maxSteps,
      history: [],
      uiElements: [],
      screenshotBefore: null,
      screenshotAfter: null,
      previousAction: '',
      error: null,
      isComplete: false,
      result: '',
    };

    this.logger.info(`[LangGraph] Starting desktop agent for: ${task}`);

    while (state.currentStep < state.maxSteps && !state.isComplete) {
      state.currentStep++;
      this.logger.info(`[LangGraph] Step ${state.currentStep}/${state.maxSteps}`);

      try {
        state = await this.nodeExtractUI(state);
        if (state.error) break;

        state = await this.nodeReason(state);
        if (state.error) break;

        const action = this.parseAction(state.result);
        if (!action) {
          state.error = 'Failed to parse action from LLM output';
          break;
        }

        this.logger.info(`[LangGraph] Executing: ${action.type} -> ${JSON.stringify(action.params)}`);

        state = await this.nodeExecute(state, action);
        if (state.error && state.currentStep >= state.maxSteps) break;

        state = await this.nodeVerify(state);
        if (state.error) break;

      } catch (error) {
        state.error = `Step ${state.currentStep} failed: ${error}`;
        this.logger.error(`[LangGraph] Error: ${error}`);
        break;
      }
    }

    if (!state.isComplete && !state.error && state.currentStep >= state.maxSteps) {
      state.result = 'Max steps reached without completing task';
    }

    const success = state.isComplete && !state.error;
    return {
      success,
      steps: state.currentStep,
      output: state.result || state.error || 'Task completed',
      history: state.history,
    };
  }

  private extractTargetApp(task: string): string {
    const taskLower = task.toLowerCase();
    const appKeywords: Record<string, string[]> = {
      'whatsapp': ['whatsapp'],
      'notepad': ['notepad', 'text editor'],
      'apple music': ['apple music', 'music'],
      'spotify': ['spotify'],
      'calculator': ['calculator', 'calc'],
    };

    for (const [app, keywords] of Object.entries(appKeywords)) {
      if (keywords.some(kw => taskLower.includes(kw))) {
        return app;
      }
    }
    return '';
  }

  // === NODE 1: Extract UI ===
  private async nodeExtractUI(state: AgentState): Promise<AgentState> {
    try {
      const elements = await this.uiExtractor.extract();
      state.uiElements = elements;

      const screenshot = await this.uiExtractor.takeScreenshot();
      if (screenshot) {
        if (state.currentStep <= 1) {
          state.screenshotBefore = screenshot;
        } else {
          state.screenshotBefore = state.screenshotAfter || screenshot;
          state.screenshotAfter = screenshot;
        }
        this.logger.info(`[NODE extract_ui] Screenshot: ${screenshot.length} bytes`);
      }

      const uiDesc = this.uiExtractor.describeUI(elements);
      this.logger.info(`[NODE extract_ui] Elements: ${elements.length}, Desc: ${uiDesc.substring(0, 200)}`);
    } catch (error) {
      this.logger.warn(`[NODE extract_ui] Error: ${error}`);
    }
    return state;
  }

  // === NODE 2: Reason - LLM decides structured action ===
  private async nodeReason(state: AgentState): Promise<AgentState> {
    const uiDescription = this.uiExtractor.describeUI(state.uiElements);

    const historyStr = state.history.length > 0
      ? state.history.map(h =>
          `  Step ${h.step}: ${h.actionType}(${JSON.stringify(h.actionParams)}) - ${h.success ? 'OK' : 'FAIL'} | verify: ${h.verifyResult}`
        ).join('\n')
      : '  (no previous actions)';

    const prompt = `You are a desktop automation agent. Given a task and current UI state, decide the next action.

TASK: ${state.task}
TARGET APP: ${state.targetApp || 'any'}
STEP: ${state.currentStep}/${state.maxSteps}

PREVIOUS ACTIONS:
${historyStr}

CURRENT UI:
${uiDescription}

Available actions:
1. {"type": "click", "params": {"x": <number>, "y": <number>}, "reasoning": "why"}
   - Click at screen coordinates. Use center coordinates from UI elements.
2. {"type": "type", "params": {"text": "text to type"}, "reasoning": "why"}
   - Type text at current focus position. Use for search queries, form fields.
3. {"type": "keypress", "params": {"key": "keyname"}, "reasoning": "why"}
   - Press a special key. Options: Enter, Tab, Escape, Down, Up, Left, Right, F5
4. {"type": "scroll", "params": {"delta": <number>}, "reasoning": "why"}
   - Scroll. Positive = down, negative = up. Use 120 for one scroll tick.
5. {"type": "wait", "params": {"seconds": <number>}, "reasoning": "why"}
   - Wait for UI to load or animation to finish. Default 1-2 seconds.
6. {"type": "done", "params": {"result": "summary"}, "reasoning": "why"}
   - ONLY when the task is COMPLETED. Summarize what was accomplished.

RULES:
- Be precise with coordinates. Use element center (x + width/2, y + height/2).
- For search: type the query text directly, then keypress Enter.
- For clicking buttons: find the button in UI elements list and use its center coordinates.
- If UI shows no elements, try common keyboard shortcuts (Ctrl+F for search, etc.).
- DO NOT mark done unless the task is genuinely complete.
- Prefer keyboard navigation (Tab, Enter) over absolute coordinates when unsure.

Respond with ONLY valid JSON:
{"type": "...", "params": {...}, "reasoning": "..."}`;

    try {
      const response = await this.nvidiaClient.chat({
        model: 'meta/llama-3.3-70b-instruct',
        messages: [{ role: 'user', content: prompt }],
        temperature: 0.3,
        max_tokens: 300,
      });

      const content = response.choices[0]?.message?.content || '';
      const jsonMatch = content.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        state.result = jsonMatch[0];
        const parsed = JSON.parse(jsonMatch[0]);
        this.logger.info(`[NODE reason] Action: ${parsed.type} -> ${JSON.stringify(parsed.params)} (${parsed.reasoning})`);
      } else {
        state.result = JSON.stringify({ type: 'wait', params: { seconds: 1 }, reasoning: 'Failed to parse structured output, waiting' });
      }
    } catch (error) {
      this.logger.error(`[NODE reason] Error: ${error}`);
      state.result = JSON.stringify({ type: 'wait', params: { seconds: 1 }, reasoning: `LLM error: ${error}, waiting` });
    }

    return state;
  }

  private parseAction(result: string): AgentAction | null {
    try {
      const parsed = JSON.parse(result);
      const validTypes = ['click', 'type', 'keypress', 'scroll', 'wait', 'done'];
      if (!validTypes.includes(parsed.type)) {
        this.logger.warn(`[LangGraph] Unknown action type: ${parsed.type}`);
        return null;
      }
      return {
        type: parsed.type as AgentAction['type'],
        params: parsed.params || {},
        reasoning: parsed.reasoning || '',
      };
    } catch {
      return null;
    }
  }

  // === NODE 3: Execute action via PowerShell ===
  private async nodeExecute(state: AgentState, action: AgentAction): Promise<AgentState> {
    const record: ActionRecord = {
      step: state.currentStep,
      action: `${action.type} ${JSON.stringify(action.params)}`,
      actionType: action.type,
      actionParams: action.params,
      reasoning: action.reasoning,
      success: false,
      verifyResult: '',
    };

    try {
      switch (action.type) {
        case 'click':
          this.execClick(action.params.x as number, action.params.y as number);
          record.success = true;
          break;

        case 'type':
          this.execType(action.params.text as string);
          record.success = true;
          break;

        case 'keypress':
          this.execKeypress(action.params.key as string);
          record.success = true;
          break;

        case 'scroll':
          this.execScroll(action.params.delta as number);
          record.success = true;
          break;

        case 'wait':
          const seconds = (action.params.seconds as number) || 1;
          await new Promise(r => setTimeout(r, seconds * 1000));
          record.success = true;
          break;

        case 'done':
          state.isComplete = true;
          state.result = (action.params.result as string) || 'Task completed';
          record.success = true;
          break;
      }

      state.previousAction = `${action.type}:${JSON.stringify(action.params)}`;
    } catch (error) {
      record.success = false;
      state.error = `Execute failed: ${error}`;
      this.logger.error(`[NODE execute] ${action.type} error: ${error}`);
    }

    state.history.push(record);
    return state;
  }

  private execClick(x: number, y: number): void {
    const ps = `
Add-Type -AssemblyName System.Windows.Forms
[System.Windows.Forms.Cursor]::Position = New-Object System.Drawing.Point(${Math.round(x)}, ${Math.round(y)})
[System.Windows.Forms.Mouse]::Event(0x0002)
[System.Windows.Forms.Mouse]::Event(0x0004)
`;
    execSync(
      `powershell -NoProfile -NonInteractive -Command "${ps.replace(/"/g, '\\"').replace(/\r?\n/g, ' ')}"`,
      { stdio: 'ignore', timeout: 5000 }
    );
  }

  private execType(text: string): void {
    const escaped = text.replace(/'/g, "''");
    const ps = `
Add-Type -AssemblyName System.Windows.Forms
[System.Windows.Forms.SendKeys]::SendWait('${escaped}')
`;
    execSync(
      `powershell -NoProfile -NonInteractive -Command "${ps.replace(/"/g, '\\"').replace(/\r?\n/g, ' ')}"`,
      { stdio: 'ignore', timeout: 5000 }
    );
  }

  private execKeypress(key: string): void {
    const keyMap: Record<string, string> = {
      'enter': '{ENTER}',
      'tab': '{TAB}',
      'escape': '{ESC}',
      'esc': '{ESC}',
      'down': '{DOWN}',
      'up': '{UP}',
      'left': '{LEFT}',
      'right': '{RIGHT}',
      'backspace': '{BACKSPACE}',
      'delete': '{DELETE}',
      'f5': '{F5}',
      'ctrl+f': '^f',
      'ctrl+c': '^c',
      'ctrl+v': '^v',
      'ctrl+a': '^a',
      'ctrl+s': '^s',
    };

    const sendKey = keyMap[key.toLowerCase()] || key;
    const ps = `
Add-Type -AssemblyName System.Windows.Forms
[System.Windows.Forms.SendKeys]::SendWait('${sendKey.replace(/'/g, "''")}')
`;
    execSync(
      `powershell -NoProfile -NonInteractive -Command "${ps.replace(/"/g, '\\"').replace(/\r?\n/g, ' ')}"`,
      { stdio: 'ignore', timeout: 5000 }
    );
  }

  private execScroll(delta: number): void {
    const dir = delta >= 0 ? '{DOWN}' : '{UP}';
    const count = Math.min(Math.max(Math.abs(Math.round((delta || 120) / 120)), 1), 20);
    const ps = `
Add-Type -AssemblyName System.Windows.Forms
${Array(count).fill(`[System.Windows.Forms.SendKeys]::SendWait('${dir}')`).join('\n')}
`;
    execSync(
      `powershell -NoProfile -NonInteractive -Command "${ps.replace(/"/g, '\\"').replace(/\r?\n/g, ' ')}"`,
      { stdio: 'ignore', timeout: 5000 }
    );
  }

  // === NODE 4: Verify ===
  private async nodeVerify(state: AgentState): Promise<AgentState> {
    const lastAction = state.history[state.history.length - 1];
    if (!lastAction) return state;

    try {
      const afterScreenshot = await this.uiExtractor.takeScreenshot();
      if (afterScreenshot) {
        state.screenshotAfter = afterScreenshot;
      }

      const afterElements = await this.uiExtractor.extract();
      const uiDesc = this.uiExtractor.describeUI(afterElements);

      const prompt = `Verify if the desktop automation task is complete.

TASK: ${state.task}
JUST EXECUTED: ${lastAction.actionType}(${JSON.stringify(lastAction.actionParams)})
REASONING: ${lastAction.reasoning}

CURRENT UI STATE AFTER ACTION:
${uiDesc}

Respond with ONLY a JSON object:
{
  "complete": false,
  "progress": "what changed or progressed",
  "next_hint": "what to try next"
}

- "complete": true ONLY if the original task is fully achieved
- "progress": describe what happened or changed
- "next_hint": suggestion for next action if not complete`;

      const response = await this.nvidiaClient.chat({
        model: 'meta/llama-3.3-70b-instruct',
        messages: [{ role: 'user', content: prompt }],
        temperature: 0.1,
        max_tokens: 150,
      });

      const content = response.choices[0]?.message?.content || '';
      const jsonMatch = content.match(/\{[\s\S]*\}/);

      if (jsonMatch) {
        const verification = JSON.parse(jsonMatch[0]);
        const wasComplete = state.isComplete;
        state.isComplete = verification.complete === true;

        lastAction.verifyResult = verification.progress || 'unknown';

        this.logger.info(`[NODE verify] Complete: ${state.isComplete}, Progress: ${verification.progress}`);

        if (state.isComplete && !wasComplete) {
          state.result = `Task completed at step ${state.currentStep}: ${verification.progress}`;
        }
      } else {
        lastAction.verifyResult = 'Verification LLM returned non-JSON';
      }

      state.uiElements = afterElements;
    } catch (error) {
      this.logger.warn(`[NODE verify] Error: ${error}`);
      lastAction.verifyResult = `Verify error: ${error}`;
    }

    return state;
  }
}
