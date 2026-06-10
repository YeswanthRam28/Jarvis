import { v4 as uuidv4 } from 'uuid';
import { ModelRouter } from '../ai/model_router';
import { ProfileManager } from '../context/profile_manager';
import { ContextStore, IntentGraph, Intent } from '../pipeline/context_store';
import { Logger } from '../utils/logger';
import { NVIDIAAPIClient, ChatMessage } from '../ai/nvidia_client';

export interface ParsedIntent {
  id: string;
  action: string;
  subject: string;
  filters?: Record<string, unknown>;
  output_label: string;
  depends_on?: string[];
  channel?: string;
  recipient?: string;
  content_template?: string;
}

export interface IntentParseResult {
  success: boolean;
  intentGraph?: IntentGraph;
  clarificationQuestion?: string;
  error?: string;
}

const ACTION_TYPES = [
  'WEB_SCRAPE',
  'WEB_SEARCH',
  'FORM_FILL',
  'FILE_OPERATION',
  'FILE_READ',
  'FILE_WRITE',
  'FILE_DELETE',
  'EMAIL',
  'WHATSAPP',
  'CALENDAR',
  'TERMINAL_CMD',
  'APP_CONTROL',
  'SCREENSHOT',
  'CODE',
  'NOTIFY',
  'REMIND',
  'CALCULATE',
  'CLIPBOARD',
  'WEATHER',
  'PAYMENT',
  'BROWSER_AUTOMATE',
  'DESKTOP_AI_AUTOMATE',
];

const SYSTEM_PROMPT = `You are an intent parser for JARVIS, an autonomous desktop agent.

Your task is to analyze user commands and convert them into structured intents.

## Output Format
Respond with ONLY valid JSON matching this schema:
{
  "intents": [
    {
      "id": "intent_001",
      "action": "ACTION_TYPE",
      "subject": "what the action operates on",
      "filters": {"key": "value"},
      "output_label": "unique_label",
      "depends_on": ["intent_001"],
      "channel": "whatsapp",
      "recipient": "Mom",
      "content_template": "message with {{variables}}"
    }
  ],
  "needs_clarification": false,
  "clarification_question": null
}

## Action Types
- WEB_SCRAPE: Extract data from websites
- WEB_SEARCH: Search the web for information
- WEATHER: Get weather information - automatically creates 2-step: first SEARCH, then extract content from results
- PAYMENT: Process payments or subscriptions - creates multi-step: verify details, confirm, execute
- FORM_FILL: Fill and submit web forms
- FILE_OPERATION: Generic file operations
- FILE_READ: Read file contents
- FILE_WRITE: Write content to files
- FILE_DELETE: Delete files
- EMAIL: Send or read emails
- WHATSAPP: Send WhatsApp messages
- CALENDAR: Calendar operations
- TERMINAL_CMD: Run shell commands
- APP_CONTROL: Open a desktop application (use for simple open-only commands)
- DESKTOP_AI_AUTOMATE: AI-powered multi-step desktop automation (use when user wants to open an app AND do actions inside it like clicking, typing, searching)
- SCREENSHOT: Take screenshots
- BROWSER_AUTOMATE: AI-powered browser automation for complex web tasks (login, signup, multi-step workflows)
- CODE: Execute code
- NOTIFY: Send notifications
- REMIND: Set reminders
- CALCULATE: Perform calculations
- CLIPBOARD: Clipboard operations

## Rules
1. Split compound commands into separate intents with proper dependencies
2. Use depends_on to indicate execution order (e.g., FORM_FILL depends on WEB_SCRAPE)
3. If the user mentions implicit references like "those", "it", use context from previous intents
4. Extract specific entities: URLs, filenames, dates, contacts, search queries
5. Infer missing steps (e.g., "apply" implies "find the form first")
6. Set output_label to a unique identifier for referencing results in later intents
7. Set needs_clarification=true ONLY if the command is truly ambiguous and you need exactly ONE piece of information
8. Keep the subject concise and clear

## Examples

Input: "search for python jobs on linkedin"
Output: {"intents":[{"id":"intent_001","action":"WEB_SEARCH","subject":"python jobs","filters":{"site":"linkedin"},"output_label":"job_search_results"}],"needs_clarification":false}

Input: "scrape internships, apply to my favorites, and whatsapp mom"
Output: {"intents":[
  {"id":"intent_001","action":"WEB_SCRAPE","subject":"internships","filters":{"sites":["linkedin","internshala"]},"output_label":"internship_list"},
  {"id":"intent_002","action":"WEB_SEARCH","subject":"internship applications","filters":{"favorites":"user.preferences.internship_favourites"},"output_label":"filtered_internships","depends_on":["intent_001"]},
  {"id":"intent_003","action":"FORM_FILL","subject":"internship applications","output_label":"application_results","depends_on":["intent_002"]},
  {"id":"intent_004","action":"WHATSAPP","subject":"internship applications","recipient":"Mom","content_template":"Applied to: {{application_results.names}}","depends_on":["intent_003"]}
],"needs_clarification":false}

Input: "open that file"
Output: {"intents":[],"needs_clarification":true,"clarification_question":"Which file would you like me to open?"}

Input: "what's tomorrow's weather in Vellore"
Output: {"intents":[{"id":"intent_001","action":"WEATHER","subject":"tomorrow's weather","filters":{"location":"Vellore","day":"tomorrow"},"output_label":"weather_info"}],"needs_clarification":false}

Input: "subscribe to netflix using my card"
Output: {"intents":[
  {"id":"intent_001","action":"WEB_SEARCH","subject":"netflix subscription plans","filters":{"site":"netflix.com"},"output_label":"netflix_plans"},
  {"id":"intent_002","action":"PAYMENT","subject":"netflix subscription","filters":{"plan":"selected","payment_method":"user.card"},"output_label":"payment_result","depends_on":["intent_001"]}
],"needs_clarification":false}

Input: "send tomorrow's weather to mom via email"
Output: {"intents":[
  {"id":"intent_001","action":"WEATHER","subject":"tomorrow's weather","filters":{"location":"current"},"output_label":"weather_info"},
  {"id":"intent_002","action":"EMAIL","subject":"weather update","recipient":"Mom","content_template":"Tomorrow's weather: {{weather_info.temp}}, {{weather_info.condition}}","depends_on":["intent_001"]}
],"needs_clarification":false}

Input: "login to my github account"
Output: {"intents":[{"id":"intent_001","action":"BROWSER_AUTOMATE","subject":"github login","filters":{"goal":"login to github","context":"user credentials from profile"},"output_label":"github_login"}],"needs_clarification":false}

Input: "create account on netflix"
Output: {"intents":[{"id":"intent_001","action":"BROWSER_AUTOMATE","subject":"netflix signup","filters":{"goal":"create new netflix account"},"output_label":"netflix_signup"}],"needs_clarification":false}

Input: "open epic games and click fortnite"
Output: {"intents":[{"id":"intent_001","action":"DESKTOP_AI_AUTOMATE","subject":"open epic games and click fortnite","output_label":"fortnite_launch"}],"needs_clarification":false}

Input: "open spotify and search for lofi beats"
Output: {"intents":[{"id":"intent_001","action":"DESKTOP_AI_AUTOMATE","subject":"open spotify and search for lofi beats","output_label":"spotify_search"}],"needs_clarification":false}`;

export class IntentParser {
  private static instance: IntentParser;
  private modelRouter: ModelRouter;
  private profileManager: ProfileManager;
  private contextStore: ContextStore;
  private nvidiaClient: NVIDIAAPIClient;
  private logger: Logger;

  private constructor() {
    this.modelRouter = ModelRouter.getInstance();
    this.profileManager = ProfileManager.getInstance();
    this.contextStore = ContextStore.getInstance();
    this.nvidiaClient = NVIDIAAPIClient.getInstance();
    this.logger = Logger.getInstance();
  }

  public static getInstance(): IntentParser {
    if (!IntentParser.instance) {
      IntentParser.instance = new IntentParser();
    }
    return IntentParser.instance;
  }

  public async parse(userInput: string, ragContext?: string): Promise<IntentParseResult> {
    this.logger.info(`Parsing intent for: "${userInput}"`);

    try {
      const profile = this.profileManager.getProfile();
      const contextMessages = this.buildContextMessages(profile, userInput, ragContext);

      const response = await this.nvidiaClient.chat({
        model: this.modelRouter.getModelForStage('intent_parser'),
        messages: contextMessages,
        temperature: 0.3,
        max_tokens: 2048,
      });

      const content = response.choices[0]?.message?.content;
      if (!content) {
        return { success: false, error: 'No response from model' };
      }

      const parsed = this.parseResponse(content);

      if (parsed.needs_clarification) {
        return {
          success: true,
          clarificationQuestion:
            parsed.clarification_question || 'Could you clarify what you mean?',
        };
      }

      const session = this.contextStore.getSession();
      const intentGraph: IntentGraph = {
        session_id: session?.session_id || uuidv4(),
        raw_input: userInput,
        intents: parsed.intents,
        user_context: {
          preferences_loaded: true,
          profile_used: this.extractProfileUsage(parsed.intents),
        },
      };

      this.logger.info(`Parsed ${intentGraph.intents.length} intents`);
      return { success: true, intentGraph };
    } catch (error) {
      this.logger.error(`Intent parsing failed: ${error}`);
      return { success: false, error: String(error) };
    }
  }

  private buildContextMessages(
    profile: ReturnType<ProfileManager['getProfile']>,
    userInput: string,
    ragContext?: string
  ): ChatMessage[] {
    const messages: ChatMessage[] = [{ role: 'system', content: SYSTEM_PROMPT }];

    const contextParts: string[] = [];

    if (profile.identity.name) {
      contextParts.push(`User name: ${profile.identity.name}`);
    }

    if (profile.contacts && Object.keys(profile.contacts).length > 0) {
      const contactNames = Object.keys(profile.contacts);
      contextParts.push(`Known contacts: ${contactNames.join(', ')}`);
    }

    if (profile.preferences.internship_favourites?.length) {
      contextParts.push(
        `Favorite companies: ${profile.preferences.internship_favourites.join(', ')}`
      );
    }

    if (profile.preferences.internship_fields?.length) {
      contextParts.push(`Interested fields: ${profile.preferences.internship_fields.join(', ')}`);
    }

    if (ragContext) {
      contextParts.push(`\nRetrieved Relevant Memories:\n${ragContext}`);
    }

    if (contextParts.length > 0) {
      messages.push({
        role: 'system',
        content: `User context:\n${contextParts.join('\n')}`,
      });
    }

    messages.push({ role: 'user', content: userInput });

    return messages;
  }

  private parseResponse(content: string): {
    intents: Intent[];
    needs_clarification: boolean;
    clarification_question: string | null;
  } {
    try {
      const jsonMatch =
        content.match(/```(?:json)?\s*([\s\S]*?)```/) || content.match(/\{[\s\S]*\}/);

      if (!jsonMatch) {
        this.logger.warn('No JSON found in response');
        return {
          intents: [],
          needs_clarification: true,
          clarification_question: "I couldn't understand that. Could you rephrase your command?",
        };
      }

      const jsonStr = jsonMatch[1] || jsonMatch[0];
      const parsed = JSON.parse(jsonStr);

      return {
        intents: (parsed.intents || []).map((intent: Partial<ParsedIntent>) =>
          this.normalizeIntent(intent)
        ),
        needs_clarification: parsed.needs_clarification || false,
        clarification_question: parsed.clarification_question || null,
      };
    } catch (error) {
      this.logger.error(`Failed to parse response: ${error}`);
      return {
        intents: [],
        needs_clarification: true,
        clarification_question: 'I had trouble understanding that. Could you rephrase?',
      };
    }
  }

  private normalizeIntent(raw: Partial<ParsedIntent>): Intent {
    return {
      id: raw.id || `intent_${uuidv4().slice(0, 8)}`,
      action: this.normalizeAction(raw.action),
      subject: raw.subject || 'unknown',
      filters: raw.filters || {},
      output_label: raw.output_label || `output_${Date.now()}`,
      depends_on: raw.depends_on || undefined,
      channel: raw.channel,
      recipient: raw.recipient,
      content_template: raw.content_template,
    };
  }

  private normalizeAction(action: string | undefined): string {
    if (!action) return 'UNKNOWN';

    const normalized = action.toUpperCase().replace(/[\s-_]/g, '_');

    for (const validAction of ACTION_TYPES) {
      if (normalized.includes(validAction) || validAction.includes(normalized)) {
        return validAction;
      }
    }

    if (normalized.includes('WEB') && normalized.includes('SEARCH')) {
      return 'WEB_SEARCH';
    }
    if (normalized.includes('WEB') && normalized.includes('SCRAPE')) {
      return 'WEB_SCRAPE';
    }
    if (normalized.includes('FILE') && normalized.includes('READ')) {
      return 'FILE_READ';
    }
    if (normalized.includes('FILE') && normalized.includes('WRITE')) {
      return 'FILE_WRITE';
    }
    if (normalized.includes('FILE') && normalized.includes('DELETE')) {
      return 'FILE_DELETE';
    }
    if (normalized.includes('EMAIL') || normalized.includes('MAIL')) {
      return 'EMAIL';
    }
    if (normalized.includes('WHATSAPP') || normalized.includes('MESSAGE')) {
      return 'WHATSAPP';
    }
    if (normalized.includes('CALENDAR') || normalized.includes('EVENT')) {
      return 'CALENDAR';
    }
    if (
      normalized.includes('TERMINAL') ||
      normalized.includes('SHELL') ||
      normalized.includes('CMD')
    ) {
      return 'TERMINAL_CMD';
    }
    if (normalized.includes('NOTIFY') || normalized.includes('NOTIFICATION')) {
      return 'NOTIFY';
    }
    if (normalized.includes('REMIND')) {
      return 'REMIND';
    }

    return normalized;
  }

  private extractProfileUsage(intents: Intent[]): string[] {
    const used: string[] = [];

    for (const intent of intents) {
      if (intent.filters) {
        const filtersStr = JSON.stringify(intent.filters);
        if (filtersStr.includes('user.preferences')) used.push('preferences');
        if (filtersStr.includes('contacts')) used.push('contacts');
        if (filtersStr.includes('resume')) used.push('resume_profile');
      }
    }

    return [...new Set(used)];
  }

  public async parseWithHistory(
    userInput: string,
    history: ChatMessage[]
  ): Promise<IntentParseResult> {
    this.logger.info(`Parsing intent with history for: "${userInput}"`);

    try {
      const profile = this.profileManager.getProfile();

      const messages: ChatMessage[] = [{ role: 'system', content: SYSTEM_PROMPT }];

      if (profile.identity.name) {
        messages.push({
          role: 'system',
          content: `User name: ${profile.identity.name}`,
        });
      }

      messages.push(...history);
      messages.push({ role: 'user', content: userInput });

      const response = await this.nvidiaClient.chat({
        model: this.modelRouter.getModelForStage('intent_parser'),
        messages,
        temperature: 0.3,
        max_tokens: 2048,
      });

      const content = response.choices[0]?.message?.content;
      if (!content) {
        return { success: false, error: 'No response from model' };
      }

      const parsed = this.parseResponse(content);

      if (parsed.needs_clarification) {
        return {
          success: true,
          clarificationQuestion:
            parsed.clarification_question || 'Could you clarify what you mean?',
        };
      }

      const session = this.contextStore.getSession();
      const intentGraph: IntentGraph = {
        session_id: session?.session_id || uuidv4(),
        raw_input: userInput,
        intents: parsed.intents,
        user_context: {
          preferences_loaded: true,
          profile_used: this.extractProfileUsage(parsed.intents),
        },
      };

      return { success: true, intentGraph };
    } catch (error) {
      this.logger.error(`Intent parsing with history failed: ${error}`);
      return { success: false, error: String(error) };
    }
  }
}
