'use client';

import { useCallback, useEffect, useRef, useState } from 'react';

/**
 * The agent's voice, on the client.
 *
 * Asks once whether a voice exists, remembers the mute switch across visits,
 * and plays one reply at a time — a new reply cuts off the previous one so
 * the agent never talks over itself. Everything degrades to silence: no key,
 * a failed render, or a browser that refuses autoplay all end the same way.
 */

const MUTE_KEY = 'sidequest.voice.muted';

export interface AgentVoice {
  /** A key is configured and a voice was found. */
  available: boolean;
  voiceName: string | null;
  muted: boolean;
  speaking: boolean;
  toggleMuted: () => void;
  speak: (text: string) => Promise<void>;
  stop: () => void;
}

export function useAgentVoice(): AgentVoice {
  const [available, setAvailable] = useState(false);
  const [voiceName, setVoiceName] = useState<string | null>(null);
  // Read once on first client render; the switch only renders after mount, so
  // the server's `false` never reaches the screen.
  const [muted, setMuted] = useState<boolean>(() => {
    if (typeof window === 'undefined') return false;
    try {
      return window.localStorage.getItem(MUTE_KEY) === '1';
    } catch {
      return false;
    }
  });
  const [speaking, setSpeaking] = useState(false);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const urlRef = useRef<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    fetch('/api/agent/speak', { cache: 'no-store' })
      .then((r) => (r.ok ? r.json() : { available: false }))
      .then((data: { available?: boolean; voice?: string }) => {
        if (cancelled) return;
        setAvailable(Boolean(data.available));
        setVoiceName(data.voice ?? null);
      })
      .catch(() => {
        if (!cancelled) setAvailable(false);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const stop = useCallback(() => {
    const audio = audioRef.current;
    if (audio) {
      audio.pause();
      audio.src = '';
      audioRef.current = null;
    }
    if (urlRef.current) {
      URL.revokeObjectURL(urlRef.current);
      urlRef.current = null;
    }
    setSpeaking(false);
  }, []);

  useEffect(() => stop, [stop]);

  const toggleMuted = useCallback(() => {
    setMuted((prev) => {
      const next = !prev;
      try {
        window.localStorage.setItem(MUTE_KEY, next ? '1' : '0');
      } catch {
        /* see above */
      }
      if (next) stop();
      return next;
    });
  }, [stop]);

  const speak = useCallback(
    async (text: string) => {
      if (!available || muted) return;
      const clean = text.trim();
      if (!clean) return;

      stop();
      try {
        const res = await fetch('/api/agent/speak', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ text: clean }),
        });
        if (!res.ok || !res.headers.get('content-type')?.startsWith('audio/')) return;

        const url = URL.createObjectURL(await res.blob());
        const audio = new Audio(url);
        urlRef.current = url;
        audioRef.current = audio;
        audio.onended = stop;
        audio.onerror = stop;
        setSpeaking(true);
        await audio.play();
      } catch {
        // Autoplay refused or the render failed. Silence is fine.
        stop();
      }
    },
    [available, muted, stop],
  );

  return { available, voiceName, muted, speaking, toggleMuted, speak, stop };
}
