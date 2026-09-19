import type { NextConfig } from "next";

/**
 * Pin the server's timezone to the viewer's own (`TEAM[0].timezone`).
 *
 * Every date in this app is local-time by construction: `dateKey`, `at()` and
 * `clockTime` all read `getHours()`/`getDate()` off the running process. When
 * the server runs somewhere else than the browser — a UTC host serving an
 * Eastern laptop is the common case — a client component that renders
 * `clockTime` prints one hour during SSR and a different one on hydration, and
 * React tears the tree down. Pinning here rather than in each component keeps
 * the whole graph on one clock. Assigning `process.env.TZ` before the server
 * boots is what actually moves Node's `Date`; the config module is the earliest
 * hook Next gives us.
 */
process.env.TZ = process.env.TZ ?? "America/New_York";

const nextConfig: NextConfig = {
  // The dev overlay parks itself bottom-left, directly over the sidebar's
  // viewer chip — the avatar the team asked for. Move it out of the demo.
  devIndicators: { position: 'top-right' },
};

export default nextConfig;
