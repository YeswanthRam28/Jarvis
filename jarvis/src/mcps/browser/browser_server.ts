import {
  MCPRequest,
  MCPResponse,
  MCPTool,
  MCP_ERROR_CODES,
  createMCPResponse,
  createMCPError,
} from '../types';
import { chromium, Browser, Page } from 'playwright';

export interface BrowserState {
  browser: Browser | null;
  page: Page | null;
  context: string;
  lastUrl: string;
}

export class BrowserServer {
  private state: BrowserState;
  private tools: MCPTool[];
  private headless: boolean;
  private userDataDir: string | null;
  private useCDP: boolean;
  private cdpEndpoint: string;

  constructor(options: { headless?: boolean; userDataDir?: string; useCDP?: boolean; cdpEndpoint?: string } = {}) {
    this.headless = options.headless ?? false;
    this.userDataDir = options.userDataDir || null;
    this.useCDP = options.useCDP ?? false;
    this.cdpEndpoint = options.cdpEndpoint || 'http://localhost:9222';
    this.state = {
      browser: null,
      page: null,
      context: '',
      lastUrl: '',
    };
    this.tools = this.defineTools();
  }

  private defineTools(): MCPTool[] {
    return [
      {
        name: 'automate',
        description:
          'AI-powered browser automation. Give a goal like "login to facebook" or "signup for netflix" - AI analyzes page, decides actions (click, type, scroll), and executes until goal is reached',
        inputSchema: {
          type: 'object',
          properties: {
            goal: {
              type: 'string',
              description:
                'What you want to achieve (e.g., "login to facebook", "create new account on github", "subscribe to premium")',
            },
            max_steps: { type: 'number', description: 'Max actions to take', default: 10 },
            context: {
              type: 'string',
              description: 'Any additional context (credentials, preferences)',
            },
          },
          required: ['goal'],
        },
      },
      {
        name: 'navigate',
        description: 'Navigate to a URL in the browser',
        inputSchema: {
          type: 'object',
          properties: {
            url: { type: 'string', description: 'The URL to navigate to' },
            wait_until: {
              type: 'string',
              description: 'Wait until: load, domcontentloaded, networkidle',
              default: 'load',
            },
          },
          required: ['url'],
        },
      },
      {
        name: 'search',
        description: 'Search the web using a search engine',
        inputSchema: {
          type: 'object',
          properties: {
            query: { type: 'string', description: 'Search query' },
            engine: {
              type: 'string',
              description: 'Search engine (google, bing, duckduckgo)',
              default: 'google',
            },
            fetch_content: {
              type: 'boolean',
              description: 'Also fetch content from result pages',
              default: true,
            },
            max_results: { type: 'number', description: 'Max number of results', default: 5 },
          },
          required: ['query'],
        },
      },
      {
        name: 'fetch',
        description: 'Navigate to URL and extract main content',
        inputSchema: {
          type: 'object',
          properties: {
            url: { type: 'string', description: 'URL to fetch' },
            max_length: { type: 'number', description: 'Max characters to extract', default: 5000 },
          },
          required: ['url'],
        },
      },
      {
        name: 'navigate_and_extract',
        description: 'Navigate to URL and extract content',
        inputSchema: {
          type: 'object',
          properties: {
            url: { type: 'string', description: 'URL to navigate to' },
            max_length: { type: 'number', description: 'Max characters to extract', default: 5000 },
          },
          required: ['url'],
        },
      },
      {
        name: 'extract',
        description: 'Extract content from the current page',
        inputSchema: {
          type: 'object',
          properties: {
            selector: { type: 'string', description: 'CSS selector to extract' },
            attribute: {
              type: 'string',
              description: 'Attribute to extract (text, href, src, etc.)',
            },
            all: { type: 'boolean', description: 'Extract all matches', default: false },
          },
        },
      },
      {
        name: 'fill_form',
        description: 'Fill form fields on the page',
        inputSchema: {
          type: 'object',
          properties: {
            fields: {
              type: 'object',
              description: 'Object with selector: value pairs',
            },
          },
          required: ['fields'],
        },
      },
      {
        name: 'submit',
        description: 'Submit a form',
        inputSchema: {
          type: 'object',
          properties: {
            selector: { type: 'string', description: 'Form or button selector' },
          },
        },
      },
      {
        name: 'click',
        description: 'Click an element on the page',
        inputSchema: {
          type: 'object',
          properties: {
            selector: { type: 'string', description: 'Element selector' },
            timeout: { type: 'number', description: 'Timeout in ms', default: 5000 },
          },
          required: ['selector'],
        },
      },
      {
        name: 'type',
        description: 'Type text into an element',
        inputSchema: {
          type: 'object',
          properties: {
            selector: { type: 'string', description: 'Element selector' },
            text: { type: 'string', description: 'Text to type' },
            delay: { type: 'number', description: 'Delay between keystrokes in ms', default: 0 },
          },
          required: ['selector', 'text'],
        },
      },
      {
        name: 'screenshot',
        description: 'Take a screenshot of the current page',
        inputSchema: {
          type: 'object',
          properties: {
            path: { type: 'string', description: 'Path to save screenshot' },
            full_page: { type: 'boolean', description: 'Capture full page', default: false },
          },
        },
      },
      {
        name: 'get_text',
        description: 'Get text content from an element',
        inputSchema: {
          type: 'object',
          properties: {
            selector: { type: 'string', description: 'Element selector' },
          },
          required: ['selector'],
        },
      },
      {
        name: 'get_attribute',
        description: 'Get attribute value from an element',
        inputSchema: {
          type: 'object',
          properties: {
            selector: { type: 'string', description: 'Element selector' },
            attribute: { type: 'string', description: 'Attribute name' },
          },
          required: ['selector', 'attribute'],
        },
      },
      {
        name: 'wait_for_selector',
        description: 'Wait for an element to appear',
        inputSchema: {
          type: 'object',
          properties: {
            selector: { type: 'string', description: 'Element selector' },
            timeout: { type: 'number', description: 'Timeout in ms', default: 30000 },
          },
          required: ['selector'],
        },
      },
      {
        name: 'scroll',
        description: 'Scroll the page or an element',
        inputSchema: {
          type: 'object',
          properties: {
            selector: { type: 'string', description: 'Element selector (optional)' },
            x: { type: 'number', description: 'X offset' },
            y: { type: 'number', description: 'Y offset' },
          },
        },
      },
      {
        name: 'close',
        description: 'Close the browser',
        inputSchema: {
          type: 'object',
          properties: {},
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
            serverInfo: { name: 'mcp-browser', version: '1.0.0' },
          });

        default:
          return createMCPError(id, MCP_ERROR_CODES.METHOD_NOT_FOUND, `Unknown method: ${method}`);
      }
    } catch (error) {
      return createMCPError(id, MCP_ERROR_CODES.INTERNAL_ERROR, `Internal error: ${error}`);
    }
  }

  private async ensureBrowser(): Promise<void> {
    if (!this.state.browser) {
      // Try CDP connection first if enabled
      if (this.useCDP) {
        try {
          process.stderr.write('[BROWSER] Attempting CDP connection to: ' + this.cdpEndpoint + '\n');
          const { chromium } = await import('playwright');
          
          const browserWSEndpoint = await this.findCDPEndpoint();
          if (browserWSEndpoint) {
            this.state.browser = await chromium.connectOverCDP(browserWSEndpoint);
            // Get existing contexts instead of creating new ones
            const existingContexts = this.state.browser.contexts();
            if (existingContexts.length > 0) {
              const context = existingContexts[0];
              const pages = context.pages();
              if (pages.length > 0) {
                this.state.page = pages[0];
                process.stderr.write('[BROWSER] Attached to existing CDP page - session preserved!\n');
                return;
              }
            }
            // Fallback: create new page if no existing
            this.state.page = await this.state.browser.newPage();
            process.stderr.write('[BROWSER] Connected via CDP - session may not be preserved\n');
            return;
          }
        } catch (e) {
          process.stderr.write('[BROWSER] CDP connection failed: ' + (e instanceof Error ? e.message : String(e)) + '\n');
          process.stderr.write('[BROWSER] Falling back to standard launch\n');
        }
      }
      
      if (this.userDataDir && this.userDataDir !== 'default') {
        try {
          const { chromium } = await import('playwright');
          
          // Use persistent context with better options
          const context = await chromium.launchPersistentContext(this.userDataDir, {
            headless: this.headless,
            channel: 'msedge',
            viewport: { width: 1280, height: 720 },
            ignoreDefaultArgs: ['--enable-automation'],
            args: ['--disable-blink-features=AutomationControlled'],
          });
          
          this.state.page = context.pages()[0] || await context.newPage();
          
          // Anti-detection: remove automation properties
          await this.state.page.addInitScript(() => {
            // Remove webdriver property
            Object.defineProperty(navigator, 'webdriver', { get: () => undefined });
            
            // Override plugins
            Object.defineProperty(navigator, 'plugins', {
              get: () => [1, 2, 3, 4, 5]
            });
            
            // Override languages
            Object.defineProperty(navigator, 'languages', {
              get: () => ['en-US', 'en']
            });
            
            // Remove Chrome runtime
            if ((window as any).chrome) {
              (window as any).chrome.runtime = undefined;
            }
            
            // Add fake chrome object
            if (!(window as any).chrome) {
              (window as any).chrome = { runtime: {} };
            }
          });
          
          process.stderr.write('[BROWSER] Using Edge profile with stealth mode\n');
          this.state.browser = context.browser();
          return;
        } catch (e) {
          process.stderr.write('[BROWSER] Persistent context failed: ' + (e instanceof Error ? e.message : String(e)) + '\n');
        }
      }
      
      this.state.browser = await chromium.launch({ 
        headless: this.headless,
        channel: 'msedge'
      });
      this.state.page = await this.state.browser.newPage();
    }
    if (!this.state.page) {
      this.state.page = await this.state.browser.newPage();
    }
  }

  private async findCDPEndpoint(): Promise<string | null> {
    try {
      const response = await fetch(this.cdpEndpoint + '/json/version');
      const data = await response.json();
      process.stderr.write('[BROWSER] Found CDP endpoint: ' + data.webSocketDebuggerUrl + '\n');
      return data.webSocketDebuggerUrl;
    } catch (e) {
      process.stderr.write('[BROWSER] Failed to get CDP endpoints: ' + (e instanceof Error ? e.message : String(e)) + '\n');
      return null;
    }
  }

  private async getPage(): Promise<Page> {
    await this.ensureBrowser();
    return this.state.page!;
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

    let asyncResult: Promise<unknown>;

    switch (name) {
      case 'automate':
        asyncResult = this.toolAutomate(args);
        break;
      case 'navigate':
        asyncResult = this.toolNavigate(args);
        break;
      case 'search':
        asyncResult = this.toolSearch(args);
        break;
      case 'fetch':
        asyncResult = this.toolFetch(args);
        break;
      case 'navigate_and_extract':
        asyncResult = this.toolFetch(args);
        break;
      case 'extract':
        asyncResult = this.toolExtract(args);
        break;
      case 'fill_form':
        asyncResult = this.toolFillForm(args);
        break;
      case 'submit':
        asyncResult = this.toolSubmit(args);
        break;
      case 'click':
        asyncResult = this.toolClick(args);
        break;
      case 'type':
        asyncResult = this.toolType(args);
        break;
      case 'screenshot':
        asyncResult = this.toolScreenshot(args);
        break;
      case 'get_text':
        asyncResult = this.toolGetText(args);
        break;
      case 'get_attribute':
        asyncResult = this.toolGetAttribute(args);
        break;
      case 'wait_for_selector':
        asyncResult = this.toolWaitForSelector(args);
        break;
      case 'scroll':
        asyncResult = this.toolScroll(args);
        break;
      case 'close':
        asyncResult = this.toolClose();
        break;
      default:
        return createMCPError(id, MCP_ERROR_CODES.METHOD_NOT_FOUND, `Unknown tool: ${name}`);
    }

    try {
      const resolved = await asyncResult;
      console.log('[BROWSER] Tool result:', JSON.stringify(resolved).slice(0, 500));
      return createMCPResponse(id, resolved);
    } catch (err) {
      console.log('[BROWSER] Tool error:', err);
      return createMCPError(id, MCP_ERROR_CODES.INTERNAL_ERROR, String(err));
    }
  }

  private async toolNavigate(args: Record<string, unknown>): Promise<unknown> {
    const page = await this.getPage();
    const url = args.url as string;
    const waitUntil = (args.wait_until as string) || 'load';

    await page.goto(url, { waitUntil: waitUntil as 'load' | 'domcontentloaded' | 'networkidle' });
    this.state.lastUrl = url;

    return { success: true, url, title: await page.title() };
  }

  private async toolAutomate(args: Record<string, unknown>): Promise<unknown> {
    const goal = args.goal as string;
    const maxSteps = (args.max_steps as number) || 15;
    const context = (args.context as string) || '';

    await this.loadCredentials();

    const page = await this.getPage();
    const results: string[] = [];
    const pageSnapshots: string[] = [];
    let stuckCount = 0;
    let emailInfo: { email?: string; subject?: string; body?: string } = {};
    let needsLogin = false;

    process.stderr.write('[AUTOMATE] Starting goal: ' + goal + '\n');

    const targetInfo = this.determineTargetUrl(goal);

    if (targetInfo) {
      emailInfo = { email: targetInfo.email, subject: targetInfo.subject, body: targetInfo.body };
      process.stderr.write('[AUTOMATE] Detected target: ' + targetInfo.url + '\n');
      if (targetInfo.email) {
        process.stderr.write('[AUTOMATE] Email to: ' + targetInfo.email + '\n');
      }
      try {
        // For Gmail, use a direct approach - navigate and wait for load
        if (targetInfo.url.includes('gmail')) {
          // Try direct inbox first
          await page.goto('https://mail.google.com/mail/u/0/', { waitUntil: 'domcontentloaded', timeout: 30000 });
          await page.waitForTimeout(2000);

          // Check if we're at Gmail (may redirect to workspace)
          const currentUrl = page.url();
          process.stderr.write('[AUTOMATE] Gmail navigation result: ' + currentUrl + '\n');

          // Wait for any redirects to complete
          await page.waitForLoadState('networkidle', { timeout: 10000 }).catch(() => {});
        } else {
          await page.goto(targetInfo.url, { waitUntil: 'networkidle', timeout: 30000 });
          await page.waitForTimeout(2000);
        }

        process.stderr.write('[AUTOMATE] Navigated to: ' + page.url() + '\n');
      } catch (e) {
        process.stderr.write('[AUTOMATE] Initial navigation failed: ' + (e instanceof Error ? e.message : String(e)) + '\n');
      }
    }

    for (let step = 0; step < maxSteps; step++) {
      try {
        process.stderr.write('[AUTOMATE] Analyzing page state (step ' + (step + 1) + ')...\n');

        await page.waitForLoadState('networkidle', { timeout: 5000 }).catch(() => {});
        await page.waitForTimeout(1000);

        const isLoading = await page
          .evaluate(() => {
            const loading = document.querySelector('.loading, .spinner, [data-loading="true"]');
            const overlay = document.querySelector('.overlay, .modal.loading');
            return !!(loading || overlay);
          })
          .catch(() => false);

        if (isLoading) {
          process.stderr.write('[AUTOMATE] Page is still loading, waiting...\n');
          await page.waitForTimeout(2000);
          continue;
        }

        const html = await page.content();
        const title = await page.title();
        const url = page.url();

        const pageHash = html.slice(0, 500);
        if (pageSnapshots.includes(pageHash)) {
          stuckCount++;
          process.stderr.write('[AUTOMATE] Page not changing, might be stuck (' + stuckCount + '/3)\n');
          
          if (stuckCount >= 2 && step < maxSteps - 1) {
            process.stderr.write('[AUTOMATE] Trying scroll to break stuck state...\n');
            await page.evaluate(() => window.scrollBy(0, 500));
            await page.waitForTimeout(1500);
            await page.evaluate(() => window.scrollTo(0, 0));
            await page.waitForTimeout(1000);
          }
          
          if (stuckCount >= 3) {
            process.stderr.write('[AUTOMATE] Stuck too long, trying alternative selectors...\n');
            stuckCount = 0;
          }
        } else {
          stuckCount = 0;
        }
        pageSnapshots.push(pageHash);
        if (pageSnapshots.length > 5) pageSnapshots.shift();

        const formFields = await page.evaluate(() => {
          const inputs = document.querySelectorAll('input:not([type="hidden"]), textarea, select');
          const fields: string[] = [];
          inputs.forEach((el: any) => {
            const label =
              document.querySelector(`label[for="${el.id}"], label[for="${el.name}"]`)
                ?.textContent ||
              el.placeholder ||
              el.name ||
              el.type;
            fields.push(`${el.type}:${el.name || el.id || 'unnamed'}:${label || ''}`);
          });
          return fields.slice(0, 20);
        });

        const isLoginPage = await page.evaluate(() => {
          const body = document.body.innerText || '';
          return body.includes('Sign into continue') || 
                 body.includes('Sign in') || 
                 body.includes('Enter your email') ||
                 body.includes('Forgot email') ||
                 document.querySelector('input[type="email"]') !== null ||
                 document.querySelector('input[name="identifier"]') !== null;
        });

        if (isLoginPage && this.credentials && !needsLogin) {
          process.stderr.write('[AUTOMATE] Detected login page - attempting auto-login...\n');
          needsLogin = true;
          
          try {
            const emailInput = await page.$('input[type="email"], input[name="identifier"], input[name="Email"]');
            if (emailInput) {
              await emailInput.fill(this.credentials.email || '');
              await page.waitForTimeout(500);
              
              const nextBtn = await page.$('button[type="submit"], button:has-text("Next"), button:has-text("Continue")');
              if (nextBtn) {
                await nextBtn.click();
                await page.waitForTimeout(2000);
                
                const passInput = await page.$('input[type="password"], input[name="password"], input[name="Passwd"]');
                if (passInput) {
                  await passInput.fill(this.credentials.password || '');
                  await page.waitForTimeout(500);
                  
                  const submitBtn = await page.$('button[type="submit"], button:has-text("Next"), button:has-text("Sign in")');
                  if (submitBtn) {
                    await submitBtn.click();
                    await page.waitForTimeout(3000);
                    process.stderr.write('[AUTOMATE] Auto-login submitted\n');
                  }
                }
              }
            }
          } catch (e) {
            process.stderr.write('[AUTOMATE] Auto-login failed: ' + (e instanceof Error ? e.message : String(e)) + '\n');
          }
          await page.waitForTimeout(2000);
        }

        const buttons = await page.evaluate(() => {
          const btns = document.querySelectorAll(
            'button, a[role="button"], input[type="submit"], a.btn, a.button'
          );
          return Array.from(btns)
            .slice(0, 10)
            .map((b: any) => b.textContent?.trim() || b.value || 'button');
        });

        const visibleText = await page.evaluate(() => document.body.innerText?.slice(0, 500) || '');

        const prompt = `You are a precise, careful browser automation AI. Your job is to analyze the page and make ONE action at a time.

CRITICAL RULES:
1. ALWAYS read the visible text and understand what you see BEFORE deciding
2. Wait for animations/loading to complete - rushing causes failures
3. If you see an error message, report it instead of ignoring it
4. Verify each action worked before moving to the next
5. Use the actual page content, not assumptions

CURRENT STATE:
- URL: ${url}
- Title: ${title}
- Goal: ${goal}
- Context: ${context}
- Step: ${step + 1}/${maxSteps}
- Email target: ${emailInfo.email || 'not specified'}
- Email subject: ${emailInfo.subject || 'not specified'}

PAGE CONTENT (read carefully):
${visibleText.slice(0, 800)}

Form fields: ${formFields.join(', ') || 'none'}
Buttons: ${buttons.join(', ') || 'none'}

ANALYSIS:
1. What is the current page actually showing? (login, compose, search results, etc.)
2. What specific text or elements did you observe?
3. Has the goal already been achieved?
4. What is the ONE next action to take?

IMPORTANT SELECTOR STRATEGY:
- For compose button: "div[gh='cm'], div[aria-label*='Compose'], button[gh*='cm'], a[href*='compose'], div[role='button'][gh*='cm']"
- For email input: "textarea[name='to'], input[name='to'], input[aria-label='To']"
- For subject: "input[name='subject'], input[aria-label='Subject'], input[placeholder*='Subject']"
- For body: "div[contenteditable='true'], div[aria-label*='Message'], textarea[name='message']"
- For send button: "div[aria-label*='Send'], button[aria-label*='Send'], div[gh*='snd']"

Output ONLY valid JSON with your analysis and next action:
{
  "page_analysis": "What you actually see on the page right now",
  "goal_achieved": true/false,
  "action": "click|type|scroll|wait|submit|navigate|done|fail",
  "selector": "specific CSS selector for the element to interact with",
  "value": "text to type (for type action only)",
  "wait_for": "element to wait for (for wait action)",
  "navigate_url": "URL to navigate to (for navigate action)",
  "reason": "Why you chose this action based on what you see",
  "result": "Current status"
}

CRITICAL RULES:
- If goal achieved: set goal_achieved=true and action="done"
- For login: check if already logged in (look for username, profile, logout button)
- For forms: fill ALL required fields before submitting
- If page has errors: set goal_achieved=false, action="fail", result="error message"
- Use exact CSS selectors like "#username", "input[name='email']", "button[type='submit']"
- If stuck (same page repeated): try scrolling or clicking a different element
- Always check for success confirmation before marking done`;

        const aiResponse = await this.callAI(prompt);
        let decision: any;

        try {
          const jsonMatch = aiResponse.match(/\{[\s\S]*\}/);
          if (jsonMatch) {
            decision = JSON.parse(jsonMatch[0]);
          } else {
            throw new Error('No JSON found');
          }
        } catch {
          process.stderr.write('[AUTOMATE] AI response invalid, continuing...\n');
          continue;
        }

        process.stderr.write(
          '[AUTOMATE] Step ' +
            (step + 1) +
            ': ' +
            decision.action +
            ' - ' +
            (decision.reason || '').slice(0, 60) +
            '\n'
        );
        results.push(`Step ${step + 1}: ${decision.action} - ${decision.reason || 'no reason'}`);

        if (decision.goal_achieved || decision.action === 'done') {
          return {
            success: true,
            goal,
            steps_taken: step + 1,
            actions: results,
            result: decision.result || 'Goal completed successfully',
          };
        }

        if (decision.action === 'fail') {
          return {
            success: false,
            goal,
            steps_taken: step + 1,
            actions: results,
            result: decision.result || 'Failed to complete goal',
          };
        }

        const prevUrl = page.url();

        switch (decision.action) {
          case 'click':
            if (decision.selector) {
              try {
                await page.waitForSelector(decision.selector, { timeout: 10000 });
                await page.click(decision.selector, { delay: 100 });
                process.stderr.write('[AUTOMATE] Clicked: ' + decision.selector + '\n');

                // Wait for page to stabilize after click
                await this.waitForPageStable(page, prevUrl);
              } catch (e) {
                process.stderr.write('[AUTOMATE] Click failed, trying fallback...\n');
                try {
                  await this.tryFallbackClick(page, decision.selector);
                  await this.waitForPageStable(page, prevUrl);
                } catch (fallbackError) {
                  process.stderr.write('[AUTOMATE] Click failed: ' + (e instanceof Error ? e.message : String(e)) + '\n');
                }
              }
            }
            break;

          case 'type':
            if (decision.selector && decision.value) {
              try {
                await page.waitForSelector(decision.selector, { timeout: 10000 });
                await page.click(decision.selector);
                await page.waitForTimeout(200);
                await page.fill(decision.selector, decision.value);
                process.stderr.write('[AUTOMATE] Typed "' + String(decision.value).slice(0, 30) + '" in: ' + decision.selector + '\n');

                // Small delay after typing to let content settle
                await page.waitForTimeout(500);
              } catch (e) {
                process.stderr.write('[AUTOMATE] Type failed, trying fallback selectors...\n');
                try {
                  const fallbackResult = await this.tryFallbackType(page, decision.value);
                  if (fallbackResult) {
                    process.stderr.write('[AUTOMATE] Typed using fallback selector\n');
                    await page.waitForTimeout(500);
                  } else {
                    throw e;
                  }
                } catch (fallbackError) {
                  process.stderr.write('[AUTOMATE] Type failed: ' + (e instanceof Error ? e.message : String(e)) + '\n');
                }
              }
            }
            break;

          case 'scroll':
            await page.evaluate(() => window.scrollBy(0, 300));
            process.stderr.write('[AUTOMATE] Scrolled down\n');
            await page.waitForTimeout(800);
            break;

          case 'wait':
            if (decision.wait_for) {
              try {
                await page.waitForSelector(decision.wait_for, { timeout: 10000 });
                process.stderr.write('[AUTOMATE] Waited for: ' + decision.wait_for + '\n');
              } catch {
                process.stderr.write('[AUTOMATE] Element not found, waiting 3s...\n');
                await page.waitForTimeout(3000);
              }
            } else {
              process.stderr.write('[AUTOMATE] Waiting 3s for page to settle...\n');
              await page.waitForTimeout(3000);
            }
            break;

          case 'navigate':
            if (decision.navigate_url) {
              await page.goto(decision.navigate_url, { waitUntil: 'networkidle', timeout: 30000 });
              process.stderr.write('[AUTOMATE] Navigated to: ' + decision.navigate_url + '\n');
              await this.waitForPageStable(page, prevUrl);
            }
            break;

          case 'submit':
            const submitSelectors = [
              'button[type="submit"]',
              'input[type="submit"]',
              'button:has-text("Submit")',
              'button:has-text("Sign")',
              'button:has-text("Log")',
              'button:has-text("Continue")',
              'button:has-text("Next")',
              'button:has-text("Save")',
              'button:has-text("Register")',
              'button:has-text("Create")',
              'a:has-text("Submit")',
              'a:has-text("Sign")',
            ];
            for (const sel of submitSelectors) {
              const btn = await page.$(sel);
              if (btn) {
                await btn.click({ delay: 100 });
                process.stderr.write('[AUTOMATE] Clicked submit button\n');
                await this.waitForPageStable(page, prevUrl);
                break;
              }
            }
            break;
        }

        // Longer delay after any action to let page settle
        await page.waitForTimeout(2000);
      } catch (e) {
        process.stderr.write(
          '[AUTOMATE] Step ' +
            (step + 1) +
            ' error: ' +
            (e instanceof Error ? e.message : String(e)) +
            '\n'
        );
      }
    }

    return {
      success: false,
      goal,
      steps_taken: maxSteps,
      actions: results,
      result: 'Max steps reached. Goal may not be fully completed.',
    };
  }

  private async callAI(prompt: string, timeoutMs: number = 60000): Promise<string> {
    const { NVIDIAAPIClient } = await import('../../ai/nvidia_client');
    const client = NVIDIAAPIClient.getInstance();

    // Create a promise that rejects after timeout
    const timeoutPromise = new Promise<never>((_, reject) => {
      setTimeout(() => reject(new Error('AI call timeout')), timeoutMs);
    });

    try {
      // Race between AI call and timeout
      const response = await Promise.race([
        client.chat({
          model: 'meta/llama-3.1-70b-instruct',
          messages: [
            { role: 'system', content: 'You are a browser automation AI. Output only valid JSON.' },
            { role: 'user', content: prompt },
          ],
          temperature: 0.3,
          max_tokens: 500,
        }),
        timeoutPromise
      ]);

      return response.choices[0]?.message?.content || '{}';
    } catch (error) {
      process.stderr.write('[AUTOMATE] AI call failed: ' + (error instanceof Error ? error.message : String(error)) + '\n');
      // Return a wait action on error so the loop doesn't crash
      return JSON.stringify({
        page_analysis: 'AI analysis failed',
        goal_achieved: false,
        action: 'wait',
        reason: 'AI call failed, waiting before retry',
        result: 'timeout_error'
      });
    }
  }

  private credentials: { email?: string; password?: string } | null = null;

  private async loadCredentials(): Promise<void> {
    const email = process.env.GMAIL_EMAIL;
    const password = process.env.GMAIL_PASSWORD;
    if (email && password) {
      this.credentials = { email, password };
      process.stderr.write('[BROWSER] Loaded credentials from environment\n');
    }
  }

  public async saveCredentials(email: string, password: string): Promise<void> {
    process.stderr.write('[BROWSER] To save credentials, set GMAIL_EMAIL and GMAIL_PASSWORD environment variables\n');
    this.credentials = { email, password };
  }

  private determineTargetUrl(goal: string): { url: string; email?: string; subject?: string; body?: string } | null {
    const goalLower = goal.toLowerCase();
    
    const emailRegex = /([a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,})/g;
    const emailMatch = goal.match(emailRegex);
    const email = emailMatch ? emailMatch[1] : undefined;

    const subjectMatch = goal.match(/subject[:\s]+([^(]+)/i);
    const subject = subjectMatch ? subjectMatch[1].trim() : 'Weather Update';

    const urlPatterns: Array<{ keywords: string[]; url: string }> = [
      { keywords: ['email', 'gmail', 'mail', 'send mail'], url: 'https://mail.google.com/mail/u/0/#inbox' },
      { keywords: ['whatsapp'], url: 'https://web.whatsapp.com/' },
      { keywords: ['calendar', 'event', 'schedule'], url: 'https://calendar.google.com/calendar/r' },
      { keywords: ['linkedin'], url: 'https://www.linkedin.com/feed/' },
      { keywords: ['twitter', 'x.com', 'tweet'], url: 'https://twitter.com/home' },
      { keywords: ['facebook'], url: 'https://www.facebook.com/' },
      { keywords: ['youtube'], url: 'https://www.youtube.com/' },
      { keywords: ['instagram'], url: 'https://www.instagram.com/' },
      { keywords: ['drive', 'docs', 'document'], url: 'https://drive.google.com/drive/my-drive' },
      { keywords: ['slack'], url: 'https://app.slack.com/' },
      { keywords: ['github'], url: 'https://github.com/' },
    ];

    for (const pattern of urlPatterns) {
      if (pattern.keywords.some(k => goalLower.includes(k))) {
        return { url: pattern.url, email, subject, body: goal };
      }
    }
    return null;
  }

  private async tryFallbackClick(page: Page, selector: string): Promise<boolean> {
    const fallbackSelectors = [
      selector.replace('textarea', 'input'),
      selector.replace('input[type="', '[type="'),
      selector.split(',').map(s => s.trim()),
    ].flat();

    for (const sel of fallbackSelectors) {
      try {
        const el = await page.$(sel);
        if (el) {
          await el.click();
          return true;
        }
      } catch {
        continue;
      }
    }

    const allButtons = await page.$$('button, a[role="button"], div[role="button"]');
    for (const btn of allButtons.slice(0, 5)) {
      try {
        await btn.click();
        return true;
      } catch {
        continue;
      }
    }
    return false;
  }

  private async tryFallbackType(page: Page, value: string): Promise<boolean> {
    const emailSelectors = [
      "input[name='to']",
      "input[type='email']", 
      "#identifierId",
      "input[aria-label='To']",
      "input[placeholder*='To']",
      "input[placeholder*='Email']",
    ];
    
    for (const sel of emailSelectors) {
      try {
        const el = await page.$(sel);
        if (el && await el.isVisible()) {
          await el.fill(value);
          return true;
        }
      } catch {
        continue;
      }
    }

    const textareas = await page.$$('textarea, div[contenteditable="true"]');
    for (const ta of textareas.slice(0, 3)) {
      try {
        if (await ta.isVisible()) {
          await ta.fill(value);
          return true;
        }
      } catch {
        continue;
      }
    }
    
    return false;
  }

  /**
   * Wait for the page to stabilize after an action.
   * Monitors network activity and DOM changes until they settle.
   */
  private async waitForPageStable(page: Page, prevUrl: string, maxWaitMs: number = 8000): Promise<void> {
    const startTime = Date.now();
    let prevContent = await page.content();

    process.stderr.write('[AUTOMATE] Waiting for page to stabilize...\n');

    // Wait for network to be idle
    try {
      await page.waitForLoadState('networkidle', { timeout: 5000 });
    } catch {
      // Network may not go fully idle, continue anyway
    }

    // Poll for DOM stability
    while (Date.now() - startTime < maxWaitMs) {
      await page.waitForTimeout(500);

      // Check if URL changed (navigation happened)
      if (page.url() !== prevUrl) {
        process.stderr.write('[AUTOMATE] Navigation detected, waiting for load...\n');
        try {
          await page.waitForLoadState('load', { timeout: 5000 });
        } catch {}
        break;
      }

      // Check if content changed significantly
      const currentContent = await page.content();
      if (currentContent !== prevContent) {
        prevContent = currentContent;
        // Content changed, keep waiting
        process.stderr.write('[AUTOMATE] Page content updating...\n');
      }
    }

    // Final settle delay
    await page.waitForTimeout(500);
    process.stderr.write('[AUTOMATE] Page stabilized\n');
  }

  private async toolSearch(args: Record<string, unknown>): Promise<unknown> {
    const query = args.query as string;
    const engine = (args.engine as string) || 'bing';
    const maxResults = (args.max_results as number) || 3;
    const fetchContent = args.fetch_content !== false;

    try {
      const searchUrls: Record<string, string> = {
        google: `https://www.google.com/search?q=${encodeURIComponent(query)}`,
        bing: `https://www.bing.com/search?q=${encodeURIComponent(query)}`,
        duckduckgo: `https://duckduckgo.com/?q=${encodeURIComponent(query)}`,
      };

      const url =
        searchUrls[engine] || 'https://www.bing.com/search?q=' + encodeURIComponent(query);
      const page = await this.getPage();

      process.stderr.write('[SEARCH] START - ' + url + '\n');

      try {
        await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 15000 });
        process.stderr.write('[SEARCH] DOM loaded\n');
      } catch (e) {
        process.stderr.write('[SEARCH] Error loading: ' + e + '\n');
        try {
          await page.goto(url, { waitUntil: 'load', timeout: 15000 });
        } catch {}
      }
      this.state.lastUrl = url;

      await page.waitForTimeout(3000);

      const results: Array<{ title: string; url: string; snippet: string; content?: string }> = [];
      const seen = new Set<string>();

      const resultSelectors = ['#b_results h2 a', '#b_results li.b_algo a', 'li.b_algo h2 a'];

      for (const selector of resultSelectors) {
        try {
          const elements = await page.locator(selector).all();
          if (elements.length > 0) {
            process.stderr.write(
              '[SEARCH] Found ' + elements.length + ' results with selector: ' + selector + '\n'
            );
            for (const el of elements.slice(0, 10)) {
              try {
                const linkHref = await el.getAttribute('href');
                const text = await el.textContent();
                if (linkHref && !seen.has(linkHref) && text && text.trim().length > 2) {
                  seen.add(linkHref);
                  results.push({
                    title: text.trim().slice(0, 80),
                    url: linkHref,
                    snippet: text.trim().slice(0, 120),
                  });
                }
              } catch {}
            }
            if (results.length >= 10) break;
          }
        } catch {}
      }

      if (results.length < 3) {
        const allAnchors = await page.locator('a').all();
        process.stderr.write('[SEARCH] Fallback: Found ' + allAnchors.length + ' anchors\n');
        for (const link of allAnchors.slice(0, 50)) {
          try {
            const href = await link.getAttribute('href');
            const text = await link.textContent();
            if (
              href &&
              href.startsWith('http') &&
              !href.includes('bing.com/ck/a') &&
              !seen.has(href) &&
              text &&
              text.trim().length > 3 &&
              !text
                .trim()
                .match(
                  /^(Images|Videos|Maps|News|Shopping|Flights|Travel|Copilot|All|Past|Speedtest|More|Tools|Date)$/i
                )
            ) {
              seen.add(href);
              results.push({
                title: text.trim().slice(0, 80),
                url: href,
                snippet: text.trim().slice(0, 120),
              });
              if (results.length >= 15) break;
            }
          } catch {}
        }
      }

      process.stderr.write('[SEARCH] Extracted ' + results.length + ' results\n');

      if (results.length === 0) {
        const pageUrl = page.url();
        return [
          {
            title: 'Search done: ' + (await page.title()).slice(0, 50),
            url: pageUrl,
            snippet: 'Try navigate then extract.',
          },
        ];
      }

      const limitedResults = results.slice(0, maxResults);

      if (fetchContent && limitedResults.length > 0) {
        process.stderr.write(
          '[SEARCH] Fetching content from ' + limitedResults.length + ' result pages...\n'
        );

        for (let i = 0; i < limitedResults.length; i++) {
          const result = limitedResults[i];
          try {
            await page.goto(result.url, { waitUntil: 'domcontentloaded', timeout: 10000 });
            await page.waitForTimeout(1500);

            const bodySelectors = [
              'article',
              'main',
              '.content',
              '#content',
              '.post-content',
              '.article-content',
            ];
            let text = '';

            for (const sel of bodySelectors) {
              try {
                const el = await page.$(sel);
                if (el) {
                  text = (await el.textContent()) || '';
                  if (text.length > 50) break;
                }
              } catch {}
            }

            if (!text || text.length < 50) {
              text = await page.evaluate(() => document.body.innerText || '');
            }

            result.content = text.replace(/\s+/g, ' ').trim().slice(0, 3000);
            process.stderr.write(
              '[SEARCH] Fetched content for: ' +
                result.title.slice(0, 30) +
                ' (' +
                result.content.length +
                ' chars)\n'
            );
          } catch (e) {
            process.stderr.write(
              '[SEARCH] Failed to fetch content for: ' +
                result.title.slice(0, 30) +
                ' - ' +
                (e instanceof Error ? e.message : String(e)) +
                '\n'
            );
          }
        }

        await page.goto(url, { waitUntil: 'domcontentloaded' });
        await page.waitForTimeout(1000);
      }

      return limitedResults;
    } catch (e) {
      process.stderr.write(
        '[SEARCH] Outer error: ' + (e instanceof Error ? e.message : String(e)) + '\n'
      );
      return { error: String(e) };
    }
  }

  private async toolFetch(args: Record<string, unknown>): Promise<unknown> {
    const url = args.url as string;
    const maxLength = (args.max_length as number) || 5000;
    const page = await this.getPage();

    process.stderr.write('[FETCH] Loading: ' + url + '\n');

    try {
      await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 15000 });
    } catch (e) {
      try {
        await page.goto(url, { waitUntil: 'load', timeout: 15000 });
      } catch {}
    }

    await page.waitForTimeout(2000);

    const title = await page.title();

    const bodySelectors = [
      'article',
      'main',
      '.content',
      '#content',
      '.post-content',
      '.article-content',
      'body',
    ];
    let text = '';

    for (const sel of bodySelectors) {
      try {
        const el = await page.$(sel);
        if (el) {
          text = (await el.textContent()) || '';
          if (text.length > 100) break;
        }
      } catch {}
    }

    if (!text || text.length < 100) {
      text = await page.evaluate(() => document.body.innerText || '');
    }

    text = text.replace(/\s+/g, ' ').trim().slice(0, maxLength);

    return {
      url,
      title: title.slice(0, 100),
      content: text,
      length: text.length,
    };
  }

  private async toolExtract(args: Record<string, unknown>): Promise<unknown> {
    const page = await this.getPage();
    const selector = args.selector as string;
    const attribute = args.attribute as string | undefined;

    if (!selector) {
      const content = await page.content();
      return { success: true, content };
    }

    if (attribute) {
      const elements = await page.$$(selector);
      const values = await Promise.all(elements.map((el) => el.getAttribute(attribute)));
      return { success: true, values };
    }

    const elements = await page.$$(selector);
    const texts = await Promise.all(elements.map((el) => el.textContent()));
    return { success: true, texts };
  }

  private async toolFillForm(args: Record<string, unknown>): Promise<unknown> {
    const page = await this.getPage();
    const fields = args.fields as Record<string, string>;

    for (const [sel, value] of Object.entries(fields)) {
      const element = await page.$(sel);
      if (element) {
        await element.fill(value);
      }
    }

    return { success: true, filled: Object.keys(fields).length };
  }

  private async toolSubmit(args: Record<string, unknown>): Promise<unknown> {
    const page = await this.getPage();
    const selector = args.selector as string;

    if (selector) {
      const element = await page.$(selector);
      if (element) {
        await element.click();
      }
    } else {
      const forms = await page.$$('form');
      if (forms.length > 0) {
        await forms[0].evaluate((form: Element) => (form as HTMLFormElement).submit());
      }
    }

    return { success: true };
  }

  private async toolClick(args: Record<string, unknown>): Promise<unknown> {
    const page = await this.getPage();
    const selector = args.selector as string;
    const timeout = (args.timeout as number) || 5000;

    await page.click(selector, { timeout });
    return { success: true, selector };
  }

  private async toolType(args: Record<string, unknown>): Promise<unknown> {
    const page = await this.getPage();
    const selector = args.selector as string;
    const text = args.text as string;
    const delay = (args.delay as number) || 0;

    await page.fill(selector, text);
    if (delay > 0) {
      await page.waitForTimeout(delay);
    }
    return { success: true, selector, text };
  }

  private async toolScreenshot(args: Record<string, unknown>): Promise<unknown> {
    const page = await this.getPage();
    const path = args.path as string;
    const fullPage = (args.full_page as boolean) || false;

    if (path) {
      await page.screenshot({ path, fullPage });
      return { success: true, path };
    } else {
      const buffer = await page.screenshot({ fullPage });
      return { success: true, base64: buffer.toString('base64') };
    }
  }

  private async toolGetText(args: Record<string, unknown>): Promise<unknown> {
    const page = await this.getPage();
    const selector = args.selector as string;

    const element = await page.$(selector);
    if (!element) return { success: false, error: 'Element not found' };

    const text = await element.textContent();
    return { success: true, text: text?.trim() || '' };
  }

  private async toolGetAttribute(args: Record<string, unknown>): Promise<unknown> {
    const page = await this.getPage();
    const selector = args.selector as string;
    const attribute = args.attribute as string;

    const element = await page.$(selector);
    if (!element) return { success: false, error: 'Element not found' };

    const value = await element.getAttribute(attribute);
    return { success: true, value };
  }

  private async toolWaitForSelector(args: Record<string, unknown>): Promise<unknown> {
    const page = await this.getPage();
    const selector = args.selector as string;
    const timeout = (args.timeout as number) || 30000;

    await page.waitForSelector(selector, { timeout });
    return { success: true, selector };
  }

  private async toolScroll(args: Record<string, unknown>): Promise<unknown> {
    const page = await this.getPage();
    const selector = args.selector as string | undefined;
    const x = (args.x as number) || 0;
    const y = (args.y as number) || 0;

    if (selector) {
      await page.$eval(selector, (el: HTMLElement) => {
        el.scrollBy(x, y);
      });
    } else {
      await page.evaluate(() => {
        window.scrollBy(x, y);
      });
    }

    return { success: true };
  }

  private async toolClose(): Promise<unknown> {
    if (this.state.page) {
      await this.state.page.close();
      this.state.page = null;
    }
    if (this.state.browser) {
      await this.state.browser.close();
      this.state.browser = null;
    }
    return { success: true };
  }

  public async close(): Promise<void> {
    await this.toolClose();
  }
}
