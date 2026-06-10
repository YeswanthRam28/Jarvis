import { Logger } from '../utils/logger';
import { MCPRegistry } from '../mcps/registry';
import { NVIDIAAPIClient } from '../ai/nvidia_client';
import Database from 'better-sqlite3';
import * as path from 'path';
import * as os from 'os';

export class NightlyReasoningJob {
  private logger: Logger;
  private mcpRegistry: MCPRegistry;
  private nvidiaClient: NVIDIAAPIClient;
  private db: Database.Database;

  constructor() {
    this.logger = Logger.getInstance();
    this.mcpRegistry = MCPRegistry.getInstance();
    this.nvidiaClient = NVIDIAAPIClient.getInstance();

    const homeDir = os.homedir();
    const dbPath = path.join(homeDir, '.jarvis', 'memory.db');
    this.db = new Database(dbPath);
  }

  public async run(): Promise<void> {
    this.logger.info('[Nightly Job] Starting memory consolidation...');
    
    try {
      // 1. Fetch episodic memories from the last 24 hours
      const oneDayAgo = Date.now() - 24 * 60 * 60 * 1000;
      const stmt = this.db.prepare('SELECT role, content FROM episodic_memory WHERE created_at > ? ORDER BY created_at ASC');
      const episodes = stmt.all(oneDayAgo) as { role: string; content: string }[];

      if (episodes.length === 0) {
        this.logger.info('[Nightly Job] No new episodes to process. Skipping.');
        return;
      }

      this.logger.info(`[Nightly Job] Processing ${episodes.length} episodes for semantic extraction.`);

      const transcript = episodes.map(e => `${e.role.toUpperCase()}: ${e.content}`).join('\n');

      // 2. Extract facts using the LLM
      const prompt = `You are an AI tasked with extracting long-term facts, preferences, and beliefs from a conversation transcript.
Analyze the following transcript and extract absolute facts about the USER.
Examples of good facts: "User prefers dark mode", "User lives in New York", "User hates repetitive emails".
Do NOT extract ephemeral tasks or specific one-time events.
Format your response as a JSON array of strings. Only output the JSON array.

Transcript:
${transcript}
`;

      const response = await this.nvidiaClient.chat({
        model: 'meta/llama3-70b-instruct', // Use a smart model for reasoning
        messages: [{ role: 'user', content: prompt }],
        temperature: 0.1,
      });

      const rawContent = response.choices[0]?.message?.content || '[]';
      let facts: string[] = [];
      try {
        const jsonMatch = rawContent.match(/\[[\s\S]*\]/);
        facts = JSON.parse(jsonMatch ? jsonMatch[0] : rawContent);
      } catch (e) {
        this.logger.warn(`[Nightly Job] Failed to parse facts JSON: ${rawContent}`);
      }

      // 3. Save extracted facts to semantic memory via MCP tool
      let added = 0;
      for (const fact of facts) {
        if (typeof fact === 'string' && fact.trim().length > 0) {
          try {
            await this.mcpRegistry.callTool('mcp-memory', 'add_semantic', { fact });
            added++;
          } catch (e) {
            this.logger.error(`[Nightly Job] Failed to save fact "${fact}": ${e}`);
          }
        }
      }

      this.logger.info(`[Nightly Job] Consolidation complete. Extracted and saved ${added} new facts.`);
    } catch (error) {
      this.logger.error(`[Nightly Job] Error during execution: ${error}`);
    }
  }

  public close() {
    this.db.close();
  }
}
