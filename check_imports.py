import sys
from pathlib import Path

# Add project root to path
sys.path.insert(0, str(Path(__file__).parent))

try:
    print("Applying compatibility fixes...")
    from utils.compatibility import apply_fixes
    apply_fixes()
    
    print("Checking audio_input...")
    import sounddevice as sd
    print("Checking stt...")
    # import whisper actually requires torch, let's see
    print("Checking llm...")
    from llama_cpp import Llama
    print("Checking tts (lazy)...")
    from core.tts import TTSEngine
    print("Checking memory...")
    import faiss
    from sentence_transformers import SentenceTransformer
    print("All imports okay!")
except Exception as e:
    print(f"Import failed: {e}")
    import traceback
    traceback.print_exc()
