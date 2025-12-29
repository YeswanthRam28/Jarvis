"""
System Actions Tools
Tools for controlling the PC (keyboard, mouse, volume, apps)
"""
import os
import webbrowser
import subprocess
import keyboard
from typing import List
from pycaw.pycaw import AudioUtilities, IAudioEndpointVolume
from comtypes import CLSCTX_ALL
from ctypes import cast, POINTER

from tools.base import BaseTool, ToolParameter, ToolResult
from utils.logger import get_logger

logger = get_logger("jarvis.tools.system_actions")


class OpenAppTool(BaseTool):
    """Opens an application on the PC"""
    
    @property
    def description(self) -> str:
        return "Opens an application on the PC"

    @property
    def parameters(self) -> List[ToolParameter]:
        return [
            ToolParameter(
                name="app",
                type="string",
                description="App name to open (e.g., notepad, calculator, spotify)",
                required=True
            )
        ]

    def _find_executable(self, app: str) -> str:
        """Finds the full path of an executable dynamically"""
        # 1. Try WHERE.exe (fastest way to find apps in PATH)
        try:
            result = subprocess.run(["where", app], capture_output=True, text=True, check=False)
            if result.returncode == 0:
                path = result.stdout.strip().split("\n")[0]
                if os.path.exists(path):
                    logger.info(f"Dynamic search: Found {app} via 'where' at {path}")
                    return path
        except Exception as e:
            logger.debug(f"Search via 'where' failed for {app}: {e}")

        # 2. Try common Program Files locations
        # Using environment variables for better compatibility
        program_files = os.environ.get("ProgramFiles", "C:\\Program Files")
        program_files_x86 = os.environ.get("ProgramFiles(x86)", "C:\\Program Files (x86)")
        local_app_data = os.environ.get("LocalAppData", os.path.expanduser("~\\AppData\\Local"))
        roaming_app_data = os.environ.get("AppData", os.path.expanduser("~\\AppData\\Roaming"))
        
        search_dirs = [
            program_files,
            program_files_x86,
            local_app_data,
            roaming_app_data,
            os.path.join(local_app_data, "Programs"),
            os.path.join(roaming_app_data, "Microsoft", "Windows", "Start Menu", "Programs")
        ]
        
        # Look for the .exe in those directories (shallow search first)
        for base_dir in search_dirs:
            # Check if app.exe exists directly in the dir or in a subfolder named after the app
            variants = [
                os.path.join(base_dir, f"{app}.exe"),
                os.path.join(base_dir, app, f"{app}.exe"),
                os.path.join(base_dir, f"{app} App", f"{app}.exe")
            ]
            for p in variants:
                if os.path.exists(p):
                    logger.info(f"Dynamic search: Found {app} at {p}")
                    return p
                    
        return None

    def execute(self, app: str, **kwargs) -> ToolResult:
        try:
            # Map common names to executables or URI protocols
            aliases = {
                "vscode": "code",
                "vs code": "code",
                "visual studio code": "code",
                "spotify": "spotify:",
                "settings": "ms-settings:",
                "bluetooth": "ms-settings:bluetooth",
                "wifi": "ms-settings:network-wifi",
                "network": "ms-settings:network",
                "chrome": "chrome",
                "brave": "brave",
                "edge": "msedge",
                "notepad": "notepad",
                "calculator": "calc",
                "explorer": "explorer",
                "terminal": "wt",
                "powershell": "powershell",
                "cmd": "cmd"
            }
            
            app_raw = app.strip().rstrip('.?!')
            app_lower = app_raw.lower()
            
            # 1. Resolve alias
            target = aliases.get(app_lower, app_lower)
            
            # 2. Handle known URI protocols immediately
            if ":" in target and not target.startswith("C:"):
                logger.info(f"Launching via protocol: {target}")
                os.system(f"start {target}")
                return ToolResult(success=True, result=f"Opening {app_raw}")
            
            # 3. Dynamic search for the executable
            exe_path = self._find_executable(target)
            
            if exe_path:
                logger.info(f"Launching found executable: {exe_path}")
                # Use start to avoid blocking and handle shell issues
                os.system(f'start "" "{exe_path}"')
                return ToolResult(success=True, result=f"Opening {app_raw}")
            
            # 4. Fallback: Try running directly in shell as a last resort
            logger.info(f"App not found in search, trying direct shell start: {target}")
            exit_code = os.system(f"start {target}")
            
            if exit_code == 0:
                return ToolResult(success=True, result=f"Attempting to launch {app_raw}")
            
            # 5. Ultimate Fallback: Search web for download
            logger.warning(f"Failed to find or launch {app_raw}. Opening web search.")
            search_url = f"https://www.google.com/search?q=download+{app_raw.replace(' ', '+')}"
            webbrowser.open(search_url)
            return ToolResult(success=True, result=f"I couldn't find {app_raw} installed, so I opened a download search for you.")
                
        except Exception as e:
            logger.error(f"Error opening app {app}: {e}")
            return ToolResult(success=False, error=str(e))


class PlayMusicTool(BaseTool):
    """Plays music via YouTube"""
    
    @property
    def description(self) -> str:
        return "Plays a song or search for music via YouTube"

    @property
    def parameters(self) -> List[ToolParameter]:
        return [
            ToolParameter(
                name="query",
                type="string",
                description="Song name or artist to play",
                required=True
            )
        ]

    def execute(self, query: str, **kwargs) -> ToolResult:
        try:
            url = f"https://www.youtube.com/results?search_query={query.replace(' ', '+')}"
            logger.info(f"Searching music on YouTube: {query}")
            webbrowser.open(url)
            return ToolResult(success=True, result=f"Searching for '{query}' on YouTube")
        except Exception as e:
            logger.error(f"Error playing music: {e}")
            return ToolResult(success=False, error=str(e))


class VolumeUpTool(BaseTool):
    """Increases system volume"""
    
    @property
    def description(self) -> str:
        return "Increases system volume"

    @property
    def parameters(self) -> List[ToolParameter]:
        return []

    def execute(self, **kwargs) -> ToolResult:
        try:
            # Try keyboard first as it's more reliable across different pycaw versions
            keyboard.press_and_release("volume up")
            return ToolResult(success=True, result="Volume increased")
        except Exception as e:
            logger.error(f"Error increasing volume via keyboard: {e}")
            # Try pycaw as backup
            try:
                devices = AudioUtilities.GetSpeakers()
                interface = devices.Activate(IAudioEndpointVolume._iid_, CLSCTX_ALL, None)
                volume = cast(interface, POINTER(IAudioEndpointVolume))
                current_volume = volume.GetMasterVolumeLevelScalar()
                new_volume = min(1.0, current_volume + 0.1)
                volume.SetMasterVolumeLevelScalar(new_volume, None)
                return ToolResult(success=True, result=f"Volume increased to {int(new_volume * 100)}%")
            except Exception as e2:
                logger.error(f"Pycaw fallback failed: {e2}")
                return ToolResult(success=False, error="Could not increase volume")


class VolumeDownTool(BaseTool):
    """Decreases system volume"""
    
    @property
    def description(self) -> str:
        return "Decreases system volume"

    @property
    def parameters(self) -> List[ToolParameter]:
        return []

    def execute(self, **kwargs) -> ToolResult:
        try:
            # Try keyboard first
            keyboard.press_and_release("volume down")
            return ToolResult(success=True, result="Volume decreased")
        except Exception as e:
            logger.error(f"Error decreasing volume via keyboard: {e}")
            # Try pycaw as backup
            try:
                devices = AudioUtilities.GetSpeakers()
                interface = devices.Activate(IAudioEndpointVolume._iid_, CLSCTX_ALL, None)
                volume = cast(interface, POINTER(IAudioEndpointVolume))
                current_volume = volume.GetMasterVolumeLevelScalar()
                new_volume = max(0.0, current_volume - 0.1)
                volume.SetMasterVolumeLevelScalar(new_volume, None)
                return ToolResult(success=True, result=f"Volume decreased to {int(new_volume * 100)}%")
            except Exception as e2:
                logger.error(f"Pycaw fallback failed: {e2}")
                return ToolResult(success=False, error="Could not decrease volume")
