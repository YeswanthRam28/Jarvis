import React, { useRef, useEffect } from 'react';

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

            // Base rotation speeds
            const slowRotate = time * 0.5;
            const fastRotate = time * 2;
            const reverseRotate = -time * 1.5;

            // Pulse based on status
            let pulse = 1;
            let coreIntensity = 1;
            if (status === 'processing') {
                pulse = 1 + Math.sin(time * 15) * 0.08;
                coreIntensity = 1 + Math.sin(time * 20) * 0.2;
            } else {
                pulse = 1 + Math.sin(time * 2) * 0.03;
            }

            const drawHexagon = (x, y, size, rotate) => {
                ctx.beginPath();
                for (let i = 0; i < 6; i++) {
                    const angle = rotate + (i / 6) * 2 * Math.PI;
                    const sx = x + Math.cos(angle) * size;
                    const sy = y + Math.sin(angle) * size;
                    if (i === 0) ctx.moveTo(sx, sy);
                    else ctx.lineTo(sx, sy);
                }
                ctx.closePath();
            };

            // 1. Outer Tech Ring (Hexagons)
            ctx.save();
            ctx.strokeStyle = '#00f2ff33';
            ctx.lineWidth = 1;
            drawHexagon(centerX, centerY, 110 * pulse, slowRotate);
            ctx.stroke();
            ctx.restore();

            // 2. Fragmented Middleware Ring
            const middlewareSegments = 12;
            for (let i = 0; i < middlewareSegments; i++) {
                const angle = (i / middlewareSegments) * 2 * Math.PI + reverseRotate;
                ctx.beginPath();
                ctx.arc(centerX, centerY, 90 * pulse, angle, angle + (Math.PI / 8));
                ctx.strokeStyle = i % 3 === 0 ? '#ff00ff' : '#00f2ffcc';
                ctx.lineWidth = 3;
                ctx.stroke();
            }

            // 3. Inner Kinetic Ring
            const segments = 6;
            for (let i = 0; i < segments; i++) {
                const angle = (i / segments) * 2 * Math.PI + fastRotate;
                ctx.beginPath();
                ctx.arc(centerX, centerY, 70 * pulse, angle, angle + (Math.PI / 4));
                ctx.strokeStyle = '#00f2ff';
                ctx.lineWidth = 8;
                ctx.stroke();

                // End caps glow
                ctx.fillStyle = '#ffffff';
                const capX = centerX + Math.cos(angle) * 70 * pulse;
                const capY = centerY + Math.sin(angle) * 70 * pulse;
                ctx.beginPath();
                ctx.arc(capX, capY, 2, 0, Math.PI * 2);
                ctx.fill();
            }

            // 4. Plasma Core
            const coreSize = 35 * pulse;
            const gradient = ctx.createRadialGradient(centerX, centerY, 0, centerX, centerY, coreSize);
            gradient.addColorStop(0, '#ffffff');
            gradient.addColorStop(0.3, '#00f2ff');
            gradient.addColorStop(0.7, '#00f2ff33');
            gradient.addColorStop(1, 'transparent');

            ctx.fillStyle = gradient;
            ctx.globalAlpha = coreIntensity;
            ctx.beginPath();
            ctx.arc(centerX, centerY, coreSize, 0, 2 * Math.PI);
            ctx.fill();
            ctx.globalAlpha = 1;

            // 5. Energy Arcs (If processing)
            if (status === 'processing') {
                ctx.beginPath();
                ctx.moveTo(centerX + (Math.random() - 0.5) * 40, centerY + (Math.random() - 0.5) * 40);
                ctx.lineTo(centerX + (Math.random() - 0.5) * 150, centerY + (Math.random() - 0.5) * 150);
                ctx.strokeStyle = '#ffffff88';
                ctx.lineWidth = 1;
                ctx.stroke();
            }

            animationFrameId = window.requestAnimationFrame(render);
        };

        render();
        return () => window.cancelAnimationFrame(animationFrameId);
    }, [status]);

    return (
        <div className="relative flex items-center justify-center">
            <div className="absolute w-[220px] h-[220px] rounded-full border border-[#00f2ff11] animate-ping opacity-20" />
            <canvas
                ref={canvasRef}
                width={400}
                height={400}
                className="drop-shadow-[0_0_30px_rgba(0,242,255,0.4)]"
            />
        </div>
    );
};

export default ArcReactor;
