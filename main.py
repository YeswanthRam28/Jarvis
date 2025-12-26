"""
JARVIS - Just A Rather Very Intelligent System
Main event loop and orchestrator

Pipeline: Mic → Whisper → Intent → LLM → Tools → Memory → TTS
"""
import asyncio
import signal
import sys
import re
from pathlib import Path

# Add project root to path
sys.path.insert(0, str(Path(__file__).parent))

from config import get_config
from utils.logger import setup_logging, get_logger
from core.audio_input import AudioInput
from core.stt import WhisperSTT
from core.llm import LLMEngine
from core.tts import TTSEngine
from core.intent import IntentParser
from core.conversation import ConversationManager
from memory.memory_manager import MemoryManager
from tools.registry import ToolRegistry
from tools.system_tools import GetTimeTool, GetSystemInfoTool, CalculatorTool
from tools.memory_tools import RememberTool, RecallTool, GetMemoryStatsTool
from utils.compatibility import apply_fixes
from utils.audio import play_sound

# Apply compatibility fixes before other imports
apply_fixes()

logger = get_logger("jarvis.main")


class JARVIS:
    """
    Main JARVIS assistant orchestrator
    """
    
    def __init__(self):
        """Initialize JARVIS"""
        # Load configuration
        self.config = get_config()
        
        # Setup logging
        setup_logging(
            log_level=self.config.logging.log_level,
            log_dir=self.config.logging.log_dir,
            log_to_file=self.config.logging.log_to_file,
            log_to_console=self.config.logging.log_to_console,
            max_bytes=self.config.logging.max_log_size_mb * 1024 * 1024,
            backup_count=self.config.logging.backup_count
        )
        
        logger.info("=" * 60)
        logger.info("JARVIS - Just A Rather Very Intelligent System")
        logger.info("=" * 60)
        
        # Initialize components
        self.audio_input: AudioInput = None
        self.stt: WhisperSTT = None
        self.llm: LLMEngine = None
        self.tts: TTSEngine = None
        self.memory: MemoryManager = None
        self.tool_registry: ToolRegistry = None
        self.intent_parser: IntentParser = None
        self.conversation: ConversationManager = None
        
        # State
        self.is_running = False
        self.shutdown_event = asyncio.Event()
        self.awaiting_command = self.config.wake_word is None
        self._shutdown_complete = False
        self.on_update = None  # Callback for UI updates
    
    def initialize(self) -> None:
        """Initialize all components"""
        logger.info("Initializing components...")
        
        try:
            # Audio input
            logger.info("Initializing audio input...")
            self.audio_input = AudioInput(self.config.audio)
            
            # Speech-to-text
            logger.info("Initializing Whisper STT...")
            self.stt = WhisperSTT(self.config.whisper)
            # self.stt.load_model()
            
            # LLM
            logger.info("Initializing LLM engine...")
            self.llm = LLMEngine(self.config.llm)
            # Don't load model yet - will be loaded on first use
            
            # TTS
            logger.info("Initializing TTS engine...")
            self.tts = TTSEngine(self.config.tts)
            # self.tts.load_model()
            
            # Memory
            logger.info("Initializing memory system...")
            self.memory = MemoryManager(self.config.memory)
            
            # Tool registry
            logger.info("Initializing tool registry...")
            self.tool_registry = ToolRegistry()
            
            # Register tools
            self.tool_registry.register(GetTimeTool())
            self.tool_registry.register(GetSystemInfoTool())
            self.tool_registry.register(CalculatorTool())
            self.tool_registry.register(RememberTool(self.memory))
            self.tool_registry.register(RecallTool(self.memory))
            self.tool_registry.register(GetMemoryStatsTool(self.memory))
            
            logger.info(f"Registered {len(self.tool_registry.list_tools())} tools")
            
            # Intent parser
            logger.info("Initializing intent parser...")
            self.intent_parser = IntentParser(self.tool_registry)
            
            # Conversation manager
            logger.info("Initializing conversation manager...")
            self.conversation = ConversationManager(self.config.conversation)
            
            logger.info("✓ All components initialized successfully")
        
        except Exception as e:
            logger.error(f"Failed to initialize components: {e}")
            raise
    
    def process_audio(self, audio_data) -> None:
        """
        Process audio input through the pipeline
        
        Args:
            audio_data: Audio data from microphone
        """
        try:
            if self.on_update:
                self.on_update({"type": "status", "data": "processing"})
            
            logger.info("Processing audio input...")
            
            # 1. Speech-to-Text
            logger.info("Transcribing audio...")
            transcription = self.stt.transcribe(audio_data)
            user_text = transcription.get("text", "").strip()
            
            if self.on_update:
                self.on_update({"type": "transcription", "data": user_text})
            
            if not user_text:
                logger.warning("No speech detected")
                return
            
            # Check for exit command
            if "shut up" in user_text.lower():
                logger.info("Exit command 'shut up' detected")
                self.tts.speak("Okay, shutting down.")
                self.is_running = False
                return
            
            logger.info(f"User said: '{user_text}'")
            
            # Wake word detection
            if self.config.wake_word and not self.awaiting_command:
                # Use regex for more robust matching (case-insensitive, whole word)
                pattern = rf"\b{re.escape(self.config.wake_word)}\b"
                if re.search(pattern, user_text, re.IGNORECASE):
                    logger.info(f"Wake word detected: {self.config.wake_word}")
                    self.awaiting_command = True
                    
                    if self.config.wake_word_sound_path:
                        play_sound(self.config.wake_word_sound_path)
                    
                    # Strip wake word and see if there's more to process
                    user_text = re.sub(pattern, "", user_text, flags=re.IGNORECASE).strip()
                    if not user_text:
                        logger.info("Wake word only detected, session started")
                        return
                else:
                    logger.debug("Ignoring speech (no wake word)")
                    return
            
            if self.on_update:
                self.on_update({"type": "state", "data": {"awaiting_command": self.awaiting_command}})
            
            self.conversation.add_message("user", user_text)
            
            # 2. Parse Intent
            logger.info("Parsing intent...")
            intent_result = self.intent_parser.parse(user_text)
            logger.info(f"Intent: {intent_result['intent'].value}, Tool: {intent_result.get('tool')}")
            
            # 3. Retrieve relevant memories
            logger.info("Retrieving context from memory...")
            memory_context = self.memory.get_context(user_text, max_memories=3)
            
            # 4. Execute tool if needed
            tool_result = None
            if self.intent_parser.should_use_tool(intent_result):
                tool_name = intent_result["tool"]
                tool_params = intent_result["params"]
                
                logger.info(f"Executing tool: {tool_name}")
                tool_result = self.tool_registry.execute(tool_name, **tool_params)
                
                if tool_result.success:
                    logger.info(f"Tool result: {tool_result.result}")
                else:
                    logger.error(f"Tool failed: {tool_result.error}")
            
            # 5. Generate LLM response
            logger.info("Generating response...")
            
            # Build context
            context_parts = []
            if memory_context:
                context_parts.append(memory_context)
            if tool_result and tool_result.success:
                context_parts.append(f"Tool result: {tool_result.result}")
            
            context = "\n\n".join(context_parts) if context_parts else None
            
            # Generate response
            response = self.llm.generate(
                user_text,
                context=context,
                max_tokens=self.config.llm.max_tokens
            )
            
            logger.info(f"Assistant response: '{response}'")
            self.conversation.add_message("assistant", response)
            
            # 6. Store in memory
            logger.info("Storing conversation in memory...")
            self.memory.remember_conversation(user_text, response)
            
            # 7. Text-to-Speech
            logger.info("Speaking response...")
            self.tts.speak(response, blocking=True)
            
            # NOTE: We no longer reset awaiting_command here. 
            # It stays True until "shut up" is detected.
            
            if self.on_update:
                self.on_update({"type": "response", "data": response})
            
            logger.info("✓ Processing complete")
            
            if self.on_update:
                self.on_update({"type": "status", "data": "idle"})
        
        except Exception as e:
            logger.error(f"Error processing audio: {e}", exc_info=True)
            self.tts.speak("I encountered an error processing your request.")
    
    def run_interactive(self) -> None:
        """Run in interactive mode (push-to-talk)"""
        logger.info("Starting interactive mode (push-to-talk)")
        logger.info("Press Enter to speak, type 'quit' to exit")
        
        self.is_running = True
        
        # Welcome message
        self.tts.speak("Hello, I am JARVIS. How can I assist you today?")
        
        try:
            while self.is_running:
                # Wait for user input
                user_input = input("\n[Press Enter to speak, or type 'quit' to exit]: ").strip()
                
                if user_input.lower() in ['quit', 'exit', 'q']:
                    logger.info("User requested exit")
                    break
                
                # Listen for speech
                logger.info("Listening...")
                print("🎤 Listening... (speak now)")
                
                audio_data = self.audio_input.listen_once(timeout=10.0)
                
                if audio_data is not None:
                    self.process_audio(audio_data)
                else:
                    print("⚠️  No speech detected")
        
        except KeyboardInterrupt:
            logger.info("Interrupted by user")
        
        finally:
            self.shutdown()
    
    def run_continuous(self) -> None:
        """Run in continuous listening mode"""
        logger.info("Starting continuous listening mode")
        
        self.is_running = True
        
        # Welcome message
        self.tts.speak("Hello, I am JARVIS. I'm listening.")
        
        try:
            # Start audio input with callback
            self.audio_input.start(callback=self.process_audio)
            
            logger.info("Listening continuously... Press Ctrl+C to stop")
            
            # Keep running until interrupted
            import time
            while self.is_running:
                time.sleep(1)
        
        except KeyboardInterrupt:
            logger.info("Interrupted by user")
        
        finally:
            self.shutdown()
    
    def shutdown(self) -> None:
        """Shutdown JARVIS gracefully"""
        if self._shutdown_complete:
            return
            
        logger.info("Shutting down JARVIS...")
        self.is_running = False
        
        # Stop audio input
        if self.audio_input:
            self.audio_input.stop()
        
        # Save memory
        if self.memory:
            logger.info("Saving memory...")
            self.memory.save()
        
        # Print session stats
        if self.conversation:
            stats = self.conversation.get_stats()
            logger.info(f"Session stats: {stats}")
        
        logger.info("Goodbye!")
        self.tts.speak("Goodbye!")
        self._shutdown_complete = True


def main():
    """Main entry point"""
    # Create JARVIS instance
    jarvis = JARVIS()
    
    # Setup signal handlers
    def signal_handler(sig, frame):
        logger.info("Received shutdown signal")
        jarvis.shutdown()
        sys.exit(0)
    
    signal.signal(signal.SIGINT, signal_handler)
    signal.signal(signal.SIGTERM, signal_handler)
    
    try:
        # Initialize
        jarvis.initialize()
        
        # Run in interactive mode (default)
        if jarvis.config.push_to_talk:
            jarvis.run_interactive()
        else:
            jarvis.run_continuous()
    
    except Exception as e:
        logger.error(f"Fatal error: {e}", exc_info=True)
        sys.exit(1)


if __name__ == "__main__":
    main()
