"""
Memory Manager
High-level interface for memory operations
"""
from typing import List, Dict, Any, Optional
import numpy as np

from .embeddings import EmbeddingModel
from .semantic_memory import SemanticMemory
from utils.logger import get_logger
from config import MemoryConfig

logger = get_logger("jarvis.memory_manager")


class MemoryManager:
    """
    High-level memory management interface
    """
    
    def __init__(self, config: MemoryConfig):
        """
        Initialize memory manager
        
        Args:
            config: Memory configuration
        """
        self.config = config
        
        # Initialize components
        self.embedding_model = EmbeddingModel(config)
        
        # Don't load model on init - lazy loading handles it
        # self.embedding_model.load_model()
        
        # Use config dim if model not loaded yet
        embedding_dim = config.embedding_dim
        self.semantic_memory = SemanticMemory(config, embedding_dim)
        # self.semantic_memory.load()
        
        logger.info("MemoryManager initialized (lazy mode)")
    
    def remember(
        self,
        text: str,
        category: str = "general",
        metadata: Optional[Dict[str, Any]] = None
    ) -> int:
        """
        Store information in memory
        
        Args:
            text: Text to remember
            category: Memory category
            metadata: Additional metadata
        
        Returns:
            Memory index
        """
        logger.info(f"Remembering: '{text[:50]}...' (category={category})")
        
        # Generate embedding
        embedding = self.embedding_model.encode(text)
        
        # Store in memory
        idx = self.semantic_memory.add(embedding, text, category, metadata)
        
        # Save to disk
        self.semantic_memory.save()
        
        return idx
    
    def recall(
        self,
        query: str,
        top_k: Optional[int] = None,
        category: Optional[str] = None,
        min_similarity: float = 0.5
    ) -> List[Dict[str, Any]]:
        """
        Retrieve relevant memories
        
        Args:
            query: Search query
            top_k: Number of results (uses config default if None)
            category: Filter by category
            min_similarity: Minimum similarity threshold
        
        Returns:
            List of relevant memories
        """
        top_k = top_k or self.config.retrieval_top_k
        
        logger.info(f"Recalling: '{query[:50]}...' (top_k={top_k}, category={category})")
        
        # Generate query embedding
        query_embedding = self.embedding_model.encode(query)
        
        # Search memory
        results = self.semantic_memory.search(
            query_embedding,
            top_k=top_k,
            category_filter=category
        )
        
        # Filter by similarity threshold
        results = [r for r in results if r.get("similarity", 0) >= min_similarity]
        
        logger.info(f"Recalled {len(results)} memories")
        
        return results
    
    def get_context(
        self,
        query: str,
        max_memories: int = 3,
        category: Optional[str] = None
    ) -> str:
        """
        Get formatted context string for LLM
        
        Args:
            query: Query to find relevant context
            max_memories: Maximum number of memories to include
            category: Filter by category
        
        Returns:
            Formatted context string
        """
        memories = self.recall(query, top_k=max_memories, category=category)
        
        if not memories:
            return ""
        
        # Format memories as context
        context_parts = ["Relevant memories:"]
        for i, mem in enumerate(memories, 1):
            text = mem.get("text", "")
            context_parts.append(f"{i}. {text}")
        
        context = "\n".join(context_parts)
        logger.debug(f"Generated context: {len(context)} chars")
        
        return context
    
    def remember_conversation(
        self,
        user_message: str,
        assistant_response: str
    ) -> None:
        """
        Store conversation exchange in memory
        
        Args:
            user_message: User's message
            assistant_response: Assistant's response
        """
        # Store as single memory entry
        conversation_text = f"User: {user_message}\nAssistant: {assistant_response}"
        
        self.remember(
            conversation_text,
            category="conversation",
            metadata={
                "user_message": user_message,
                "assistant_response": assistant_response
            }
        )
    
    def get_stats(self) -> Dict[str, Any]:
        """Get memory statistics"""
        return self.semantic_memory.get_stats()
    
    def save(self) -> bool:
        """Save memory to disk"""
        return self.semantic_memory.save()
    
    def clear(self) -> None:
        """Clear all memories"""
        self.semantic_memory.clear()
        self.semantic_memory.save()
