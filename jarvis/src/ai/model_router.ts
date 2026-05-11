import { NVIDIAAPIClient, ChatMessage } from "./nvidia_client";
import { ConfigLoader } from "../config/loader";
import { Logger } from "../utils/logger";

export type PipelineStage =
  | "intent_parser"
  | "decision_planner"
  | "tool_caller"
  | "executor"
  | "reporter";

export interface ModelConfig {
  model: string;
  temperature: number;
  maxTokens: number;
}

const STAGE_CONFIGS: Record<PipelineStage, { temperature: number; maxTokens: number }> = {
  intent_parser: { temperature: 0.3, maxTokens: 4096 },
  decision_planner: { temperature: 0.4, maxTokens: 4096 },
  tool_caller: { temperature: 0.2, maxTokens: 2048 },
  executor: { temperature: 0.5, maxTokens: 1024 },
  reporter: { temperature: 0.7, maxTokens: 2048 },
};

export class ModelRouter {
  private static instance: ModelRouter;
  private nvidiaClient: NVIDIAAPIClient;
  private configLoader: ConfigLoader;
  private logger: Logger;

  private constructor() {
    this.nvidiaClient = NVIDIAAPIClient.getInstance();
    this.configLoader = ConfigLoader.getInstance();
    this.logger = Logger.getInstance();
  }

  public static getInstance(): ModelRouter {
    if (!ModelRouter.instance) {
      ModelRouter.instance = new ModelRouter();
    }
    return ModelRouter.instance;
  }

  public getModelForStage(stage: PipelineStage): string {
    const config = this.configLoader.getConfig();

    switch (stage) {
      case "intent_parser":
        return config.models.intent_parser;
      case "decision_planner":
        return config.models.decision_planner;
      case "tool_caller":
        return config.models.tool_caller;
      case "executor":
        return config.models.executor;
      case "reporter":
        return config.models.reporter;
      default:
        this.logger.warn(`Unknown stage: ${stage}, using default model`);
        return config.models.intent_parser;
    }
  }

  public getStageConfig(stage: PipelineStage): { temperature: number; maxTokens: number } {
    return STAGE_CONFIGS[stage];
  }

  public async chat(
    stage: PipelineStage,
    systemPrompt: string,
    userMessage: string
  ): Promise<string> {
    const model = this.getModelForStage(stage);
    const stageConfig = this.getStageConfig(stage);

    this.logger.debug(`Routing to ${stage} with model ${model}`);

    const response = await this.nvidiaClient.chatSimple(
      model,
      systemPrompt,
      userMessage,
      stageConfig.temperature,
      stageConfig.maxTokens
    );

    return response;
  }

  public async chatWithHistory(
    stage: PipelineStage,
    systemPrompt: string,
    messages: ChatMessage[]
  ): Promise<string> {
    const model = this.getModelForStage(stage);
    const stageConfig = this.getStageConfig(stage);

    this.logger.debug(`Routing to ${stage} with model ${model} (with history)`);

    const fullMessages: ChatMessage[] = [
      { role: "system", content: systemPrompt },
      ...messages,
    ];

    const response = await this.nvidiaClient.chat({
      model,
      messages: fullMessages,
      temperature: stageConfig.temperature,
      max_tokens: stageConfig.maxTokens,
    });

    return response.choices[0]?.message?.content || "";
  }

  public async chatStructured<T>(
    stage: PipelineStage,
    systemPrompt: string,
    userMessage: string
  ): Promise<T> {
    const response = await this.chat(stage, systemPrompt, userMessage);

    try {
      const jsonMatch = response.match(/```(?:json)?\s*([\s\S]*?)```/) ||
                       response.match(/\{[\s\S]*\}/);

      if (jsonMatch) {
        const jsonStr = jsonMatch[1] || jsonMatch[0];
        return JSON.parse(jsonStr) as T;
      }

      return JSON.parse(response) as T;
    } catch (error) {
      this.logger.error(`Failed to parse structured response: ${error}`);
      throw new Error(`Failed to parse structured response: ${response}`);
    }
  }
}
