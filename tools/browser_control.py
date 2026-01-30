"""
Browser Control Tool
Full browser automation using Playwright with Google Chrome
"""
import asyncio
from typing import Optional, List
from tools.base import BaseTool, ToolResult, ToolParameter
from utils.logger import get_logger

logger = get_logger("jarvis.tools.browser")


class BrowserControlTool(BaseTool):
    """Control Google Chrome browser for web automation"""

    
    @property
    def description(self) -> str:
        return "Open and control Google Chrome browser to navigate websites, search, or interact with web pages"
    
    @property
    def parameters(self) -> list[ToolParameter]:
        return [
            ToolParameter(
                name="action",
                type="string",
                description="Action to perform: 'open_url', 'search_google', 'search_youtube', 'screenshot'",
                required=True
            ),
            ToolParameter(
                name="target",
                type="string",
                description="URL to open or search query",
                required=True
            ),
            ToolParameter(
                name="headless",
                type="boolean",
                description="Run browser in headless mode (default: False)",
                required=False,
                default=False
            )
        ]
    
    def execute(self, action: str, target: str, headless: bool = False) -> ToolResult:
        """
        Execute browser action
        
        Args:
            action: Action to perform
            target: URL or search query
            headless: Run in headless mode
            
        Returns:
            Execution result
        """
        try:
            # Run async operation
            result = asyncio.run(self._execute_async(action, target, headless))
            return result
        
        except Exception as e:
            error_msg = f"Browser control failed: {str(e)}"
            logger.error(error_msg)
            return ToolResult(success=False, error=error_msg)
    
    async def _execute_async(self, action: str, target: str, headless: bool) -> ToolResult:
        """Async execution of browser actions"""
        try:
            from playwright.async_api import async_playwright
            
            logger.info(f"Browser action: {action} - {target}")
            
            async with async_playwright() as p:
                # Launch Chrome (not Edge)
                browser = await p.chromium.launch(
                    headless=headless,
                    channel="chrome"  # Force Google Chrome
                )
                
                context = await browser.new_context(
                    viewport={'width': 1920, 'height': 1080},
                    user_agent='Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
                )
                
                page = await context.new_page()
                
                # Execute action
                if action == "open_url":
                    await page.goto(target, wait_until="domcontentloaded", timeout=30000)
                    result_msg = f"Opened {target} in Chrome"
                
                elif action == "search_google":
                    search_url = f"https://www.google.com/search?q={target.replace(' ', '+')}"
                    await page.goto(search_url, wait_until="domcontentloaded")
                    result_msg = f"Searched Google for: {target}"
                
                elif action == "search_youtube":
                    search_url = f"https://www.youtube.com/results?search_query={target.replace(' ', '+')}"
                    await page.goto(search_url, wait_until="domcontentloaded")
                    result_msg = f"Searched YouTube for: {target}"
                
                elif action == "screenshot":
                    # Ensure URL has protocol
                    if not target.startswith("http://") and not target.startswith("https://"):
                        # If simple word without dots/spaces, assume .com
                        if "." not in target and " " not in target:
                            target = f"https://{target}.com"
                        else:
                            target = "https://" + target
                        
                    await page.goto(target, wait_until="domcontentloaded")
                    screenshot_path = f"data/screenshots/{target.replace('://', '_').replace('/', '_')}.png"
                    await page.screenshot(path=screenshot_path)
                    result_msg = f"Screenshot saved to {screenshot_path}"
                
                else:
                    await browser.close()
                    return ToolResult(
                        success=False,
                        error=f"Unknown action: {action}"
                    )
                
                # Keep browser open for user interaction (don't close immediately)
                # User can manually close when done
                logger.info(f"Browser action completed: {result_msg}")
                
                # Note: We're NOT closing the browser here so user can interact
                # await browser.close()
                
                return ToolResult(success=True, result=result_msg)
        
        except ImportError:
            error_msg = (
                "Playwright not installed. Run:\n"
                "pip install playwright\n"
                "playwright install chrome"
            )
            logger.error(error_msg)
            return ToolResult(success=False, error=error_msg)
        
        except Exception as e:
            error_msg = f"Browser automation error: {str(e)}"
            logger.error(error_msg)
            return ToolResult(success=False, error=error_msg)


class OpenURLTool(BaseTool):
    """Simple tool to open URLs in Chrome"""
    
    @property
    def description(self) -> str:
        return "Open a URL in Google Chrome browser"
    
    @property
    def parameters(self) -> list[ToolParameter]:
        return [
            ToolParameter(
                name="url",
                type="string",
                description="URL to open (must be a valid http/https URL)",
                required=True
            )
        ]
    
    def execute(self, url: str) -> ToolResult:
        """
        Open URL in Chrome
        
        Args:
            url: URL to open
            
        Returns:
            Execution result
        """
        try:
            import webbrowser
            
            # Register Chrome browser
            chrome_path = None
            
            # Common Chrome installation paths on Windows
            import os
            possible_paths = [
                r"C:\Program Files\Google\Chrome\Application\chrome.exe",
                r"C:\Program Files (x86)\Google\Chrome\Application\chrome.exe",
                os.path.expanduser(r"~\AppData\Local\Google\Chrome\Application\chrome.exe")
            ]
            
            for path in possible_paths:
                if os.path.exists(path):
                    chrome_path = path
                    break
            
            if chrome_path:
                webbrowser.register('chrome', None, webbrowser.BackgroundBrowser(chrome_path))
                browser = webbrowser.get('chrome')
                browser.open(url)
                logger.info(f"Opened {url} in Chrome")
                return ToolResult(success=True, result=f"Opened {url} in Chrome")
            else:
                # Fallback to default browser
                webbrowser.open(url)
                logger.warning("Chrome not found, opened in default browser")
                return ToolResult(success=True, result=f"Opened {url} in default browser")
        
        except Exception as e:
            error_msg = f"Failed to open URL: {str(e)}"
            logger.error(error_msg)
            return ToolResult(success=False, error=error_msg)


class SearchGoogleTool(BaseTool):
    """Quick Google search in Chrome"""
    
    @property
    def description(self) -> str:
        return "Search Google in Chrome browser"
    
    @property
    def parameters(self) -> list[ToolParameter]:
        return [
            ToolParameter(
                name="query",
                type="string",
                description="Search query",
                required=True
            )
        ]
    
    def execute(self, query: str) -> ToolResult:
        """Execute Google search"""
        url = f"https://www.google.com/search?q={query.replace(' ', '+')}"
        open_tool = OpenURLTool()
        return open_tool.execute(url)


class SearchYouTubeTool(BaseTool):
    """Quick YouTube search in Chrome"""
    
    @property
    def description(self) -> str:
        return "Search YouTube in Chrome browser"
    
    @property
    def parameters(self) -> list[ToolParameter]:
        return [
            ToolParameter(
                name="query",
                type="string",
                description="Search query or video name",
                required=True
            )
        ]
    
    def execute(self, query: str) -> ToolResult:
        """Execute YouTube search"""
        url = f"https://www.youtube.com/results?search_query={query.replace(' ', '+')}"
        open_tool = OpenURLTool()
        return open_tool.execute(url)
