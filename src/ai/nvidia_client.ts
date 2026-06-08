import axios, { AxiosInstance, AxiosError } from "axios";
import { Logger } from "../utils/logger";

export interface ChatMessage {
  role: "system" | "user" | "assistant";
  content: string;
}

export interface ChatCompletionRequest {
  model: string;
  messages: ChatMessage[];
  temperature?: number;
  max_tokens?: number;
  top_p?: number;
  stream?: boolean;
  stop?: string[];
}

export interface ChatCompletionChoice {
  index: number;
  message: ChatMessage;
  finish_reason: string;
}

export interface ChatCompletionResponse {
  id: string;
  object: string;
  created: number;
  model: string;
  choices: ChatCompletionChoice[];
  usage: {
    prompt_tokens: number;
    completion_tokens: number;
    total_tokens: number;
  };
}

export interface StreamChunk {
  id: string;
  object: string;
  created: number;
  model: string;
  choices: {
    index: number;
    delta: {
      content?: string;
      role?: string;
    };
    finish_reason?: string;
  }[];
}

export class NVIDIAAPIClient {
  private static instance: NVIDIAAPIClient;
  private client: AxiosInstance;
  private apiKey: string;
  private logger: Logger;
  private baseURL = "https://integrate.api.nvidia.com/v1";

  private maxRetries = 3;
  private baseDelayMs = 1000;

  private constructor() {
    this.logger = Logger.getInstance();
    this.apiKey = process.env.NV_API_KEY || "";

    if (!this.apiKey) {
      this.logger.warn("NV_API_KEY environment variable not set");
    }

    this.client = axios.create({
      baseURL: this.baseURL,
      headers: {
        Authorization: `Bearer ${this.apiKey}`,
        "Content-Type": "application/json",
      },
      timeout: 120000,
    });
  }

  public static getInstance(): NVIDIAAPIClient {
    if (!NVIDIAAPIClient.instance) {
      NVIDIAAPIClient.instance = new NVIDIAAPIClient();
    }
    return NVIDIAAPIClient.instance;
  }

  public async chat(request: ChatCompletionRequest): Promise<ChatCompletionResponse> {
    let lastError: Error | null = null;

    for (let attempt = 0; attempt <= this.maxRetries; attempt++) {
      try {
        this.logger.debug(`Calling NVIDIA API with model: ${request.model} (attempt ${attempt + 1}/${this.maxRetries + 1})`);
        const response = await this.client.post<ChatCompletionResponse>("/chat/completions", request);
        return response.data;
      } catch (error) {
        lastError = error instanceof Error ? error : new Error(String(error));

        if (axios.isAxiosError(error) && error.response) {
          const status = error.response.status;
          if (status === 429 || status >= 500) {
            const delay = this.baseDelayMs * Math.pow(2, attempt);
            this.logger.warn(`NVIDIA API ${status}. Retrying in ${delay}ms... (attempt ${attempt + 1}/${this.maxRetries + 1})`);

            if (attempt < this.maxRetries) {
              await this.sleep(delay);
              continue;
            }
          }
        }

        this.handleError(error);
        throw error;
      }
    }

    throw lastError || new Error("NVIDIA API call failed after retries");
  }

  private sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  public async chatStream(
    request: ChatCompletionRequest,
    onChunk: (chunk: StreamChunk) => void,
    onComplete: () => void,
    onError: (error: Error) => void
  ): Promise<void> {
    let lastError: Error | null = null;

    for (let attempt = 0; attempt <= this.maxRetries; attempt++) {
      try {
        this.logger.debug(`Streaming from NVIDIA API with model: ${request.model} (attempt ${attempt + 1}/${this.maxRetries + 1})`);

        if (attempt > 0) {
          const delay = this.baseDelayMs * Math.pow(2, attempt - 1);
          this.logger.warn(`Retrying stream after ${delay}ms...`);
          await this.sleep(delay);
        }

        await this.doStream(request, onChunk, onComplete);
        return;
      } catch (error) {
        lastError = error instanceof Error ? error : new Error(String(error));

        if (axios.isAxiosError(error) && error.response?.status === 429) {
          const delay = this.baseDelayMs * Math.pow(2, attempt);
          this.logger.warn(`NVIDIA API rate limited (429) during stream. Retrying in ${delay}ms...`);

          if (attempt < this.maxRetries) {
            await this.sleep(delay);
            continue;
          }
        }

        this.handleError(error);
        onError(lastError);
        return;
      }
    }

    onError(lastError || new Error("Stream failed after retries"));
  }

  private async doStream(
    request: ChatCompletionRequest,
    onChunk: (chunk: StreamChunk) => void,
    onComplete: () => void
  ): Promise<void> {
    const response = await this.client.post(
      "/chat/completions",
      { ...request, stream: true },
      { responseType: "stream" }
    );

    let buffer = "";

    response.data.on("data", (chunk: Buffer) => {
      buffer += chunk.toString();
      const lines = buffer.split("\n");
      buffer = lines.pop() || "";

      for (const line of lines) {
        if (line.startsWith("data: ")) {
          const data = line.slice(6);
          if (data === "[DONE]") {
            onComplete();
            return;
          }
          try {
            const parsed = JSON.parse(data) as StreamChunk;
            onChunk(parsed);
          } catch {
            this.logger.debug(`Failed to parse stream chunk: ${data}`);
          }
        }
      }
    });

    return new Promise((resolve, reject) => {
      response.data.on("end", () => {
        onComplete();
        resolve();
      });

      response.data.on("error", (error: Error) => {
        reject(error);
      });
    });
  }

  public async chatSimple(
    model: string,
    systemPrompt: string,
    userMessage: string,
    temperature = 0.7,
    maxTokens = 2048
  ): Promise<string> {
    const response = await this.chat({
      model,
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: userMessage },
      ],
      temperature,
      max_tokens: maxTokens,
    });

    return response.choices[0]?.message?.content || "";
  }

  public setApiKey(apiKey: string): void {
    this.apiKey = apiKey;
    this.client.defaults.headers["Authorization"] = `Bearer ${this.apiKey}`;
    this.logger.info("API key updated");
  }

  public hasApiKey(): boolean {
    return !!this.apiKey && this.apiKey.length > 0;
  }

  private handleError(error: unknown): void {
    if (axios.isAxiosError(error)) {
      const axiosError = error as AxiosError;
      if (axiosError.response) {
        const status = axiosError.response.status;
        const data = axiosError.response.data as { error?: { message?: string } };
        const message = data?.error?.message || "Unknown error";

        switch (status) {
          case 401:
            this.logger.error(`NVIDIA API Authentication failed: ${message}`);
            break;
          case 429:
            this.logger.error(`NVIDIA API Rate limit exceeded: ${message}`);
            break;
          case 500:
            this.logger.error(`NVIDIA API Server error: ${message}`);
            break;
          default:
            this.logger.error(`NVIDIA API Error (${status}): ${message}`);
        }
      } else if (axiosError.request) {
        this.logger.error("NVIDIA API No response received");
      }
    } else {
      this.logger.error(`Unexpected error: ${error}`);
    }
  }
}
