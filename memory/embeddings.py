"""
Embedding Generation
Sentence transformers for semantic embeddings
"""
import numpy as np
from typing import List, Union, Optional, TYPE_CHECKING
from pathlib import Path

if TYPE_CHECKING:
    from sentence_transformers import SentenceTransformer

from utils.logger import get_logger
from config import MemoryConfig

logger = get_logger("jarvis.embeddings")


class EmbeddingModel:
    """
    Sentence transformer embeddings for semantic search
    """
    
    def __init__(self, config: MemoryConfig):
        """
        Initialize embedding model
        
        Args:
            config: Memory configuration
        """
        self.config = config
        self.model_name = config.embedding_model
        self.model: SentenceTransformer = None
        
        # Create cache directory
        config.model_cache_dir.mkdir(parents=True, exist_ok=True)
        
        logger.info(f"EmbeddingModel initialized: model={self.model_name}")
    
    def load_model(self) -> None:
        """Load embedding model (lazy loading)"""
        if self.model is not None:
            return
        
        logger.info(f"Loading embedding model: {self.model_name}")
        
        try:
            from sentence_transformers import SentenceTransformer
            self.model = SentenceTransformer(
                self.model_name,
                cache_folder=str(self.config.model_cache_dir)
            )
            logger.info(f"Embedding model loaded: dim={self.model.get_sentence_embedding_dimension()}")
        
        except Exception as e:
            logger.error(f"Failed to load embedding model: {e}")
            raise
    
    def encode(
        self,
        texts: Union[str, List[str]],
        normalize: bool = True,
        show_progress: bool = False
    ) -> np.ndarray:
        """
        Generate embeddings for text(s)
        
        Args:
            texts: Single text or list of texts
            normalize: Normalize embeddings to unit length
            show_progress: Show progress bar
        
        Returns:
            Embeddings as numpy array (shape: [n_texts, embedding_dim])
        """
        # Ensure model is loaded
        self.load_model()
        
        # Convert single text to list
        if isinstance(texts, str):
            texts = [texts]
            single_input = True
        else:
            single_input = False
        
        logger.debug(f"Encoding {len(texts)} text(s)")
        
        try:
            # Generate embeddings
            embeddings = self.model.encode(
                texts,
                normalize_embeddings=normalize,
                show_progress_bar=show_progress,
                convert_to_numpy=True
            )
            
            # Return single embedding if single input
            if single_input:
                return embeddings[0]
            
            return embeddings
        
        except Exception as e:
            logger.error(f"Encoding failed: {e}")
            # Return zero embeddings on error
            dim = self.config.embedding_dim
            if single_input:
                return np.zeros(dim, dtype=np.float32)
            return np.zeros((len(texts), dim), dtype=np.float32)
    
    def get_dimension(self) -> int:
        """Get embedding dimension"""
        self.load_model()
        return self.model.get_sentence_embedding_dimension()
    
    def unload_model(self) -> None:
        """Unload model to free memory"""
        if self.model is not None:
            logger.info("Unloading embedding model")
            del self.model
            self.model = None
