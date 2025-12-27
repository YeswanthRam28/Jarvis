from fastapi import FastAPI, WebSocket, WebSocketDisconnect
from fastapi.middleware.cors import CORSMiddleware
import asyncio
import json
from pathlib import Path
import sys
from contextlib import asynccontextmanager

# Add project root to path
sys.path.insert(0, str(Path(__file__).parent.parent))

from main import JARVIS
from utils.logger import get_logger

logger = get_logger("jarvis.api")

import psutil
import time

class ConnectionManager:
    def __init__(self):
        self.active_connections: list[WebSocket] = []
        self.loop = None

    async def connect(self, websocket: WebSocket):
        await websocket.accept()
        self.active_connections.append(websocket)

    def disconnect(self, websocket: WebSocket):
        if websocket in self.active_connections:
            self.active_connections.remove(websocket)

    async def broadcast(self, message: dict):
        for connection in self.active_connections:
            try:
                await connection.send_text(json.dumps(message))
            except Exception as e:
                logger.debug(f"Broadcast failed to a client: {e}")

manager = ConnectionManager()
jarvis = JARVIS()
jarvis.initialize()

def jarvis_update_callback(event):
    """Bridge for JARVIS internal events to WebSocket (thread-safe)"""
    if manager.loop:
        asyncio.run_coroutine_threadsafe(
            manager.broadcast(event),
            manager.loop
        )

# Register the callback
jarvis.on_update = jarvis_update_callback

async def telemetry_task():
    """Background task to broadcast system telemetry"""
    while True:
        try:
            cpu_usage = psutil.cpu_percent()
            mem = psutil.virtual_memory()
            
            telemetry_data = {
                "type": "telemetry",
                "data": {
                    "cpu": cpu_usage,
                    "memory": mem.percent,
                    "active_mem": f"{mem.used / (1024**3):.1f}GB",
                    "total_mem": f"{mem.total / (1024**3):.1f}GB",
                    "timestamp": time.time()
                }
            }
            await manager.broadcast(telemetry_data)
        except Exception as e:
            logger.error(f"Telemetry error: {e}")
        await asyncio.sleep(2)

@asynccontextmanager
async def lifespan(app: FastAPI):
    # Startup
    manager.loop = asyncio.get_running_loop()
    logger.info("Starting JARVIS background orchestrator")
    jarvis.is_running = True
    jarvis.audio_input.start(callback=jarvis.process_audio)
    
    # Start telemetry task
    telemetry_bg = asyncio.create_task(telemetry_task())
    
    yield
    
    # Shutdown
    jarvis.is_running = False
    telemetry_bg.cancel()
    jarvis.shutdown()

app = FastAPI(title="JARVIS API", lifespan=lifespan)

# Enable CORS for the Electron frontend
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

@app.websocket("/ws")
async def websocket_endpoint(websocket: WebSocket):
    await manager.connect(websocket)
    try:
        # Send initial state
        await websocket.send_text(json.dumps({
            "type": "state",
            "data": {
                "is_running": jarvis.is_running,
                "awaiting_command": jarvis.awaiting_command
            }
        }))
        
        while True:
            # Receive commands from UI
            data = await websocket.receive_text()
            try:
                msg = json.loads(data)
                if msg.get("type") == "command":
                    cmd = msg.get("data")
                    if cmd == "stop":
                        logger.info("UI requested stop")
                        # You could implement a mid-processing interrupt here
                        # For now, we'll just force idle status
                        if manager.loop:
                            asyncio.run_coroutine_threadsafe(
                                manager.broadcast({"type": "status", "data": "idle"}),
                                manager.loop
                            )
                    elif cmd == "shutdown":
                        logger.info("UI requested shutdown")
                        jarvis.is_running = False
                        
                        # Send status update
                        if manager.loop:
                            asyncio.run_coroutine_threadsafe(
                                manager.broadcast({"type": "status", "data": "offline"}),
                                manager.loop
                            )
                        
                        # Graceful exit after broadcast
                        async def exit_after_delay():
                            await asyncio.sleep(0.5)
                            import os
                            import signal
                            logger.info("Triggering process exit...")
                            os.kill(os.getpid(), signal.SIGINT)
                            
                        asyncio.create_task(exit_after_delay())
            except Exception as e:
                logger.error(f"Failed to process UI message: {e}")
            
    except WebSocketDisconnect:
        manager.disconnect(websocket)

@app.get("/status")
async def get_status():
    return {
        "is_running": jarvis.is_running,
        "awaiting_command": jarvis.awaiting_command,
        "memory_count": jarvis.memory.get_stats()["total_entries"] if jarvis.memory else 0
    }

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)
