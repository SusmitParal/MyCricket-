import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';

export default function SplashScreen({ onComplete }: { onComplete: () => void }) {
  const [phase, setPhase] = useState<'init' | 'scan' | 'reveal' | 'ready'>('init');
  const [progress, setProgress] = useState(0);

  useEffect(() => {
    document.body.style.overflow = 'hidden';
    
    // Professional loading sequence
    const sequence = async () => {
      // Step 1: Initial boot
      await new Promise(r => setTimeout(r, 800));
      setPhase('scan');
      
      // Step 2: Progress simulation
      const interval = setInterval(() => {
        setProgress(prev => {
          if (prev >= 100) {
            clearInterval(interval);
            return 100;
          }
          return prev + Math.random() * 15;
        });
      }, 150);

      await new Promise(r => setTimeout(r, 2000));
      setPhase('reveal');
      
      await new Promise(r => setTimeout(r, 2500));
      setPhase('ready');
      
      await new Promise(r => setTimeout(r, 800));
      document.body.style.overflow = 'auto';
      onComplete();
    };

    sequence();

    return () => {
      document.body.style.overflow = 'auto';
    };
  }, [onComplete]);

  return (
    <motion.div 
      initial={{ opacity: 1 }}
      exit={{ opacity: 0, scale: 1.1, filter: 'blur(20px)' }}
      transition={{ duration: 0.8, ease: "circIn" }}
      className="fixed inset-0 w-screen h-screen bg-[#050505] z-[10000] flex flex-col items-center justify-center overflow-hidden select-none"
    >
      {/* Initialization Percentage */}
      <div className="absolute top-8 right-8 z-[10001] text-neon-cyan font-mono text-sm font-bold">
        {Math.round(progress)}%
      </div>

      {/* Cinematic Background Elements */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        {/* Grid System */}
        <div className="absolute inset-0 opacity-[0.03]" 
             style={{ 
               backgroundImage: `linear-gradient(rgba(0,255,255,0.2) 1px, transparent 1px), linear-gradient(90deg, rgba(0,255,255,0.2) 1px, transparent 1px)`,
               backgroundSize: '60px 60px' 
             }} 
        />
        
        {/* Moving Light Streaks */}
        <motion.div 
          animate={{ 
            x: ['-100%', '200%'],
            opacity: [0, 0.5, 0]
          }}
          transition={{ duration: 3, repeat: Infinity, ease: "linear" }}
          className="absolute top-1/4 left-0 w-full h-[1px] bg-gradient-to-r from-transparent via-neon-cyan to-transparent"
        />
        <motion.div 
          animate={{ 
            x: ['200%', '-100%'],
            opacity: [0, 0.3, 0]
          }}
          transition={{ duration: 4, repeat: Infinity, ease: "linear", delay: 1 }}
          className="absolute bottom-1/3 left-0 w-full h-[1px] bg-gradient-to-r from-transparent via-neon-cyan to-transparent"
        />

        {/* Ambient Glows */}
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[800px] h-[800px] bg-neon-cyan/5 blur-[150px] rounded-full" />
      </div>

      <div className="relative z-10 flex flex-col items-center">
        {/* Main Logo Reveal */}
        <AnimatePresence mode="wait">
          {(phase === 'init' || phase === 'scan') && (
            <motion.div
              key="loader"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0, scale: 0.8 }}
              className="flex flex-col items-center"
            >
              {/* Hexagonal Loader Frame */}
              <div className="relative w-32 h-32 mb-12">
                <svg className="w-full h-full rotate-90" viewBox="0 0 100 100">
                  <motion.circle
                    cx="50" cy="50" r="45"
                    fill="none"
                    stroke="rgba(0,255,255,0.1)"
                    strokeWidth="2"
                  />
                  <motion.circle
                    cx="50" cy="50" r="45"
                    fill="none"
                    stroke="var(--neon-cyan)"
                    strokeWidth="2"
                    strokeDasharray="283"
                    animate={{ strokeDashoffset: 283 - (283 * progress) / 100 }}
                    transition={{ type: "spring", stiffness: 50 }}
                  />
                </svg>
                <div className="absolute inset-0 flex items-center justify-center">
                  <span className="text-neon-cyan font-mono text-xl font-bold">{Math.round(progress)}%</span>
                </div>
              </div>
              <motion.div 
                animate={{ opacity: [0.4, 1, 0.4] }}
                transition={{ duration: 2, repeat: Infinity }}
                className="text-[10px] uppercase tracking-[0.8em] text-neon-cyan/60 font-mono"
              >
                Initializing System
              </motion.div>
            </motion.div>
          )}

          {(phase === 'reveal' || phase === 'ready') && (
            <motion.div
              key="logo"
              initial={{ opacity: 0, y: 40 }}
              animate={{ opacity: 1, y: 0 }}
              className="flex flex-col items-center"
            >
              {/* Stylized Cricket Graphic */}
              <div className="relative w-64 h-64 mb-8 flex items-center justify-center">
                {/* Wickets */}
                <div className="absolute flex gap-2 z-10">
                  <div className="w-2 h-24 bg-yellow-500 rounded-sm" />
                  <div className="w-2 h-24 bg-yellow-500 rounded-sm" />
                  <div className="w-2 h-24 bg-yellow-500 rounded-sm" />
                </div>
                
                {/* Crossed Bats */}
                <motion.div
                  initial={{ rotate: -45, opacity: 0 }}
                  animate={{ rotate: -45, opacity: 1 }}
                  className="absolute w-12 h-64 bg-amber-100 rounded-t-full rounded-b-sm z-20 shadow-lg border-l-4 border-amber-200"
                >
                  <div className="w-full h-8 bg-amber-200 mt-4" />
                </motion.div>
                <motion.div
                  initial={{ rotate: 45, opacity: 0 }}
                  animate={{ rotate: 45, opacity: 1 }}
                  className="absolute w-12 h-64 bg-amber-100 rounded-t-full rounded-b-sm z-20 shadow-lg border-r-4 border-amber-200"
                >
                  <div className="w-full h-8 bg-amber-200 mt-4" />
                </motion.div>

                {/* Cricket Ball */}
                <motion.div
                  initial={{ scale: 0, opacity: 0 }}
                  animate={{ scale: 1, opacity: 1 }}
                  transition={{ type: "spring", delay: 0.3 }}
                  className="absolute w-24 h-24 bg-red-600 rounded-full border-4 border-red-800 z-30 shadow-[0_0_20px_rgba(220,38,38,0.5)] flex items-center justify-center"
                >
                  <div className="w-full h-1 bg-white/30 rotate-45 absolute" />
                  <div className="w-full h-1 bg-white/30 -rotate-45 absolute" />
                </motion.div>
              </div>

              <div className="relative mb-4">
                <h1 className="text-7xl md:text-9xl font-black italic tracking-tighter text-white leading-none">
                  MY <span className="text-neon-cyan">CRICKET</span>
                </h1>
              </div>
              
              <motion.div 
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ delay: 0.8 }}
                className="text-xs uppercase tracking-[1.2em] text-white/40 font-mono mt-8"
              >
                Professional Management Suite
              </motion.div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* Footer Branding */}
      <motion.div 
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 1.5, duration: 2 }}
        className="absolute bottom-12 flex flex-col items-center gap-3"
      >
        <div className="flex items-center gap-4">
          <div className="h-[1px] w-12 bg-neon-cyan/20" />
          <span className="text-[10px] uppercase tracking-[0.6em] text-white/40 font-mono font-bold">Powered by</span>
          <div className="h-[1px] w-12 bg-neon-cyan/20" />
        </div>
        <div className="flex flex-col items-center">
          <span className="text-2xl font-black tracking-[0.3em] text-white/90">
            ATHER-X <span className="text-neon-cyan">PRO</span>
          </span>
        </div>
      </motion.div>
    </motion.div>
  );
}
