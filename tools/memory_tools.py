"""
Memory Tools
Tools for interacting with JARVIS memory system
"""
from typing import Optional

from .base import BaseTool, ToolParameter, ToolResult
from utils.logger import get_logger

logger = get_logger("jarvis.tools.memory")


class RememberTool(BaseTool):
    """Store information in memory"""
    
    def __init__(self, memory_manager):
        """
        Initialize remember tool
        
        Args:
            memory_manager: MemoryManager instance
        """
        super().__init__()
        self.memory_manager = memory_manager
    
    @property
    def description(self) -> str:
        return "Store information in long-term memory for later recall"
    
    @property
    def parameters(self) -> list[ToolParameter]:
        return [
            ToolParameter(
                name="information",
                type="string",
                description="Information to remember",
                required=True
            ),
            ToolParameter(
                name="category",
                type="string",
                description="Memory category (fact, preference, task, etc.)",
                required=False,
                default="fact"
            )
        ]
    
    def execute(self, information: str, category: str = "fact", **kwargs) -> ToolResult:
        """Execute remember tool"""
        try:
            idx = self.memory_manager.remember(information, category=category)
            
            result = f"Remembered: {information}"
            self.logger.info(f"Stored memory #{idx}: {information[:50]}...")
            
            return ToolResult(
                success=True,
                result=result,
                metadata={"index": idx, "category": category}
            )
        
        except Exception as e:
            self.logger.error(f"Failed to remember: {e}")
            return ToolResult(success=False, error=str(e))


class RecallTool(BaseTool):
    """Retrieve information from memory"""
    
    def __init__(self, memory_manager):
        """
        Initialize recall tool
        
        Args:
            memory_manager: MemoryManager instance
        """
        super().__init__()
        self.memory_manager = memory_manager
    
    @property
    def description(self) -> str:
        return "Retrieve relevant information from long-term memory"
    
    @property
    def parameters(self) -> list[ToolParameter]:
        return [
            ToolParameter(
                name="query",
                type="string",
                description="What to search for in memory",
                required=True
            ),
            ToolParameter(
                name="category",
                type="string",
                description="Filter by memory category",
                required=False,
                default=None
            )
        ]
    
    def execute(self, query: str, category: Optional[str] = None, **kwargs) -> ToolResult:
        """Execute recall tool"""
        try:
            memories = self.memory_manager.recall(query, category=category, top_k=3)
            
            if not memories:
                result = "No relevant memories found."
            else:
                result_parts = ["Found relevant memories:"]
                for i, mem in enumerate(memories, 1):
                    text = mem.get("text", "")
                    similarity = mem.get("similarity", 0)
                    result_parts.append(f"{i}. {text} (relevance: {similarity:.2f})")
                
                result = "\n".join(result_parts)
            
            self.logger.info(f"Recalled {len(memories)} memories for: {query[:50]}...")
            
            return ToolResult(
                success=True,
                result=result,
                metadata={"count": len(memories), "memories": memories}
            )
        
        except Exception as e:
            self.logger.error(f"Failed to recall: {e}")
            return ToolResult(success=False, error=str(e))


class GetMemoryStatsTool(BaseTool):
    """Get memory system statistics"""
    
    def __init__(self, memory_manager):
        """
        Initialize memory stats tool
        
        Args:
            memory_manager: MemoryManager instance
        """
        super().__init__()
        self.memory_manager = memory_manager
    
    @property
    def description(self) -> str:
        return "Get statistics about the memory system"
    
    @property
    def parameters(self) -> list[ToolParameter]:
        return []
    
    def execute(self, **kwargs) -> ToolResult:
        """Execute memory stats tool"""
        try:
            stats = self.memory_manager.get_stats()
            
            result_parts = [
                f"Total memories: {stats.get('total', 0)}",
                f"Active memories: {stats.get('active', 0)}"
            ]
            
            by_category = stats.get('by_category', {})
            if by_category:
                result_parts.append("\nBy category:")
                for category, count in by_category.items():
                    result_parts.append(f"  - {category}: {count}")
            
            result = "\n".join(result_parts)
            
            self.logger.info("Retrieved memory statistics")
            
            return ToolResult(
                success=True,
                result=result,
                metadata=stats
            )
        
        except Exception as e:
            self.logger.error(f"Failed to get memory stats: {e}")
            return ToolResult(success=False, error=str(e))
