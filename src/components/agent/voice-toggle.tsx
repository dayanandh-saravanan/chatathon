'use client';

import { motion } from 'framer-motion';
import { Volume2, VolumeX } from 'lucide-react';

import type { AgentVoice } from '@/lib/agent/use-voice';
import { cn } from '@/lib/utils';

/**
 * The speaker switch from the reference UI's top-left corner. Rendered only
 * when a voice exists; pulses gently while the agent is talking.
 */
export function VoiceToggle({ voice, className }: { voice: AgentVoice; className?: string }) {
  if (!voice.available) return null;
  const Icon = voice.muted ? VolumeX : Volume2;
  return (
    <button
      type="button"
      onClick={voice.toggleMuted}
      aria-pressed={!voice.muted}
      aria-label={voice.muted ? 'Turn the agent voice on' : 'Turn the agent voice off'}
      title={voice.voiceName ? `Voice: ${voice.voiceName}` : undefined}
      className={cn(
        'btn-glass relative flex h-8 w-8 items-center justify-center text-foreground',
        voice.muted && 'text-muted-foreground',
        className,
      )}
    >
      {voice.speaking && !voice.muted ? (
        <motion.span
          aria-hidden
          className="absolute inset-0 rounded-full bg-primary/15"
          animate={{ scale: [1, 1.35, 1], opacity: [0.6, 0, 0.6] }}
          transition={{ duration: 1.4, repeat: Infinity, ease: 'easeInOut' }}
        />
      ) : null}
      <Icon className="relative size-4" />
    </button>
  );
}
