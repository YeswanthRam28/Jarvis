"""
Speech-to-Text using OpenAI Whisper
Offline speech recognition with model caching
"""
import numpy as np
from typing import Optional, Dict, Any, TYPE_CHECKING
from pathlib import Path

if TYPE_CHECKING:
    import whisper

from utils.logger import get_logger
from config import WhisperConfig

logger = get_logger("jarvis.stt")


class WhisperSTT:
    """
    Speech-to-text using OpenAI Whisper
    """
    
    def __init__(self, config: WhisperConfig):
        """
        Initialize Whisper STT
        
        Args:
            config: Whisper configuration
        """
        self.config = config
        self.model = None
        self.model_name = config.model_name
        
        # Create model directory
        config.model_dir.mkdir(parents=True, exist_ok=True)
        
        logger.info(f"WhisperSTT initialized: model={self.model_name}, device={config.device}")
    
    def load_model(self) -> None:
        """Load Whisper model (lazy loading)"""
        if self.model is not None:
            return
        
        logger.info(f"Loading Whisper model: {self.model_name}")
        
        try:
            import whisper
            self.model = whisper.load_model(
                self.model_name,
                device=self.config.device,
                download_root=str(self.config.model_dir)
            )
            logger.info("Whisper model loaded successfully")
        
        except Exception as e:
            logger.error(f"Failed to load Whisper model: {e}")
            raise
    
    def transcribe(
        self,
        audio: np.ndarray,
        language: Optional[str] = None,
        task: str = "transcribe"
    ) -> Dict[str, Any]:
        """
        Transcribe audio to text
        
        Args:
            audio: Audio data (numpy array, float32, 16kHz)
            language: Language code (None = auto-detect)
            task: Task type ("transcribe" or "translate")
        
        Returns:
            Dictionary with transcription results:
                - text: Transcribed text
                - language: Detected/specified language
                - segments: Detailed segments with timestamps
        """
        # Ensure model is loaded
        self.load_model()
        
        # Use configured language if not specified
        if language is None:
            language = self.config.language
        
        logger.debug(f"Transcribing audio: {len(audio) / 16000:.2f}s, language={language}")
        
        try:
            # Transcribe
            result = self.model.transcribe(
                audio,
                language=language,
                task=task,
                fp16=False,  # Use FP32 for CPU
                verbose=False
            )
            
            text = result["text"].strip()
            detected_language = result.get("language", language)
            
            logger.info(f"Transcription: '{text}' (language={detected_language})")
            
            return {
                "text": text,
                "language": detected_language,
                "segments": result.get("segments", [])
            }
        
        except Exception as e:
            logger.error(f"Transcription failed: {e}")
            return {
                "text": "",
                "language": language or "unknown",
                "segments": []
            }
    
    def transcribe_file(self, audio_file: Path, **kwargs) -> Dict[str, Any]:
        """
        Transcribe audio from file
        
        Args:
            audio_file: Path to audio file
            **kwargs: Additional arguments for transcribe()
        
        Returns:
            Transcription results
        """
        self.load_model()
        
        logger.info(f"Transcribing file: {audio_file}")
        
        try:
            result = self.model.transcribe(str(audio_file), **kwargs)
            text = result["text"].strip()
            
            logger.info(f"File transcription: '{text}'")
            
            return {
                "text": text,
                "language": result.get("language", "unknown"),
                "segments": result.get("segments", [])
            }
        
        except Exception as e:
            logger.error(f"File transcription failed: {e}")
            return {
                "text": "",
                "language": "unknown",
                "segments": []
            }
    
    def unload_model(self) -> None:
        """Unload model to free memory"""
        if self.model is not None:
            logger.info("Unloading Whisper model")
            del self.model
            self.model = None
