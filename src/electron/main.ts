import { app, BrowserWindow, ipcMain, globalShortcut, Tray, Menu, nativeImage } from 'electron';
import * as path from 'path';
import * as dotenv from 'dotenv';
import { JARVISPipeline } from '../pipeline/jarvis_pipeline';

dotenv.config();

let mainWindow: BrowserWindow | null = null;
let tray: Tray | null = null;
let isQuitting = false;

// Initialize JARVIS Pipeline
const pipeline = JARVISPipeline.getInstance();
pipeline.setConfig({
  sendNotifications: true,
  useTTS: false,
  startMCPServers: true,
});

function createWindow() {
  mainWindow = new BrowserWindow({
    fullscreen: true,
    show: false, // Initially hidden
    frame: false, // Frameless window
    transparent: true,
    resizable: false,
    alwaysOnTop: true,
    skipTaskbar: true, // Don't show in taskbar
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      nodeIntegration: false,
      contextIsolation: true,
    },
  });

  // Load the Vite dev server URL in development, or the local file in production
  const isDev = !app.isPackaged && process.env.NODE_ENV !== 'production';
  
  if (isDev) {
    // Wait for Vite to start, then load, with auto-retry
    const loadDevServer = () => {
      mainWindow?.loadURL('http://localhost:5173').catch((err) => {
        console.log('Waiting for Vite dev server...');
        setTimeout(loadDevServer, 1000);
      });
    };
    loadDevServer();
    // Open DevTools in detached mode
    mainWindow.webContents.openDevTools({ mode: 'detach' });
  } else {
    mainWindow.loadFile(path.join(__dirname, '../../ui/dist/index.html'));
  }

  // Hide window when it loses focus (like Spotlight/Raycast)
  mainWindow.on('blur', () => {
    if (!mainWindow?.webContents.isDevToolsOpened()) {
      mainWindow?.hide();
    }
  });

  mainWindow.on('close', (event) => {
    if (!isQuitting) {
      event.preventDefault();
      mainWindow?.hide();
    }
  });
}

function toggleWindow() {
  if (!mainWindow) return;
  if (mainWindow.isVisible()) {
    mainWindow.hide();
  } else {
    mainWindow.show();
    mainWindow.focus();
  }
}

function createTray() {
  // Create a simple blank icon for the tray (replace with an actual icon later)
  const icon = nativeImage.createEmpty();
  tray = new Tray(icon);
  
  const contextMenu = Menu.buildFromTemplate([
    { label: 'Toggle JARVIS', click: () => toggleWindow() },
    { type: 'separator' },
    { label: 'Quit', click: () => {
      isQuitting = true;
      app.quit();
    }}
  ]);

  tray.setToolTip('JARVIS Personal OS');
  tray.setContextMenu(contextMenu);
  
  tray.on('click', () => toggleWindow());
}

app.whenReady().then(() => {
  createWindow();
  createTray();

  // Register Global Shortcut (Ctrl+Space)
  const ret = globalShortcut.register('CommandOrControl+Space', () => {
    toggleWindow();
  });

  if (!ret) {
    console.error('Registration of global shortcut failed');
  }

  // Start MCP servers exactly once on application boot
  pipeline.startMCPServers();

  // Run Nightly Reasoning Job (delayed by 5s to let MCPs start)
  setTimeout(async () => {
    const { NightlyReasoningJob } = require('../scheduler/nightly');
    const job = new NightlyReasoningJob();
    await job.run();
    job.close();
    
    // Schedule to run every 24 hours
    setInterval(async () => {
      const scheduledJob = new NightlyReasoningJob();
      await scheduledJob.run();
      scheduledJob.close();
    }, 24 * 60 * 60 * 1000);
  }, 5000);
});

app.on('will-quit', () => {
  globalShortcut.unregisterAll();
  pipeline.shutdown();
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

// --- IPC Handlers (React UI -> JARVIS Pipeline) ---

import { client, handle_file } from '@gradio/client';
import * as fs from 'fs';
import * as os from 'os';

ipcMain.handle('jarvis:synthesize', async (event, text: string) => {
  let lastError: any;
  for (let attempt = 1; attempt <= 3; attempt++) {
    try {
      const app = await client("mrfakename/MeloTTS", { hf_token: process.env.HF_TOKEN } as any);
      const result = await app.predict("/synthesize", [
        text,
        "EN-US",
        1.0,
        "EN"
      ]);
      return { success: true, audio: (result.data as any)[0].url || (result.data as any)[0] };
    } catch (error: any) {
      console.warn(`TTS Synthesis attempt ${attempt} failed:`, error.message || error);
      lastError = error;
      // If it's a hard error like Quota, maybe break early. But for 'Connection errored out', retry.
      if (attempt < 3) await new Promise(res => setTimeout(res, 2000));
    }
  }
  console.error('TTS Synthesis Error after 3 attempts:', lastError);
  return { success: false, error: String(lastError) };
});

ipcMain.handle('jarvis:get-memories', async () => {
  try {
    const listRes = await pipeline['mcpRegistry'].callTool('mcp-memory', 'list_semantic', { limit: 100 });
    return { success: true, memories: (listRes.result as any)?.results || [] };
  } catch (error) {
    console.error('Failed to get memories:', error);
    return { success: false, error: String(error) };
  }
});

ipcMain.handle('jarvis:delete-memory', async (event, id: number) => {
  try {
    const res = await pipeline['mcpRegistry'].callTool('mcp-memory', 'delete_semantic', { id });
    return { success: true, deleted: (res.result as any)?.deleted };
  } catch (error) {
    console.error('Failed to delete memory:', error);
    return { success: false, error: String(error) };
  }
});

ipcMain.handle('jarvis:transcribe', async (event, base64Audio: string) => {
  try {
    // Convert base64 to buffer
    const audioBuffer = Buffer.from(base64Audio.split(',')[1] || base64Audio, 'base64');
    
    // Write buffer to temporary file
    const tempFilePath = path.join(os.tmpdir(), `jarvis_audio_${Date.now()}.webm`);
    fs.writeFileSync(tempFilePath, audioBuffer);

    console.log(`Transcribing audio file: ${tempFilePath}`);

    // Call Whisper API
    const app = await client("hf-audio/whisper-large-v3", { hf_token: process.env.HF_TOKEN } as any);
    const result = await app.predict("/transcribe", [
      handle_file(tempFilePath), // audio file
      "transcribe", // task
    ]);

    // Clean up temp file
    try { fs.unlinkSync(tempFilePath); } catch (e) {}

    // result.data[0] is the transcribed text string
    const text = (result.data as any)[0];
    return { success: true, text: text?.trim() || '' };
  } catch (error) {
    console.error('STT Transcription Error:', error);
    return { success: false, error: String(error) };
  }
});

ipcMain.handle('jarvis:run', async (event, command: string) => {
  console.log(`JARVIS UI Command received: ${command}`);
  try {
    const onProgress = (stage: string, message: string) => {
      // Send progress updates back to the UI
      event.sender.send('jarvis:progress', { stage, message });
    };

    const result = await pipeline.run(command, onProgress);
    return result;
  } catch (error) {
    console.error('JARVIS Run Error:', error);
    return { success: false, error: String(error) };
  }
});

ipcMain.on('jarvis:hide', () => {
  mainWindow?.hide();
});
