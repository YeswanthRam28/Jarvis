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
    const { status, transcription, response, state, sendCommand, backendIp, updateBackendIp } = useJarvis();
    const [logs, setLogs] = useState([]);

    const handleIpChange = () => {
        const newIp = prompt('Enter Backend IP Address:', backendIp);
        if (newIp && newIp !== backendIp) {
            updateBackendIp(newIp);
        }
    };

    useEffect(() => {
        const itv = setInterval(() => {
            const hex = Math.random().toString(16).slice(2, 10).toUpperCase();
            const ops = ['SYNC', 'PUSH', 'PULL', 'INIT', 'CALC', 'MEM_RW'];
            setLogs(p => [`${ops[Math.floor(Math.random() * ops.length)]} :: 0x${hex}`, ...p].slice(0, 12));
        }, 1500);
        return () => clearInterval(itv);
    }, []);

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
                        <TelemetryPod label="Core_Load" value="1.21" unit="GW" />
                        <TelemetryPod label="Neural_Sync" value="99.98" unit="%" />
                    </div>
                </motion.div>

                <motion.div
                    initial={{ opacity: 0, scale: 0.9 }}
                    animate={{ opacity: 1, scale: 1 }}
                    onClick={handleIpChange}
                    className="hologram-panel p-4 flex gap-8 items-center border-[#5227FF]/30 cursor-pointer hover:border-[#5227FF]/60 transition-colors"
                    title="Click to change Backend IP"
                >
                    <div className="flex flex-col items-end">
                        <span className="fui-label-mini">Auth_Level</span>
                        <span className="text-xs font-mono text-white tracking-widest uppercase">Delta_Clearance</span>
                    </div>
                    <div className="w-[2px] h-8 bg-[#5227FF]/20" />
                    <div className="flex flex-col items-center gap-1">
                        <Wifi size={16} className={`${status === 'offline' ? 'text-red-500' : 'text-[#FF9FFC]'} fui-anim-pulse`} />
                        <span className="text-[8px] font-mono opacity-50 uppercase">{backendIp}</span>
                    </div>
                </motion.div>
            </div>

            {/* CENTRAL NEURAL INTERFACE */}
            <div className="absolute inset-0 flex items-center justify-center z-10 pointer-events-none">
                <div className="relative pointer-events-auto">
                    <NeuralSphere status={status} />

                    {/* Floating Info Pods around the sphere */}
                    <motion.div
                        animate={{ y: [0, -10, 0] }}
                        transition={{ duration: 4, repeat: Infinity }}
                        className="absolute -top-10 -right-20 hologram-panel p-2 px-4 text-[9px] font-mono border-[#FF9FFC]/20"
                    >
                        SYS_PROC :: 0x8F22A
                    </motion.div>
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
                                    <span className="fui-label-mini opacity-100">Cortex_Telemetry</span>
                                </div>
                                <div className="w-1.5 h-1.5 rounded-full bg-[#5227FF] animate-ping" />
                            </div>
                            <div className="flex flex-col gap-1.5 font-mono text-[9px] text-[#B19EEF]/60 overflow-hidden h-full italic">
                                {logs.map((L, i) => (
                                    <div key={i} className="flex gap-2 items-center">
                                        <span className="opacity-20 text-[7px]">{Math.floor(Math.random() * 9999)}</span>
                                        <span>{L}</span>
                                    </div>
                                ))}
                            </div>
                        </div>
                    </PixelCard>

                    <div className="flex flex-col gap-3">
                        <div className="flex justify-between items-end">
                            <span className="fui-label-mini">Mem_Buffer</span>
                            <span className="text-[10px] font-mono text-white/40">78%</span>
                        </div>
                        <div className="h-1 bg-white/5 w-full relative overflow-hidden">
                            <motion.div
                                initial={{ width: 0 }}
                                animate={{ width: '78%' }}
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
                        <span className="fui-label-mini">Spatial_Lock</span>
                        <span className="text-xs font-mono tracking-tighter opacity-70 italic whitespace-nowrap">
                            GRID_Z: 114.009 // LAT: 34.01 // LNG: -118.29
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
                                    <span>Sub_Processor</span>
                                    <span>Active</span>
                                </div>
                                <div className="flex gap-1 h-3">
                                    {[...Array(12)].map((_, i) => (
                                        <div key={i} className={`flex-1 ${i < 8 ? 'bg-[#5227FF]' : 'bg-white/5'}`} />
                                    ))}
                                </div>
                            </div>
                            <div className="flex flex-col gap-2">
                                <div className="flex justify-between items-center text-[10px] opacity-50 uppercase tracking-widest font-mono">
                                    <span>Kernel_Stability</span>
                                    <span>94%</span>
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

            {/* FOOTER RESPONSE & VOICE WAVE */}
            <div className="mt-auto flex flex-col gap-6 relative pt-10 z-30">

                {/* Transcription Overlay (Floating above voice wave) */}
                <AnimatePresence>
                    {transcription && (
                        <motion.div
                            initial={{ opacity: 0, y: 10, filter: 'blur(5px)' }}
                            animate={{ opacity: 1, y: 0, filter: 'blur(0px)' }}
                            exit={{ opacity: 0, y: -10, filter: 'blur(5px)' }}
                            className="mx-auto"
                        >
                            <div className="px-10 py-4 hologram-panel border-[#5227FF]/40 bg-[#121212]/95 backdrop-blur-2xl">
                                <div className="flex items-center gap-3 mb-2 opacity-30">
                                    <Command size={14} />
                                    <span className="fui-label-mini">Thought_Stream_Capture</span>
                                </div>
                                <p className="text-3xl font-light tracking-wide text-white m-0 uppercase drop-shadow-2xl">
                                    "{transcription}"
                                </p>
                            </div>
                        </motion.div>
                    )}
                </AnimatePresence>

                {/* VOICE WAVE FEEDBACK */}
                <div className="w-full flex flex-col items-center gap-2">
                    <VoiceWave status={status} />
                    <span className="fui-label-mini opacity-20">Voice_Feed_Standby</span>
                </div>

                {/* FINAL RESPONSE BOX */}
                <div className="flex justify-between items-end gap-10">
                    <div className="flex gap-10 opacity-40 hover:opacity-100 transition-opacity">
                        <div className="flex items-center gap-2">
                            <Info size={14} className="text-[#B19EEF]" />
                            <span className="text-[10px] font-mono tracking-widest">v4.8.0_SYNTH</span>
                        </div>
                        <div className="flex items-center gap-2">
                            <Activity size={14} className="text-[#FF9FFC]" />
                            <span className="text-[10px] font-mono tracking-widest">HEARTBEAT_ACK</span>
                        </div>
                    </div>

                    <AnimatePresence mode="wait">
                        {response && (
                            <PixelCard variant="synth" className="max-w-2xl border-r-2 border-r-[#FF9FFC]">
                                <motion.div
                                    initial={{ opacity: 0, width: 0 }}
                                    animate={{ opacity: 1, width: 'auto' }}
                                    exit={{ opacity: 0, x: 200 }}
                                    className="p-8 bg-[#121212]/95 h-full relative"
                                >
                                    <div className="flex justify-between items-center mb-5">
                                        <div className="flex items-center gap-3 text-[#FF9FFC]">
                                            <Activity size={16} className="animate-pulse" />
                                            <span className="fui-label-mini italic opacity-100">Assistant_Transmission</span>
                                        </div>
                                        <div className="text-[9px] font-mono opacity-30 tracking-[0.5em]">MARK_85_CORTEX</div>
                                    </div>
                                    <div className="text-2xl font-light leading-relaxed text-white m-0 tracking-wide selection:bg-[#5227FF] selection:text-white">
                                        <DecayText text={response} />
                                    </div>
                                </motion.div>
                            </PixelCard>
                        )}
                    </AnimatePresence>

                    <div className="flex flex-col items-end gap-2">
                        <div className="flex gap-2">
                            {[...Array(5)].map((_, i) => (
                                <div key={i} className="w-1 h-1 bg-[#5227FF]/40" />
                            ))}
                        </div>
                        <span className="fui-label-mini opacity-20">Synth_Hybrid_Link</span>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default HUD;
