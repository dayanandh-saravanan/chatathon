'use client';

import { usePathname } from 'next/navigation';
import type { ReactNode } from 'react';

/**
 * Renders children everywhere except under the given path prefixes. Used to
 * keep the floating agent dock off `/quests`, where the agent *is* the page.
 */
export function RouteGate({
  hideOn,
  children,
}: {
  hideOn: string[];
  children: ReactNode;
}) {
  const pathname = usePathname() ?? '';
  if (hideOn.some((prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`))) {
    return null;
  }
  return <>{children}</>;
}
