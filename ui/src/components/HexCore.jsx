import React, { useRef, useEffect } from 'react';

const HexCore = ({ status }) => {
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

            // Pulse multiplier
            const pulse = status === 'processing' ? 1 + Math.sin(time * 15) * 0.05 : 1 + Math.sin(time * 2) * 0.02;

            const drawHex = (size, rotate, color, weight = 1, dashed = false) => {
                ctx.save();
                ctx.translate(centerX, centerY);
                ctx.rotate(rotate);
                if (dashed) ctx.setLineDash([5, 10]);
                ctx.beginPath();
                for (let i = 0; i < 6; i++) {
                    const angle = (i / 6) * 2 * Math.PI;
                    const x = Math.cos(angle) * size;
                    const y = Math.sin(angle) * size;
                    if (i === 0) ctx.moveTo(x, y);
                    else ctx.lineTo(x, y);
                }
                ctx.closePath();
                ctx.strokeStyle = color;
                ctx.lineWidth = weight;
                ctx.stroke();
                ctx.restore();
            };

            // 1. Static Outer Frame
            drawHex(140, Math.PI / 6, 'rgba(0, 212, 255, 0.1)', 0.5);

            // 2. Kinetic Data Ring (Dashed)
            drawHex(120 * pulse, time * 0.5, 'rgba(0, 212, 255, 0.3)', 1, true);

            // 3. Segmented Power Ring
            const segments = 12;
            for (let i = 0; i < segments; i++) {
                const offset = (i / segments) * 2 * Math.PI + time * 1.5;
                ctx.beginPath();
                ctx.arc(centerX, centerY, 100 * pulse, offset, offset + (Math.PI / 10));
                ctx.strokeStyle = i % 3 === 0 ? '#00d4ff' : 'rgba(0, 212, 255, 0.2)';
                ctx.lineWidth = 4;
                ctx.stroke();
            }

            // 4. Central Hex-Core (The "Brain")
            ctx.save();
            ctx.translate(centerX, centerY);
            ctx.rotate(-time * 1);

            // Core Hexagon Fill
            ctx.beginPath();
            for (let i = 0; i < 6; i++) {
                const angle = (i / 6) * 2 * Math.PI;
                ctx.lineTo(Math.cos(angle) * 40 * pulse, Math.sin(angle) * 40 * pulse);
            }
            ctx.closePath();
            const grad = ctx.createRadialGradient(0, 0, 0, 0, 0, 40 * pulse);
            grad.addColorStop(0, '#ffffff');
            grad.addColorStop(0.5, '#00d4ff');
            grad.addColorStop(1, 'rgba(0, 212, 255, 0.1)');
            ctx.fillStyle = grad;
            ctx.fill();

            // Core Border
            ctx.strokeStyle = '#00d4ff';
            ctx.lineWidth = 1;
            ctx.stroke();
            ctx.restore();

            // 5. Telemetry Dots / Data Stream
            const dots = 8;
            for (let i = 0; i < dots; i++) {
                const angle = (i / dots) * 2 * Math.PI - time * 2;
                const x = centerX + Math.cos(angle) * 70 * pulse;
                const y = centerY + Math.sin(angle) * 70 * pulse;
                ctx.fillStyle = '#00d4ff';
                ctx.beginPath();
                ctx.arc(x, y, 1.5, 0, Math.PI * 2);
                ctx.fill();

                // Micro labels
                if (i % 2 === 0) {
                    ctx.font = '6px JetBrains Mono';
                    ctx.fillStyle = 'rgba(0, 212, 255, 0.4)';
                    ctx.fillText(`0x${(i * 123).toString(16)}`, x + 5, y);
                }
            }

            // 6. Audio Waveform (Simulated if idle, reactive if processing)
            if (status === 'processing') {
                ctx.beginPath();
                ctx.strokeStyle = '#00d4ff88';
                ctx.lineWidth = 0.5;
                for (let i = 0; i < 50; i++) {
                    const x = centerX - 100 + i * 4;
                    const y = centerY + 130 + Math.sin(time * 20 + i * 0.5) * (Math.random() * 20);
                    if (i === 0) ctx.moveTo(x, y);
                    else ctx.lineTo(x, y);
                }
                ctx.stroke();
            }

            animationFrameId = window.requestAnimationFrame(render);
        };

        render();
        return () => window.cancelAnimationFrame(animationFrameId);
    }, [status]);

    return (
        <div className="relative">
            <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[350px] h-[350px] border border-[#00d4ff05] rounded-full" />
            <canvas ref={canvasRef} width={500} height={500} className="relative z-10" />
        </div>
    );
};

export default HexCore;
