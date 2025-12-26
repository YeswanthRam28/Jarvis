import React from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Cpu, Database, Activity, Mic } from 'lucide-react';
import { useJarvis } from './hooks/useJarvis';
import ArcReactor from './components/ArcReactor';

const App = () => {
  const { status, transcription, response, state } = useJarvis();

  return (
    <div className="w-full h-full flex flex-col p-8 select-none">
      {/* Top Header */}
      <div className="flex justify-between items-start mb-auto">
        <motion.div
          initial={{ opacity: 0, x: -20 }}
          animate={{ opacity: 1, x: 0 }}
          className="flex flex-col"
        >
          <h1 className="text-2xl font-bold tracking-widest glow-text m-0">JARVIS</h1>
          <div className="flex items-center gap-2 text-xs opacity-60">
            <div className={`w-2 h-2 rounded-full ${status === 'idle' ? 'bg-green-500' : 'bg-blue-400 animate-pulse'}`} />
            {status.toUpperCase()}
          </div>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, x: 20 }}
          animate={{ opacity: 1, x: 0 }}
          className="glass-panel p-4 flex gap-6"
        >
          <div className="flex items-center gap-2">
            <Activity size={16} className="text-[#00f2ff]" />
            <span className="text-xs uppercase font-medium">Core: Active</span>
          </div>
          <div className="flex items-center gap-2">
            <Mic size={16} className={state.awaiting_command ? 'text-gray-500' : 'text-[#00f2ff]'} />
            <span className="text-xs uppercase font-medium">Session: {state.awaiting_command ? 'Locked' : 'Listening'}</span>
          </div>
        </motion.div>
      </div>

      {/* Center Visualizer */}
      <div className="flex-1 flex flex-col items-center justify-center -mt-20">
        <ArcReactor status={status} />

        <AnimatePresence>
          {transcription && (
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
              className="mt-8 text-xl font-light italic opacity-80 max-w-2xl text-center"
            >
              "{transcription}"
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* Bottom Panel */}
      <div className="flex flex-col gap-4">
        <AnimatePresence>
          {response && (
            <motion.div
              initial={{ opacity: 0, y: 100 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: 100 }}
              className="glass-panel p-6 max-w-3xl ml-auto"
            >
              <div className="text-[#00f2ff] text-[10px] uppercase tracking-widest mb-2">Assistant Response</div>
              <p className="text-base leading-relaxed m-0">{response}</p>
            </motion.div>
          )}
        </AnimatePresence>

        <div className="flex justify-between items-end mt-4">
          <div className="flex gap-4">
            <div className="glass-panel p-2 px-4 flex items-center gap-3">
              <Cpu size={14} className="text-[#00f2ff]" />
              <div className="flex flex-col">
                <span className="text-[8px] opacity-60">CPU</span>
                <span className="text-[10px] font-mono">1.2 GHz // OPTIMAL</span>
              </div>
            </div>
            <div className="glass-panel p-2 px-4 flex items-center gap-3">
              <Database size={14} className="text-[#00f2ff]" />
              <div className="flex flex-col">
                <span className="text-[8px] opacity-60">MEMORY</span>
                <span className="text-[10px] font-mono">2.4 GB // STABLE</span>
              </div>
            </div>
          </div>

          <div className="text-[10px] opacity-40 font-mono italic">
            // MARK 85 // AUTH_SUCCESS
          </div>
        </div>
      </div>
    </div>
  );
};

export default App;
