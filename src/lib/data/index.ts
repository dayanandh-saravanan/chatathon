import 'server-only';

import type { Repository } from './repository';
import { MemoryRepository } from './memory-repository';

/**
 * Repository selection.
 *
 * Supabase when it is configured, memory otherwise. If Supabase is configured
 * but unreachable we fall back rather than crash — a hackathon demo should
 * never die on stage because of a network blip.
 */
let cached: Repository | null = null;

export function isSupabaseConfigured(): boolean {
  return Boolean(process.env.NEXT_PUBLIC_SUPABASE_URL && process.env.SUPABASE_SECRET_KEY);
}

export async function getRepository(): Promise<Repository> {
  if (cached) return cached;

  if (isSupabaseConfigured()) {
    try {
      const { SupabaseRepository } = await import('./supabase-repository');
      const repo = new SupabaseRepository();
      await repo.healthCheck();
      cached = repo;
      return cached;
    } catch (error) {
      console.warn(
        '[sidequest] Supabase unavailable, falling back to the in-memory store:',
        error instanceof Error ? error.message : error,
      );
    }
  }

  cached = new MemoryRepository();
  return cached;
}

/** Test hook. */
export function resetRepository(): void {
  cached = null;
}
