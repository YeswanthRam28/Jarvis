"""
Conversation Manager
Manages conversation state and context
"""
from typing import List, Dict, Any, Optional
from datetime import datetime

from utils.logger import get_logger
from config import ConversationConfig

logger = get_logger("jarvis.conversation")


class Message:
    """Represents a conversation message"""
    
    def __init__(self, role: str, content: str, metadata: Optional[Dict[str, Any]] = None):
        """
        Initialize message
        
        Args:
            role: Message role (user, assistant, system)
            content: Message content
            metadata: Additional metadata
        """
        self.role = role
        self.content = content
        self.timestamp = datetime.now()
        self.metadata = metadata or {}
    
    def to_dict(self) -> Dict[str, Any]:
        """Convert to dictionary"""
        return {
            "role": self.role,
            "content": self.content,
            "timestamp": self.timestamp.isoformat(),
            "metadata": self.metadata
        }


class ConversationManager:
    """
    Manages conversation history and context
    """
    
    def __init__(self, config: ConversationConfig):
        """
        Initialize conversation manager
        
        Args:
            config: Conversation configuration
        """
        self.config = config
        self.messages: List[Message] = []
        self.session_start = datetime.now()
        
        logger.info("ConversationManager initialized")
    
    def add_message(
        self,
        role: str,
        content: str,
        metadata: Optional[Dict[str, Any]] = None
    ) -> None:
        """
        Add message to conversation history
        
        Args:
            role: Message role (user, assistant, system)
            content: Message content
            metadata: Additional metadata
        """
        message = Message(role, content, metadata)
        self.messages.append(message)
        
        logger.debug(f"Added {role} message: {content[:50]}...")
        
        # Trim history if too long
        if len(self.messages) > self.config.max_history * 2:  # *2 for user+assistant pairs
            self._trim_history()
    
    def _trim_history(self) -> None:
        """Trim conversation history to max_history"""
        # Keep only recent messages
        keep_count = self.config.max_history * 2
        removed_count = len(self.messages) - keep_count
        
        self.messages = self.messages[-keep_count:]
        
        logger.info(f"Trimmed conversation history: removed {removed_count} messages")
    
    def get_history(
        self,
        max_messages: Optional[int] = None,
        include_system: bool = False
    ) -> List[Dict[str, str]]:
        """
        Get conversation history
        
        Args:
            max_messages: Maximum number of messages to return
            include_system: Include system messages
        
        Returns:
            List of message dictionaries
        """
        messages = self.messages
        
        # Filter system messages if needed
        if not include_system:
            messages = [m for m in messages if m.role != "system"]
        
        # Limit count
        if max_messages:
            messages = messages[-max_messages:]
        
        return [{"role": m.role, "content": m.content} for m in messages]
    
    def get_context_window(self) -> str:
        """
        Get formatted context window for LLM
        
        Returns:
            Formatted conversation history
        """
        history = self.get_history(max_messages=self.config.max_history * 2)
        
        if not history:
            return ""
        
        # Format as context
        context_parts = []
        for msg in history:
            role = msg["role"].capitalize()
            content = msg["content"]
            context_parts.append(f"{role}: {content}")
        
        return "\n".join(context_parts)
    
    def clear_history(self) -> None:
        """Clear conversation history"""
        logger.info("Clearing conversation history")
        self.messages.clear()
        self.session_start = datetime.now()
    
    def get_session_duration(self) -> float:
        """Get session duration in seconds"""
        return (datetime.now() - self.session_start).total_seconds()
    
    def get_message_count(self) -> int:
        """Get total message count"""
        return len(self.messages)
    
    def get_stats(self) -> Dict[str, Any]:
        """Get conversation statistics"""
        user_messages = sum(1 for m in self.messages if m.role == "user")
        assistant_messages = sum(1 for m in self.messages if m.role == "assistant")
        
        return {
            "total_messages": len(self.messages),
            "user_messages": user_messages,
            "assistant_messages": assistant_messages,
            "session_duration_seconds": self.get_session_duration(),
            "session_start": self.session_start.isoformat()
        }
