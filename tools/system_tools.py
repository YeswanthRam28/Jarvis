"""
System Tools
Basic system information and control tools
"""
from datetime import datetime
import platform
import psutil
from typing import Any

from .base import BaseTool, ToolParameter, ToolResult
from utils.logger import get_logger

logger = get_logger("jarvis.tools.system")


class GetTimeTool(BaseTool):
    """Get current time and date"""
    
    @property
    def description(self) -> str:
        return "Get the current time and date"
    
    @property
    def parameters(self) -> list[ToolParameter]:
        return [
            ToolParameter(
                name="format",
                type="string",
                description="Time format: 'full', 'time', or 'date'",
                required=False,
                default="full"
            )
        ]
    
    def execute(self, format: str = "full", **kwargs) -> ToolResult:
        """Execute get time tool"""
        try:
            now = datetime.now()
            
            if format == "time":
                result = now.strftime("%I:%M %p")
            elif format == "date":
                result = now.strftime("%A, %B %d, %Y")
            else:  # full
                result = now.strftime("%A, %B %d, %Y at %I:%M %p")
            
            self.logger.info(f"Current time: {result}")
            
            return ToolResult(
                success=True,
                result=result,
                metadata={"timestamp": now.isoformat()}
            )
        
        except Exception as e:
            self.logger.error(f"Failed to get time: {e}")
            return ToolResult(success=False, error=str(e))


class GetSystemInfoTool(BaseTool):
    """Get system information"""
    
    @property
    def description(self) -> str:
        return "Get system information (OS, CPU, memory, etc.)"
    
    @property
    def parameters(self) -> list[ToolParameter]:
        return []
    
    def execute(self, **kwargs) -> ToolResult:
        """Execute get system info tool"""
        try:
            # Gather system info
            info = {
                "os": platform.system(),
                "os_version": platform.version(),
                "architecture": platform.machine(),
                "processor": platform.processor(),
                "cpu_count": psutil.cpu_count(),
                "cpu_percent": psutil.cpu_percent(interval=1),
                "memory_total_gb": round(psutil.virtual_memory().total / (1024**3), 2),
                "memory_available_gb": round(psutil.virtual_memory().available / (1024**3), 2),
                "memory_percent": psutil.virtual_memory().percent
            }
            
            # Format result
            result = (
                f"System: {info['os']} {info['os_version']}\n"
                f"Processor: {info['processor']} ({info['cpu_count']} cores)\n"
                f"CPU Usage: {info['cpu_percent']}%\n"
                f"Memory: {info['memory_available_gb']}GB / {info['memory_total_gb']}GB available "
                f"({100 - info['memory_percent']:.1f}% free)"
            )
            
            self.logger.info("Retrieved system information")
            
            return ToolResult(
                success=True,
                result=result,
                metadata=info
            )
        
        except Exception as e:
            self.logger.error(f"Failed to get system info: {e}")
            return ToolResult(success=False, error=str(e))


class CalculatorTool(BaseTool):
    """Perform mathematical calculations"""
    
    @property
    def description(self) -> str:
        return "Perform mathematical calculations (supports basic arithmetic and Python math expressions)"
    
    @property
    def parameters(self) -> list[ToolParameter]:
        return [
            ToolParameter(
                name="expression",
                type="string",
                description="Mathematical expression to evaluate",
                required=True
            )
        ]
    
    def execute(self, expression: str, **kwargs) -> ToolResult:
        """Execute calculator tool"""
        try:
            # Sanitize expression (basic safety check)
            allowed_chars = set("0123456789+-*/().% ")
            if not all(c in allowed_chars or c.isalpha() for c in expression):
                return ToolResult(
                    success=False,
                    error="Expression contains invalid characters"
                )
            
            # Evaluate expression
            result = eval(expression, {"__builtins__": {}}, {})
            
            self.logger.info(f"Calculated: {expression} = {result}")
            
            return ToolResult(
                success=True,
                result=str(result),
                metadata={"expression": expression, "value": result}
            )
        
        except Exception as e:
            self.logger.error(f"Calculation failed: {e}")
            return ToolResult(success=False, error=f"Calculation error: {str(e)}")
