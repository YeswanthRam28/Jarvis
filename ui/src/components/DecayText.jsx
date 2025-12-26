import React, { useEffect, useState, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';

const DecayText = ({ text, className = "" }) => {
    const [displayText, setDisplayText] = useState("");
    const [isDecaying, setIsDecaying] = useState(false);

    useEffect(() => {
        let timeout;
        let index = 0;
        setDisplayText("");

        const typeWriter = () => {
            if (index < text.length) {
                setDisplayText(prev => prev + text[index]);
                index++;
                timeout = setTimeout(typeWriter, 30);
            }
        };

        typeWriter();

        return () => clearTimeout(timeout);
    }, [text]);

    const glitchChars = "ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789@#$%&*";

    return (
        <div className={`font-mono ${className}`}>
            {displayText.split("").map((char, i) => (
                <motion.span
                    key={i}
                    initial={{ opacity: 0, filter: "blur(4px)" }}
                    animate={{ opacity: 1, filter: "blur(0px)" }}
                    transition={{ duration: 0.2, delay: i * 0.01 }}
                >
                    {char === " " ? "\u00A0" : char}
                </motion.span>
            ))}
            <motion.span
                animate={{ opacity: [0, 1, 0] }}
                transition={{ duration: 0.8, repeat: Infinity }}
                className="inline-block w-2 h-4 bg-amber-500 ml-1 translate-y-0.5"
            />
        </div>
    );
};

export default DecayText;
