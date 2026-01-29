"""
Intent Parser
Classifies user intent and routes to appropriate handlers
"""
import re
from typing import Dict, Any, Optional, Tuple
from enum import Enum

from utils.logger import get_logger
from tools.registry import ToolRegistry

logger = get_logger("jarvis.intent")


class IntentType(Enum):
    """Types of user intents"""
    TOOL_CALL = "tool_call"
    MEMORY_STORE = "memory_store"
    MEMORY_RECALL = "memory_recall"
    CONVERSATION = "conversation"
    SYSTEM_COMMAND = "system_command"


class IntentParser:
    """
    Parses user input to determine intent and extract parameters
    """
    
    def __init__(self, tool_registry: ToolRegistry):
        """
        Initialize intent parser
        
        Args:
            tool_registry: Tool registry instance
        """
        self.tool_registry = tool_registry
        
        # Intent patterns (simple rule-based for now)
        self.patterns = {
            # Time queries
            r"what (time|date) is it|what's the (time|date)|current (time|date)": {
                "intent": IntentType.TOOL_CALL,
                "tool": "GetTimeTool",
                "params": {}
            },
            
            # System info
            r"system (info|information)|how (is|are) (the|my) system|system status": {
                "intent": IntentType.TOOL_CALL,
                "tool": "GetSystemInfoTool",
                "params": {}
            },
            
            # Calculator
            r"(calculate|compute|what is|how much is) \d+|(\d+ [\+\-\*\/] \d+)": {
                "intent": IntentType.TOOL_CALL,
                "tool": "CalculatorTool",
                "params": {}
            },
            
            # Memory storage
            r"remember (that|this)|store (this|that)|save (this|that)": {
                "intent": IntentType.MEMORY_STORE,
                "tool": "RememberTool",
                "params": {}
            },
            
            # Memory recall
            r"(do you remember|recall|what do you know about)": {
                "intent": IntentType.MEMORY_RECALL,
                "tool": "RecallTool",
                "params": {}
            },
            
            # Memory stats
            r"memory (stats|statistics|status)": {
                "intent": IntentType.TOOL_CALL,
                "tool": "GetMemoryStatsTool",
                "params": {}
            },
            
            # Telegram Alert
            r"(notify|alert|remind) me": {
                "intent": IntentType.TOOL_CALL,
                "tool": "TelegramAlertTool",
                "params": {}
            },
            
            # Application & Settings Control
            r"(open|launch|show) (settings|system settings|control panel|bluetooth|wifi|network)": {
                "intent": IntentType.TOOL_CALL,
                "tool": "OpenAppTool",
                "params": {}
            },
            r"(open|launch) (.+)": {
                "intent": IntentType.TOOL_CALL,
                "tool": "OpenAppTool",
                "params": {}
            },
            
            # Music Control
            r"play (.+)": {
                "intent": IntentType.TOOL_CALL,
                "tool": "PlayMusicTool",
                "params": {}
            },
            
            # Volume Control
            r"(increase volume|volume up)": {
                "intent": IntentType.TOOL_CALL,
                "tool": "VolumeUpTool",
                "params": {}
            },
            r"(decrease volume|volume down)": {
                "intent": IntentType.TOOL_CALL,
                "tool": "VolumeDownTool",
                "params": {}
            }
        }
        
        logger.info("IntentParser initialized")
    
    def parse(self, text: str) -> Dict[str, Any]:
        """
        Parse user input to determine intent
        
        Args:
            text: User input text
        
        Returns:
            Dictionary with intent information:
                - intent: IntentType
                - tool: Tool name (if applicable)
                - params: Extracted parameters
                - confidence: Confidence score (0-1)
        """
        text_lower = text.lower().strip()
        
        logger.debug(f"Parsing intent: '{text[:50]}...'")
        
        # Try pattern matching
        for pattern, intent_info in self.patterns.items():
            if re.search(pattern, text_lower):
                logger.info(f"Matched pattern: {pattern}")
                
                result = {
                    "intent": intent_info["intent"],
                    "tool": intent_info["tool"],
                    "params": self._extract_params(text, intent_info),
                    "confidence": 0.9,
                    "original_text": text
                }
                
                return result
        
        # Default to conversation
        logger.debug("No pattern matched, defaulting to conversation")
        
        return {
            "intent": IntentType.CONVERSATION,
            "tool": None,
            "params": {},
            "confidence": 0.5,
            "original_text": text
        }
    
    def _extract_params(self, text: str, intent_info: Dict[str, Any]) -> Dict[str, Any]:
        """
        Extract parameters from text based on intent
        
        Args:
            text: User input text
            intent_info: Intent information
        
        Returns:
            Extracted parameters
        """
        params = intent_info.get("params", {}).copy()
        tool_name = intent_info.get("tool")
        
        # Tool-specific parameter extraction
        if tool_name == "CalculatorTool":
            # Extract mathematical expression
            # Remove common phrases
            expr = text.lower()
            expr = re.sub(r"(calculate|compute|what is|what's|how much is)", "", expr).strip()
            params["expression"] = expr
        
        elif tool_name == "RememberTool":
            # Extract information to remember
            info = re.sub(r"(remember that|remember this|store this|store that|save this|save that)", "", text, flags=re.IGNORECASE).strip()
            params["information"] = info
            params["category"] = "fact"
        
        elif tool_name == "RecallTool":
            # Extract query
            query = re.sub(r"(do you remember|recall|what do you know about)", "", text, flags=re.IGNORECASE).strip()
            params["query"] = query
        
        elif tool_name == "GetTimeTool":
            # Determine format
            if "time" in text.lower() and "date" not in text.lower():
                params["format"] = "time"
            elif "date" in text.lower() and "time" not in text.lower():
                params["format"] = "date"
            else:
                params["format"] = "full"
        
        elif tool_name == "TelegramAlertTool":
            # Extract message to send
            message = re.sub(r"(notify me that|notify me|alert me that|alert me|remind me that|remind me)", "", text, flags=re.IGNORECASE).strip()
            # Clean up leading "that" or "to" if they persist
            message = re.sub(r"^(that|to)\s+", "", message, flags=re.IGNORECASE).strip()
            params["message"] = message
            
        elif tool_name == "OpenAppTool":
            # Extract app name from phrases like "open settings" or "launch notepad"
            app = re.sub(r"(open|launch|show)", "", text, flags=re.IGNORECASE).strip().rstrip('.?!')
            params["app"] = app
            
        elif tool_name == "PlayMusicTool":
            # Extract search query
            query = re.sub(r"play", "", text, flags=re.IGNORECASE).strip().rstrip('.?!')
            params["query"] = query
        
        return params
    
    def should_use_tool(self, intent_result: Dict[str, Any]) -> bool:
        """
        Determine if a tool should be used
        
        Args:
            intent_result: Result from parse()
        
        Returns:
            True if tool should be used
        """
        return intent_result["intent"] in [
            IntentType.TOOL_CALL,
            IntentType.MEMORY_STORE,
            IntentType.MEMORY_RECALL
        ] and intent_result["tool"] is not None
