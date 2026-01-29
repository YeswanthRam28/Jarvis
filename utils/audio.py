"""
Audio utility functions for playback and recording
"""
from pathlib import Path
import sounddevice as sd
import numpy as np
import librosa
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
        # Load audio file using librosa (more robust backends for MP3 on Windows)
        # mono=False to preserve stereo if present
        audio_data, sample_rate = librosa.load(str(file_path), sr=None, mono=False)
        
        # sounddevice expects (frames, channels)
        # librosa returns (channels, frames) for multi-channel, so we transpose
        if len(audio_data.shape) > 1:
            audio_data = audio_data.T
            
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
