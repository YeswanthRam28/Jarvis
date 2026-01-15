import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
    Cpu, Shield, Zap, Terminal, Activity, Layers,
    Crosshair, BarChart3, Database, Command,
    Eye, Binary, Wifi, Info
} from 'lucide-react';
import { useJarvis } from '../hooks/useJarvis';
import NeuralSphere from '../components/NeuralSphere';
import VoiceWave from '../components/VoiceWave';
import PixelCard from '../components/PixelCard';
import SpotlightCard from '../components/SpotlightCard';
import DecayText from '../components/DecayText';

const TelemetryPod = ({ label, value, unit = '', status = 'normal' }) => (
    <SpotlightCard
        spotlightColor="rgba(82, 39, 255, 0.2)"
        className="flex flex-col gap-0.5 border-l-2 border-[#5227FF]/10 pl-3 pr-4 py-1 bg-transparent border-none"
    >
        <div className="flex items-center gap-1 opacity-40">
            <span className="fui-label-mini">{label}</span>
            <div className={`w-1 h-1 rounded-full ${status === 'alert' ? 'bg-[#FF9FFC] animate-pulse' : 'bg-[#5227FF]'}`} />
        </div>
        <div className="flex items-baseline gap-1">
            <span className="text-sm font-light tracking-widest text-white">{value}</span>
            <span className="text-[9px] text-[#B19EEF]/40 uppercase font-mono">{unit}</span>
        </div>
    </SpotlightCard>
);

const CornerBracket = ({ position }) => {
    const styles = {
        'tl': 'top-0 left-0 border-t border-l',
        'tr': 'top-0 right-0 border-t border-r',
        'bl': 'bottom-0 left-0 border-b border-l',
        'br': 'bottom-0 right-0 border-b border-r',
    };
    return (
        <div className={`absolute w-3 h-3 border-[#5227FF]/50 ${styles[position]} z-10`} />
    );
};

const HUD = () => {
    const { status, transcription, response, state, sendCommand, backendUrl, updateBackendUrl, telemetry } = useJarvis();
    const [logs, setLogs] = useState([]);

    const handleUrlChange = () => {
        const newUrl = prompt('Enter Backend URL (e.g., https://your-app.ngrok-free.app or http://localhost:8000):', backendUrl);
        if (newUrl && newUrl !== backendUrl) {
            updateBackendUrl(newUrl);
        }
    };

    useEffect(() => {
        const logMsg = status === 'offline' ? 'CONNECTION_LOST :: RETRYING...' :
            status === 'processing' ? 'CORTEX_ACTIVE :: ANALYZING...' :
                'KERNEL_READY :: LISTENING';
        const hex = Math.random().toString(16).slice(2, 6).toUpperCase();
        setLogs(p => [`${logMsg} [0x${hex}]`, ...p].slice(0, 15));
    }, [status]);

    useEffect(() => {
        if (transcription) {
            setLogs(p => [`STT_CAPTURE :: "${transcription.slice(0, 20)}..."`, ...p].slice(0, 15));
        }
    }, [transcription]);

    return (
        <div className="w-full h-full flex flex-col p-10 relative z-20">
            {/* HEADER HUD */}
            <div className="flex justify-between items-start mb-auto relative z-30">
                <motion.div
                    initial={{ opacity: 0, x: -30 }}
                    animate={{ opacity: 1, x: 0 }}
                    className="flex flex-col gap-2"
                >
                    <div className="flex items-baseline gap-3">
                        <h1 className="text-4xl font-black tracking-[0.3em] font-header amber-glow-text mb-0">JARVIS</h1>
                        <div className="flex items-center gap-2 px-3 py-1 hologram-panel border-[#5227FF]/40">
                            <Binary size={12} className="text-[#5227FF]" />
                            <span className="text-[10px] font-mono tracking-widest text-[#B19EEF]/80">MARK.LXXXV</span>
                        </div>
                    </div>
                    <div className="flex gap-6 mt-3">
                        <TelemetryPod
                            label="Internal_Status"
                            value={status === 'processing' ? 'ACTIVE_THOUGHT' : status === 'offline' ? 'OFFLINE' : 'STANDBY'}
                            status={status === 'processing' || status === 'offline' ? 'alert' : 'normal'}
                        />
                        <TelemetryPod label="CPU_LOAD" value={telemetry.cpu || 0} unit="%" />
                        <TelemetryPod label="MEM_SYNC" value={telemetry.memory || 0} unit="%" />
                    </div>
                </motion.div>

                <motion.div
                    initial={{ opacity: 0, scale: 0.9 }}
                    animate={{ opacity: 1, scale: 1 }}
                    onClick={handleUrlChange}
                    className="hologram-panel p-4 flex gap-8 items-center border-[#5227FF]/30 cursor-pointer hover:border-[#5227FF]/60 transition-colors"
                    title="Click to change Backend URL"
                >
                    <div className="flex flex-col items-end">
                        <span className="fui-label-mini">Auth_Level</span>
                        <span className="text-xs font-mono text-white tracking-widest uppercase">Delta_Clearance</span>
                    </div>
                    <div className="w-[2px] h-8 bg-[#5227FF]/20" />
                    <div className="flex flex-col items-center gap-1">
                        <Wifi size={16} className={`${status === 'offline' ? 'text-red-500' : 'text-[#FF9FFC]'} fui-anim-pulse`} />
                        <span className="text-[8px] font-mono opacity-50 uppercase max-w-[200px] truncate" title={backendUrl}>{backendUrl}</span>
                    </div>
                </motion.div>
            </div>

            {/* CENTRAL NEURAL INTERFACE */}
            <div className="absolute inset-0 flex items-center justify-center z-10 pointer-events-none transform -translate-y-32">
                <div className="relative pointer-events-auto">
                    <NeuralSphere status={status} />
                </div>
            </div>

            {/* SIDEBAR TELEMETRY */}
            <div className="flex-1 flex justify-between items-center relative px-4 pointer-events-none z-20">

                {/* Left Data Stack */}
                <motion.div
                    initial={{ opacity: 0, x: -50 }}
                    animate={{ opacity: 1, x: 0 }}
                    className="flex flex-col gap-6 w-56 pointer-events-auto"
                >
                    <PixelCard variant="synth" className="h-[400px] border-[#5227FF]/20">
                        <div className="p-5 flex flex-col gap-4 h-full relative">
                            <CornerBracket position="tl" />
                            <CornerBracket position="tr" />
                            <CornerBracket position="bl" />
                            <CornerBracket position="br" />
                            <div className="flex justify-between items-center mb-2">
                                <div className="flex items-center gap-2">
                                    <Terminal size={14} className="text-[#FF9FFC]" />
                                    <span className="fui-label-mini opacity-100">Core_Stream</span>
                                </div>
                                <div className="w-1.5 h-1.5 rounded-full bg-[#5227FF] animate-ping" />
                            </div>
                            <div className="flex flex-col gap-1.5 font-mono text-[9px] text-[#B19EEF]/60 overflow-hidden h-full italic">
                                {logs.map((L, i) => (
                                    <div key={i} className="flex gap-2 items-center">
                                        <span className="opacity-20 text-[7px]">{i.toString().padStart(3, '0')}</span>
                                        <span>{L}</span>
                                    </div>
                                ))}
                            </div>
                        </div>
                    </PixelCard>

                    <div className="flex flex-col gap-3">
                        <div className="flex justify-between items-end">
                            <span className="fui-label-mini">CPU_Buffer</span>
                            <span className="text-[10px] font-mono text-white/40">{telemetry.cpu || 0}%</span>
                        </div>
                        <div className="h-1 bg-white/5 w-full relative overflow-hidden">
                            <motion.div
                                animate={{ width: `${telemetry.cpu || 0}%` }}
                                className="h-full bg-[#5227FF] shadow-[0_0_10px_#5227FF]"
                            />
                        </div>
                    </div>
                </motion.div>

                {/* Right System Monitor */}
                <motion.div
                    initial={{ opacity: 0, x: 50 }}
                    animate={{ opacity: 1, x: 0 }}
                    className="flex flex-col gap-8 w-64 items-end pointer-events-auto"
                >
                    <div className="text-right flex flex-col gap-1">
                        <span className="fui-label-mini">Signal_Status</span>
                        <span className="text-xs font-mono tracking-tighter opacity-70 italic whitespace-nowrap">
                            LATENCY: {(Math.random() * 50 + 10).toFixed(0)}ms // LOSS: 0.00%
                        </span>
                    </div>

                    <PixelCard variant="synth" className="w-full border-[#5227FF]/20">
                        <div className="p-6 flex flex-col gap-6 w-full relative h-full">
                            <CornerBracket position="tl" />
                            <CornerBracket position="br" />

                            {/* SYSTEM CONTROLS */}
                            <div className="flex flex-col gap-3">
                                <span className="fui-label-mini">System_Controls</span>
                                <div className="flex gap-2">
                                    <button
                                        onClick={() => sendCommand('command', 'stop')}
                                        className="cursor-target flex-1 px-3 py-2 border border-[#5227FF]/30 bg-[#5227FF]/5 hover:bg-[#5227FF]/20 text-[10px] font-mono tracking-widest uppercase transition-colors"
                                    >
                                        Stop
                                    </button>
                                    <button
                                        onClick={() => sendCommand('command', 'shutdown')}
                                        className="cursor-target flex-1 px-3 py-2 border border-red-500/30 bg-red-500/5 hover:bg-red-500/20 text-[10px] font-mono tracking-widest uppercase transition-colors text-red-400"
                                    >
                                        Shutdown
                                    </button>
                                </div>
                            </div>

                            <div className="flex flex-col gap-2">
                                <div className="flex justify-between items-center text-[10px] opacity-50 uppercase tracking-widest font-mono">
                                    <span>Mem_Usage</span>
                                    <span>{telemetry.memory || 0}%</span>
                                </div>
                                <div className="flex gap-1 h-3">
                                    {[...Array(12)].map((_, i) => (
                                        <div key={i} className={`flex-1 ${i < (telemetry.memory / 8.3) ? 'bg-[#5227FF]' : 'bg-white/5'}`} />
                                    ))}
                                </div>
                            </div>
                            <div className="flex flex-col gap-2">
                                <div className="flex justify-between items-center text-[10px] opacity-50 uppercase tracking-widest font-mono">
                                    <span>System_Heal</span>
                                    <span>98%</span>
                                </div>
                                <div className="flex gap-1 h-3">
                                    {[...Array(12)].map((_, i) => (
                                        <div key={i} className={`flex-1 ${i < 11 ? 'bg-[#FF9FFC]' : 'bg-white/5'}`} />
                                    ))}
                                </div>
                            </div>
                        </div>
                    </PixelCard>
                </motion.div>
            </div>

            {/* FOOTER AREA - BOTTOM ANCHORED */}
            <div className="fixed bottom-0 left-0 w-full p-8 flex flex-col items-center pointer-events-none z-50">

                {/* VOICE WAVE FEEDBACK */}
                <div className="flex flex-col items-center gap-1 pointer-events-auto mb-4">
                    <VoiceWave status={status} />
                    <span className="fui-label-mini opacity-20 text-[8px]">Neural_Link_Static</span>
                </div>

                {/* Transcription Overlay - Compact Capsule */}
                <div className="w-full max-w-xl pointer-events-none mb-4">
                    <AnimatePresence>
                        {transcription && (
                            <motion.div
                                initial={{ opacity: 0, y: 10 }}
                                animate={{ opacity: 1, y: 0 }}
                                exit={{ opacity: 0, scale: 0.9 }}
                                className="text-center"
                            >
                                <div className="inline-block px-5 py-1.5 hologram-panel border-[#5227FF]/40 bg-[#121212]/80 backdrop-blur-xl rounded-full">
                                    <p className="text-lg font-light tracking-[0.15em] text-[#B19EEF] m-0 uppercase italic">
                                        "{transcription}"
                                    </p>
                                </div>
                            </motion.div>
                        )}
                    </AnimatePresence>
                </div>

                {/* FINAL RESPONSE BOX */}
                <div className="w-full max-w-2xl pointer-events-auto mb-6">
                    <AnimatePresence mode="wait">
                        {response && (
                            <motion.div
                                initial={{ opacity: 0, y: 20 }}
                                animate={{ opacity: 1, y: 0 }}
                                exit={{ opacity: 0, filter: 'blur(10px)' }}
                            >
                                <PixelCard variant="synth" className="border-t border-t-[#FF9FFC]/40 shadow-[0_-15px_60px_rgba(82,39,255,0.25)] bg-[#050505]/98">
                                    <div className="p-6 relative">
                                        <div className="absolute top-3 left-6 flex items-center gap-2 text-[#FF9FFC]/50">
                                            <Activity size={10} className="animate-pulse" />
                                            <span className="text-[7px] font-mono tracking-[0.4em] uppercase">Transmission_Feed</span>
                                        </div>
                                        <div className="max-h-[140px] overflow-y-auto mt-4 px-4 custom-scrollbar">
                                            <div className="text-xl font-light leading-relaxed text-white tracking-wide text-center">
                                                <DecayText text={response} />
                                            </div>
                                        </div>
                                    </div>
                                </PixelCard>
                            </motion.div>
                        )}
                    </AnimatePresence>
                </div>

                {/* STATUS BAR DECORATION */}
                <div className="w-full flex justify-between items-end opacity-20 px-8">
                    <div className="flex gap-4">
                        <span className="text-[9px] font-mono tracking-widest uppercase">Kernel.85</span>
                        <span className="text-[9px] font-mono tracking-widest uppercase text-[#FF9FFC]">Secure_Handshake</span>
                    </div>

                    <div className="flex flex-col items-end gap-2">
                        <motion.div
                            animate={{ opacity: [0.4, 1, 0.4] }}
                            transition={{ duration: 2, repeat: Infinity }}
                            className="hologram-panel py-1 px-3 text-[8px] font-mono border-[#FF9FFC]/20 bg-[#121212]/40 mb-1"
                        >
                            SYS_PROC :: {telemetry.active_mem || '0GB'} / {telemetry.total_mem || '0GB'}
                        </motion.div>
                        <div className="flex gap-1">
                            {[...Array(10)].map((_, i) => (
                                <motion.div
                                    key={i}
                                    animate={{ opacity: [0.2, 1, 0.2] }}
                                    transition={{ duration: 1.5, delay: i * 0.1, repeat: Infinity }}
                                    className="w-1 h-3 bg-[#5227FF]"
                                />
                            ))}
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default HUD;
