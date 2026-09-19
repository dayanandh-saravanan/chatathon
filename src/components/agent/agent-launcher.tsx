'use client';

import { motion } from 'framer-motion';
import { Sparkles } from 'lucide-react';
import type { Ref } from 'react';

import { cn } from '@/lib/utils';

const EASE_LIQUID: [number, number, number, number] = [0.17, 0.67, 0.27, 1];

export interface AgentLauncherProps {
  open: boolean;
  onOpen: () => void;
  /** Lets the panel hand focus back here when it closes. */
  ref?: Ref<HTMLButtonElement>;
}

/**
 * The one always-present way into the agent. It sits above page content but
 * below the panel, and fades out while the panel is open so the two never
 * overlap at the same corner.
 *
 * The fixed positioning lives on the wrapper, not the button: `.glass-btn`
 * declares `position: relative` after Tailwind in globals.css, so a `fixed`
 * utility on the same element loses and the button drops into normal flow.
 */
export function AgentLauncher({ open, onOpen, ref }: AgentLauncherProps) {
  return (
    <div
      className={cn(
        'fixed bottom-6 right-6 z-40',
        open && 'pointer-events-none',
      )}
    >
      <motion.button
        ref={ref}
        type="button"
        onClick={onOpen}
        aria-label="Ask SideQuest"
        aria-expanded={open}
        // No mount animation: this is the only way into the agent, so it must be
        // visible from the server HTML rather than waiting on hydration.
        initial={false}
        animate={{ opacity: open ? 0 : 1, scale: open ? 0.8 : 1 }}
        transition={{ duration: 0.3, ease: EASE_LIQUID }}
        whileHover={{ scale: open ? 0.8 : 1.06 }}
        whileTap={{ scale: open ? 0.8 : 0.96 }}
        className="glass-btn no-tap"
        style={{
          boxShadow:
            'inset 0 0 20px -6px rgba(255, 255, 255, 0.8), 0 10px 30px hsl(var(--primary) / 0.3), 0 0 0 1px hsl(var(--primary) / 0.12)',
        }}
      >
        <span
          aria-hidden
          className="gradient-purple-blue relative z-10 flex size-10 items-center justify-center rounded-full shadow-soft"
        >
          <Sparkles className="size-5 text-white" />
        </span>
      </motion.button>
    </div>
  );
}
