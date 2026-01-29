"""
System Actions Tools
Tools for controlling the PC (keyboard, mouse, volume, apps)
"""
import os
import webbrowser
import subprocess
import keyboard
import pywintypes
import win32gui
import win32con
import win32api
import time
from typing import List, Optional, Any
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

    def _find_start_app(self, app_name: str) -> Optional[str]:
        """Finds an app in the Windows Start Apps list (Shell:AppsFolder)"""
        try:
            # Use PowerShell to get list of apps
            cmd = f'Get-StartApps | Where-Object {{ $_.Name -like "*{app_name}*" }} | Select-Object -ExpandProperty AppID'
            result = subprocess.run(["powershell", "-Command", cmd], capture_output=True, text=True, check=False)
            
            if result.returncode == 0 and result.stdout.strip():
                # Get the first match
                app_id = result.stdout.strip().split("\n")[0].strip()
                logger.info(f"Found {app_name} in Start Apps list: {app_id}")
                return app_id
        except Exception as e:
            logger.debug(f"Search via Get-StartApps failed: {e}")
        return None

    def _find_executable(self, app: str) -> str:
        """Finds the full path of an executable dynamically (Fallback method)"""
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
            
            # 3. New Primary Method: Search via Windows Start Apps (Shell:AppsFolder)
            # This handles Store apps, system apps, and most desktop apps
            app_id = self._find_start_app(target)
            if not app_id and target != app_lower:
                # If alias failed, try original name
                app_id = self._find_start_app(app_lower)
                
            if app_id:
                logger.info(f"Launching via AppID: {app_id}")
                # Launching via shell:AppsFolder is the most reliable way for these shortcuts
                os.system(f'explorer.exe shell:AppsFolder\\{app_id}')
                return ToolResult(success=True, result=f"Opening {app_raw}")
            
            # 4. Fallback: Dynamic search for the executable on disk
            exe_path = self._find_executable(target)
            
            if exe_path:
                logger.info(f"Launching found executable: {exe_path}")
                os.system(f'start "" "{exe_path}"')
                return ToolResult(success=True, result=f"Opening {app_raw}")
            
            # 5. Fallback: Try running directly in shell as a last resort
            logger.info(f"App not found in search, trying direct shell start: {target}")
            exit_code = os.system(f"start {target}")
            
            if exit_code == 0:
                return ToolResult(success=True, result=f"Attempting to launch {app_raw}")
            
            # 6. Ultimate Fallback: Search web for download
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


class WorkSpaceAutomationTool(BaseTool):
    """Automates workspace setup (Instagram, GitHub, ChatGPT)"""
    
    @property
    def description(self) -> str:
        return "Sets up a workspace with Instagram (Left), GitHub (Top Right), and ChatGPT (Bottom Right)"

    @property
    def parameters(self) -> List[ToolParameter]:
        return []

    def _find_window_by_substring(self, substring: str):
        def callback(hwnd, windows):
            if win32gui.IsWindowVisible(hwnd):
                title = win32gui.GetWindowText(hwnd)
                if substring.lower() in title.lower():
                    windows.append(hwnd)
        
        windows = []
        win32gui.EnumWindows(callback, windows)
        # Return the most recently active one if multiple found
        return windows[0] if windows else None

    def execute(self, **kwargs) -> ToolResult:
        try:
            # Monitor Info
            width = win32api.GetSystemMetrics(0)
            height = win32api.GetSystemMetrics(1)
            
            # Start apps using their Windows AppIDs
            targets = [
                {"name": "Instagram", "id": "Facebook.InstagramBeta_8xx8rvfyw5nnt!App"},
                {"name": "GitHub", "id": "github.com-8B11BEB2_2t1n1bqhyggy0!App"},
                {"name": "ChatGPT", "id": "OpenAI.ChatGPT-Desktop_2p2nqsd0c76g0!ChatGPT"}
            ]
            
            for target in targets:
                logger.info(f"Launching workspace app: {target['name']}")
                # Using the Shell:AppsFolder method which is universal for Windows Apps
                os.system(f'explorer.exe shell:AppsFolder\\{target["id"]}')
                time.sleep(1.5) # Wait for launch
            
            # Give windows time to initialize and set titles
            logger.info("Waiting for windows to stabilize...")
            time.sleep(5) 
            
            # Position Layout:
            # 1. Instagram -> Left Half
            hwnd_ig = self._find_window_by_substring("Instagram")
            if hwnd_ig:
                logger.info(f"Tiling Instagram (HWND: {hwnd_ig})")
                win32gui.ShowWindow(hwnd_ig, win32con.SW_RESTORE)
                win32gui.SetWindowPos(hwnd_ig, win32con.HWND_TOP, 0, 0, width // 2, height, win32con.SWP_SHOWWINDOW)
            else:
                logger.warning("Could not find Instagram window")

            # 2. GitHub -> Top Right
            # Note: GitHub Desktop title is often "GitHub Desktop"
            hwnd_gh = self._find_window_by_substring("GitHub")
            if hwnd_gh:
                logger.info(f"Tiling GitHub (HWND: {hwnd_gh})")
                win32gui.ShowWindow(hwnd_gh, win32con.SW_RESTORE)
                win32gui.SetWindowPos(hwnd_gh, win32con.HWND_TOP, width // 2, 0, width // 2, height // 2, win32con.SWP_SHOWWINDOW)
            else:
                logger.warning("Could not find GitHub window")

            # 3. ChatGPT -> Bottom Right
            hwnd_gpt = self._find_window_by_substring("ChatGPT")
            if hwnd_gpt:
                logger.info(f"Tiling ChatGPT (HWND: {hwnd_gpt})")
                win32gui.ShowWindow(hwnd_gpt, win32con.SW_RESTORE)
                win32gui.SetWindowPos(hwnd_gpt, win32con.HWND_TOP, width // 2, height // 2, width // 2, height // 2, win32con.SWP_SHOWWINDOW)
            else:
                logger.warning("Could not find ChatGPT window")
            
            return ToolResult(success=True, result="Workspace automation complete.")
        except Exception as e:
            logger.error(f"Workspace automation failed: {e}")
            return ToolResult(success=False, error=str(e))
