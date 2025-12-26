import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useNavigate } from 'react-router-dom';
import { User, Lock, Mail, ArrowRight, ShieldCheck, Fingerprint, Cpu } from 'lucide-react';
import PixelCard from '../components/PixelCard';

const Auth = () => {
    const [isLogin, setIsLogin] = useState(true);
    const [loading, setLoading] = useState(false);
    const navigate = useNavigate();

    const handleSubmit = (e) => {
        e.preventDefault();
        setLoading(true);
        // Mock authentication delay
        setTimeout(() => {
            setLoading(false);
            navigate('/hud');
        }, 2000);
    };

    return (
        <div className="w-full h-full flex items-center justify-center p-6">
            <div className="w-full max-w-md flex flex-col gap-8">

                {/* Auth Mode Toggle */}
                <div className="flex gap-4 justify-center">
                    <button
                        onClick={() => setIsLogin(true)}
                        className={`font-header text-[10px] tracking-[0.3em] uppercase transition-all pb-2 border-b-2 ${isLogin ? 'text-[#FF9FFC] border-[#FF9FFC]' : 'text-white/30 border-transparent hover:text-white/60'}`}
                    >
                        Access_Portal
                    </button>
                    <button
                        onClick={() => setIsLogin(false)}
                        className={`font-header text-[10px] tracking-[0.3em] uppercase transition-all pb-2 border-b-2 ${!isLogin ? 'text-[#FF9FFC] border-[#FF9FFC]' : 'text-white/30 border-transparent hover:text-white/60'}`}
                    >
                        New_Enrollment
                    </button>
                </div>

                <PixelCard variant="synth" className="w-full">
                    <motion.div
                        layout
                        className="p-10 bg-[#121212]/90 backdrop-blur-xl relative flex flex-col gap-8"
                    >
                        <div className="flex justify-between items-center mb-2">
                            <div className="flex items-center gap-2 text-[#5227FF]">
                                <Fingerprint size={18} />
                                <span className="font-header text-[9px] tracking-widest uppercase opacity-80">Security_Check</span>
                            </div>
                            <div className="flex gap-1">
                                {[...Array(3)].map((_, i) => (
                                    <div key={i} className="w-1 h-1 bg-[#FF9FFC]/40" />
                                ))}
                            </div>
                        </div>

                        <form onSubmit={handleSubmit} className="flex flex-col gap-6">
                            {!isLogin && (
                                <motion.div
                                    initial={{ opacity: 0, height: 0 }}
                                    animate={{ opacity: 1, height: 'auto' }}
                                    className="flex flex-col gap-2"
                                >
                                    <label className="fui-label-mini">User_Identity</label>
                                    <div className="flex items-center gap-4 bg-white/5 border border-white/10 px-4 py-3 group focus-within:border-[#5227FF]/50 transition-all">
                                        <User size={16} className="text-white/30 group-focus-within:text-[#FF9FFC]" />
                                        <input
                                            type="text"
                                            placeholder="Full_Name"
                                            className="bg-transparent border-none outline-none text-sm font-mono w-full"
                                            required
                                        />
                                    </div>
                                </motion.div>
                            )}

                            <div className="flex flex-col gap-2">
                                <label className="fui-label-mini">Encryption_Address</label>
                                <div className="flex items-center gap-4 bg-white/5 border border-white/10 px-4 py-3 group focus-within:border-[#5227FF]/50 transition-all">
                                    <Mail size={16} className="text-white/30 group-focus-within:text-[#FF9FFC]" />
                                    <input
                                        type="email"
                                        placeholder="Email_Hash"
                                        className="bg-transparent border-none outline-none text-sm font-mono w-full text-[#B19EEF]"
                                        required
                                    />
                                </div>
                            </div>

                            <div className="flex flex-col gap-2">
                                <label className="fui-label-mini">Biometric_Cipher</label>
                                <div className="flex items-center gap-4 bg-white/5 border border-white/10 px-4 py-3 group focus-within:border-[#5227FF]/50 transition-all">
                                    <Lock size={16} className="text-white/30 group-focus-within:text-[#FF9FFC]" />
                                    <input
                                        type="password"
                                        placeholder="********"
                                        className="bg-transparent border-none outline-none text-sm font-mono w-full"
                                        required
                                    />
                                </div>
                            </div>

                            <button
                                disabled={loading}
                                className="mt-4 flex items-center justify-center gap-3 bg-[#5227FF] hover:bg-[#5227FF]/80 text-white font-header py-4 text-xs tracking-widest uppercase transition-all disabled:opacity-50 disabled:cursor-wait relative overflow-hidden group"
                            >
                                <div className="absolute inset-0 bg-white/10 translate-x-[-100%] group-hover:translate-x-[100%] transition-transform duration-500" />
                                {loading ? (
                                    <motion.div
                                        animate={{ rotate: 360 }}
                                        transition={{ duration: 1, repeat: Infinity, ease: 'linear' }}
                                    >
                                        <Cpu size={18} />
                                    </motion.div>
                                ) : (
                                    <>
                                        <span>{isLogin ? 'Authenticate' : 'Enroll_Core'}</span>
                                        <ArrowRight size={16} />
                                    </>
                                )}
                            </button>
                        </form>

                        <div className="flex flex-col items-center gap-3 pt-4 border-t border-white/5 mt-4">
                            <div className="flex items-center gap-2 opacity-20">
                                <ShieldCheck size={12} />
                                <span className="text-[8px] font-mono uppercase tracking-[0.3em]">AES_256_Encrypted_Tunnel</span>
                            </div>
                        </div>
                    </motion.div>
                </PixelCard>

                {/* BOTTOM DECORATION */}
                <div className="flex justify-between items-end opacity-20 text-[#B19EEF] font-mono text-[9px] uppercase tracking-widest">
                    <div className="flex flex-col">
                        <span>Status :: Waiting_For_Auth</span>
                        <span>Port :: 443_SSL</span>
                    </div>
                    <span>0x77_ALPHA_SEC</span>
                </div>
            </div>
        </div>
    );
};

export default Auth;
