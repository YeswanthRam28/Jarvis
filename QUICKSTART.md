# JARVIS Quick Reference

## 🚀 Quick Start

```powershell
# 1. Setup
python setup.py

# 2. Download GGUF model → place in models/llm/

# 3. Update .env
JARVIS_LLM_MODEL_PATH=models/llm/your-model.gguf

# 4. Run
python main.py
```

## 📂 Project Structure

```
Jarvis/
├── main.py              # Main orchestrator
├── config.py            # Configuration
├── setup.py             # Setup script
│
├── core/                # Core modules
│   ├── audio_input.py   # Mic + VAD
│   ├── stt.py           # Whisper
│   ├── llm.py           # LLM engine
│   ├── tts.py           # Coqui TTS
│   ├── intent.py        # Intent parser
│   └── conversation.py  # History manager
│
├── memory/              # Memory system
│   ├── embeddings.py    # Sentence transformers
│   ├── semantic_memory.py  # FAISS
│   └── memory_manager.py   # High-level API
│
├── tools/               # Tool system
│   ├── base.py          # Base class
│   ├── system_tools.py  # Time, system info, calc
│   ├── memory_tools.py  # Remember, recall
│   └── registry.py      # Tool registry
│
└── utils/               # Utilities
    └── logger.py        # Logging
```

## 🎯 Pipeline Flow

```
User Speech
    ↓
Audio Input (VAD)
    ↓
Whisper STT
    ↓
Intent Parser
    ↓
Memory Retrieval (context)
    ↓
Tool Execution (if needed)
    ↓
LLM Generation
    ↓
Memory Storage
    ↓
TTS Output
    ↓
User Hears Response
```

## 🛠️ Built-in Tools

| Tool | Usage Example |
|------|---------------|
| **Time** | "What time is it?" |
| **System Info** | "How is my system?" |
| **Calculator** | "Calculate 25 * 4" |
| **Remember** | "Remember that I like pizza" |
| **Recall** | "What do you know about my preferences?" |
| **Memory Stats** | "Memory statistics" |

## ⚙️ Key Configuration

### Audio
```python
vad_threshold: 0.5        # Voice detection (0-1)
silence_duration_ms: 1000 # Silence to end speech
```

### Whisper
```python
model_name: "base"        # tiny/base/small/medium/large
language: "en"            # Language code
```

### LLM
```python
context_size: 4096        # Context window
max_tokens: 512           # Max response
temperature: 0.7          # Creativity (0-1)
```

### Memory
```python
retrieval_top_k: 5        # Memories to retrieve
max_memories: 10000       # Max stored
```

## 🔧 Adding a Custom Tool

```python
# 1. Create tool (tools/my_tool.py)
from tools.base import BaseTool, ToolParameter, ToolResult

class MyTool(BaseTool):
    @property
    def description(self) -> str:
        return "What this tool does"
    
    @property
    def parameters(self) -> list[ToolParameter]:
        return [
            ToolParameter(
                name="param",
                type="string",
                description="Parameter description",
                required=True
            )
        ]
    
    def execute(self, param: str, **kwargs) -> ToolResult:
        # Your logic here
        return ToolResult(success=True, result="Done!")

# 2. Register (main.py)
from tools.my_tool import MyTool
self.tool_registry.register(MyTool())

# 3. Add intent pattern (core/intent.py) - optional
r"my pattern": {
    "intent": IntentType.TOOL_CALL,
    "tool": "MyTool",
    "params": {}
}
```

## 📝 Environment Variables

```bash
# LLM
JARVIS_LLM_MODEL_PATH=models/llm/model.gguf

# Whisper
JARVIS_WHISPER_MODEL=base

# Logging
JARVIS_LOG_LEVEL=INFO

# Debug
JARVIS_DEBUG=false
```

## 🐛 Troubleshooting

| Issue | Solution |
|-------|----------|
| "Model not found" | Download GGUF model, update .env |
| "No speech detected" | Lower vad_threshold in config.py |
| High memory usage | Use smaller models (tiny/base) |
| Slow responses | Use Q4_K_M quantized models |
| Wrong audio device | Set JARVIS_AUDIO_DEVICE in .env |

## 📊 Logs

- **Console**: Rich formatted with colors
- **File**: `data/logs/jarvis.log` (rotating, 10MB)

## 🎮 Operating Modes

### Interactive (Default)
```python
push_to_talk: bool = True
```
- Press Enter to speak
- Type 'quit' to exit

### Continuous
```python
push_to_talk: bool = False
```
- Always listening
- Ctrl+C to stop

## 📦 Recommended Models

| Model | Size | Speed | Quality |
|-------|------|-------|---------|
| TinyLlama-1.1B-Q4 | 700MB | Fast | Basic |
| Mistral-7B-Q4_K_M | 4GB | Medium | Good |
| Llama-2-7B-Q4_K_M | 4GB | Medium | Good |

## 🔗 Model Sources

- **Hugging Face**: Search for "GGUF" models
- **TheBloke**: Popular quantized models
- Look for: `Q4_K_M` or `Q5_K_M` quantization

## 💡 Tips

1. **First run**: Models download automatically (except LLM)
2. **Memory**: Conversations auto-saved to FAISS
3. **Logs**: Check `data/logs/` for debugging
4. **Tools**: Easy to extend - just inherit BaseTool
5. **Intent**: Add patterns for better routing

## 🚀 Next Steps

1. Download model
2. Run setup.py
3. Configure .env
4. Run main.py
5. Start talking!

---

**Need help?** Check [README.md](file:///d:/Projects/Jarvis/README.md) for full documentation.
