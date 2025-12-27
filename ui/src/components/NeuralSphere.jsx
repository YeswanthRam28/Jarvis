import React, { useRef, useMemo } from 'react';
import { Canvas, useFrame } from '@react-three/fiber';
import { Points, PointMaterial } from '@react-three/drei';
import * as THREE from 'three';

const ParticleSphere = ({ status }) => {
    const pointsRef = useRef();

    // Generate random points in a sphere
    const particles = useMemo(() => {
        const count = 5000;
        const positions = new Float32Array(count * 3);
        for (let i = 0; i < count; i++) {
            const u = Math.random();
            const v = Math.random();
            const theta = 2 * Math.PI * u;
            const phi = Math.acos(2 * v - 1);
            const x = 1.5 * Math.sin(phi) * Math.cos(theta);
            const y = 1.5 * Math.sin(phi) * Math.sin(theta);
            const z = 1.5 * Math.cos(phi);
            positions.set([x, y, z], i * 3);
        }
        return positions;
    }, []);

    useFrame((state) => {
        const time = state.clock.getElapsedTime();
        if (pointsRef.current) {
            pointsRef.current.rotation.y = time * 0.1;
            pointsRef.current.rotation.x = time * 0.05;

            // Pulse effect when processing
            if (status === 'processing') {
                const s = 1 + Math.sin(time * 10) * 0.1;
                pointsRef.current.scale.set(s, s, s);
            } else {
                pointsRef.current.scale.set(1, 1, 1);
            }
        }
    });

    return (
        <Points ref={pointsRef} positions={particles} stride={3} frustumCulled={false}>
            <PointMaterial
                transparent
                color="#5227FF"
                size={0.015}
                sizeAttenuation={true}
                depthWrite={false}
                blending={THREE.AdditiveBlending}
                opacity={0.8}
            />
        </Points>
    );
};

const NeuralSphere = ({ status }) => {
    return (
        <div className="w-[400px] h-[400px] relative">
            <Canvas camera={{ position: [0, 0, 5], fov: 40 }}>
                <ambientLight intensity={0.5} />
                <ParticleSphere status={status} />

                {/* Decorative inner rings */}
                <mesh rotation={[Math.PI / 2, 0, 0]}>
                    <torusGeometry args={[1.6, 0.005, 16, 100]} />
                    <meshBasicMaterial color="#FF9FFC" transparent opacity={0.2} />
                </mesh>
                <mesh rotation={[0, Math.PI / 2, 0]}>
                    <torusGeometry args={[1.7, 0.005, 16, 100]} />
                    <meshBasicMaterial color="#B19EEF" transparent opacity={0.1} />
                </mesh>
            </Canvas>

        </div>
    );
};

export default NeuralSphere;
