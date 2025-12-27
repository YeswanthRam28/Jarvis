import React, { useEffect, useState, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';

const DecayText = ({ text, className = "" }) => {
    const [displayText, setDisplayText] = useState("");
    const safeText = String(text || "").trim();

    useEffect(() => {
        let timeout;
        let index = 0;
        setDisplayText("");

        if (!safeText) return;

        const typeWriter = () => {
            if (index < safeText.length) {
                setDisplayText(safeText.slice(0, index + 1));
                index++;
                timeout = setTimeout(typeWriter, 20);
            }
        };

        typeWriter();

        return () => clearTimeout(timeout);
    }, [safeText]);

    return (
        <div className={`font-mono break-words whitespace-pre-wrap ${className}`}>
            {displayText.split("").map((char, i) => (
                <motion.span
                    key={i}
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    transition={{ duration: 0.1 }}
                >
                    {char}
                </motion.span>
            ))}
            <motion.span
                animate={{ opacity: [0, 1, 0] }}
                transition={{ duration: 0.8, repeat: Infinity }}
                className="inline-block w-2 h-5 bg-[#FF9FFC] ml-1 align-middle shadow-[0_0_8px_#FF9FFC]"
            />
        </div>
    );
};

export default DecayText;
