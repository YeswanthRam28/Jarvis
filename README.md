# JARVIS 🛰️🌌🧡
### Just A Rather Very Intelligent System

[![License: MIT](https://img.shields.io/badge/License-MIT-purple.svg)](https://opensource.org/licenses/MIT)
[![Python: 3.10+](https://img.shields.io/badge/Python-3.10+-5227FF.svg)](https://www.python.org/)
[![React: FUI](https://img.shields.io/badge/UI-Holographic_FUI-FF9FFC.svg)](https://react.dev/)

A production-ready, offline AI assistant featuring a high-fidelity **Synthwave Holographic HUD**. JARVIS combines local LLM inference, long-term semantic memory, and a cinematic interface to provide a truly immersive AI experience—all running 100% locally on your hardware.

---

## ✨ Features

- **Holographic FUI (Futuristic UI)**: A stunning Synthwave-themed dashboard built with React, Three.js, and Framer Motion.
- **Always-on Voice Core**: Real-time microphone listening with high-precision Voice Activity Detection (VAD).
- **Private & Offline**: 
  - **Speech-to-Text**: High-accuracy transcription via OpenAI Whisper.
  - **LLM Brain**: Local inference via `llama-cpp-python` (GGUF support).
  - **Neural TTS**: Natural-sounding speech generation via Coqui TTS.
- **Semantic Cortex**: Long-term memory system using FAISS vector clustering and sentence-transformers for infinite context retrieval.
- **Extensible Toolbelt**: Custom plugin system allowing JARVIS to control your system, perform calculations, and manage its own memory.
- **Liquid Ether Physics**: Dynamic, interactive fluid-background that responds to your presence and AI thought processes.

---

## 🏗️ System Architecture

```text
Jarvis/
├── main.py                    # Neural Orchestrator (Backend)
├── config.py                  # System Parameters
├── ui/                        # Holographic HUD (Frontend)
│   ├── src/pages/             # Activation Portal & Battle-Bridge
│   └── src/components/        # NeuralSphere, LiquidEther, HexCore
├── core/                      # Cognitive Modules (STT, LLM, TTS)
├── memory/                    # Semantic Vector Storage
└── tools/                     # Operational Extensions
```

---

## 🚀 Deployment Instructions

### 1. Initialize Neural Environment

```powershell
# Clone the repository
git clone https://github.com/YeswanthRam28/Jarvis.git
cd Jarvis

# Setup Backend Environment
python -m venv venv
.\venv\Scripts\Activate.ps1
pip install -r requirements.txt

# Setup HUD Dependencies
cd ui
npm install
```

### 2. Configure Neural Links

1. Create a `.env` file from the template:
   ```powershell
   Copy-Item .env.template .env
   ```
2. Download a GGUF model (e.g., Mistral-7B, Llama-3) and place it in `models/llm/`.
3. Update `JARVIS_LLM_MODEL_PATH` in your `.env` to point to your model.

### 3. Ignition

Launch the full experience (Backend + HUD) with one command:
```powershell
./run_hud.ps1
```

---

## 🛰️ Holographic HUD Operations

The interface consists of three primary security layers:

1. **Activation Portal**: The system's "resting" state. Energy fields (Liquid Ether) flow at baseline levels.
2. **Security Check (Auth)**: RSA-256 encrypted biometric cipher entry for system access.
3. **Command Bridge (HUD)**: 
   - **Neural Sphere**: Real-time visualization of the AI's internal thought state.
   - **Telemetry Pods**: Live tracking of neural sync, core load, and system stability.
   - **Cortex Stream**: Scrolling digital logs of all background system operations.
   - **Digital Decay**: Holographic text materialization with digital materialization effects.

---

## 🧩 Advanced Customization

### Modifying the HUD Palette
Update `ui/src/index.css` variables to shift the system's aesthetic:
```css
:root {
  --fui-primary: #5227FF;   /* Primary Glow */
  --fui-secondary: #FF9FFC; /* Accent Glow */
  --fui-tertiary: #B19EEF;  /* Sub-Glow */
}
```

### Extending Tools
Extend the `BaseTool` class in `tools/` to give JARVIS new capabilities (e.g., controlling IoT devices, web searching, or specific localized tasks).

---

## 📄 Operational License

Distributed under the **MIT License**. See `LICENSE` for more information.

---

**Designed with precision. Built for intelligence.**  
Developed by [Yeswanth Ram](https://github.com/YeswanthRam28) 🧑‍💻✨
