"""
Quick setup script for JARVIS
Creates necessary directories and .env file
"""
import os
from pathlib import Path

def setup():
    """Setup JARVIS environment"""
    print("=" * 60)
    print("JARVIS Setup")
    print("=" * 60)
    
    base_dir = Path(__file__).parent
    
    # Create directories
    directories = [
        "models/llm",
        "models/whisper",
        "models/tts",
        "models/embeddings",
        "data/memory",
        "data/logs",
        "data/audio_cache"
    ]
    
    print("\n1. Creating directories...")
    for dir_path in directories:
        full_path = base_dir / dir_path
        full_path.mkdir(parents=True, exist_ok=True)
        print(f"   ✓ {dir_path}")
    
    # Create .env if it doesn't exist
    env_file = base_dir / ".env"
    env_template = base_dir / ".env.template"
    
    if not env_file.exists() and env_template.exists():
        print("\n2. Creating .env file...")
        with open(env_template, 'r') as src:
            content = src.read()
        with open(env_file, 'w') as dst:
            dst.write(content)
        print("   ✓ .env created from template")
    else:
        print("\n2. .env file already exists")
    
    # Check for LLM model
    print("\n3. Checking for LLM model...")
    llm_dir = base_dir / "models" / "llm"
    gguf_files = list(llm_dir.glob("*.gguf"))
    
    if gguf_files:
        print(f"   ✓ Found {len(gguf_files)} GGUF model(s)")
        for model in gguf_files:
            print(f"     - {model.name}")
    else:
        print("   ⚠ No GGUF models found in models/llm/")
        print("   → Download a GGUF model and place it in models/llm/")
        print("   → Recommended: Mistral-7B-Instruct-v0.2.Q4_K_M.gguf")
        print("   → Update JARVIS_LLM_MODEL_PATH in .env")
    
    print("\n" + "=" * 60)
    print("Setup complete!")
    print("=" * 60)
    print("\nNext steps:")
    print("1. Download a GGUF model if you haven't already")
    print("2. Update .env with your model path")
    print("3. Run: python main.py")
    print("\n")

if __name__ == "__main__":
    setup()
