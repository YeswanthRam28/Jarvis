import React, { useState, useEffect, useRef } from 'react';
import { Send, Loader2, Mic, Square } from 'lucide-react';
import StarCloud from './StarCloud';
import Orb from './Orb';
import './index.css';

import MemoryBoard from './MemoryBoard';

function App() {
  const [input, setInput] = useState('');
  const [isProcessing, setIsProcessing] = useState(false);
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [isListening, setIsListening] = useState(false);
  const [showMemoryBoard, setShowMemoryBoard] = useState(false);
  const [currentSubtitle, setCurrentSubtitle] = useState('Hello, I am JARVIS.');
  const audioRef = useRef<HTMLAudioElement | null>(null);
  
  // MediaRecorder refs
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);

  useEffect(() => {
    // Listen for progress updates from JARVIS pipeline
    if (window.jarvisAPI) {
      window.jarvisAPI.onProgress((stage, message) => {
        setCurrentSubtitle(`[${stage}] ${message}`);
        setCurrentSubtitle(`[${stage}] ${message}`);
      });
    }

    return () => {
      if (window.jarvisAPI) window.jarvisAPI.removeListeners();
    };
  }, []);

  const speak = async (text: string) => {
    if (!text) return;
    setIsSpeaking(true);
    setCurrentSubtitle(text);
    
    // Stop any ongoing speech
    window.speechSynthesis.cancel();
    
    const utterance = new SpeechSynthesisUtterance(text);
    
    // Try to find a good voice (English male preferably, but fallback to any)
    const voices = window.speechSynthesis.getVoices();
    const preferredVoice = voices.find(v => 
      v.name.includes('Microsoft Mark') || 
      v.name.includes('Microsoft David') || 
      v.name.includes('Google UK English Male')
    );
    if (preferredVoice) {
      utterance.voice = preferredVoice;
    }
    
    utterance.rate = 1.0;
    utterance.pitch = 1.0;
    
    utterance.onend = () => setIsSpeaking(false);
    utterance.onerror = () => setIsSpeaking(false);
    
    window.speechSynthesis.speak(utterance);
  };

  const handleSend = async (e?: React.FormEvent, commandOverride?: string) => {
    if (e) e.preventDefault();
    const userCmd = commandOverride || input.trim();
    if (!userCmd || isProcessing) return;

    setInput('');
    setIsProcessing(true);
    setCurrentSubtitle(userCmd);

    setCurrentSubtitle(userCmd);

    try {
      if (window.jarvisAPI) {
        const result = await window.jarvisAPI.runCommand(userCmd);
        
          let replyText = 'Task completed successfully.';
          
          if (result.success) {
            if (result.clarificationQuestion) {
              replyText = result.clarificationQuestion;
            } else if (result.report) {
              replyText = (result.report as any).spoken_summary || result.report.summary;
            }
            
            speak(replyText); // Play TTS
          } else {
            replyText = `Error: ${result.error}`;
            setCurrentSubtitle(replyText);
          }
      }
    } catch (err) {
      setCurrentSubtitle('A critical system error occurred.');
    } finally {
      setIsProcessing(false);
    }
  };

  const toggleRecording = async () => {
    if (isListening) {
      // Stop recording
      mediaRecorderRef.current?.stop();
      setIsListening(false);
      setCurrentSubtitle('Processing audio...');
    } else {
      // Start recording
      try {
        const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
        const mediaRecorder = new MediaRecorder(stream, { mimeType: 'audio/webm' });
        mediaRecorderRef.current = mediaRecorder;
        audioChunksRef.current = [];

        mediaRecorder.ondataavailable = (event) => {
          if (event.data.size > 0) {
            audioChunksRef.current.push(event.data);
          }
        };

        mediaRecorder.onstop = async () => {
          setIsProcessing(true);
          const audioBlob = new Blob(audioChunksRef.current, { type: 'audio/webm' });
          
          // Convert Blob to Base64
          const reader = new FileReader();
          reader.readAsDataURL(audioBlob);
          reader.onloadend = async () => {
            const base64Audio = reader.result as string;
            
            if (window.jarvisAPI) {
              setCurrentSubtitle('Transcribing...');
              const response = await window.jarvisAPI.transcribe(base64Audio);
              if (response.success && response.text) {
                // Audio transcribed successfully, run pipeline
                handleSend(undefined, response.text);
              } else {
                setCurrentSubtitle(`I couldn't hear that clearly. ${response.error || ''}`);
                setIsProcessing(false);
              }
            }
          };

          // Stop all audio tracks
          stream.getTracks().forEach(track => track.stop());
        };

        mediaRecorder.start();
        setIsListening(true);
        setCurrentSubtitle('Listening...');
        // Stop TTS if speaking
        if (audioRef.current) {
          audioRef.current.pause();
          setIsSpeaking(false);
        }
      } catch (err) {
        console.error('Error accessing microphone:', err);
        setCurrentSubtitle('Error: Could not access microphone.');
      }
    }
  };

  // Determine Orb visual state
  const orbHoverIntensity = isListening ? 2.0 : isSpeaking ? 1.5 : isProcessing ? 0.8 : 0.2;
  const orbRotation = isProcessing || isSpeaking || isListening;
  const orbHue = isListening ? 180 : 220; // Shift color slightly when listening

  return (
    <>
      <div style={{ position: 'fixed', top: 0, left: 0, width: '100vw', height: '100vh', zIndex: -1 }}>
        <StarCloud />
      </div>

      <div className="agent-container">
        
        {/* Central Orb Display */}
        <div className="orb-wrapper">
          <div style={{ width: '400px', height: '400px', position: 'relative' }}>
            <Orb
              hue={orbHue}
              hoverIntensity={orbHoverIntensity}
              rotateOnHover={orbRotation}
              forceHoverState={isSpeaking || isProcessing || isListening}
              backgroundColor="transparent"
            />
          </div>
        </div>

        {/* Cinematic Subtitles */}
        <div className="subtitle-container">
          <p className="subtitle-text">{currentSubtitle}</p>
        </div>

        {/* Input Area */}
        <div className="agent-input-area">
          <form onSubmit={handleSend} className="input-form">
            <button 
              type="button" 
              onClick={toggleRecording} 
              className={`mic-button ${isListening ? 'listening' : ''}`}
              disabled={isProcessing}
            >
              {isListening ? <Square size={16} fill="white" /> : <Mic size={16} />}
            </button>
            <button 
              type="button"
              className="brain-button"
              onClick={() => setShowMemoryBoard(true)}
              title="View Memory"
            >
              🧠
            </button>
            <input
              type="text"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              disabled={isProcessing || isListening}
              placeholder={isListening ? "Listening..." : "Command JARVIS..."}
              className="chat-input agent-chat-input"
            />
            <button type="submit" disabled={!input.trim() || isProcessing || isListening} className="send-button">
              {isProcessing ? <Loader2 size={16} className="icon-spin" /> : <Send size={16} style={{ marginLeft: '2px' }} />}
            </button>
          </form>
        </div>
      </div>

      {showMemoryBoard && (
        <MemoryBoard onClose={() => setShowMemoryBoard(false)} />
      )}
    </>
  );
};

export default App;
