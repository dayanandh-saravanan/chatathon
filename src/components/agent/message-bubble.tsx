'use client';

import { motion } from 'framer-motion';
import { Sparkles } from 'lucide-react';
import type { ReactNode } from 'react';

import type { AgentMessage } from '@/lib/domain/types';
import { cn } from '@/lib/utils';

/** The system's house easing, spelled out so framer gets a mutable tuple. */
const EASE_LIQUID: [number, number, number, number] = [0.17, 0.67, 0.27, 1];

function AgentMark() {
  return (
    <span
      aria-hidden
      className="gradient-purple-blue mt-0.5 flex size-6 shrink-0 items-center justify-center rounded-full shadow-soft"
    >
      <Sparkles className="size-3 text-white" />
    </span>
  );
}

export interface MessageBubbleProps {
  message: AgentMessage;
  /**
   * Result cards for `message.actions`. They hang off the bubble rather than
   * sitting in the bubble, so a long reply and its outcome stay separable.
   */
  children?: ReactNode;
}

export function MessageBubble({ message, children }: MessageBubbleProps) {
  const isUser = message.role === 'user';

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.28, ease: EASE_LIQUID }}
      className={cn('flex gap-2.5', isUser ? 'justify-end' : 'justify-start')}
    >
      {!isUser && <AgentMark />}

      <div className="flex min-w-0 max-w-[85%] flex-col gap-2">
        <div
          className={cn(
            // `w-fit` keeps a short reply hugging its text; without it the bubble
            // stretches to the column's full 85% and every message looks the same size.
            'w-fit whitespace-pre-wrap text-[14px] leading-relaxed',
            isUser && 'ml-auto',
            isUser
              ? 'gradient-purple-blue rounded-2xl rounded-br-md px-3.5 py-2.5 text-white shadow-soft'
              : 'glass-card rounded-2xl rounded-bl-md px-3.5 py-2.5 text-foreground',
          )}
        >
          {message.content}
        </div>

        {children}
      </div>
    </motion.div>
  );
}

/** Shown while `/api/agent/chat` is in flight, in the agent's own slot. */
export function TypingBubble() {
  return (
    <motion.div
      initial={{ opacity: 0, y: 6 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.2, ease: EASE_LIQUID }}
      className="flex justify-start gap-2.5"
      aria-label="SideQuest is thinking"
    >
      <AgentMark />
      <div className="glass-card flex items-center gap-1.5 rounded-2xl rounded-bl-md px-3.5 py-3">
        {[0, 1, 2].map((i) => (
          <motion.span
            key={i}
            className="block size-1.5 rounded-full bg-primary/60"
            animate={{ opacity: [0.25, 1, 0.25], y: [0, -2, 0] }}
            transition={{ duration: 1, repeat: Infinity, delay: i * 0.16, ease: 'easeInOut' }}
          />
        ))}
      </div>
    </motion.div>
  );
}
