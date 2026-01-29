"""
LLM Inference Engine
Local LLM inference using llama-cpp-python with GGUF models
"""
from typing import Optional, List, Dict, Any, Iterator, TYPE_CHECKING
import re
from pathlib import Path

if TYPE_CHECKING:
    from llama_cpp import Llama

from utils.logger import get_logger
from config import LLMConfig

logger = get_logger("jarvis.llm")


class LLMEngine:
    """
    Local LLM inference using llama-cpp-python
    """
    
    def __init__(self, config: LLMConfig):
        """
        Initialize LLM engine
        
        Args:
            config: LLM configuration
        """
        self.config = config
        self.model: Optional[Llama] = None
        self.conversation_history: List[Dict[str, str]] = []
        
        logger.info(f"LLMEngine initialized: model={config.model_path.name}")
    
    def load_model(self) -> None:
        """Load LLM model (lazy loading)"""
        if self.model is not None:
            return
        
        if not self.config.model_path.exists():
            logger.error(f"Model file not found: {self.config.model_path}")
            raise FileNotFoundError(f"Model file not found: {self.config.model_path}")
        
        logger.info(f"Loading LLM model: {self.config.model_path}")
        
        try:
            from llama_cpp import Llama
            self.model = Llama(
                model_path=str(self.config.model_path),
                n_ctx=self.config.context_size,
                n_threads=self.config.n_threads,
                n_gpu_layers=self.config.n_gpu_layers,
                verbose=False
            )
            logger.info("LLM model loaded successfully")
        
        except Exception as e:
            logger.error(f"Failed to load LLM model: {e}")
            raise
    
    def _build_prompt(
        self,
        user_message: str,
        system_prompt: Optional[str] = None,
        context: Optional[str] = None,
        include_history: bool = True
    ) -> str:
        """
        Build prompt from message and context
        
        Args:
            user_message: User's message
            system_prompt: System prompt (uses config default if None)
            context: Additional context to include
            include_history: Include conversation history
        
        Returns:
            Formatted prompt string
        """
        system = system_prompt or self.config.system_prompt
        model_name = self.config.model_path.name.lower()
        
        # Check for Llama 3 model family
        is_llama3 = "llama-3" in model_name or "llama3" in model_name
        
        if is_llama3:
            # Llama 3 Format
            prompt = f"<|begin_of_text|><|start_header_id|>system<|end_header_id|>\n\n{system}"
            
            if context:
                prompt += f"\n\nContext information:\n{context}"
                
            prompt += "<|eot_id|>"
            
            # Add history
            if include_history:
                valid_history = [m for m in self.conversation_history if m.get("content")]
                for msg in valid_history[-5:]:
                    role = "user" if msg["role"] == "user" else "assistant"
                    prompt += f"<|start_header_id|>{role}<|end_header_id|>\n\n{msg['content']}<|eot_id|>"
            
            # Add current message
            prompt += f"<|start_header_id|>user<|end_header_id|>\n\n{user_message}<|eot_id|><|start_header_id|>assistant<|end_header_id|>\n\n"
            return prompt
            
        else:
            # Default/Phi-2 Instruct format
            instruction = f"{system}\n\n"
            
            if context:
                instruction += f"Context information:\n{context}\n\n"
                
            if include_history:
                valid_history = [m for m in self.conversation_history if m.get("content")]
                if valid_history:
                    instruction += "Previous conversation:\n"
                    for msg in valid_history[-5:]:
                        role = "User" if msg["role"] == "user" else "Assistant"
                        instruction += f"{role}: {msg['content']}\n"
                    instruction += "\n"
                
            instruction += f"Question: {user_message}"
            return f"Instruct: {instruction}\nOutput:"
    
    def generate(
        self,
        user_message: str,
        system_prompt: Optional[str] = None,
        context: Optional[str] = None,
        max_tokens: Optional[int] = None,
        temperature: Optional[float] = None,
        stream: bool = False
    ) -> str:
        """
        Generate response from user message
        
        Args:
            user_message: User's message
            system_prompt: Optional system prompt override
            context: Additional context (e.g., from memory)
            max_tokens: Maximum tokens to generate
            temperature: Sampling temperature
            stream: Enable streaming output
        
        Returns:
            Generated response text
        """
        # Ensure model is loaded
        self.load_model()
        
        # Build prompt
        prompt = self._build_prompt(user_message, system_prompt, context)
        logger.debug(f"LLM Prompt:\n{prompt}")
        
        # Generation parameters
        max_tokens = max_tokens or self.config.max_tokens
        temperature = temperature or self.config.temperature
        
        try:
            # Generate
            stop_tokens = ["User:", "Assistant:", "Instruct:", "Output:"]
            if "llama" in self.config.model_path.name.lower():
                stop_tokens.extend(["<|eot_id|>", "<|end_of_text|>"])
                
            raw_response = self.model(
                prompt,
                max_tokens=max_tokens,
                temperature=temperature,
                stop=stop_tokens,
                echo=False
            )
            
            # Extract text
            generated_text = raw_response["choices"][0]["text"].strip()
            
            # Post-process: Remove relevance scores or metrics often hallucinated by the model
            generated_text = re.sub(r"\(relievance:.*?\)", "", generated_text, flags=re.IGNORECASE).strip()
            # Also handle potentially common formatting issues
            generated_text = generated_text.replace("..", ".").strip()
            self.conversation_history.append({"role": "user", "content": user_message})
            self.conversation_history.append({"role": "assistant", "content": generated_text})
            
            logger.info(f"Generated response: {len(generated_text)} chars")
            logger.debug(f"Response: {generated_text[:100]}...")
            
            return generated_text
        
        except Exception as e:
            logger.error(f"Generation failed: {e}")
            return "I apologize, but I encountered an error processing your request."
    
    def generate_stream(
        self,
        user_message: str,
        system_prompt: Optional[str] = None,
        context: Optional[str] = None,
        max_tokens: Optional[int] = None,
        temperature: Optional[float] = None
    ) -> Iterator[str]:
        """
        Generate response with streaming
        
        Args:
            user_message: User's message
            system_prompt: Optional system prompt override
            context: Additional context
            max_tokens: Maximum tokens to generate
            temperature: Sampling temperature
        
        Yields:
            Generated text chunks
        """
        self.load_model()
        
        prompt = self._build_prompt(user_message, system_prompt, context)
        max_tokens = max_tokens or self.config.max_tokens
        temperature = temperature or self.config.temperature
        
        logger.debug("Starting streaming generation")
        
        try:
            full_response = []
            
            stop_tokens = ["User:", "Assistant:", "Instruct:", "Output:"]
            if "llama" in self.config.model_path.name.lower():
                stop_tokens.extend(["<|eot_id|>", "<|end_of_text|>"])
                
            for output in self.model(
                prompt,
                max_tokens=max_tokens,
                temperature=temperature,
                stop=stop_tokens,
                stream=True
            ):
                chunk = output["choices"][0]["text"]
                full_response.append(chunk)
                yield chunk
            
            # Update history
            generated_text = "".join(full_response).strip()
            # Post-process streaming response for history and metadata updates
            generated_text = re.sub(r"\(relievance:.*?\)", "", generated_text, flags=re.IGNORECASE).strip()
            generated_text = generated_text.replace("..", ".").strip()
            
            self.conversation_history.append({"role": "user", "content": user_message})
            self.conversation_history.append({"role": "assistant", "content": generated_text})
            
            logger.info(f"Streaming complete: {len(generated_text)} chars")
        
        except Exception as e:
            logger.error(f"Streaming generation failed: {e}")
            yield "I apologize, but I encountered an error."
    
    def clear_history(self) -> None:
        """Clear conversation history"""
        logger.info("Clearing conversation history")
        self.conversation_history.clear()
    
    def get_history(self) -> List[Dict[str, str]]:
        """Get conversation history"""
        return self.conversation_history.copy()
    
    def unload_model(self) -> None:
        """Unload model to free memory"""
        if self.model is not None:
            logger.info("Unloading LLM model")
            del self.model
            self.model = None
