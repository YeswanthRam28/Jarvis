import { v4 as uuidv4 } from "uuid";
import { Logger } from "../utils/logger";

export interface IntentGraph {
  session_id: string;
  raw_input: string;
  intents: Intent[];
  user_context: {
    preferences_loaded: boolean;
    profile_used: string[];
  };
}

export interface Intent {
  id: string;
  action: string;
  subject: string;
  filters?: Record<string, unknown>;
  output_label: string;
  depends_on?: string[];
  filter?: string;
  channel?: string;
  recipient?: string;
  content_template?: string;
}

export interface TaskDAG {
  plan_id: string;
  tasks: Task[];
  total_estimated_seconds: number;
  parallel_groups: string[][];
  checkpoints: string[];
}

export interface Task {
  task_id: string;
  intent_id: string;
  tool: string;
  mcp_server: string;
  executor_model: string;
  params: Record<string, unknown>;
  output_key: string;
  fallback?: string;
  requires_confirm: boolean;
  confirm_message?: string;
  estimated_seconds: number;
  depends_on?: string[];
}

export interface TaskResult {
  task_id: string;
  success: boolean;
  output: unknown;
  error?: string;
  duration_ms: number;
}

export interface PipelineSession {
  session_id: string;
  start_time: number;
  end_time?: number;
  status: "running" | "completed" | "failed" | "cancelled";
  current_stage?: PipelineStageName;
  intent_graph?: IntentGraph;
  task_dag?: TaskDAG;
  task_results: TaskResult[];
  raw_input: string;
  error?: string;
}

export type PipelineStageName = "intent_parser" | "decision_planner" | "tool_caller" | "executor" | "reporter";

export class ContextStore {
  private static instance: ContextStore;
  private store: Map<string, unknown>;
  private session: PipelineSession | null = null;
  private logger: Logger;
  private watchers: Map<string, Set<(value: unknown) => void>>;

  private constructor() {
    this.store = new Map();
    this.logger = Logger.getInstance();
    this.watchers = new Map();
  }

  public static getInstance(): ContextStore {
    if (!ContextStore.instance) {
      ContextStore.instance = new ContextStore();
    }
    return ContextStore.instance;
  }

  public createSession(rawInput: string): PipelineSession {
    this.session = {
      session_id: uuidv4(),
      start_time: Date.now(),
      status: "running",
      task_results: [],
      raw_input: rawInput,
    };
    this.store.clear();
    this.set("session", this.session);
    this.logger.info(`Created new session: ${this.session.session_id}`);
    return this.session;
  }

  public getSession(): PipelineSession | null {
    return this.session;
  }

  public updateSession(updates: Partial<PipelineSession>): void {
    if (this.session) {
      this.session = { ...this.session, ...updates };
      this.set("session", this.session);
    }
  }

  public completeSession(status: "completed" | "failed" | "cancelled", error?: string): void {
    if (this.session) {
      this.session.end_time = Date.now();
      this.session.status = status;
      if (error) {
        this.session.error = error;
      }
      this.set("session", this.session);
      this.logger.info(`Session ${this.session.session_id} ${status}`);
    }
  }

  public set(key: string, value: unknown): void {
    this.store.set(key, value);
    this.notifyWatchers(key, value);
  }

  public get<T>(key: string): T | undefined {
    return this.store.get(key) as T | undefined;
  }

  public has(key: string): boolean {
    return this.store.has(key);
  }

  public delete(key: string): boolean {
    return this.store.delete(key);
  }

  public clear(): void {
    this.store.clear();
    this.logger.debug("Context store cleared");
  }

  public watch(key: string, callback: (value: unknown) => void): () => void {
    if (!this.watchers.has(key)) {
      this.watchers.set(key, new Set());
    }
    this.watchers.get(key)!.add(callback);

    return () => {
      this.watchers.get(key)?.delete(callback);
    };
  }

  private notifyWatchers(key: string, value: unknown): void {
    const keyWatchers = this.watchers.get(key);
    if (keyWatchers) {
      keyWatchers.forEach((callback) => callback(value));
    }
  }

  public setIntentGraph(intentGraph: IntentGraph): void {
    this.set("intent_graph", intentGraph);
    this.updateSession({ intent_graph: intentGraph });
  }

  public getIntentGraph(): IntentGraph | undefined {
    return this.get<IntentGraph>("intent_graph");
  }

  public setTaskDAG(taskDAG: TaskDAG): void {
    this.set("task_dag", taskDAG);
    this.updateSession({ task_dag: taskDAG });
  }

  public getTaskDAG(): TaskDAG | undefined {
    return this.get<TaskDAG>("task_dag");
  }

  public setTaskResult(_taskId: string, result: TaskResult): void {
    const results = this.get<TaskResult[]>("task_results") || [];
    results.push(result);
    this.set("task_results", results);

    if (this.session) {
      this.session.task_results.push(result);
    }
  }

  public getTaskResults(): TaskResult[] {
    return this.get<TaskResult[]>("task_results") || [];
  }

  public hydrateParams(params: Record<string, unknown>): Record<string, unknown> {
    const hydrated: Record<string, unknown> = {};

    for (const [key, value] of Object.entries(params)) {
      if (typeof value === "string") {
        hydrated[key] = this.hydrateString(value);
      } else {
        hydrated[key] = value;
      }
    }

    return hydrated;
  }

  private hydrateString(str: string): string {
    const templateRegex = /\{\{([^}]+)\}\}/g;
    return str.replace(templateRegex, (_, path) => {
      const value = this.getByPath(path.trim());
      return value !== undefined ? String(value) : `{{${path}}}`;
    });
  }

  private getByPath(path: string): unknown {
    const parts = path.split(".");
    let current: unknown = this.store;

    for (const part of parts) {
      if (current === null || current === undefined) {
        return undefined;
      }

      if (current instanceof Map) {
        current = (current as Map<string, unknown>).get(part);
      } else if (typeof current === "object") {
        current = (current as Record<string, unknown>)[part];
      } else {
        return undefined;
      }
    }

    return current;
  }

  public async waitForDependencies(dependsOn: string[] | undefined): Promise<void> {
    if (!dependsOn || dependsOn.length === 0) {
      return;
    }

    const results = this.getTaskResults();
    const completedTaskIds = new Set(results.map((r) => r.task_id));

    const pending = dependsOn.filter((id) => !completedTaskIds.has(id));

    if (pending.length > 0) {
      this.logger.debug(`Waiting for dependencies: ${pending.join(", ")}`);

      await new Promise<void>((resolve) => {
        const checkInterval = setInterval(() => {
          const updatedResults = this.getTaskResults();
          const updatedCompleted = new Set(updatedResults.map((r) => r.task_id));
          const allDone = pending.every((id) => updatedCompleted.has(id));

          if (allDone) {
            clearInterval(checkInterval);
            resolve();
          }
        }, 100);
      });
    }
  }

  public getFullLog(): Record<string, unknown> {
    return {
      session: this.session,
      store: Object.fromEntries(this.store),
      duration_ms: this.session?.end_time
        ? this.session.end_time - this.session.start_time
        : Date.now() - (this.session?.start_time || Date.now()),
    };
  }
}
