"""
Web Scraper Tool
Fetches and extracts clean text content from web pages
"""
from typing import Optional
from tools.base import BaseTool, ToolResult, ToolParameter
from utils.logger import get_logger

logger = get_logger("jarvis.tools.web_scraper")


class WebScraperTool(BaseTool):
    """Fetch and extract content from web pages"""
    
    @property
    def description(self) -> str:
        return "Read and extract text content from a specific webpage URL"
    
    @property
    def parameters(self) -> list[ToolParameter]:
        return [
            ToolParameter(
                name="url",
                type="string",
                description="URL of the webpage to scrape",
                required=True
            ),
            ToolParameter(
                name="max_length",
                type="integer",
                description="Maximum characters to return (default: 2000)",
                required=False,
                default=2000
            )
        ]
    
    def execute(self, url: str, max_length: int = 2000) -> ToolResult:
        """
        Scrape webpage content
        
        Args:
            url: URL to scrape
            max_length: Maximum content length
            
        Returns:
            Extracted text content
        """
        try:
            import requests
            from bs4 import BeautifulSoup
            
            logger.info(f"Scraping URL: {url}")
            
            # Fetch the page
            headers = {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
            }
            response = requests.get(url, headers=headers, timeout=10)
            response.raise_for_status()
            
            # Parse HTML
            soup = BeautifulSoup(response.content, 'html.parser')
            
            # Remove script and style elements
            for script in soup(["script", "style", "nav", "footer", "header"]):
                script.decompose()
            
            # Get text
            text = soup.get_text(separator='\n', strip=True)
            
            # Clean up whitespace
            lines = [line.strip() for line in text.splitlines() if line.strip()]
            clean_text = '\n'.join(lines)
            
            # Truncate if needed
            if len(clean_text) > max_length:
                clean_text = clean_text[:max_length] + "...\n[Content truncated]"
            
            logger.info(f"Successfully scraped {len(clean_text)} characters")
            return ToolResult(
                success=True,
                result=f"Content from {url}:\n\n{clean_text}"
            )
        
        except ImportError:
            error_msg = "beautifulsoup4 library not installed. Run: pip install beautifulsoup4"
            logger.error(error_msg)
            return ToolResult(success=False, error=error_msg)
        
        except requests.exceptions.RequestException as e:
            error_msg = f"Failed to fetch URL: {str(e)}"
            logger.error(error_msg)
            return ToolResult(success=False, error=error_msg)
        
        except Exception as e:
            error_msg = f"Web scraping failed: {str(e)}"
            logger.error(error_msg)
            return ToolResult(success=False, error=error_msg)
