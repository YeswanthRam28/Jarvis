export interface PipelineResult {
  success: boolean;
  sessionId: string;
  report?: {
    summary: string;
    tasks_completed: number;
    tasks_failed: number;
  };
  error?: string;
  clarificationQuestion?: string;
}

declare global {
  interface Window {
    jarvisAPI: {
      runCommand: (command: string) => Promise<PipelineResult>;
      synthesize: (text: string) => Promise<{ success: boolean; audio?: string; error?: string }>;
      transcribe: (base64Audio: string) => Promise<{ success: boolean; text?: string; error?: string }>;
      onProgress: (callback: (stage: string, message: string) => void) => void;
      getMemories: () => Promise<{ success: boolean; memories?: any[]; error?: string }>;
  deleteMemory: (id: number) => Promise<{ success: boolean; deleted?: boolean; error?: string }>;
  hideWindow: () => void;
      removeListeners: () => void;
    };
  }
}
