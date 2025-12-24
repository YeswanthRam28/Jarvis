"""
Text-to-Speech using Coqui TTS
Offline speech synthesis with voice customization
"""
import sounddevice as sd
import numpy as np
from typing import Optional, TYPE_CHECKING
from pathlib import Path

if TYPE_CHECKING:
    from TTS.api import TTS

from utils.logger import get_logger
from config import TTSConfig

logger = get_logger("jarvis.tts")


class TTSEngine:
    """
    Text-to-speech using Coqui TTS
    """
    
    def __init__(self, config: TTSConfig):
        """
        Initialize TTS engine
        
        Args:
            config: TTS configuration
        """
        self.config = config
        self.model: Optional[TTS] = None
        self.model_name = config.model_name
        
        # Create model directory
        config.model_dir.mkdir(parents=True, exist_ok=True)
        
        logger.info(f"TTSEngine initialized: model={self.model_name}")
    
    def load_model(self) -> None:
        """Load TTS model (lazy loading)"""
        if self.model is not None:
            return
        
        logger.info(f"Loading TTS model: {self.model_name}")
        
        try:
            # Import TTS here to avoid numba compilation on startup
            from TTS.api import TTS
            
            self.model = TTS(
                model_name=self.model_name,
                progress_bar=False,
                gpu=self.config.use_cuda
            )
            logger.info("TTS model loaded successfully")
        
        except Exception as e:
            logger.error(f"Failed to load TTS model: {e}")
            raise
    
    def synthesize(
        self,
        text: str,
        speaker: Optional[str] = None,
        speed: Optional[float] = None
    ) -> np.ndarray:
        """
        Synthesize speech from text
        
        Args:
            text: Text to synthesize
            speaker: Speaker name (for multi-speaker models)
            speed: Speech speed multiplier
        
        Returns:
            Audio data as numpy array
        """
        # Ensure model is loaded
        self.load_model()
        
        speaker = speaker or self.config.speaker
        speed = speed or self.config.speed
        
        logger.debug(f"Synthesizing: '{text[:50]}...' (speed={speed})")
        
        try:
            # Synthesize
            wav = self.model.tts(text=text, speaker=speaker)
            
            # Convert to numpy array
            audio = np.array(wav, dtype=np.float32)
            
            # Adjust speed if needed
            if speed != 1.0:
                # Simple speed adjustment (resampling would be better)
                audio = self._adjust_speed(audio, speed)
            
            logger.info(f"Synthesized: {len(audio) / 22050:.2f}s audio")
            
            return audio
        
        except Exception as e:
            logger.error(f"Synthesis failed: {e}")
            return np.array([], dtype=np.float32)
    
    def speak(
        self,
        text: str,
        speaker: Optional[str] = None,
        speed: Optional[float] = None,
        blocking: bool = True
    ) -> None:
        """
        Synthesize and play speech
        
        Args:
            text: Text to speak
            speaker: Speaker name
            speed: Speech speed multiplier
            blocking: Wait for playback to complete
        """
        if not text.strip():
            logger.warning("Empty text provided for TTS")
            return
        
        logger.info(f"Speaking: '{text[:50]}...'")
        
        # Synthesize
        audio = self.synthesize(text, speaker, speed)
        
        if len(audio) == 0:
            logger.error("No audio generated")
            return
        
        # Play audio
        try:
            sd.play(audio, samplerate=22050, blocking=blocking)
            logger.debug("Audio playback started")
        
        except Exception as e:
            logger.error(f"Audio playback failed: {e}")
    
    def save_to_file(
        self,
        text: str,
        output_file: Path,
        speaker: Optional[str] = None,
        speed: Optional[float] = None
    ) -> None:
        """
        Synthesize and save to file
        
        Args:
            text: Text to synthesize
            output_file: Output audio file path
            speaker: Speaker name
            speed: Speech speed multiplier
        """
        self.load_model()
        
        logger.info(f"Saving TTS to file: {output_file}")
        
        try:
            self.model.tts_to_file(
                text=text,
                speaker=speaker or self.config.speaker,
                file_path=str(output_file)
            )
            logger.info(f"TTS saved to {output_file}")
        
        except Exception as e:
            logger.error(f"Failed to save TTS: {e}")
    
    def _adjust_speed(self, audio: np.ndarray, speed: float) -> np.ndarray:
        """
        Adjust audio speed (simple implementation)
        
        Args:
            audio: Audio data
            speed: Speed multiplier
        
        Returns:
            Speed-adjusted audio
        """
        if speed == 1.0:
            return audio
        
        # Simple resampling (not ideal, but works)
        indices = np.arange(0, len(audio), speed)
        indices = indices[indices < len(audio)].astype(int)
        return audio[indices]
    
    def stop(self) -> None:
        """Stop current playback"""
        try:
            sd.stop()
            logger.debug("Audio playback stopped")
        except Exception as e:
            logger.error(f"Failed to stop playback: {e}")
    
    def unload_model(self) -> None:
        """Unload model to free memory"""
        if self.model is not None:
            logger.info("Unloading TTS model")
            del self.model
            self.model = None
