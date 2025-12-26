import React from 'react';
import { motion } from 'framer-motion';

const VoiceWave = ({ status }) => {
    const bars = 40;
    const isActive = status === 'processing';

    return (
        <div className="flex items-center justify-center gap-[2px] h-8 w-full">
            {[...Array(bars)].map((_, i) => (
                <motion.div
                    key={i}
                    className="w-[2px] bg-amber-400 rounded-full"
                    initial={{ height: 4 }}
                    animate={{
                        height: isActive
                            ? [4, Math.random() * 32 + 4, 4]
                            : 4
                    }}
                    transition={{
                        duration: 0.5,
                        repeat: Infinity,
                        delay: i * 0.02,
                        ease: "easeInOut"
                    }}
                    style={{
                        opacity: isActive ? 0.8 : 0.2,
                        boxShadow: isActive ? '0 0 10px rgba(251, 191, 36, 0.4)' : 'none'
                    }}
                />
            ))}
        </div>
    );
};

export default VoiceWave;
