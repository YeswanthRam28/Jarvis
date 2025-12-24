"""
Semantic Memory using FAISS
Vector database for long-term memory storage and retrieval
"""
import faiss
import numpy as np
import json
from typing import List, Dict, Any, Optional, Tuple
from pathlib import Path
from datetime import datetime

from utils.logger import get_logger
from config import MemoryConfig

logger = get_logger("jarvis.semantic_memory")


class SemanticMemory:
    """
    FAISS-based semantic memory for storing and retrieving information
    """
    
    def __init__(self, config: MemoryConfig, embedding_dim: int):
        """
        Initialize semantic memory
        
        Args:
            config: Memory configuration
            embedding_dim: Dimension of embeddings
        """
        self.config = config
        self.embedding_dim = embedding_dim
        
        # FAISS index
        self.index: Optional[faiss.Index] = None
        
        # Metadata storage (parallel to FAISS index)
        self.metadata: List[Dict[str, Any]] = []
        
        # Paths
        self.index_path = config.faiss_index_path
        self.metadata_path = config.metadata_path
        
        # Create directories
        self.index_path.parent.mkdir(parents=True, exist_ok=True)
        
        logger.info(f"SemanticMemory initialized: dim={embedding_dim}")
    
    def _create_index(self) -> faiss.Index:
        """Create new FAISS index"""
        logger.info("Creating new FAISS index")
        
        # Use IndexFlatL2 for exact search (can upgrade to IndexIVFFlat for speed)
        index = faiss.IndexFlatL2(self.embedding_dim)
        
        return index
    
    def load(self) -> bool:
        """
        Load index and metadata from disk
        
        Returns:
            True if loaded successfully, False otherwise
        """
        if not self.index_path.exists() or not self.metadata_path.exists():
            logger.info("No existing memory found, creating new index")
            self.index = self._create_index()
            return False
        
        try:
            logger.info("Loading memory from disk")
            
            # Load FAISS index
            self.index = faiss.read_index(str(self.index_path))
            
            # Load metadata
            with open(self.metadata_path, 'r', encoding='utf-8') as f:
                self.metadata = json.load(f)
            
            logger.info(f"Memory loaded: {len(self.metadata)} entries")
            return True
        
        except Exception as e:
            logger.error(f"Failed to load memory: {e}")
            self.index = self._create_index()
            self.metadata = []
            return False
    
    def save(self) -> bool:
        """
        Save index and metadata to disk
        
        Returns:
            True if saved successfully
        """
        try:
            logger.info("Saving memory to disk")
            
            if self.index is None:
                logger.warning("No index to save")
                return False
                
            # Save FAISS index
            faiss.write_index(self.index, str(self.index_path))
            
            # Save metadata
            with open(self.metadata_path, 'w', encoding='utf-8') as f:
                json.dump(self.metadata, f, indent=2, ensure_ascii=False)
            
            logger.info(f"Memory saved: {len(self.metadata)} entries")
            return True
        
        except Exception as e:
            logger.error(f"Failed to save memory: {e}")
            return False
    
    def add(
        self,
        embedding: np.ndarray,
        text: str,
        category: str = "general",
        metadata: Optional[Dict[str, Any]] = None
    ) -> int:
        """
        Add memory to index
        
        Args:
            embedding: Embedding vector
            text: Original text
            category: Memory category (e.g., "fact", "conversation", "preference")
            metadata: Additional metadata
        
        Returns:
            Index of added memory
        """
        if self.index is None:
            # Try loading from disk first
            if not self.load():
                self.index = self._create_index()
        
        # Ensure embedding is 2D
        if embedding.ndim == 1:
            embedding = embedding.reshape(1, -1)
        
        # Add to FAISS index
        self.index.add(embedding.astype(np.float32))
        
        # Create metadata entry
        meta = {
            "text": text,
            "category": category,
            "timestamp": datetime.now().isoformat(),
            "access_count": 0,
            **(metadata or {})
        }
        
        self.metadata.append(meta)
        
        idx = len(self.metadata) - 1
        logger.debug(f"Added memory #{idx}: '{text[:50]}...' (category={category})")
        
        return idx
    
    def search(
        self,
        query_embedding: np.ndarray,
        top_k: int = 5,
        category_filter: Optional[str] = None
    ) -> List[Dict[str, Any]]:
        """
        Search for similar memories
        
        Args:
            query_embedding: Query embedding vector
            top_k: Number of results to return
            category_filter: Filter by category
        
        Returns:
            List of memory results with text, metadata, and similarity score
        """
        if self.index is None:
            # Try loading from disk first
            self.load()
            
        if self.index is None or len(self.metadata) == 0:
            logger.warning("No memories in index")
            return []
        
        # Ensure embedding is 2D
        if query_embedding.ndim == 1:
            query_embedding = query_embedding.reshape(1, -1)
        
        # Search
        k = min(top_k * 2, len(self.metadata))  # Get more results for filtering
        distances, indices = self.index.search(query_embedding.astype(np.float32), k)
        
        # Build results
        results = []
        for dist, idx in zip(distances[0], indices[0]):
            if idx < 0 or idx >= len(self.metadata):
                continue
            
            meta = self.metadata[idx].copy()
            
            # Apply category filter
            if category_filter and meta.get("category") != category_filter:
                continue
            
            # Add similarity score (convert L2 distance to similarity)
            meta["similarity"] = float(1 / (1 + dist))
            meta["distance"] = float(dist)
            meta["index"] = int(idx)
            
            # Update access count
            self.metadata[idx]["access_count"] += 1
            
            results.append(meta)
            
            if len(results) >= top_k:
                break
        
        logger.debug(f"Found {len(results)} memories")
        
        return results
    
    def get_by_index(self, idx: int) -> Optional[Dict[str, Any]]:
        """Get memory by index"""
        if 0 <= idx < len(self.metadata):
            return self.metadata[idx].copy()
        return None
    
    def delete_by_index(self, idx: int) -> bool:
        """
        Delete memory by index (marks as deleted, doesn't rebuild index)
        
        Args:
            idx: Memory index
        
        Returns:
            True if deleted
        """
        if 0 <= idx < len(self.metadata):
            self.metadata[idx]["deleted"] = True
            logger.info(f"Deleted memory #{idx}")
            return True
        return False
    
    def get_stats(self) -> Dict[str, Any]:
        """Get memory statistics"""
        if not self.metadata:
            return {"total": 0, "by_category": {}}
        
        stats = {
            "total": len(self.metadata),
            "active": sum(1 for m in self.metadata if not m.get("deleted", False)),
            "by_category": {}
        }
        
        for meta in self.metadata:
            if meta.get("deleted"):
                continue
            category = meta.get("category", "unknown")
            stats["by_category"][category] = stats["by_category"].get(category, 0) + 1
        
        return stats
    
    def clear(self) -> None:
        """Clear all memories"""
        logger.warning("Clearing all memories")
        self.index = self._create_index()
        self.metadata = []
