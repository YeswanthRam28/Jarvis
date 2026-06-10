import { useMemo } from 'react';
import { motion } from 'framer-motion';

export default function StarCloud() {
  const stars = useMemo(() => {
    return Array.from({ length: 150 }).map((_, i) => {
      const size = Math.random() * 2.5 + 0.5;
      return {
        id: i,
        x: Math.random() * 100,
        y: Math.random() * 100,
        size,
        duration: Math.random() * 4 + 2,
        delay: Math.random() * 5,
        opacity: Math.random() * 0.7 + 0.3,
      };
    });
  }, []);

  return (
    <div style={{ width: '100%', height: '100%', backgroundColor: '#0f172a', position: 'relative', overflow: 'hidden' }}>
      {/* Deep space gradient */}
      <div style={{
        position: 'absolute',
        top: 0, left: 0, right: 0, bottom: 0,
        background: 'radial-gradient(circle at 50% 50%, #1e293b 0%, #0f172a 100%)',
        zIndex: 0
      }} />
      
      {stars.map((star) => (
        <motion.div
          key={star.id}
          style={{
            position: 'absolute',
            left: `${star.x}%`,
            top: `${star.y}%`,
            width: star.size,
            height: star.size,
            backgroundColor: '#e2e8f0',
            borderRadius: '50%',
            boxShadow: `0 0 ${star.size * 3}px #93c5fd`,
            zIndex: 1,
          }}
          animate={{
            opacity: [star.opacity * 0.3, star.opacity, star.opacity * 0.3],
            scale: [1, 1.2, 1],
          }}
          transition={{
            duration: star.duration,
            repeat: Infinity,
            delay: star.delay,
            ease: "easeInOut"
          }}
        />
      ))}
      
      {/* Subtle floating nebula effect */}
      <motion.div
        style={{
          position: 'absolute',
          top: '20%', left: '30%',
          width: '40vw', height: '40vw',
          background: 'radial-gradient(circle, rgba(56,189,248,0.1) 0%, rgba(15,23,42,0) 70%)',
          borderRadius: '50%',
          filter: 'blur(40px)',
          zIndex: 0,
        }}
        animate={{
          x: [0, 50, 0],
          y: [0, -30, 0],
          scale: [1, 1.1, 1],
        }}
        transition={{
          duration: 15,
          repeat: Infinity,
          ease: "linear"
        }}
      />
    </div>
  );
}
