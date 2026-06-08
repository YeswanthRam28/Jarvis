#!/usr/bin/env node

import { Command } from 'commander';
import * as dotenv from 'dotenv';
import { ConfigLoader } from '../config/loader';
import { Logger } from '../utils/logger';
import { NVIDIAAPIClient } from '../ai/nvidia_client';
import { ContextStore } from '../pipeline/context_store';
import { IntentParser } from '../pipeline/intent_parser';
import { DecisionPlanner } from '../pipeline/decision_planner';
import { ProfileManager } from '../context/profile_manager';

dotenv.config();

const program = new Command();
const logger = Logger.getInstance();

function checkApiKey(): NVIDIAAPIClient {
  const nvidiaClient = NVIDIAAPIClient.getInstance();
  if (!nvidiaClient.hasApiKey()) {
    console.error('\n Error: NV_API_KEY environment variable is not set.');
    console.error(' Please set it with: export NV_API_KEY=your_api_key\n');
    console.error(' Get your API key at: https://developer.nvidia.com/nim\n');
    process.exit(1);
  }
  return nvidiaClient;
}

program
  .name('jarvis')
  .description('JARVIS - Just A Rather Very Intelligent System')
  .version('0.1.0');

program
  .command('run')
  .description('Run a JARVIS command')
  .argument('<command>', 'The natural language command to execute')
  .option('-s, --silent', 'Suppress output except results')
  .action(async (command: string, options: { silent?: boolean }) => {
    checkApiKey();
    const contextStore = ContextStore.getInstance();
    const profileManager = ProfileManager.getInstance();
    const intentParser = IntentParser.getInstance();
    const decisionPlanner = DecisionPlanner.getInstance();

    try {
      console.log(`\n JARVIS > Received command: "${command}"`);

      contextStore.createSession(command);
      profileManager.load();

      if (!options.silent) {
        console.log(`\n Session ID: ${contextStore.getSession()?.session_id}`);
      }

      if (!options.silent) console.log('\n[Stage 1] Intent Parser');

      const parseResult = await intentParser.parse(command);

      if (!parseResult.success) {
        console.error(`\n Error: ${parseResult.error}\n`);
        contextStore.completeSession('failed', parseResult.error);
        process.exit(1);
      }

      if (parseResult.clarificationQuestion) {
        console.log(`\n JARVIS > ${parseResult.clarificationQuestion}\n`);
        contextStore.completeSession('completed');
        process.exit(0);
      }

      if (!parseResult.intentGraph) {
        console.error('\n Error: No intent graph generated\n');
        contextStore.completeSession('failed', 'No intent graph');
        process.exit(1);
      }

      const intentGraph = parseResult.intentGraph;
      contextStore.setIntentGraph(intentGraph);

      if (!options.silent) {
        console.log(`\n Parsed ${intentGraph.intents.length} intent(s):`);
        for (const intent of intentGraph.intents) {
          const deps = intent.depends_on?.length
            ? ` (depends on: ${intent.depends_on.join(', ')})`
            : '';
          console.log(`   - ${intent.id}: ${intent.action} -> ${intent.subject}${deps}`);
        }
        console.log('\n[Stage 2] Decision Planner');
      }

      const planResult = await decisionPlanner.plan(intentGraph);

      if (!planResult.success || !planResult.taskDAG) {
        console.error(`\n Error: ${planResult.error || 'Failed to create plan'}\n`);
        contextStore.completeSession('failed', planResult.error);
        process.exit(1);
      }

      const taskDAG = planResult.taskDAG;
      contextStore.setTaskDAG(taskDAG);

      if (!options.silent) {
        console.log(
          `\n Generated ${taskDAG.tasks.length} task(s) in ${taskDAG.parallel_groups.length} parallel group(s):`
        );
        for (const task of taskDAG.tasks) {
          const deps = task.depends_on?.length ? ` [depends: ${task.depends_on.join(', ')}]` : '';
          const confirm = task.requires_confirm ? ' [CONFIRM]' : '';
          console.log(`   - ${task.task_id}: ${task.tool} (${task.mcp_server})${deps}${confirm}`);
        }
        console.log(`\n Estimated time: ~${taskDAG.total_estimated_seconds}s`);
        if (taskDAG.checkpoints.length > 0) {
          console.log(` Checkpoints: ${taskDAG.checkpoints.join(', ')}`);
        }
        console.log('\n[Stages 1-2 Complete] Pipeline ready');
        console.log('\n (Stages 3-5: Tool Caller, Executor, Reporter coming next)\n');
      }

      contextStore.completeSession('completed');
    } catch (error) {
      logger.error(`Command failed: ${error}`);
      console.error(`\n Error: ${error}\n`);
      contextStore.completeSession('failed', String(error));
      process.exit(1);
    }
  });

program
  .command('exec')
  .description('Execute a command with full pipeline (all 5 stages)')
  .argument('<command>', 'The natural language command to execute')
  .option('-s, --silent', 'Suppress output except results')
  .option('--no-notify', 'Disable notifications')
  .option('--no-tts', 'Disable text-to-speech')
  .option('--no-start-servers', 'Dont start MCP servers (assume already running)')
  .option('-p, --port <ports...>', 'MCP server ports (format: server:port)')
  .action(
    async (
      command: string,
      options: {
        silent?: boolean;
        notify?: boolean;
        tts?: boolean;
        startServers?: boolean;
        port?: string[];
      }
    ) => {
      const { JARVISPipeline } = await import('../pipeline/jarvis_pipeline');
      const pipeline = JARVISPipeline.getInstance();

      pipeline.setConfig({
        sendNotifications: options.notify !== false,
        useTTS: options.tts !== false,
        startMCPServers: options.startServers !== false,
      });

      const contextStore = ContextStore.getInstance();
      const profileManager = ProfileManager.getInstance();

      try {
        console.log(`\n JARVIS > Executing: "${command}"`);

        contextStore.createSession(command);
        profileManager.load();

        const onProgress = (stage: string, message: string) => {
          if (!options.silent) {
            const stageNames: Record<string, string> = {
              setup: 'Setup',
              intent_parser: 'Intent Parser',
              decision_planner: 'Decision Planner',
              tool_caller: 'Tool Caller',
              executor: 'Executor',
              reporter: 'Reporter',
            };
            console.log(`\n[${stageNames[stage] || stage}] ${message}`);
          }
        };

        const result = await pipeline.run(command, onProgress);

        if (result.clarificationQuestion) {
          console.log(`\n JARVIS > ${result.clarificationQuestion}\n`);
          process.exit(0);
        }

        if (!result.success) {
          console.error(`\n Error: ${result.error}\n`);
          process.exit(1);
        }

        if (result.report) {
          console.log(`\n${'─'.repeat(50)}`);
          console.log('\n Session Report:');
          console.log(
            ` Tasks completed: ${result.report.tasks_completed}/${result.report.tasks_completed + result.report.tasks_failed}`
          );
          console.log(` Summary: ${result.report.summary}`);
          console.log('');
        }

        contextStore.completeSession('completed');
        await pipeline.shutdown();
        process.exit(0);
      } catch (error) {
        logger.error(`Execution failed: ${error}`);
        console.error(`\n Error: ${error}\n`);
        contextStore.completeSession('failed', String(error));
        process.exit(1);
      }
    }
  );

program
  .command('run-servers')
  .description('Start all MCP servers and keep them running')
  .option('-o, --once', 'Start servers once and exit (dont keep running)')
  .action(async (options: { once?: boolean }) => {
    checkApiKey();
    const { MCPRegistry } = await import('../mcps/registry');
    const mcpRegistry = MCPRegistry.getInstance();

    console.log('\n[Starting MCP Servers]');

    const servers = [
      'mcp-memory',
      'mcp-user-profile',
      'mcp-browser',
      'mcp-filesystem',
      'mcp-code',
      'mcp-payment',
      'mcp-email',
      'mcp-calendar',
    ];

    for (const server of servers) {
      try {
        await mcpRegistry.registerServer(server);
        await mcpRegistry.startServer(server);
        console.log(`  ✓ ${server}`);
      } catch (error) {
        console.log(`  ✗ ${server}: ${error}`);
      }
    }

    console.log('\n[All servers started]');

    if (!options.once) {
      console.log('Press Ctrl+C to stop\n');
      // Keep process running
      process.on('SIGINT', async () => {
        console.log('\n[Shutting down]');
        await mcpRegistry.shutdown();
        process.exit(0);
      });
      
      // Wait forever
      await new Promise(() => {});
    } else {
      await mcpRegistry.shutdown();
    }
  });

program
  .command('parse')
  .description('Parse a command and show intent graph')
  .argument('<command>', 'The natural language command to parse')
  .action(async (command: string) => {
    checkApiKey();
    const profileManager = ProfileManager.getInstance();
    const intentParser = IntentParser.getInstance();

    try {
      console.log(`\n JARVIS > Parsing: "${command}"\n`);

      profileManager.load();

      const result = await intentParser.parse(command);

      if (!result.success) {
        console.error(`\n Error: ${result.error}\n`);
        process.exit(1);
      }

      if (result.clarificationQuestion) {
        console.log(` Clarification needed: ${result.clarificationQuestion}\n`);
        process.exit(0);
      }

      if (result.intentGraph) {
        console.log(' Intent Graph:');
        console.log(JSON.stringify(result.intentGraph, null, 2));
      }
    } catch (error) {
      logger.error(`Parse failed: ${error}`);
      console.error(`\n Error: ${error}\n`);
      process.exit(1);
    }
  });

program
  .command('plan')
  .description('Parse command and generate task DAG')
  .argument('<command>', 'The natural language command to plan')
  .action(async (command: string) => {
    checkApiKey();
    const profileManager = ProfileManager.getInstance();
    const intentParser = IntentParser.getInstance();
    const decisionPlanner = DecisionPlanner.getInstance();

    try {
      console.log(`\n JARVIS > Planning: "${command}"\n`);

      profileManager.load();

      const parseResult = await intentParser.parse(command);

      if (!parseResult.success || !parseResult.intentGraph) {
        console.error(`\n Error: ${parseResult.error || 'Failed to parse'}\n`);
        process.exit(1);
      }

      if (parseResult.clarificationQuestion) {
        console.log(` Clarification needed: ${parseResult.clarificationQuestion}\n`);
        process.exit(0);
      }

      console.log(' Intent Graph:');
      console.log(JSON.stringify(parseResult.intentGraph, null, 2));

      const planResult = await decisionPlanner.plan(parseResult.intentGraph);

      if (!planResult.success || !planResult.taskDAG) {
        console.error(`\n Error: ${planResult.error || 'Failed to plan'}\n`);
        process.exit(1);
      }

      console.log('\n Task DAG:');
      console.log(JSON.stringify(planResult.taskDAG, null, 2));
    } catch (error) {
      logger.error(`Plan failed: ${error}`);
      console.error(`\n Error: ${error}\n`);
      process.exit(1);
    }
  });

program
  .command('config')
  .description('View or update configuration')
  .option('-p, --path', 'Show config file path')
  .action((options: { path?: boolean }) => {
    const configLoader = ConfigLoader.getInstance();
    const config = configLoader.getConfig();

    if (options.path) {
      console.log(`Config file: ${configLoader.getConfigPath()}`);
    } else {
      console.log('\nCurrent Configuration:');
      console.log(JSON.stringify(config, null, 2));
    }
  });

program
  .command('profile')
  .description('View or update user profile')
  .option('-g, --get', 'Get current profile')
  .option('-s, --set <json>', 'Update profile with JSON')
  .action((options: { get?: boolean; set?: string }) => {
    const profileManager = ProfileManager.getInstance();
    profileManager.load();

    if (options.get || (!options.get && !options.set)) {
      const profile = profileManager.getProfile();
      console.log('\nUser Profile:');
      console.log(JSON.stringify(profile, null, 2));
    } else if (options.set) {
      try {
        const updates = JSON.parse(options.set);
        if (updates.identity) {
          profileManager.updateIdentity(updates.identity);
        }
        if (updates.contacts) {
          for (const [name, contact] of Object.entries(updates.contacts)) {
            profileManager.addContact(
              name,
              contact as Parameters<typeof profileManager.addContact>[1]
            );
          }
        }
        if (updates.preferences) {
          for (const [key, value] of Object.entries(updates.preferences)) {
            profileManager.setPreference(
              key,
              value as Parameters<typeof profileManager.setPreference>[1]
            );
          }
        }
        console.log('\nProfile updated successfully!\n');
      } catch (error) {
        console.error(`\n Error parsing JSON: ${error}\n`);
        process.exit(1);
      }
    }
  });

program
  .command('init')
  .description('Initialize JARVIS configuration')
  .action(() => {
    const configLoader = ConfigLoader.getInstance();
    configLoader.load();
    console.log('\n JARVIS configuration initialized successfully!');
    console.log(` Config file: ${configLoader.getConfigPath()}`);

    const profileManager = ProfileManager.getInstance();
    profileManager.load();
    console.log(` Profile file: ${profileManager.getProfilePath()}\n`);
  });

program
  .command('mcp')
  .description('Manage MCP servers')
  .addCommand(
    new Command('start')
      .description('Start an MCP server')
      .argument('<server>', 'Server name (e.g., mcp-memory, mcp-user-profile)')
      .action(async (server: string) => {
        const { MCPRegistry } = await import('../mcps/registry');
        const registry = MCPRegistry.getInstance();
        await registry.initialize();

        try {
          await registry.registerServer(server);
          await registry.startServer(server);
          console.log(`\n MCP server '${server}' started successfully\n`);
        } catch (error) {
          console.error(`\n Failed to start server: ${error}\n`);
          process.exit(1);
        }
      })
  )
  .addCommand(
    new Command('stop')
      .description('Stop an MCP server')
      .argument('<server>', 'Server name')
      .action(async (server: string) => {
        const { MCPRegistry } = await import('../mcps/registry');
        const registry = MCPRegistry.getInstance();
        await registry.initialize();

        try {
          await registry.stopServer(server);
          console.log(`\n MCP server '${server}' stopped\n`);
        } catch (error) {
          console.error(`\n Failed to stop server: ${error}\n`);
          process.exit(1);
        }
      })
  )
  .addCommand(
    new Command('list').description('List all registered MCP servers').action(async () => {
      const { MCPRegistry } = await import('../mcps/registry');
      const registry = MCPRegistry.getInstance();
      await registry.initialize();

      const servers = registry.getAllServers();

      console.log('\n Registered MCP Servers:');
      console.log('─'.repeat(50));

      if (servers.size === 0) {
        console.log(' No servers registered');
      } else {
        for (const [name, info] of servers) {
          const status = info.status === 'running' ? '\x1b[32m●\x1b[0m' : '\x1b[31m○\x1b[0m';
          console.log(
            ` ${status} ${name.padEnd(20)} ${info.status.padEnd(10)} ${info.tools.length} tools`
          );
        }
      }
      console.log('');
    })
  )
  .addCommand(
    new Command('tools')
      .description('List tools available from MCP servers')
      .argument('[server]', 'Optional: specific server name')
      .action(async (server?: string) => {
        const { MCPRegistry } = await import('../mcps/registry');
        const registry = MCPRegistry.getInstance();
        await registry.initialize();

        if (server) {
          const info = registry.getServerInfo(server);
          if (!info) {
            console.error(`\n Server '${server}' not found\n`);
            process.exit(1);
          }
          console.log(`\n Tools from ${server}:`);
          console.log('─'.repeat(50));
          for (const tool of info.tools) {
            console.log(` \x1b[33m${tool.name}\x1b[0m`);
            console.log(`   ${tool.description}`);
          }
        } else {
          const servers = registry.getAllServers();
          console.log('\n All MCP Tools:');
          console.log('─'.repeat(50));
          for (const [name, info] of servers) {
            console.log(`\n \x1b[1m${name}\x1b[0m (${info.tools.length} tools)`);
            for (const tool of info.tools) {
              console.log(`   \x1b[33m${tool.name}\x1b[0m - ${tool.description.slice(0, 50)}...`);
            }
          }
        }
        console.log('');
      })
  )
  .addCommand(
    new Command('call')
      .description('Call an MCP tool directly')
      .argument('<server>', 'Server name')
      .argument('<tool>', 'Tool name')
      .argument('[args]', 'JSON arguments (optional)')
      .action(async (server: string, tool: string, args?: string) => {
        const { MCPRegistry } = await import('../mcps/registry');
        const registry = MCPRegistry.getInstance();
        await registry.initialize();

        const info = registry.getServerInfo(server);
        if (!info || info.status !== 'running') {
          console.error(
            `\n Server '${server}' is not running. Start it with: jarvis mcp start ${server}\n`
          );
          process.exit(1);
        }

        let parsedArgs: Record<string, unknown> = {};
        if (args) {
          try {
            parsedArgs = JSON.parse(args);
          } catch {
            console.error('\n Invalid JSON arguments\n');
            process.exit(1);
          }
        }

        try {
          console.log(`\n Calling ${server}.${tool}...`);
          const result = await registry.callTool(server, tool, parsedArgs);

          if (result.success) {
            console.log('\n Result:');
            console.log(JSON.stringify(result.result, null, 2));
          } else {
            console.error(`\n Error: ${result.error}\n`);
            process.exit(1);
          }
        } catch (error) {
          console.error(`\n Tool call failed: ${error}\n`);
          process.exit(1);
        }
      })
  )
  .addCommand(
    new Command('start-all').description('Start all registered MCP servers').action(async () => {
      const { MCPRegistry } = await import('../mcps/registry');
      const registry = MCPRegistry.getInstance();
      await registry.initialize();

      const servers = ['mcp-memory', 'mcp-user-profile'];

      console.log('\n Starting MCP servers...\n');

      for (const server of servers) {
        try {
          await registry.registerServer(server);
          await registry.startServer(server);
          console.log(` \x1b[32m✓\x1b[0m ${server}`);
        } catch (error) {
          console.log(` \x1b[31m✗\x1b[0m ${server}: ${error}`);
        }
      }

      console.log('');
    })
  );

program.parse();
