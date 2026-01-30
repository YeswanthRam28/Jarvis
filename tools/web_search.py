"""
Web Search Tool
Searches the web using DuckDuckGo and returns summarized results
"""
from typing import Optional
from tools.base import BaseTool, ToolResult, ToolParameter
from utils.logger import get_logger

logger = get_logger("jarvis.tools.web_search")


class WebSearchTool(BaseTool):
    """Search the web for information"""
    
    @property
    def description(self) -> str:
        return "Search the web for current information, news, or answers to questions"
    
    @property
    def parameters(self) -> list[ToolParameter]:
        return [
            ToolParameter(
                name="query",
                type="string",
                description="Search query or question",
                required=True
            ),
            ToolParameter(
                name="max_results",
                type="integer",
                description="Maximum number of results to return (default: 5)",
                required=False,
                default=5
            )
        ]
    
    def execute(self, query: str, max_results: int = 5) -> ToolResult:
        """
        Execute web search
        
        Args:
            query: Search query
            max_results: Maximum number of results
            
        Returns:
            Search results
        """
        try:
            try:
                from ddgs import DDGS
            except ImportError:
                from duckduckgo_search import DDGS
            
            logger.info(f"Searching web for: {query}")
            
            # Perform search
            with DDGS() as ddgs:
                results = list(ddgs.text(query, max_results=max_results))
            
            if not results:
                return ToolResult(
                    success=True,
                    result="No results found for your search."
                )
            
            # Format results
            formatted_results = []
            for i, result in enumerate(results, 1):
                title = result.get('title', 'No title')
                snippet = result.get('body', 'No description')
                url = result.get('href', '')
                
                formatted_results.append(f"{i}. {title}\n   {snippet}\n   URL: {url}")
            
            output = f"Search results for '{query}':\n\n" + "\n\n".join(formatted_results)
            
            logger.info(f"Found {len(results)} results")
            return ToolResult(success=True, result=output)
        
        except ImportError:
            error_msg = "duckduckgo-search library not installed. Run: pip install duckduckgo-search"
            logger.error(error_msg)
            return ToolResult(success=False, error=error_msg)
        
        except Exception as e:
            error_msg = f"Web search failed: {str(e)}"
            logger.error(error_msg)
            return ToolResult(success=False, error=error_msg)
