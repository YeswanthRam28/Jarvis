import * as fs from "fs";
import * as path from "path";
import * as os from "os";
import * as yaml from "yaml";
import { Logger } from "../utils/logger";

export interface JarvisConfig {
  jarvis: {
    name: string;
    wake_hotkey: string;
    voice_enabled: boolean;
    tts_enabled: boolean;
    hud_position: string;
  };
  models: {
    intent_parser: string;
    decision_planner: string;
    tool_caller: string;
    executor: string;
    reporter: string;
  };
  mcps: Record<
    string,
    {
      server: string;
      transport: string;
      auth?: string;
      db?: string;
    }
  >;
  safety: {
    require_confirm_for: string[];
    sandbox_shell: boolean;
    audit_log: boolean;
    audit_log_path: string;
  };
  execution: {
    max_parallel_tasks: number;
    task_timeout_seconds: number;
    retry_attempts: number;
    screenshot_verify: boolean;
  };
  learning: {
    enable_preference_learning: boolean;
    enable_command_history: boolean;
    suggest_macros: boolean;
  };
}

export class ConfigLoader {
  private static instance: ConfigLoader;
  private config: JarvisConfig | null = null;
  private configPath: string;
  private logger: Logger;

  private constructor() {
    this.logger = Logger.getInstance();
    const homeDir = os.homedir();
    this.configPath = path.join(homeDir, ".jarvis", "config.yaml");
  }

  public static getInstance(): ConfigLoader {
    if (!ConfigLoader.instance) {
      ConfigLoader.instance = new ConfigLoader();
    }
    return ConfigLoader.instance;
  }

  public load(): JarvisConfig {
    if (this.config) {
      return this.config;
    }

    const configDir = path.dirname(this.configPath);

    if (!fs.existsSync(configDir)) {
      this.logger.info(`Creating config directory: ${configDir}`);
      fs.mkdirSync(configDir, { recursive: true });
    }

    if (!fs.existsSync(this.configPath)) {
      this.logger.info(`Config file not found, creating default: ${this.configPath}`);
      this.createDefaultConfig();
    }

    try {
      const fileContent = fs.readFileSync(this.configPath, "utf-8");
      this.config = yaml.parse(fileContent) as JarvisConfig;
      this.logger.info("Configuration loaded successfully");
      return this.config;
    } catch (error) {
      this.logger.error(`Failed to load config: ${error}`);
      throw new Error(`Failed to load configuration: ${error}`);
    }
  }

  private createDefaultConfig(): void {
    const defaultConfig: JarvisConfig = {
      jarvis: {
        name: "JARVIS",
        wake_hotkey: "alt+j",
        voice_enabled: false,
        tts_enabled: false,
        hud_position: "top-right",
      },
      models: {
        intent_parser: "meta/llama-3.3-70b-instruct",
        decision_planner: "meta/llama-3.3-70b-instruct",
        tool_caller: "mistralai/mixtral-8x7b-instruct-v0.1",
        executor: "meta/llama-3.1-70b-instruct",
        reporter: "meta/llama-3.1-70b-instruct",
      },
      mcps: {
        browser: { server: "mcp-browser", transport: "sse" },
        desktop: { server: "mcp-desktop-ui", transport: "sse" },
        filesystem: { server: "mcp-filesystem", transport: "sse" },
        shell: { server: "mcp-shell", transport: "sse" },
        email: { server: "mcp-email", transport: "sse", auth: "oauth" },
        calendar: { server: "mcp-calendar", transport: "sse", auth: "oauth" },
        memory: { server: "mcp-memory", transport: "sse", db: "~/.jarvis/memory.db" },
        notifications: { server: "mcp-notifications", transport: "sse" },
        code: { server: "mcp-code", transport: "sse" },
      },
      safety: {
        require_confirm_for: ["delete", "send_message", "post", "submit_form", "payment"],
        sandbox_shell: true,
        audit_log: true,
        audit_log_path: "~/.jarvis/audit.log",
      },
      execution: {
        max_parallel_tasks: 3,
        task_timeout_seconds: 120,
        retry_attempts: 2,
        screenshot_verify: true,
      },
      learning: {
        enable_preference_learning: true,
        enable_command_history: true,
        suggest_macros: true,
      },
    };

    const fileContent = yaml.stringify(defaultConfig);
    fs.writeFileSync(this.configPath, fileContent, "utf-8");
    this.logger.info(`Default config written to ${this.configPath}`);
  }

  public getConfig(): JarvisConfig {
    if (!this.config) {
      return this.load();
    }
    return this.config;
  }

  public reload(): JarvisConfig {
    this.config = null;
    return this.load();
  }

  public getConfigPath(): string {
    return this.configPath;
  }
}
