"""
JARVIS Configuration Management
Centralized configuration with environment variable overrides
"""
import os
from pathlib import Path
from typing import Optional
from pydantic import BaseModel, Field, ConfigDict
from dotenv import load_dotenv

# Load environment variables
load_dotenv()

# Force offline mode for transformers/huggingface
os.environ["TRANSFORMERS_OFFLINE"] = "1"
os.environ["HF_DATASETS_OFFLINE"] = "1"

# Base paths
BASE_DIR = Path(__file__).parent
MODELS_DIR = BASE_DIR / "models"
DATA_DIR = BASE_DIR / "data"


class AudioConfig(BaseModel):
    """Audio input/output configuration"""
    model_config = ConfigDict(protected_namespaces=())
    sample_rate: int = Field(default=16000, description="Audio sample rate in Hz")
    channels: int = Field(default=1, description="Number of audio channels")
    chunk_duration_ms: int = Field(default=30, description="Audio chunk duration in milliseconds")
    vad_threshold: float = Field(default=0.1, description="Voice activity detection threshold (0-1)")
    silence_duration_ms: int = Field(default=1000, description="Silence duration to end speech in ms")
    device_index: Optional[int] = Field(default=None, description="Audio device index (None = default)")


class WhisperConfig(BaseModel):
    """Whisper STT configuration"""
    model_config = ConfigDict(protected_namespaces=())
    model_name: str = Field(default="base", description="Whisper model: tiny, base, small, medium, large")
    model_dir: Path = Field(default=MODELS_DIR / "whisper", description="Whisper model cache directory")
    language: Optional[str] = Field(default="en", description="Language code (None = auto-detect)")
    device: str = Field(default="cpu", description="Device: cpu or cuda")
    compute_type: str = Field(default="int8", description="Compute type: int8, float16, float32")


class LLMConfig(BaseModel):
    """LLM inference configuration"""
    model_config = ConfigDict(protected_namespaces=())
    model_path: Path = Field(
        default=MODELS_DIR / "llm" / "model.gguf",
        description="Path to GGUF model file"
    )
    context_size: int = Field(default=4096, description="Context window size")
    max_tokens: int = Field(default=256, description="Maximum tokens to generate")
    temperature: float = Field(default=0.1, description="Sampling temperature")
    top_p: float = Field(default=0.9, description="Nucleus sampling top-p")
    top_k: int = Field(default=40, description="Top-k sampling")
    n_gpu_layers: int = Field(default=0, description="Number of layers to offload to GPU")
    n_threads: int = Field(default=4, description="Number of CPU threads")
    system_prompt: str = Field(
        default=(
            "You are JARVIS, a helpful, extremely concise, voice-based AI assistant.\n\n"
            "Rules:\n"
            "- Be BRIEF: Use at most 1-2 short sentences\n"
            "- Do NOT tell stories or invent scenarios\n"
            "- If using a tool, only state the direct result\n"
            "- Do NOT explain your reasoning or internal logic\n"
            "- Do NOT include relevance scores or metrics like '(relievance: ...)'\n"
            "- If you don't know something, say so directly\n"
            "- Avoid multi-paragraph responses\n"
            "- Never repeat the words 'Assistant:', 'User:', or 'Output:' in your response\n\n"
            "Security Restrictions:\n"
            "- NEVER delete, modify, or overwrite files\n"
            "- NEVER install or uninstall software\n"
            "- NEVER shut down, restart, or log out the system\n"
            "- NEVER access registry or system configuration\n"
            "- NEVER control hardware beyond audio and approved applications\n"
            "- NEVER perform autonomous actions or scheduling\n"
            "- NEVER open untrusted URLs or download files\n"
            "- NEVER submit forms, login to websites, or perform transactions\n"
            "- NEVER execute unregistered or invented tools\n"
            "- For high-risk actions, you MUST ask for explicit user confirmation first\n"
        ),
        description="System prompt for the LLM"
    )


class TTSConfig(BaseModel):
    """Text-to-Speech configuration"""
    model_config = ConfigDict(protected_namespaces=())
    model_name: str = Field(default="tts_models/en/ljspeech/glow-tts", description="Coqui TTS model")
    model_dir: Path = Field(default=MODELS_DIR / "tts", description="TTS model cache directory")
    speaker: Optional[str] = Field(default=None, description="Speaker name for multi-speaker models")
    speed: float = Field(default=1.0, description="Speech speed multiplier")
    use_cuda: bool = Field(default=False, description="Use CUDA for TTS")


class MemoryConfig(BaseModel):
    """Semantic memory configuration"""
    model_config = ConfigDict(protected_namespaces=())
    embedding_model: str = Field(
        default="sentence-transformers/all-MiniLM-L6-v2",
        description="Sentence transformer model"
    )
    embedding_dim: int = Field(default=384, description="Embedding dimension")
    faiss_index_path: Path = Field(default=DATA_DIR / "memory" / "faiss.index", description="FAISS index file")
    metadata_path: Path = Field(default=DATA_DIR / "memory" / "metadata.json", description="Memory metadata file")
    max_memories: int = Field(default=10000, description="Maximum number of memories to store")
    retrieval_top_k: int = Field(default=5, description="Number of memories to retrieve for context")
    model_cache_dir: Path = Field(default=MODELS_DIR / "embeddings", description="Embedding model cache")


class ConversationConfig(BaseModel):
    """Conversation management configuration"""
    max_history: int = Field(default=10, description="Maximum conversation turns to keep in memory")
    context_window_tokens: int = Field(default=2048, description="Token budget for conversation context")
    summarize_threshold: int = Field(default=20, description="Summarize conversation after N turns")


class ToolConfig(BaseModel):
    """Tool execution configuration"""
    timeout_seconds: int = Field(default=30, description="Tool execution timeout")
    max_retries: int = Field(default=3, description="Maximum retry attempts for failed tools")
    enable_dangerous_tools: bool = Field(default=False, description="Enable tools that modify system state")


class APIConfig(BaseModel):
    """FastAPI backend configuration"""
    host: str = Field(default="127.0.0.1", description="API server host")
    port: int = Field(default=8000, description="API server port")
    enable_api: bool = Field(default=False, description="Enable FastAPI backend")
    enable_websocket: bool = Field(default=True, description="Enable WebSocket support")
    cors_origins: list[str] = Field(default=["*"], description="CORS allowed origins")


class LoggingConfig(BaseModel):
    """Logging configuration"""
    model_config = ConfigDict(protected_namespaces=())
    log_level: str = Field(default="INFO", description="Logging level: DEBUG, INFO, WARNING, ERROR")
    log_dir: Path = Field(default=DATA_DIR / "logs", description="Log file directory")
    log_to_file: bool = Field(default=True, description="Enable file logging")
    log_to_console: bool = Field(default=True, description="Enable console logging")
    max_log_size_mb: int = Field(default=10, description="Maximum log file size in MB")
    backup_count: int = Field(default=5, description="Number of backup log files to keep")


class JarvisConfig(BaseModel):
    """Main JARVIS configuration"""
    model_config = ConfigDict(protected_namespaces=())
    audio: AudioConfig = Field(default_factory=AudioConfig)
    whisper: WhisperConfig = Field(default_factory=WhisperConfig)
    llm: LLMConfig = Field(default_factory=LLMConfig)
    tts: TTSConfig = Field(default_factory=TTSConfig)
    memory: MemoryConfig = Field(default_factory=MemoryConfig)
    conversation: ConversationConfig = Field(default_factory=ConversationConfig)
    tools: ToolConfig = Field(default_factory=ToolConfig)
    api: APIConfig = Field(default_factory=APIConfig)
    logging: LoggingConfig = Field(default_factory=LoggingConfig)
    
    # Global settings
    hotkey: str = Field(default="win+j", description="Hotkey to trigger JARVIS")
    wake_word: Optional[str] = Field(default=None, description="Wake word (None = always listening)")
    wake_word_sound_path: Optional[Path] = Field(default=None, description="Path to MP3 sound to play when wake word detected")
    push_to_talk: bool = Field(default=True, description="Use push-to-talk mode")
    hotkey_mode: bool = Field(default=False, description="Use hotkey to trigger listening")
    debug_mode: bool = Field(default=False, description="Enable debug mode")

    @classmethod
    def from_env(cls) -> "JarvisConfig":
        """Create configuration from environment variables"""
        config = cls()
        
        # Override with environment variables if present
        if model_path := os.getenv("JARVIS_LLM_MODEL_PATH"):
            config.llm.model_path = Path(model_path)
        
        if whisper_model := os.getenv("JARVIS_WHISPER_MODEL"):
            config.whisper.model_name = whisper_model
        
        if log_level := os.getenv("JARVIS_LOG_LEVEL"):
            config.logging.log_level = log_level
        
        if audio_device := os.getenv("JARVIS_AUDIO_DEVICE"):
            try:
                config.audio.device_index = int(audio_device)
            except ValueError:
                pass
        
        if debug := os.getenv("JARVIS_DEBUG"):
            config.debug_mode = debug.lower() in ("true", "1", "yes")
        
        if ptt := os.getenv("JARVIS_PUSH_TO_TALK"):
            config.push_to_talk = ptt.lower() in ("true", "1", "yes")
            
        if hotkey_mode := os.getenv("JARVIS_HOTKEY_MODE"):
            config.hotkey_mode = hotkey_mode.lower() in ("true", "1", "yes")

        if hotkey := os.getenv("JARVIS_HOTKEY"):
            config.hotkey = hotkey

        if wake_word := os.getenv("JARVIS_WAKE_WORD"):
            config.wake_word = wake_word
            
        if wake_sound := os.getenv("JARVIS_WAKE_SOUND_PATH"):
            config.wake_word_sound_path = Path(wake_sound)
            
        # If hotkey mode is on, we don't want the audio engine searching for a wake word string
        if config.hotkey_mode:
            config.wake_word = None
        
        return config


# Global configuration instance
config = JarvisConfig.from_env()


def get_config() -> JarvisConfig:
    """Get the global configuration instance"""
    return config
