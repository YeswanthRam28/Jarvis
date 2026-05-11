import * as fs from "fs";
import * as path from "path";
import * as os from "os";
import {
  MCPRequest,
  MCPResponse,
  MCPTool,
  MCP_ERROR_CODES,
  createMCPResponse,
  createMCPError,
} from "../types";
import {
  UserProfile,
  DEFAULT_PROFILE,
  Contact,
} from "../../context/profile_types";

export class UserProfileServer {
  private profile: UserProfile | null = null;
  private profilePath: string;
  private tools: MCPTool[];
  private logPath: string;

  constructor(profilePath?: string) {
    const homeDir = os.homedir();
    const jarvisDir = path.join(homeDir, ".jarvis");
    this.profilePath = profilePath || path.join(jarvisDir, "profile.json");
    this.logPath = path.join(jarvisDir, "profile_server.log");
    this.tools = this.defineTools();
    this.loadProfile();
  }

  private log(message: string): void {
    const timestamp = new Date().toISOString();
    const logLine = `[${timestamp}] ${message}\n`;
    fs.appendFileSync(this.logPath, logLine);
  }

  private loadProfile(): void {
    const profileDir = path.dirname(this.profilePath);

    if (!fs.existsSync(profileDir)) {
      fs.mkdirSync(profileDir, { recursive: true });
    }

    if (!fs.existsSync(this.profilePath)) {
      this.profile = { ...DEFAULT_PROFILE };
      this.saveProfile();
      this.log("Created default profile");
    }

    try {
      const fileContent = fs.readFileSync(this.profilePath, "utf-8");
      const parsed = JSON.parse(fileContent);
      this.profile = this.validateProfile(parsed);
      this.log("Profile loaded successfully");
    } catch (error) {
      this.log(`Failed to load profile: ${error}`);
      this.profile = { ...DEFAULT_PROFILE };
      this.saveProfile();
    }
  }

  private validateProfile(raw: Partial<UserProfile>): UserProfile {
    return {
      identity: {
        name: raw.identity?.name || DEFAULT_PROFILE.identity.name,
        email: raw.identity?.email || DEFAULT_PROFILE.identity.email,
        phone: raw.identity?.phone || DEFAULT_PROFILE.identity.phone,
      },
      contacts: raw.contacts || {},
      preferences: { ...DEFAULT_PROFILE.preferences, ...raw.preferences },
      resume_profile: { ...DEFAULT_PROFILE.resume_profile, ...raw.resume_profile },
      app_credentials: raw.app_credentials || {},
      learned_preferences: raw.learned_preferences || {},
      command_history: raw.command_history || [],
    };
  }

  private saveProfile(): void {
    if (!this.profile) return;

    const dir = path.dirname(this.profilePath);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }

    fs.writeFileSync(this.profilePath, JSON.stringify(this.profile, null, 2), "utf-8");
    this.log("Profile saved");
  }

  private defineTools(): MCPTool[] {
    return [
      {
        name: "get_profile",
        description: "Get the full user profile",
        inputSchema: { type: "object", properties: {} },
      },
      {
        name: "get_identity",
        description: "Get user identity information",
        inputSchema: { type: "object", properties: {} },
      },
      {
        name: "update_identity",
        description: "Update user identity",
        inputSchema: {
          type: "object",
          properties: {
            name: { type: "string" },
            email: { type: "string" },
            phone: { type: "string" },
          },
        },
      },
      {
        name: "get_contact",
        description: "Get a specific contact",
        inputSchema: {
          type: "object",
          properties: { name: { type: "string" } },
          required: ["name"],
        },
      },
      {
        name: "add_contact",
        description: "Add or update a contact",
        inputSchema: {
          type: "object",
          properties: {
            name: { type: "string" },
            contact: {
              type: "object",
              properties: {
                whatsapp: { type: "string" },
                email: { type: "string" },
                phone: { type: "string" },
              },
            },
          },
          required: ["name", "contact"],
        },
      },
      {
        name: "get_preferences",
        description: "Get user preferences",
        inputSchema: { type: "object", properties: {} },
      },
      {
        name: "get_preference",
        description: "Get a specific preference",
        inputSchema: {
          type: "object",
          properties: { key: { type: "string" } },
          required: ["key"],
        },
      },
      {
        name: "set_preference",
        description: "Set a preference",
        inputSchema: {
          type: "object",
          properties: {
            key: { type: "string" },
            value: { type: "string" },
          },
          required: ["key", "value"],
        },
      },
      {
        name: "get_resume",
        description: "Get resume profile",
        inputSchema: { type: "object", properties: {} },
      },
      {
        name: "update_resume",
        description: "Update resume profile",
        inputSchema: {
          type: "object",
          properties: {
            name: { type: "string" },
            skills: { type: "array", items: { type: "string" } },
            resume_path: { type: "string" },
          },
        },
      },
      {
        name: "add_to_history",
        description: "Add command to history",
        inputSchema: {
          type: "object",
          properties: {
            command: { type: "string" },
            success: { type: "boolean" },
          },
          required: ["command"],
        },
      },
      {
        name: "get_history",
        description: "Get command history",
        inputSchema: {
          type: "object",
          properties: { limit: { type: "number" } },
        },
      },
    ];
  }

  public getTools(): MCPTool[] {
    return this.tools;
  }

  public handleRequest(request: MCPRequest): MCPResponse {
    const { id, method, params } = request;

    try {
      switch (method) {
        case "tools/list":
          return createMCPResponse(id, { tools: this.tools });

        case "tools/call":
          return this.handleToolCall(id, params);

        case "initialize":
          return createMCPResponse(id, {
            protocolVersion: "2024-11-05",
            capabilities: { tools: {} },
            serverInfo: { name: "mcp-user-profile", version: "1.0.0" },
          });

        default:
          return createMCPError(
            id,
            MCP_ERROR_CODES.METHOD_NOT_FOUND,
            `Unknown method: ${method}`
          );
      }
    } catch (error) {
      return createMCPError(
        id,
        MCP_ERROR_CODES.INTERNAL_ERROR,
        `Internal error: ${error}`
      );
    }
  }

  private handleToolCall(
    id: string | number,
    params?: Record<string, unknown>
  ): MCPResponse {
    if (!params || typeof params !== "object") {
      return createMCPError(id, MCP_ERROR_CODES.INVALID_PARAMS, "Invalid params");
    }

    const { name, arguments: args } = params as {
      name: string;
      arguments: Record<string, unknown>;
    };

    try {
      switch (name) {
        case "get_profile":
          return createMCPResponse(id, { profile: this.profile });
        case "get_identity":
          return createMCPResponse(id, { identity: this.profile?.identity });
        case "update_identity":
          return this.toolUpdateIdentity(id, args);
        case "get_contact":
          return this.toolGetContact(id, args);
        case "add_contact":
          return this.toolAddContact(id, args);
        case "get_preferences":
          return createMCPResponse(id, { preferences: this.profile?.preferences });
        case "get_preference":
          return this.toolGetPreference(id, args);
        case "set_preference":
          return this.toolSetPreference(id, args);
        case "get_resume":
          return createMCPResponse(id, { resume: this.profile?.resume_profile });
        case "update_resume":
          return this.toolUpdateResume(id, args);
        case "add_to_history":
          return this.toolAddToHistory(id, args);
        case "get_history":
          return this.toolGetHistory(id, args);
        default:
          return createMCPError(id, MCP_ERROR_CODES.METHOD_NOT_FOUND, `Unknown tool: ${name}`);
      }
    } catch (error) {
      return createMCPError(id, MCP_ERROR_CODES.INTERNAL_ERROR, `Tool error: ${error}`);
    }
  }

  private toolUpdateIdentity(id: string | number, args: Record<string, unknown>): MCPResponse {
    if (this.profile) {
      this.profile.identity = { ...this.profile.identity, ...args as Partial<UserProfile["identity"]> };
      this.saveProfile();
    }
    return createMCPResponse(id, { success: true, identity: this.profile?.identity });
  }

  private toolGetContact(id: string | number, args: Record<string, unknown>): MCPResponse {
    const name = args.name as string;
    const contact = this.profile?.contacts[name];
    return createMCPResponse(id, { contact: contact || null, found: !!contact });
  }

  private toolAddContact(id: string | number, args: Record<string, unknown>): MCPResponse {
    const name = args.name as string;
    const contact = args.contact as Contact;
    if (this.profile) {
      this.profile.contacts[name] = contact;
      this.saveProfile();
    }
    return createMCPResponse(id, { success: true });
  }

  private toolGetPreference(id: string | number, args: Record<string, unknown>): MCPResponse {
    const key = args.key as string;
    const value = this.profile?.preferences[key];
    return createMCPResponse(id, { key, value: value || null });
  }

  private toolSetPreference(id: string | number, args: Record<string, unknown>): MCPResponse {
    const key = args.key as string;
    const value = args.value;
    if (this.profile) {
      this.profile.preferences[key] = value;
      this.saveProfile();
    }
    return createMCPResponse(id, { success: true });
  }

  private toolUpdateResume(id: string | number, args: Record<string, unknown>): MCPResponse {
    if (this.profile) {
      this.profile.resume_profile = { ...this.profile.resume_profile, ...args as Partial<UserProfile["resume_profile"]> };
      this.saveProfile();
    }
    return createMCPResponse(id, { success: true, resume: this.profile?.resume_profile });
  }

  private toolAddToHistory(id: string | number, args: Record<string, unknown>): MCPResponse {
    const command = args.command as string;
    const success = args.success as boolean ?? true;
    if (this.profile) {
      this.profile.command_history.push({ command, timestamp: Date.now(), success });
      if (this.profile.command_history.length > 100) {
        this.profile.command_history = this.profile.command_history.slice(-100);
      }
      this.saveProfile();
    }
    return createMCPResponse(id, { success: true });
  }

  private toolGetHistory(id: string | number, args: Record<string, unknown>): MCPResponse {
    const limit = (args.limit as number) || 20;
    const history = this.profile?.command_history.slice(-limit) || [];
    return createMCPResponse(id, { history, count: history.length });
  }
}
