"""
Base Tool Interface
Abstract base class for all JARVIS tools
"""
from abc import ABC, abstractmethod
from typing import Any, Dict, Optional
from pydantic import BaseModel, Field

from utils.logger import get_logger

logger = get_logger("jarvis.tools.base")


class ToolParameter(BaseModel):
    """Tool parameter definition"""
    name: str = Field(..., description="Parameter name")
    type: str = Field(..., description="Parameter type (string, int, float, bool)")
    description: str = Field(..., description="Parameter description")
    required: bool = Field(default=True, description="Whether parameter is required")
    default: Optional[Any] = Field(default=None, description="Default value")


class ToolResult(BaseModel):
    """Tool execution result"""
    success: bool = Field(..., description="Whether execution succeeded")
    result: Any = Field(default=None, description="Execution result")
    error: Optional[str] = Field(default=None, description="Error message if failed")
    metadata: Dict[str, Any] = Field(default_factory=dict, description="Additional metadata")


class BaseTool(ABC):
    """
    Abstract base class for all tools
    """
    
    def __init__(self):
        """Initialize tool"""
        self.name = self.__class__.__name__
        self.logger = get_logger(f"jarvis.tools.{self.name}")
    
    @property
    @abstractmethod
    def description(self) -> str:
        """Tool description for LLM"""
        pass
    
    @property
    @abstractmethod
    def parameters(self) -> list[ToolParameter]:
        """Tool parameters"""
        pass
    
    @abstractmethod
    def execute(self, **kwargs) -> ToolResult:
        """
        Execute the tool
        
        Args:
            **kwargs: Tool parameters
        
        Returns:
            Tool execution result
        """
        pass
    
    def validate_parameters(self, **kwargs) -> tuple[bool, Optional[str]]:
        """
        Validate tool parameters
        
        Args:
            **kwargs: Parameters to validate
        
        Returns:
            (is_valid, error_message)
        """
        for param in self.parameters:
            if param.required and param.name not in kwargs:
                return False, f"Missing required parameter: {param.name}"
        
        return True, None
    
    def to_dict(self) -> Dict[str, Any]:
        """Convert tool to dictionary representation"""
        return {
            "name": self.name,
            "description": self.description,
            "parameters": [p.model_dump() for p in self.parameters]
        }
    
    def __str__(self) -> str:
        return f"{self.name}: {self.description}"
