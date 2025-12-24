"""
Tool Registry
Manages tool registration and discovery
"""
from typing import Dict, List, Optional, Any
from .base import BaseTool, ToolResult
from utils.logger import get_logger

logger = get_logger("jarvis.tools.registry")


class ToolRegistry:
    """
    Registry for managing and executing tools
    """
    
    def __init__(self):
        """Initialize tool registry"""
        self.tools: Dict[str, BaseTool] = {}
        logger.info("ToolRegistry initialized")
    
    def register(self, tool: BaseTool) -> None:
        """
        Register a tool
        
        Args:
            tool: Tool instance to register
        """
        tool_name = tool.name
        
        if tool_name in self.tools:
            logger.warning(f"Tool '{tool_name}' already registered, overwriting")
        
        self.tools[tool_name] = tool
        logger.info(f"Registered tool: {tool_name}")
    
    def unregister(self, tool_name: str) -> bool:
        """
        Unregister a tool
        
        Args:
            tool_name: Name of tool to unregister
        
        Returns:
            True if unregistered successfully
        """
        if tool_name in self.tools:
            del self.tools[tool_name]
            logger.info(f"Unregistered tool: {tool_name}")
            return True
        
        logger.warning(f"Tool '{tool_name}' not found")
        return False
    
    def get_tool(self, tool_name: str) -> Optional[BaseTool]:
        """
        Get tool by name
        
        Args:
            tool_name: Tool name
        
        Returns:
            Tool instance or None
        """
        return self.tools.get(tool_name)
    
    def list_tools(self) -> List[str]:
        """Get list of registered tool names"""
        return list(self.tools.keys())
    
    def get_tools_info(self) -> List[Dict[str, Any]]:
        """Get information about all registered tools"""
        return [tool.to_dict() for tool in self.tools.values()]
    
    def execute(self, tool_name: str, **kwargs) -> ToolResult:
        """
        Execute a tool by name
        
        Args:
            tool_name: Name of tool to execute
            **kwargs: Tool parameters
        
        Returns:
            Tool execution result
        """
        tool = self.get_tool(tool_name)
        
        if tool is None:
            logger.error(f"Tool '{tool_name}' not found")
            return ToolResult(
                success=False,
                error=f"Tool '{tool_name}' not found"
            )
        
        # Validate parameters
        is_valid, error_msg = tool.validate_parameters(**kwargs)
        if not is_valid:
            logger.error(f"Invalid parameters for '{tool_name}': {error_msg}")
            return ToolResult(
                success=False,
                error=error_msg
            )
        
        # Execute tool
        logger.info(f"Executing tool: {tool_name}")
        
        try:
            result = tool.execute(**kwargs)
            
            if result.success:
                logger.info(f"Tool '{tool_name}' executed successfully")
            else:
                logger.warning(f"Tool '{tool_name}' execution failed: {result.error}")
            
            return result
        
        except Exception as e:
            logger.error(f"Tool '{tool_name}' raised exception: {e}")
            return ToolResult(
                success=False,
                error=f"Tool execution error: {str(e)}"
            )
    
    def get_tools_description(self) -> str:
        """
        Get formatted description of all tools for LLM
        
        Returns:
            Formatted tool descriptions
        """
        if not self.tools:
            return "No tools available."
        
        descriptions = ["Available tools:"]
        
        for tool_name, tool in self.tools.items():
            desc = f"\n{tool_name}: {tool.description}"
            
            if tool.parameters:
                params = []
                for param in tool.parameters:
                    req = "required" if param.required else "optional"
                    params.append(f"  - {param.name} ({param.type}, {req}): {param.description}")
                
                if params:
                    desc += "\n  Parameters:\n" + "\n".join(params)
            
            descriptions.append(desc)
        
        return "\n".join(descriptions)
