import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Cpu, Shield, Zap, Terminal, Activity, Layers, Crosshair, BarChart3, Database } from 'lucide-react';
import { useJarvis } from './hooks/useJarvis';
import HexCore from './components/HexCore';

const TelemetryItem = ({ label, value, unit = '', color = 'var(--fui-cyan)' }) => (
  <div className="flex flex-col gap-0.5 border-l border-white/5 pl-2">
    <span className="fui-label">{label}</span>
    <div className="flex items-baseline gap-1">
      <span className="text-xs font-mono" style={{ color }}>{value}</span>
      <span className="text-[8px] opacity-30 font-mono italic">{unit}</span>
    </div>
  </div>
);

const App = () => {
  const { status, transcription, response, state } = useJarvis();
  const [logs, setLogs] = useState([]);

  // Generate mock system chatter
  useEffect(() => {
    const interval = setInterval(() => {
      const chatter = [
        `> BUFF_LOAD: ${Math.floor(Math.random() * 100)}%`,
        `> KERNEL_RSP: OK`,
        `> NEURAL_SYNC: 0.992`,
        `> INF_TOKEN: ${Math.floor(Math.random() * 5000)}ms`,
        `> IO_PIPE: STABLE`
      ];
      setLogs(prev => [chatter[Math.floor(Math.random() * chatter.length)], ...prev].slice(0, 15));
    }, 2000);
    return () => clearInterval(interval);
  }, []);

  return (
    <div className="w-full h-full flex flex-col p-6 text-[#e0e0e0] overflow-hidden">
      <div className="fui-topo-grid" />

      {/* PERSISTENT HUD FRAME */}
      <div className="absolute inset-0 border-[20px] border-black pointer-events-none z-50 opacity-20" style={{ boxShadow: 'inset 0 0 100px rgba(0,0,0,1)' }} />

      {/* TOP HEADER SECTION */}
      <div className="flex justify-between items-start z-20">
        <motion.div
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          className="flex flex-col gap-1"
        >
          <div className="flex items-center gap-4">
            <h1 className="text-2xl font-black tracking-widest m-0 fui-text-glow font-header">JARVIS</h1>
            <div className="px-2 py-0.5 bg-[#00d4ff11] border border-[#00d4ff33] text-[9px] font-mono text-[#00d4ff]">
              M-LXXXV // OS.v4
            </div>
          </div>
          <div className="flex gap-4 mt-2">
            <TelemetryItem label="Sys_Status" value={status.toUpperCase()} color={status === 'idle' ? 'var(--fui-cyan)' : 'var(--fui-amber)'} />
            <TelemetryItem label="Latency" value="24" unit="ms" />
            <TelemetryItem label="Uptime" value="99.9" unit="%" />
          </div>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, x: 20 }}
          animate={{ opacity: 1, x: 0 }}
          className="fui-panel p-3 flex gap-8 items-center"
        >
          <div className="flex flex-col items-end">
            <span className="fui-label">Session_Key</span>
            <span className="text-[10px] font-mono text-[#00d4ff]">{state.awaiting_command ? 'SYNC_WAIT' : 'STREAM_ACTIVE'}</span>
          </div>
          <div className="w-[1px] h-6 bg-white/10" />
          <Crosshair size={20} className={`text-[#00d4ff] ${status === 'processing' ? 'animate-spin-slow' : ''}`} />
        </motion.div>
      </div>

      {/* MAIN CONTENT AREA */}
      <div className="flex-1 flex justify-between items-center relative gap-10">

        {/* LEFT TELEMETRY SIDEBAR */}
        <motion.div
          initial={{ opacity: 0, x: -50 }}
          animate={{ opacity: 1, x: 0 }}
          className="flex flex-col gap-6 w-48"
        >
          <div className="fui-panel p-4 flex flex-col gap-4">
            <div className="flex items-center gap-2">
              <Layers size={14} className="text-[#00d4ff]" />
              <span className="fui-label">Data_Stack</span>
            </div>
            <div className="fui-telemetry-scroll h-60 flex flex-col gap-1">
              {logs.map((log, i) => (
                <div key={i} className="opacity-80 leading-none">{log}</div>
              ))}
            </div>
          </div>

          <div className="flex flex-col gap-2">
            <span className="fui-label">Core_Temp</span>
            <div className="flex gap-1">
              {[...Array(10)].map((_, i) => (
                <div key={i} className={`h-4 w-1.5 ${i < 4 ? 'bg-[#00d4ff]' : 'bg-white/5'}`} />
              ))}
            </div>
          </div>
        </motion.div>

        {/* CENTRAL HEX-CORE */}
        <div className="relative flex-1 flex flex-col items-center justify-center -mt-10">
          <HexCore status={status} />

          <AnimatePresence>
            {transcription && (
              <motion.div
                initial={{ opacity: 0, scale: 0.9 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 1.1 }}
                className="absolute top-[80%] w-[600px] text-center"
              >
                <div className="inline-block px-8 py-4 bg-black/80 border-y border-[#00d4ff22] backdrop-blur-md">
                  <div className="fui-label mb-2 opacity-20">Voice_Input_Bypass</div>
                  <p className="text-2xl font-light tracking-tight text-[#00d4ff] italic m-0 uppercase font-main">
                    "{transcription}"
                  </p>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        {/* RIGHT METRICS SECTION */}
        <motion.div
          initial={{ opacity: 0, x: 50 }}
          animate={{ opacity: 1, x: 0 }}
          className="flex flex-col gap-6 w-64 items-end"
        >
          <div className="fui-panel p-4 w-full border-r-2 border-r-[#00d4ff]">
            <div className="flex items-center gap-2 mb-4">
              <BarChart3 size={14} className="text-[#00d4ff]" />
              <span className="fui-label">Buffer_Alloc</span>
            </div>
            <div className="flex flex-col gap-3">
              {[
                { label: 'Neural', val: 74 },
                { label: 'Vision', val: 12 },
                { label: 'Audio', val: 92 }
              ].map(m => (
                <div key={m.label} className="flex flex-col gap-1">
                  <div className="flex justify-between text-[9px] font-mono opacity-60">
                    <span>{m.label}</span>
                    <span>{m.val}%</span>
                  </div>
                  <div className="h-0.5 bg-white/5 w-full">
                    <div className="h-full bg-[#00d4ff]" style={{ width: `${m.val}%` }} />
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div className="p-4 text-right">
            <div className="fui-label mb-1">Grid_Coords</div>
            <div className="text-[10px] font-mono opacity-40">34.0522° N // 118.2437° W</div>
          </div>
        </motion.div>
      </div>

      {/* FOOTER RESPONSE AREA */}
      <div className="flex justify-between items-end gap-10 mt-auto pt-6">
        <div className="flex gap-8">
          <TelemetryItem label="Kernel" value="STABLE" />
          <TelemetryItem label="Memory" value="2.4" unit="GB / 16GB" />
          <TelemetryItem label="Auth" value="LEVEL_5" color="var(--fui-amber)" />
        </div>

        <AnimatePresence mode="wait">
          {response && (
            <motion.div
              initial={{ opacity: 0, y: 50 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: 50 }}
              className="fui-panel p-6 max-w-2xl bg-black/95 border-b-2 border-b-[#00d4ff] flex flex-col gap-4"
            >
              <div className="flex justify-between items-center">
                <div className="flex items-center gap-2 text-[#00d4ff]">
                  <Activity size={12} />
                  <span className="fui-label m-0 opacity-100 italic">Core_Response_String</span>
                </div>
                <div className="text-[10px] font-mono opacity-20">TIMESTAMP_{Date.now().toString().slice(-6)}</div>
              </div>
              <p className="text-xl font-light leading-relaxed text-[#f0f0f0] tracking-wide font-main m-0">
                {response}
              </p>
            </motion.div>
          )}
        </AnimatePresence>

        <div className="flex flex-col items-end gap-1 opacity-20 hover:opacity-100 transition-opacity">
          <span className="fui-label">Project_Jarvis</span>
          <span className="text-[8px] font-mono">// CORTEX_LINK_ESTABLISHED</span>
        </div>
      </div>
    </div>
  );
};

export default App;
