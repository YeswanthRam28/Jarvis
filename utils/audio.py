"""
Audio utility functions for playback and recording
"""
from pathlib import Path
import sounddevice as sd
import numpy as np
import torchaudio
from utils.logger import get_logger

logger = get_logger("jarvis.utils.audio")

def play_sound(file_path: Path) -> bool:
    """
    Play an audio file using torchaudio and sounddevice
    
    Args:
        file_path: Path to the audio file (MP3, WAV, etc.)
        
    Returns:
        True if played successfully, False otherwise
    """
    if not file_path or not file_path.exists():
        logger.error(f"Sound file not found: {file_path}")
        return False
        
    try:
        # Load audio file
        waveform, sample_rate = torchaudio.load(str(file_path))
        
        # Convert to numpy and handle channels
        # sounddevice expects (frames, channels)
        audio_data = waveform.t().numpy()
        
        logger.info(f"Playing sound: {file_path.name} ({len(audio_data)/sample_rate:.2f}s)")
        
        # Play asynchronously
        sd.play(audio_data, sample_rate)
        # Note: We don't block here so the pipeline can continue
        # but the caller can choose to wait if needed using sd.wait()
        
        return True
    except Exception as e:
        logger.error(f"Failed to play sound {file_path}: {e}")
        return False

def wait_for_playback():
    """Wait for current audio playback to finish"""
    sd.wait()
