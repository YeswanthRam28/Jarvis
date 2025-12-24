"""
Audio Input Handler
Continuous microphone listening with Voice Activity Detection (VAD)
"""
import numpy as np
import sounddevice as sd
from typing import Optional, Callable
from collections import deque
from threading import Thread, Event
import time

from utils.logger import get_logger
from config import AudioConfig

logger = get_logger("jarvis.audio_input")


class AudioInput:
    """
    Handles microphone input with voice activity detection
    """
    
    def __init__(self, config: AudioConfig):
        """
        Initialize audio input handler
        
        Args:
            config: Audio configuration
        """
        self.config = config
        self.sample_rate = config.sample_rate
        self.channels = config.channels
        self.chunk_size = int(config.sample_rate * config.chunk_duration_ms / 1000)
        self.vad_threshold = config.vad_threshold
        self.silence_duration = config.silence_duration_ms / 1000  # Convert to seconds
        
        # Audio buffer
        self.buffer = deque(maxlen=100)  # Keep last 3 seconds of audio
        
        # State
        self.is_listening = False
        self.is_speaking = False
        self.last_speech_time = 0
        self.speech_buffer = []
        
        # Threading
        self.stop_event = Event()
        self.listen_thread: Optional[Thread] = None
        
        # Callback for when speech is detected
        self.on_speech_detected: Optional[Callable[[np.ndarray], None]] = None
        
        logger.info(f"AudioInput initialized: sample_rate={self.sample_rate}, chunk_size={self.chunk_size}")
    
    def _calculate_energy(self, audio_chunk: np.ndarray) -> float:
        """
        Calculate energy of audio chunk for VAD
        
        Args:
            audio_chunk: Audio data
        
        Returns:
            Normalized energy value (0-1)
        """
        if len(audio_chunk) == 0:
            return 0.0
        
        # RMS energy
        energy = np.sqrt(np.mean(audio_chunk ** 2))
        
        # Normalize to 0-1 range (assuming 16-bit audio)
        normalized_energy = min(energy / 0.1, 1.0)
        
        return normalized_energy
    
    def _is_speech(self, audio_chunk: np.ndarray) -> bool:
        """
        Determine if audio chunk contains speech
        
        Args:
            audio_chunk: Audio data
        
        Returns:
            True if speech detected
        """
        energy = self._calculate_energy(audio_chunk)
        return energy > self.vad_threshold
    
    def _audio_callback(self, indata: np.ndarray, frames: int, time_info, status):
        """
        Callback for audio stream
        
        Args:
            indata: Input audio data
            frames: Number of frames
            time_info: Time information
            status: Stream status
        """
        if status:
            logger.warning(f"Audio stream status: {status}")
        
        # Copy audio data
        audio_chunk = indata[:, 0].copy() if self.channels == 1 else indata.copy()
        
        # Add to buffer
        self.buffer.append(audio_chunk)
        
        # Check for speech
        if self._is_speech(audio_chunk):
            if not self.is_speaking:
                logger.debug("Speech started")
                self.is_speaking = True
                # Include some pre-speech audio from buffer
                self.speech_buffer = list(self.buffer)[-10:]  # Last ~300ms
            else:
                self.speech_buffer.append(audio_chunk)
            
            self.last_speech_time = time.time()
        
        elif self.is_speaking:
            # Still in speech, add to buffer
            self.speech_buffer.append(audio_chunk)
            
            # Check if silence duration exceeded
            if time.time() - self.last_speech_time > self.silence_duration:
                logger.debug("Speech ended")
                self.is_speaking = False
                
                # Concatenate speech buffer
                if self.speech_buffer:
                    speech_audio = np.concatenate(self.speech_buffer)
                    
                    # Call callback if registered
                    if self.on_speech_detected:
                        self.on_speech_detected(speech_audio)
                
                # Clear buffer
                self.speech_buffer = []
    
    def start(self, callback: Optional[Callable[[np.ndarray], None]] = None) -> None:
        """
        Start listening for audio
        
        Args:
            callback: Function to call when speech is detected
        """
        if self.is_listening:
            logger.warning("Already listening")
            return
        
        self.on_speech_detected = callback
        self.is_listening = True
        self.stop_event.clear()
        
        logger.info("Starting audio input stream")
        
        # Start audio stream
        self.stream = sd.InputStream(
            samplerate=self.sample_rate,
            channels=self.channels,
            dtype=np.float32,
            blocksize=self.chunk_size,
            device=self.config.device_index,
            callback=self._audio_callback
        )
        
        self.stream.start()
        logger.info("Audio input stream started")
    
    def stop(self) -> None:
        """Stop listening for audio"""
        if not self.is_listening:
            return
        
        logger.info("Stopping audio input stream")
        self.is_listening = False
        self.stop_event.set()
        
        if hasattr(self, 'stream'):
            self.stream.stop()
            self.stream.close()
        
        logger.info("Audio input stream stopped")
    
    def listen_once(self, timeout: float = 10.0) -> Optional[np.ndarray]:
        """
        Listen for a single speech utterance
        
        Args:
            timeout: Maximum time to wait for speech (seconds)
        
        Returns:
            Audio data or None if timeout
        """
        speech_data = None
        speech_event = Event()
        
        def callback(audio: np.ndarray):
            nonlocal speech_data
            speech_data = audio
            speech_event.set()
        
        self.start(callback)
        
        # Wait for speech or timeout
        speech_detected = speech_event.wait(timeout)
        
        self.stop()
        
        if speech_detected:
            logger.info(f"Captured speech: {len(speech_data) / self.sample_rate:.2f}s")
            return speech_data
        else:
            logger.warning("Speech detection timeout")
            return None
    
    def __enter__(self):
        """Context manager entry"""
        return self
    
    def __exit__(self, exc_type, exc_val, exc_tb):
        """Context manager exit"""
        self.stop()
