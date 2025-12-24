# JARVIS - Just A Rather Very Intelligent System

A production-ready, offline AI assistant built with Python. JARVIS uses local models for speech recognition, language understanding, and text-to-speech, with semantic memory for context-aware conversations.

## 🎯 Features

- **Always-on microphone listener** with Voice Activity Detection (VAD)
- **Offline speech-to-text** using OpenAI Whisper
- **Local LLM inference** using llama-cpp-python (GGUF models)
- **Tool-based command execution** (extensible plugin system)
- **Long-term semantic memory** using FAISS + sentence-transformers
- **Text-to-speech** using Coqui TTS
- **Modular architecture** designed for growth and extensibility

## 📁 Project Structure

```
Jarvis/
├── main.py                    # Main event loop orchestrator
├── config.py                  # Centralized configuration
├── req.txt                    # Dependencies
├── .env                       # Environment variables (create from .env.template)
│
├── core/                      # Core system modules
│   ├── audio_input.py         # Microphone listener with VAD
│   ├── stt.py                 # Whisper speech-to-text
│   ├── llm.py                 # LLM inference engine
│   ├── tts.py                 # Coqui TTS engine
│   ├── intent.py              # Intent parsing and routing
│   └── conversation.py        # Conversation state management
│
├── memory/                    # Long-term memory system
│   ├── embeddings.py          # Sentence transformer embeddings
│   ├── semantic_memory.py     # FAISS vector store
│   └── memory_manager.py      # High-level memory interface
│
├── tools/                     # Executable tools/commands
│   ├── base.py                # Base tool interface
│   ├── system_tools.py        # System commands
│   ├── memory_tools.py        # Memory operations
│   └── registry.py            # Tool registration
│
├── utils/                     # Shared utilities
│   └── logger.py              # Logging configuration
│
├── models/                    # Model storage
│   ├── llm/                   # GGUF models (place your models here)
│   ├── whisper/               # Whisper model cache
│   ├── tts/                   # TTS model cache
│   └── embeddings/            # Sentence transformer cache
│
└── data/                      # Runtime data
    ├── memory/                # FAISS indices
    ├── logs/                  # Application logs
    └── audio_cache/           # Temporary audio files
```

## 🚀 Quick Start

### 1. Setup Environment

```powershell
# Create .env file from template
Copy-Item .env.template .env

# Edit .env to configure your setup (optional)
notepad .env
```

### 2. Download Models

**LLM Model (Required):**
- Download a GGUF model (e.g., Mistral-7B, Llama-2, etc.)
- Place in `models/llm/`
- Update `.env` with the model path:
  ```
  JARVIS_LLM_MODEL_PATH=models/llm/your-model.gguf
  ```

**Recommended models:**
- Mistral-7B-Instruct (Q4_K_M): ~4GB, good balance
- Llama-2-7B-Chat (Q4_K_M): ~4GB, conversational
- TinyLlama-1.1B (Q4_K_M): ~700MB, fast but less capable

**Other models (auto-downloaded on first run):**
- Whisper: Auto-downloads on first use
- TTS: Auto-downloads on first use
- Embeddings: Auto-downloads on first use

### 3. Run JARVIS

```powershell
# Activate virtual environment
.\venv\Scripts\Activate.ps1

# Run JARVIS
python main.py
```

## 💬 Usage

### Interactive Mode (Default)

JARVIS runs in push-to-talk mode by default:

1. Press Enter to start listening
2. Speak your command
3. JARVIS will process and respond
4. Type 'quit' to exit

**Example interactions:**
```
User: "What time is it?"
JARVIS: "It's 2:30 PM"

User: "Remember that my favorite color is blue"
JARVIS: "I'll remember that your favorite color is blue"

User: "What's my favorite color?"
JARVIS: "Your favorite color is blue"

User: "Calculate 25 * 4"
JARVIS: "The result is 100"
```

### Continuous Mode

To enable always-listening mode, edit `config.py`:
```python
push_to_talk: bool = False
```

## 🛠️ Configuration

All configuration is in `config.py`. Key settings:

### Audio Settings
```python
sample_rate: int = 16000          # Audio sample rate
vad_threshold: float = 0.5        # Voice detection sensitivity (0-1)
silence_duration_ms: int = 1000   # Silence to end speech
```

### Whisper Settings
```python
model_name: str = "base"          # tiny, base, small, medium, large
language: str = "en"              # Language code
```

### LLM Settings
```python
context_size: int = 4096          # Context window
max_tokens: int = 512             # Max response length
temperature: float = 0.7          # Creativity (0-1)
```

### Memory Settings
```python
retrieval_top_k: int = 5          # Memories to retrieve
max_memories: int = 10000         # Max stored memories
```

## 🔧 Adding Custom Tools

Create a new tool by extending `BaseTool`:

```python
# tools/my_tool.py
from tools.base import BaseTool, ToolParameter, ToolResult

class MyCustomTool(BaseTool):
    @property
    def description(self) -> str:
        return "Description of what this tool does"
    
    @property
    def parameters(self) -> list[ToolParameter]:
        return [
            ToolParameter(
                name="param1",
                type="string",
                description="Parameter description",
                required=True
            )
        ]
    
    def execute(self, param1: str, **kwargs) -> ToolResult:
        try:
            # Your tool logic here
            result = f"Processed: {param1}"
            return ToolResult(success=True, result=result)
        except Exception as e:
            return ToolResult(success=False, error=str(e))
```

Register in `main.py`:
```python
from tools.my_tool import MyCustomTool
self.tool_registry.register(MyCustomTool())
```

## 📊 Built-in Tools

- **GetTimeTool**: Get current time/date
- **GetSystemInfoTool**: System information (OS, CPU, memory)
- **CalculatorTool**: Mathematical calculations
- **RememberTool**: Store information in memory
- **RecallTool**: Retrieve information from memory
- **GetMemoryStatsTool**: Memory system statistics

## 🧠 Memory System

JARVIS uses FAISS for semantic memory:

- **Automatic storage**: Conversations are automatically stored
- **Semantic search**: Retrieves relevant context based on meaning
- **Categories**: Organize memories (facts, conversations, preferences)
- **Persistent**: Memories saved to disk and loaded on startup

## 📝 Logging

Logs are written to:
- **Console**: Rich formatted output with colors
- **File**: `data/logs/jarvis.log` (rotating, 10MB max)

Log levels: DEBUG, INFO, WARNING, ERROR

## 🎛️ Advanced Configuration

### Environment Variables

Override config via environment variables:
```
JARVIS_LLM_MODEL_PATH=path/to/model.gguf
JARVIS_WHISPER_MODEL=small
JARVIS_LOG_LEVEL=DEBUG
JARVIS_DEBUG=true
```

### Audio Device Selection

List available audio devices:
```python
import sounddevice as sd
print(sd.query_devices())
```

Set device in `.env`:
```
JARVIS_AUDIO_DEVICE=0
```

## 🐛 Troubleshooting

### "Model file not found"
- Ensure you've downloaded a GGUF model
- Check the path in `.env` or `config.py`

### "No speech detected"
- Adjust `vad_threshold` in config (lower = more sensitive)
- Check microphone permissions
- Verify correct audio device

### High memory usage
- Use smaller models (tiny/base Whisper, smaller LLM)
- Reduce `context_size` in LLM config
- Lower `max_memories` in memory config

### Slow responses
- Use quantized models (Q4_K_M recommended)
- Reduce `max_tokens` for faster generation
- Enable GPU layers: `n_gpu_layers` in config

## 🔮 Future Enhancements

- Wake word detection
- Multi-language support
- Web UI via FastAPI
- Plugin marketplace
- Voice cloning
- Integration with smart home devices
- Calendar and email integration
- Web search capabilities

## 📄 License

This project is provided as-is for educational and personal use.

## 🙏 Acknowledgments

Built with:
- OpenAI Whisper
- llama-cpp-python
- Coqui TTS
- FAISS
- sentence-transformers
- sounddevice
- Rich

---

**JARVIS** - Your personal AI assistant, running entirely on your machine.
