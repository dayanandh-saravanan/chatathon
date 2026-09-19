'use client';

import { motion } from 'framer-motion';

/**
 * The centre of the quest studio: a CSS "liquid glass" sphere. The reference
 * project rendered this with a WebGL transmission material; a layered radial
 * gradient, a slow conic sheen and a blurred glow behind it read the same at a
 * glance and cost nothing to ship.
 */
export function Orb({ size, active }: { size: number; active: boolean }) {
  return (
    <div className="relative" style={{ width: size, height: size }} aria-hidden>
      <motion.div
        className="absolute -inset-12 rounded-full"
        style={{
          background:
            'radial-gradient(circle at 62% 58%, rgba(139,92,246,0.36), rgba(59,130,246,0.22) 45%, transparent 72%)',
          filter: 'blur(30px)',
        }}
        animate={{
          opacity: active ? [0.55, 1, 0.55] : [0.35, 0.6, 0.35],
          scale: active ? [1, 1.18, 1] : [1, 1.06, 1],
        }}
        transition={{ duration: active ? 1.8 : 4.2, repeat: Infinity, ease: 'easeInOut' }}
      />
      <motion.div
        className="absolute inset-0 rounded-full"
        style={{
          background:
            'radial-gradient(circle at 32% 28%, rgba(255,255,255,0.98) 0%, rgba(255,255,255,0.62) 16%, rgba(237,233,254,0.58) 40%, rgba(196,181,253,0.48) 70%, rgba(147,197,253,0.42) 100%)',
          boxShadow:
            'inset 0 -18px 40px -10px rgba(139,92,246,0.38), inset 0 12px 24px -8px rgba(255,255,255,0.95), 0 22px 50px -18px rgba(99,102,241,0.45), 0 0 0 0.5px rgba(148,163,184,0.35)',
          backdropFilter: 'blur(20px) saturate(160%)',
          WebkitBackdropFilter: 'blur(20px) saturate(160%)',
        }}
        animate={{ scale: active ? [1, 1.06, 1] : [1, 1.02, 1] }}
        transition={{ duration: active ? 1.2 : 3.4, repeat: Infinity, ease: 'easeInOut' }}
      />
      <motion.div
        className="absolute inset-[6%] rounded-full"
        style={{
          background:
            'conic-gradient(from 0deg, transparent 0deg, rgba(255,255,255,0.75) 40deg, transparent 95deg, rgba(167,139,250,0.4) 200deg, transparent 265deg)',
          mixBlendMode: 'screen',
          filter: 'blur(6px)',
        }}
        animate={{ rotate: 360 }}
        transition={{ duration: active ? 3 : 16, repeat: Infinity, ease: 'linear' }}
      />
      <div className="absolute left-[22%] top-[13%] h-[20%] w-[34%] rounded-full bg-white/85 blur-[5px]" />
    </div>
  );
}
