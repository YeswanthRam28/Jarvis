import React from 'react';
import { motion } from 'framer-motion';
import { useNavigate } from 'react-router-dom';
import { Shield, Zap, Power, Cpu } from 'lucide-react';
import NeuralSphere from '../components/NeuralSphere';
import PixelCard from '../components/PixelCard';

const Landing = () => {
    const navigate = useNavigate();

    return (
        <div className="w-full h-full flex flex-col items-center justify-center p-10 relative">
            <motion.div
                initial={{ opacity: 0, y: 30 }}
                animate={{ opacity: 1, y: 0 }}
                className="z-20 flex flex-col items-center gap-8 max-w-4xl text-center"
            >
                <div className="relative mb-4">
                    <NeuralSphere status="idle" />
                    <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                        <motion.h1
                            animate={{ opacity: [0.5, 1, 0.5] }}
                            transition={{ duration: 3, repeat: Infinity }}
                            className="text-6xl font-black tracking-[0.5em] font-header"
                            style={{ color: '#5227FF', textShadow: '0 0 20px rgba(82, 39, 255, 0.5)' }}
                        >
                            JARVIS
                        </motion.h1>
                    </div>
                </div>

                <div className="flex flex-col gap-4">
                    <h2 className="text-2xl font-light tracking-[0.3em] uppercase opacity-60">System Core Activation Portal</h2>
                    <p className="text-sm font-mono opacity-40 max-w-md mx-auto italic">
                        Integrated Neural Holographic Interface // MARK_85_CORTEX_STABLE
                    </p>
                </div>

                <div className="flex gap-6 mt-4">
                    <PixelCard variant="synth" className="w-64">
                        <button
                            onClick={() => navigate('/auth')}
                            className="w-full p-6 flex flex-col items-center gap-4 cursor-target group transition-all"
                        >
                            <Power size={32} className="text-[#FF9FFC] group-hover:scale-110 transition-transform" />
                            <span className="font-header text-xs tracking-widest uppercase text-[#B19EEF]">Initiate Access</span>
                        </button>
                    </PixelCard>

                    <PixelCard variant="synth" className="w-64">
                        <div className="w-full p-6 flex flex-col items-center gap-4 opacity-30 select-none">
                            <Shield size={32} className="text-[#5227FF]" />
                            <span className="font-header text-xs tracking-widest uppercase">Emergency Protocol</span>
                        </div>
                    </PixelCard>
                </div>

                <div className="mt-12 flex gap-12 opacity-20 text-[#B19EEF]">
                    <div className="flex items-center gap-2">
                        <Cpu size={14} />
                        <span className="text-[10px] font-mono uppercase tracking-widest">Neural_Core_Online</span>
                    </div>
                    <div className="flex items-center gap-2">
                        <Zap size={14} />
                        <span className="text-[10px] font-mono uppercase tracking-widest">Plasma_Field_Stable</span>
                    </div>
                </div>
            </motion.div>

            {/* Decorative Overlays */}
            <div className="absolute top-10 left-10 flex flex-col gap-1 opacity-20 font-mono text-[8px] uppercase tracking-[0.4em] text-[#B19EEF]">
                <span>Loc :: Jarvis_Main_Terminal</span>
                <span>Node :: 0x882A_FUI</span>
            </div>
        </div>
    );
};

export default Landing;
