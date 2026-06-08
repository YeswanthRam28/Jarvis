import { exec, execSync, spawn } from 'child_process';
import * as fs from 'fs';
import * as path from 'path';
import {
  MCPRequest,
  MCPResponse,
  MCPTool,
  MCP_ERROR_CODES,
  createMCPResponse,
  createMCPError,
} from '../types';

let DesktopAgentGraphInstance: any = null;

export class DesktopUIServer {
  private tools: MCPTool[];

  constructor() {
    this.tools = this.defineTools();
  }

  private defineTools(): MCPTool[] {
    return [
      {
        name: 'open_app',
        description: 'Open a desktop application',
        inputSchema: {
          type: 'object',
          properties: {
            app: { type: 'string', description: 'Application name or path' },
            args: { type: 'string', description: 'Command line arguments' },
          },
          required: ['app'],
        },
      },
      {
        name: 'send_whatsapp',
        description: 'Send a WhatsApp message using WhatsApp Desktop app',
        inputSchema: {
          type: 'object',
          properties: {
            phone: { type: 'string', description: 'Phone number with country code (e.g., +1234567890)' },
            message: { type: 'string', description: 'Message to send' },
            contact: { type: 'string', description: 'Contact name instead of phone number' },
          },
          required: ['message'],
        },
      },
      {
        name: 'desktop_automation',
        description: 'Multi-step desktop automation: open app, search, click, type. Example: "open Apple Music, search for playlist, click shuffle"',
        inputSchema: {
          type: 'object',
          properties: {
            app: { type: 'string', description: 'App to open (e.g., Apple Music, Spotify)' },
            action: { type: 'string', description: 'Action in the app (e.g., "search for playlist givesomeshit and click shuffle")' },
          },
          required: ['app', 'action'],
        },
      },
      {
        name: 'automate_desktop',
        description: 'AI-powered desktop automation with LangGraph loop - extracts UI, reasons, executes, verifies',
        inputSchema: {
          type: 'object',
          properties: {
            task: { type: 'string', description: 'Task description (e.g., "send message to Mom")' },
            max_steps: { type: 'number', description: 'Max steps', default: 10 },
          },
          required: ['task'],
        },
      },
      {
        name: 'click',
        description: 'Click at coordinates or on an element',
        inputSchema: {
          type: 'object',
          properties: {
            x: { type: 'number', description: 'X coordinate' },
            y: { type: 'number', description: 'Y coordinate' },
            selector: { type: 'string', description: 'Element selector (UIAutomation)' },
          },
        },
      },
      {
        name: 'type',
        description: 'Type text at current focus or coordinates',
        inputSchema: {
          type: 'object',
          properties: {
            text: { type: 'string', description: 'Text to type' },
            x: { type: 'number', description: 'X coordinate to click first' },
            y: { type: 'number', description: 'Y coordinate to click first' },
          },
          required: ['text'],
        },
      },
      {
        name: 'scroll',
        description: 'Scroll at coordinates or in an element',
        inputSchema: {
          type: 'object',
          properties: {
            x: { type: 'number', description: 'X coordinate' },
            y: { type: 'number', description: 'Y coordinate' },
            delta: { type: 'number', description: 'Scroll amount (positive=down, negative=up)' },
          },
        },
      },
      {
        name: 'screenshot',
        description: 'Take a screenshot',
        inputSchema: {
          type: 'object',
          properties: {
            path: { type: 'string', description: 'Path to save screenshot' },
          },
        },
      },
      {
        name: 'find_element',
        description: 'Find a UI element using UIAutomation',
        inputSchema: {
          type: 'object',
          properties: {
            name: { type: 'string', description: 'Element name or AutomationId' },
            type: { type: 'string', description: 'Element type (Button, Edit, etc.)' },
            timeout: { type: 'number', description: 'Timeout in ms', default: 5000 },
          },
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
            serverInfo: { name: 'mcp-desktop-ui', version: '1.0.0' },
          });

        default:
          return createMCPError(id, MCP_ERROR_CODES.METHOD_NOT_FOUND, `Unknown method: ${method}`);
      }
    } catch (error) {
      return createMCPError(id, MCP_ERROR_CODES.INTERNAL_ERROR, `Internal error: ${error}`);
    }
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

    try {
      switch (name) {
        case 'open_app':
          return this.toolOpenApp(id, args);
        case 'send_whatsapp':
          return await this.toolSendWhatsApp(id, args);
        case 'desktop_automation':
          return this.toolDesktopAutomation(id, args);
        case 'automate_desktop':
          return this.toolAutomateDesktop(id, args);
        case 'click':
          return this.toolClick(id, args);
        case 'type':
          return this.toolType(id, args);
        case 'scroll':
          return this.toolScroll(id, args);
        case 'screenshot':
          return this.toolScreenshot(id, args);
        case 'find_element':
          return this.toolFindElement(id, args);
        default:
          return createMCPError(id, MCP_ERROR_CODES.METHOD_NOT_FOUND, `Unknown tool: ${name}`);
      }
    } catch (error) {
      return createMCPError(id, MCP_ERROR_CODES.INTERNAL_ERROR, `Tool error: ${error}`);
    }
  }

  private toolOpenApp(id: string | number, args: Record<string, unknown>): MCPResponse {
    const app = args.app as string;
    const appArgs = args.args as string;

    if (!app) {
      return createMCPError(id, MCP_ERROR_CODES.INVALID_PARAMS, 'app is required');
    }

    try {
      const isWindows = process.platform === 'win32';
      const appsFolder = process.env.APPS_FOLDER || 'C:\\Users\\YeswanthRam\\OneDrive\\Documents\\Apps.lnk';

      const tryOpenApp = (appPath: string): boolean => {
        if (!fs.existsSync(appPath)) {
          return false;
        }
        
        const command = isWindows
          ? `start "" "${appPath}"${appArgs ? ` ${appArgs}` : ''}`
          : appPath;

        exec(command, (error) => {
          if (error) {
            console.error('[DESKTOP-UI] Open app error:', error.message);
          }
        });
        return true;
      };

      // Try direct path first
      if (tryOpenApp(app)) {
        return createMCPResponse(id, { success: true, app, started: true, path: app });
      }

      // Try Apps.lnk folder on Windows
      if (isWindows) {
        if (fs.existsSync(appsFolder) && fs.statSync(appsFolder).isDirectory()) {
          // Try .lnk first, then try executable
          const lnkPath = path.join(appsFolder, `${app}.lnk`);
          const exePath = path.join(appsFolder, `${app}.exe`);
          
          if (tryOpenApp(lnkPath)) {
            return createMCPResponse(id, { success: true, app, started: true, path: lnkPath });
          }
          
          if (tryOpenApp(exePath)) {
            return createMCPResponse(id, { success: true, app, started: true, path: exePath });
          }

          // List all files in Apps folder and try fuzzy match
          const files = fs.readdirSync(appsFolder);
          const match = files.find(f => 
            f.toLowerCase().includes(app.toLowerCase()) ||
            app.toLowerCase().includes(f.replace('.lnk', '').replace('.exe', '').toLowerCase())
          );
          
          if (match) {
            const matchPath = path.join(appsFolder, match);
            if (tryOpenApp(matchPath)) {
              return createMCPResponse(id, { success: true, app, started: true, path: matchPath });
            }
          }
        }
      }

      // Try system PATH as fallback
      // Try to find in common locations
      const foundPath = this.findAppPath(app);
      if (foundPath) {
        tryOpenApp(foundPath);
        return createMCPResponse(id, { success: true, app, started: true, path: foundPath });
      }

      const command = isWindows
        ? `start "" "${app}"${appArgs ? ` ${appArgs}` : ''}`
        : app;

      exec(command, (error) => {
        if (error) {
          console.error('[DESKTOP-UI] Open app error:', error.message);
        }
      });

      return createMCPResponse(id, { success: true, app, started: true, note: 'Tried system PATH' });
    } catch (error) {
      return createMCPResponse(id, { success: false, error: String(error) });
    }
  }

  private async toolSendWhatsApp(id: string | number, args: Record<string, unknown>): Promise<MCPResponse> {
    const phone = args.phone as string;
    const contact = args.contact as string;
    const message = args.message as string;

    if (!message) {
      return createMCPError(id, MCP_ERROR_CODES.INVALID_PARAMS, 'message is required');
    }

    let resolvedPhone = phone;
    let resolvedContact = contact;

    if (contact) {
      try {
        const contactInfo = this.lookupContactSync(contact);
        if (contactInfo?.phone) {
          resolvedPhone = contactInfo.phone;
          resolvedContact = contact;
          console.log(`[DESKTOP-UI] Found contact ${contact}: ${resolvedPhone}`);
        }
      } catch (e) {
        console.log(`[DESKTOP-UI] Contact lookup failed: ${e}`);
      }
    }

    return this.sendWhatsAppDesktop(resolvedContact || resolvedPhone, message);
  }

  private async sendWhatsAppDesktop(contactName: string, message: string): Promise<MCPResponse> {
    let whatsappPath = '';
    
    const possiblePaths = [
      'C:\\Program Files\\WindowsApps\\5319275A.WhatsAppDesktop_2.2613.101.0_x64__cv1g1gvanyjgm\\WhatsApp.exe',
      'C:\\Users\\YeswanthRam\\AppData\\Local\\WhatsApp\\WhatsApp.exe',
      path.join(process.env.LOCALAPPDATA || '', 'WhatsApp', 'WhatsApp.exe'),
    ];

    for (const wpPath of possiblePaths) {
      try {
        if (fs.existsSync(wpPath)) {
          whatsappPath = wpPath;
          break;
        }
      } catch (e) {
        // Ignore permission errors
      }
    }

    // Try to find via registry if not found
    if (!whatsappPath) {
      try {
        const regResult = execSync('powershell -Command "(Get-AppxPackage *WhatsApp*).InstallLocation"', { encoding: 'utf8' }).trim();
        if (regResult) {
          whatsappPath = path.join(regResult, 'WhatsApp.exe');
        }
      } catch (e) {
        // Ignore
      }
    }

    // Try opening via shell
    if (!whatsappPath) {
      try {
        execSync('start whatsapp:', { shell: 'cmd.exe' });
        whatsappPath = 'shell:whatsapp';
      } catch (e) {
        // Ignore
      }
    }

    if (!whatsappPath) {
      return createMCPResponse('send_whatsapp', { success: false, error: 'WhatsApp Desktop not installed' });
    }

    console.log(`[DESKTOP-UI] Opening WhatsApp to search for: ${contactName}`);

    const tempScript = path.join(process.env.TEMP || 'C:\\Windows\\Temp', `wa_send_${Date.now()}.ps1`);
    const escapedContact = contactName.replace(/'/g, "''");
    const escapedMessage = message.replace(/'/g, "''");
    
    const scriptContent = `
Add-Type -AssemblyName System.Windows.Forms

Start-Process "whatsapp:"
Start-Sleep -Seconds 2

$procs = Get-Process | Where-Object { $_.MainWindowTitle -like "*WhatsApp*" }
if ($procs.Count -gt 0) {
    [System.Windows.Forms.SendKeys]::SendWait("^f")
    Start-Sleep -Milliseconds 200
    [System.Windows.Forms.SendKeys]::SendWait("${escapedContact}")
    Start-Sleep -Milliseconds 300
    [System.Windows.Forms.SendKeys]::SendWait("{ENTER}")
    Start-Sleep -Milliseconds 300
    [System.Windows.Forms.SendKeys]::SendWait("${escapedMessage}")
    Start-Sleep -Milliseconds 200
    [System.Windows.Forms.SendKeys]::SendWait("{ENTER}")
    Write-Output "Sent"
} else {
    Write-Output "WhatsApp not found"
}
`;

    try {
      fs.writeFileSync(tempScript, scriptContent, 'utf8');
      
      exec(`powershell -ExecutionPolicy Bypass -File "${tempScript}"`, (error) => {
        setTimeout(() => {
          try { fs.unlinkSync(tempScript); } catch {}
        }, 5000);
      });
      
      return createMCPResponse('send_whatsapp', { 
        success: true, 
        message: 'Message sent',
        contact: contactName,
        note: `Sent to "${contactName}"`
      });
    } catch (error) {
      console.error(`[DESKTOP-UI] Error: ${error}`);
      return createMCPResponse('send_whatsapp', { 
        success: false, 
        error: String(error)
      });
    }
  }

  private toolDesktopAutomation(id: string | number, args: Record<string, unknown>): MCPResponse {
    const app = args.app as string;
    const action = args.action as string;

    if (!app) {
      return createMCPError(id, MCP_ERROR_CODES.INVALID_PARAMS, 'app is required');
    }
    if (!action) {
      return createMCPError(id, MCP_ERROR_CODES.INVALID_PARAMS, 'action is required');
    }

    console.log(`[DESKTOP-UI] Desktop automation: open ${app}, then ${action}`);

    const appPaths: Record<string, string> = {
      'apple music': 'C:\\Users\\YeswanthRam\\OneDrive\\Desktop\\Apple Music - Shortcut.lnk',
      'spotify': 'Spotify',
      'whatsapp': 'whatsapp:',
      'notepad': 'notepad.exe',
      'calculator': 'calc.exe',
      'edge': 'msedge.exe',
      'code': 'code.exe',
    };

    let appCmd = appPaths[app.toLowerCase()];
    
    if (!appCmd) {
      const foundPath = this.findAppPath(app);
      if (foundPath) {
        appCmd = foundPath;
      } else {
        appCmd = app;
      }
    }
    
    // Use start for shortcuts/paths with spaces
    const startCmd = appCmd.includes(' ') || appCmd.includes('.lnk') 
      ? `start "" "${appCmd}"`
      : appCmd;
    
    // Clean up action - remove web stuff
    let cleanAction = action
      .replace(/site:[^\s]+/gi, '')
      .replace(/https?:[^\s]+/gi, '')
      .replace(/playlist/gi, '')
      .trim();
    
    // Parse actions with " and " delimiter
    const actionList = action.split(/\s+and\s+/i).map(a => a.trim()).filter(a => a.length > 0);
    
    // Build PowerShell script for in-app automation
    const scriptContent = `
Add-Type -AssemblyName System.Windows.Forms

# Open app using start for shortcuts/EXE
$openCmd = "${startCmd}"
$appTitle = "${app.toLowerCase()}"

# Run open command
if ($openCmd.StartsWith("start")) {
    Invoke-Expression $openCmd
} else {
    Start-Process $openCmd -ErrorAction SilentlyContinue
}

# Wait for window
Start-Sleep -Seconds 4

# Find window by title
$appProc = Get-Process | Where-Object { $_.MainWindowTitle -like "*$appTitle*" -or $_.Name -like "*$appName*" } | Select-Object -First 1

if ($appProc) {
    Write-Output "Found app: $($appProc.MainWindowTitle)"
    
    # Do each action in sequence
${actionList.map((a, i) => `
    # Action ${i + 1}: ${a}
    Start-Sleep -Milliseconds 300
    
    # Search pattern - use Ctrl+F
    if ("${a}" -match "search") {
        [System.Windows.Forms.SendKeys]::SendWait("^f")
        Start-Sleep -Milliseconds 500
        [System.Windows.Forms.SendKeys]::SendWait("${a}".Replace("search for ",""))
    }
    # Click pattern
    elseif ("${a}" -match "click|press|tap") {
        # Tab to navigate, then enter
        Start-Sleep -Milliseconds 200
        [System.Windows.Forms.SendKeys]::SendWait("{TAB}")
        Start-Sleep -Milliseconds 100
        [System.Windows.Forms.SendKeys]::SendWait("{ENTER}")
    }
    # Shuffle button usually 'S' key in music apps
    elseif ("${a}" -match "shuffle") {
        [System.Windows.Forms.SendKeys]::SendWait("s")
    }
    # Type direct text
    else {
        [System.Windows.Forms.SendKeys]::SendWait("${a}")
    }
`).join('\n')}
    
    Write-Output "Actions completed"
} else {
    Write-Output "App not found: $appTitle"
}
`;

    const tempScript = path.join(process.env.TEMP || 'C:\\Windows\\Temp', `desktop_auto_${Date.now()}.ps1`);
    
    try {
      fs.writeFileSync(tempScript, scriptContent, 'utf8');
      
      // Run with no window, capture output
      const child = spawn('powershell', [
        '-ExecutionPolicy', 'Bypass', 
        '-File', tempScript
      ], { detached: false, stdio: 'ignore' });
      
      child.unref();
      
      // Clean up after delay
      setTimeout(() => {
        try { fs.unlinkSync(tempScript); } catch {}
      }, 5000);
      
      return createMCPResponse(id, { 
        success: true, 
        app,
        action,
        note: `Opened ${app}`
      });
    } catch (error) {
      return createMCPResponse(id, { success: false, error: String(error) });
    }
  }

  private execPowerShellAsync(script: string): Promise<string> {
    return new Promise((resolve, reject) => {
      const child = exec(`powershell -ExecutionPolicy Bypass -Command "${script.replace(/"/g, '\\"')}"`, (error, stdout, stderr) => {
        if (error) reject(error);
        else resolve(stdout);
      });
    });
  }

  private lookupContactSync(name: string): { name: string; phone: string } | null {
    const homeDir = process.env.USERPROFILE || process.env.HOME || 'C:\\Users\\YeswanthRam';
    const profilePath = path.join(homeDir, '.jarvis', 'profile.json');
    
    if (fs.existsSync(profilePath)) {
      try {
        const profileData = JSON.parse(fs.readFileSync(profilePath, 'utf-8'));
        const contacts = profileData?.contacts || {};
        
        // Try exact match first
        let contact = contacts[name];
        
        // Try case-insensitive match
        if (!contact) {
          const lowerName = name.toLowerCase();
          for (const [key, value] of Object.entries(contacts)) {
            if (key.toLowerCase() === lowerName) {
              contact = value as { name: string; phone: string; whatsapp: string };
              break;
            }
          }
        }
        
        // Support both phone and whatsapp fields
        if (contact?.phone || contact?.whatsapp) {
          return { name: contact.name || name, phone: contact.phone || contact.whatsapp };
        }
      } catch (e) {
        console.log(`[DESKTOP-UI] Profile read error: ${e}`);
      }
    }
    return null;
  }

  private findAppPath(appName: string): string | null {
    // First check known app process names
    const knownApps: Record<string, string> = {
      'apple music': 'start "" "C:\\Users\\YeswanthRam\\OneDrive\\Desktop\\Apple Music - Shortcut.lnk"',
      'spotify': 'Spotify',
      'whatsapp': 'WhatsApp',
      'discord': 'Discord',
      'slack': 'slack',
      'teams': 'Teams',
      'zoom': 'Zoom',
      'notion': 'Notion',
    };
    
    if (knownApps[appName.toLowerCase()]) {
      return knownApps[appName.toLowerCase()];
    }
    
    const searchName = appName.toLowerCase();
    const searchLocations = [
      'C:\\Program Files',
      'C:\\Program Files (x86)',
      path.join(process.env.LOCALAPPDATA || '', 'Microsoft\\Windows\\Start Menu\\Programs'),
      path.join(process.env.APPDATA || '', 'Microsoft\\Windows\\Start Menu\\Programs'),
      (process.env.USERPROFILE || 'C:\\Users\\YeswanthRam') + '\\Desktop',
      (process.env.PUBLIC || 'C:\\Users\\Public') + '\\Desktop',
    ];

    const exeExtensions = ['.exe', '.lnk', '.url'];
    
    for (const loc of searchLocations) {
      try {
        if (!fs.existsSync(loc)) continue;
        
        const files = fs.readdirSync(loc);
        for (const file of files) {
          const fileNameWithoutExt = file.replace(/\.(exe|lnk|url)$/i, '');
          if (fileNameWithoutExt.toLowerCase().includes(searchName) || searchName.includes(fileNameWithoutExt.toLowerCase())) {
            const fullPath = path.join(loc, file);
            
            if (file.toLowerCase().endsWith('.lnk')) {
              return `start "" "${fullPath}"`;
            }
            if (file.toLowerCase().endsWith('.exe')) {
              return fullPath;
            }
          }
        }
        
        // Also search in subdirectories (1 level deep)
        const subdirs = files.filter(f => {
          try {
            return fs.statSync(path.join(loc, f)).isDirectory();
          } catch { return false; }
        });
        
        for (const subdir of subdirs) {
          const subdirPath = path.join(loc, subdir);
          try {
            const subFiles = fs.readdirSync(subdirPath);
            for (const file of subFiles) {
              const fileNameWithoutExt = file.replace(/\.(exe|lnk|url)$/i, '');
              if (fileNameWithoutExt.toLowerCase().includes(searchName) || searchName.includes(fileNameWithoutExt.toLowerCase())) {
                const fullPath = path.join(subdirPath, file);
                if (file.toLowerCase().endsWith('.lnk')) {
                  return `start "" "${fullPath}"`;
                }
                if (file.toLowerCase().endsWith('.exe')) {
                  return fullPath;
                }
              }
            }
          } catch { continue; }
        }
      } catch { continue; }
    }

    // Also check running processes for the app
    try {
      const processes = execSync('tasklist /FO CSV /NH', { encoding: 'utf8' });
      const lines = processes.split('\n');
      for (const line of lines) {
        if (line.toLowerCase().includes(searchName)) {
          const processName = line.split(',')[0].replace(/"/g, '').trim();
          if (processName.endsWith('.exe')) {
            return processName;
          }
          return processName + '.exe';
        }
      }
    } catch {}

    return null;
  }

  private async toolAutomateDesktop(id: string | number, args: Record<string, unknown>): Promise<MCPResponse> {
    const task = args.task as string;
    const maxSteps = (args.max_steps as number) || 10;

    if (!task) {
      return createMCPError(id, MCP_ERROR_CODES.INVALID_PARAMS, 'task is required');
    }

    console.log(`[DESKTOP-UI] Starting LangGraph automation: ${task}`);

    try {
      // Lazy load the agent
      if (!DesktopAgentGraphInstance) {
        const { DesktopAgentGraph } = await import('../../agents/desktop_agent_graph');
        DesktopAgentGraphInstance = new DesktopAgentGraph();
      }

      const result = await DesktopAgentGraphInstance.run(task, maxSteps);

      console.log(`[DESKTOP-UI] LangGraph result: ${result.success ? 'success' : 'failed'} in ${result.steps} steps`);

      return createMCPResponse(id, {
        success: result.success,
        steps: result.steps,
        output: result.output,
        history: result.history,
      });
    } catch (error) {
      console.error(`[DESKTOP-UI] Automate error: ${error}`);
      return createMCPResponse(id, {
        success: false,
        error: String(error),
      });
    }
  }

  private toolClick(id: string | number, args: Record<string, unknown>): MCPResponse {
    const x = args.x as number;
    const y = args.y as number;

    if (x === undefined || y === undefined) {
      return createMCPError(id, MCP_ERROR_CODES.INVALID_PARAMS, 'x and y coordinates are required');
    }

    try {
      const isWindows = process.platform === 'win32';
      const command = isWindows
        ? `powershell -Command "[System.Windows.Forms.Cursor]::Position = New-Object System.Drawing.Point(${x}, ${y}); [System.Windows.Forms.Mouse]::Event(0x0002); [System.Windows.Forms.Mouse]::Event(0x0004)"`
        : `xdotool click 1`;

      exec(command, (error) => {
        if (error) console.error('[DESKTOP-UI] Click error:', error.message);
      });

      return createMCPResponse(id, { success: true, x, y });
    } catch (error) {
      return createMCPResponse(id, { success: false, error: String(error) });
    }
  }

  private toolType(id: string | number, args: Record<string, unknown>): MCPResponse {
    const text = args.text as string;

    if (!text) {
      return createMCPError(id, MCP_ERROR_CODES.INVALID_PARAMS, 'text is required');
    }

    try {
      const escapedText = text.replace(/"/g, '\\"');
      const isWindows = process.platform === 'win32';
      const command = isWindows
        ? `powershell -Command "Add-Type -AssemblyName System.Windows.Forms; [System.Windows.Forms.SendKeys]::SendWait('${escapedText}')"`
        : `xdotool type '${text}'`;

      exec(command, (error) => {
        if (error) console.error('[DESKTOP-UI] Type error:', error.message);
      });

      return createMCPResponse(id, { success: true, text });
    } catch (error) {
      return createMCPResponse(id, { success: false, error: String(error) });
    }
  }

  private toolScroll(id: string | number, args: Record<string, unknown>): MCPResponse {
    const delta = (args.delta as number) || 120;
    const x = args.x as number;
    const y = args.y as number;

    try {
      const isWindows = process.platform === 'win32';

      if (isWindows && x !== undefined && y !== undefined) {
        const command = `powershell -Command "[System.Windows.Forms.Cursor]::Position = New-Object System.Drawing.Point(${x}, ${y}); [System.Windows.Forms.SendKeys]::SendWait('{DOWN ${Math.abs(delta)}}')"`;
        exec(command);
      } else {
        const scrollCmd = isWindows
          ? `powershell -Command "[System.Windows.Forms.SendKeys]::SendWait('{PGDN}')"`
          : `xdotool click 5`;
        exec(scrollCmd);
      }

      return createMCPResponse(id, { success: true, delta, x, y });
    } catch (error) {
      return createMCPResponse(id, { success: false, error: String(error) });
    }
  }

  private toolScreenshot(id: string | number, args: Record<string, unknown>): MCPResponse {
    const savePath = args.path as string;

    try {
      const isWindows = process.platform === 'win32';
      const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
      const defaultPath = savePath || `screenshot-${timestamp}.png`;

      if (isWindows) {
        const command = `powershell -Command "Add-Type -AssemblyName System.Drawing; Add-Type -AssemblyName System.Windows.Forms; $bounds = [System.Windows.Forms.Screen]::PrimaryScreen.Bounds; $bitmap = New-Object System.Drawing.Bitmap $bounds.Width, $bounds.Height; $graphics = [System.Drawing.Graphics]::FromImage($bitmap); $graphics.CopyFromScreen($bounds.X, $bounds.Y, 0, 0, $bounds.Size); $bitmap.Save('${defaultPath}', [System.Drawing.Imaging.ImageFormat]::Png); $graphics.Dispose(); $bitmap.Dispose()"`;
        exec(command);
      } else {
        exec(`gnome-screenshot -f "${defaultPath}"`);
      }

      return createMCPResponse(id, { success: true, path: defaultPath });
    } catch (error) {
      return createMCPResponse(id, { success: false, error: String(error) });
    }
  }

  private toolFindElement(id: string | number, args: Record<string, unknown>): MCPResponse {
    const name = args.name as string;
    const timeout = (args.timeout as number) || 5000;

    console.log(`[DESKTOP-UI] Find element: ${name} (timeout: ${timeout}ms)`);

    return createMCPResponse(id, {
      success: false,
      error: 'Windows UIAutomation not fully implemented. Use browser automation for UI tasks.',
      name,
      suggestion: 'Use mcp-browser for web UI tasks',
    });
  }
}
