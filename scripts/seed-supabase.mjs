#!/usr/bin/env node
/**
 * Load the SideQuest demo dataset into Supabase.
 *
 *   node scripts/seed-supabase.mjs        (or: npm run seed)
 *
 * Safe to re-run: `reseed` wipes every `sq_*` table first. Re-running is in
 * fact the point — the dataset is generated relative to "now", so seeding again
 * re-centres the narrative (today is a wall, Ethan went quiet two weeks ago) on
 * the day you are demoing.
 *
 * The dataset builders and the row mapping are TypeScript and live in `src/`.
 * Rather than duplicate them in JS — where they would silently drift — this
 * script leans on Node's built-in type stripping and imports the real modules.
 * Two resolution details Node does not know about are patched below.
 */
import { spawnSync } from 'node:child_process';
import { existsSync, readFileSync } from 'node:fs';
import { registerHooks } from 'node:module';
import { dirname, resolve as resolvePath } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const ROOT = resolvePath(dirname(fileURLToPath(import.meta.url)), '..');

// Importing .ts from a package without "type": "module" makes Node print a
// four-line warning every run. Adding that field would change how the rest of
// the toolchain reads package.json, and a warning listener cannot suppress
// Node's default output — only the CLI flag can. So re-exec once with it.
const QUIET = '--disable-warning=MODULE_TYPELESS_PACKAGE_JSON';
if (!process.execArgv.includes(QUIET)) {
  const { status } = spawnSync(
    process.execPath,
    [QUIET, fileURLToPath(import.meta.url), ...process.argv.slice(2)],
    { stdio: 'inherit' },
  );
  process.exit(status ?? 1);
}

// ----------------------------------------------------------------- environment

/** Minimal .env parser — a seed script should not pull in a dependency. */
function loadEnv(file) {
  if (!existsSync(file)) return;
  for (const raw of readFileSync(file, 'utf8').split('\n')) {
    const line = raw.trim();
    if (!line || line.startsWith('#')) continue;
    const eq = line.indexOf('=');
    if (eq === -1) continue;
    const key = line.slice(0, eq).trim();
    let value = line.slice(eq + 1).trim();
    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }
    if (process.env[key] === undefined) process.env[key] = value;
  }
}

loadEnv(resolvePath(ROOT, '.env.local'));
loadEnv(resolvePath(ROOT, '.env'));

if (!process.env.NEXT_PUBLIC_SUPABASE_URL || !process.env.SUPABASE_SECRET_KEY) {
  console.error(
    'Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SECRET_KEY.\n' +
      'Copy .env.example to .env.local and fill them in.',
  );
  process.exit(1);
}

// ----------------------------------------------------------------- resolution

const SRC = resolvePath(ROOT, 'src');
// `server-only` throws outside a React Server Component graph. Its own package
// already ships the no-op that Next.js uses; point at that instead.
const SERVER_ONLY_NOOP = resolvePath(ROOT, 'node_modules/server-only/empty.js');

function firstExisting(base) {
  for (const candidate of [base, `${base}.ts`, `${base}.tsx`, `${base}/index.ts`]) {
    if (existsSync(candidate)) return candidate;
  }
  return null;
}

registerHooks({
  resolve(specifier, context, nextResolve) {
    if (specifier === 'server-only') {
      return { url: pathToFileURL(SERVER_ONLY_NOOP).href, shortCircuit: true };
    }

    // tsconfig's "@/*" -> "./src/*" alias, which Node has no concept of.
    if (specifier.startsWith('@/')) {
      const hit = firstExisting(resolvePath(SRC, specifier.slice(2)));
      if (hit) return { url: pathToFileURL(hit).href, shortCircuit: true };
    }

    // Extensionless relative imports between TypeScript modules.
    if (specifier.startsWith('.') && context.parentURL?.startsWith('file:')) {
      const hit = firstExisting(
        resolvePath(dirname(fileURLToPath(context.parentURL)), specifier),
      );
      if (hit) return { url: pathToFileURL(hit).href, shortCircuit: true };
    }

    return nextResolve(specifier, context);
  },
});

// ----------------------------------------------------------------- seed

const { buildSeedBundle } = await import('@/lib/data/service.ts');
const { SupabaseRepository } = await import('@/lib/data/supabase-repository.ts');

const bundle = buildSeedBundle();
const repo = new SupabaseRepository();

await repo.healthCheck();
await repo.reseed(bundle);

// Read back through the same mapping the app uses, so a green run means the
// app can actually render this data — not just that the inserts returned 200.
const [members, quests, events, signals, windows, posts] = await Promise.all([
  repo.listMembers(),
  repo.listQuests(),
  repo.listEvents(),
  repo.listSignals(),
  repo.listWindows(),
  repo.listPosts(),
]);

const milestones = quests.reduce((n, q) => n + q.milestones.length, 0);
const cheers = posts.reduce((n, p) => n + p.cheers.length, 0);
const memberPhotos = members.filter((m) => m.photoUrl).length;
const postPhotos = posts.filter((p) => p.photoUrl).length;

/**
 * `photo_url` is nullable, so a broken column mapping would not raise — it
 * would quietly return null on every row and the app would show initials
 * forever. Compare what went in against what came back, per row: the app is
 * usually running against this same project while the seed executes, so a
 * count is not stable but an id-keyed lookup is.
 */
function checkPhotos(label, sent, loaded) {
  const byId = new Map(loaded.map((row) => [row.id, row.photoUrl]));
  const broken = sent
    .filter((row) => row.photoUrl)
    .filter((row) => byId.get(row.id) !== row.photoUrl);
  if (broken.length === 0) return;
  console.error(
    `photo_url did not round-trip for ${broken.length} ${label}, e.g. ${broken[0].id}. ` +
      `Check the column on that table.`,
  );
  process.exit(1);
}

checkPhotos('members', bundle.members, members);
checkPhotos('posts', bundle.posts, posts);

// Photos are served from public/, so a path that is not on disk renders the
// glyph fallback. That is expected while the team is still sending files —
// worth naming, not worth failing on.
const missing = [...members.map((m) => m.photoUrl), ...posts.map((p) => p.photoUrl)]
  .filter((url) => url && !existsSync(resolvePath(ROOT, 'public', url.slice(1))));

console.log(`Seeded ${new URL(process.env.NEXT_PUBLIC_SUPABASE_URL).host}`);
console.table({
  members: members.length,
  quests: quests.length,
  milestones,
  events: events.length,
  signals: signals.length,
  windows: windows.length,
  posts: posts.length,
  cheers,
  memberPhotos,
  postPhotos,
});

if (missing.length > 0) {
  console.log(
    `${missing.length} of ${memberPhotos + postPhotos} photo paths are not in public/ yet; ` +
      'those surfaces fall back to initials or the glyph tile.',
  );
}
