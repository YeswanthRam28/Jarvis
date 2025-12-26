import React, { useRef, useEffect } from 'react';
import { motion } from 'framer-motion';

const ArcReactor = ({ status }) => {
    const canvasRef = useRef(null);

    useEffect(() => {
        const canvas = canvasRef.current;
        const ctx = canvas.getContext('2d');
        let animationFrameId;

        const render = () => {
            ctx.clearRect(0, 0, canvas.width, canvas.height);
            const centerX = canvas.width / 2;
            const centerY = canvas.height / 2;
            const time = Date.now() / 1000;

            // Pulse based on status
            let pulse = 1;
            if (status === 'processing') {
                pulse = 1 + Math.sin(time * 10) * 0.1;
            } else {
                pulse = 1 + Math.sin(time * 2) * 0.05;
            }

            // Outer ring
            ctx.beginPath();
            ctx.arc(centerX, centerY, 80 * pulse, 0, 2 * Math.PI);
            ctx.strokeStyle = '#00f2ff';
            ctx.lineWidth = 2;
            ctx.stroke();

            // Inner segments
            const segments = 8;
            for (let i = 0; i < segments; i++) {
                const angle = (i / segments) * 2 * Math.PI + time;
                ctx.beginPath();
                ctx.arc(centerX, centerY, 60 * pulse, angle, angle + (Math.PI / 6));
                ctx.strokeStyle = '#00f2ff';
                ctx.lineWidth = 10;
                ctx.stroke();
            }

            // Core glow
            const gradient = ctx.createRadialGradient(centerX, centerY, 0, centerX, centerY, 40 * pulse);
            gradient.addColorStop(0, '#ffffff');
            gradient.addColorStop(0.5, '#00f2ff');
            gradient.addColorStop(1, 'transparent');

            ctx.fillStyle = gradient;
            ctx.beginPath();
            ctx.arc(centerX, centerY, 40 * pulse, 0, 2 * Math.PI);
            ctx.fill();

            animationFrameId = window.requestAnimationFrame(render);
        };

        render();
        return () => window.cancelAnimationFrame(animationFrameId);
    }, [status]);

    return (
        <div className="relative flex items-center justify-center">
            <canvas
                ref={canvasRef}
                width={300}
                height={300}
                className="drop-shadow-[0_0_20px_rgba(0,242,255,0.5)]"
            />
        </div>
    );
};

export default ArcReactor;
