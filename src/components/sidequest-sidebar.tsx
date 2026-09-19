'use client';

import { useCallback, useEffect, useState } from 'react';
import Image from 'next/image';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import {
  CalendarRange,
  ChevronLeft,
  ChevronRight,
  Images,
  Target,
  Users,
  type LucideIcon,
} from 'lucide-react';

import { Avatar } from '@/components/avatar';
import type { TeamMember } from '@/lib/domain/types';
import { cn } from '@/lib/utils';

interface NavItem {
  href: string;
  label: string;
  icon: LucideIcon;
}

/** Quests leads: it is what the product is for. Plan carries Today. */
const NAV: NavItem[] = [
  { href: '/quests', label: 'Quests', icon: Target },
  { href: '/plan', label: 'Plan', icon: CalendarRange },
  { href: '/feed', label: 'Feed', icon: Images },
  { href: '/team', label: 'Team', icon: Users },
];

const EXPANDED_WIDTH = 220;
const COLLAPSED_WIDTH = 60;

export function SideQuestSidebar({
  viewer,
  collapsed,
  onToggle,
}: {
  viewer: TeamMember;
  collapsed: boolean;
  onToggle: () => void;
}) {
  const pathname = usePathname();

  return (
    <aside
      className="relative z-20 flex h-full shrink-0 flex-col border-r border-border bg-white/80 animate-smooth ease-liquid"
      style={{
        width: collapsed ? COLLAPSED_WIDTH : EXPANDED_WIDTH,
        backdropFilter: 'blur(32px) saturate(180%)',
        WebkitBackdropFilter: 'blur(32px) saturate(180%)',
      }}
    >
      <Wordmark collapsed={collapsed} />

      <nav className="flex flex-1 flex-col gap-0.5 px-2">
        {NAV.map((item) => (
          <NavLink
            key={item.href}
            item={item}
            collapsed={collapsed}
            active={pathname === item.href || pathname.startsWith(`${item.href}/`)}
          />
        ))}
      </nav>

      <ViewerChip viewer={viewer} collapsed={collapsed} />

      <button
        type="button"
        onClick={onToggle}
        aria-label={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
        title={`${collapsed ? 'Expand' : 'Collapse'} sidebar  ⌘B`}
        className="absolute -right-3 top-[22px] z-30 flex h-6 w-6 items-center justify-center rounded-full border border-border bg-white text-muted-foreground shadow-soft animate-smooth ease-liquid hover:text-foreground"
      >
        {collapsed ? (
          <ChevronRight className="h-3.5 w-3.5" />
        ) : (
          <ChevronLeft className="h-3.5 w-3.5" />
        )}
      </button>
    </aside>
  );
}

function Wordmark({ collapsed }: { collapsed: boolean }) {
  return (
    <Link
      href="/quests"
      className="flex h-14 items-center gap-2.5 px-4 no-tap"
      aria-label="SideQuest home"
    >
      {/* The team's mark is the only saturated thing in the chrome. */}
      <Image
        src="/sidequest-mark.png"
        alt=""
        aria-hidden="true"
        width={22}
        height={22}
        unoptimized
        className="h-[22px] w-[22px] shrink-0"
      />
      {!collapsed && (
        <span className="truncate text-[15px] font-semibold tracking-[0.08em] text-foreground">
          SideQuest
        </span>
      )}
    </Link>
  );
}

function NavLink({
  item,
  collapsed,
  active,
}: {
  item: NavItem;
  collapsed: boolean;
  active: boolean;
}) {
  const Icon = item.icon;

  return (
    <Link
      href={item.href}
      title={collapsed ? item.label : undefined}
      aria-current={active ? 'page' : undefined}
      className={cn(
        'group flex items-center gap-2.5 rounded-lg px-2.5 py-2 text-[13px] font-normal animate-smooth ease-liquid no-tap',
        collapsed && 'justify-center px-0',
        active
          ? 'bg-primary/10 text-primary'
          : 'text-muted-foreground hover:bg-muted hover:text-foreground',
      )}
    >
      <Icon className="h-4 w-4 shrink-0" strokeWidth={1.75} />
      {!collapsed && <span className="truncate">{item.label}</span>}
    </Link>
  );
}

function ViewerChip({ viewer, collapsed }: { viewer: TeamMember; collapsed: boolean }) {
  const firstName = viewer.name.split(' ')[0];

  return (
    <div className="border-t border-border p-2">
      <div
        className={cn(
          'flex items-center gap-2.5 rounded-lg px-1.5 py-1.5',
          collapsed && 'justify-center px-0',
        )}
        title={collapsed ? `${viewer.name} · ${viewer.role}` : undefined}
      >
        <Avatar
          name={viewer.name}
          initials={viewer.initials}
          accent={viewer.accent}
          photoUrl={viewer.photoUrl}
          size="sm"
        />
        {!collapsed && (
          <span className="min-w-0 leading-tight">
            <span className="block truncate text-[13px] text-foreground">{firstName}</span>
            <span className="block truncate text-[11px] text-muted-foreground">
              {viewer.role}
            </span>
          </span>
        )}
      </div>
    </div>
  );
}

/**
 * The shell owns collapse state so both the sidebar and the scroll container
 * stay in one client boundary; the route layout above it stays a server
 * component and can read the viewer directly.
 */
export function AppShell({
  viewer,
  children,
}: {
  viewer: TeamMember;
  children: React.ReactNode;
}) {
  const [collapsed, setCollapsed] = useState(false);

  const toggle = useCallback(() => setCollapsed((c) => !c), []);

  useEffect(() => {
    function onKeyDown(event: KeyboardEvent) {
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === 'b') {
        event.preventDefault();
        toggle();
      }
    }
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [toggle]);

  return (
    <div className="flex h-screen overflow-hidden bg-background">
      <SideQuestSidebar viewer={viewer} collapsed={collapsed} onToggle={toggle} />
      <main className="relative flex-1 overflow-y-auto">
        <div className="mx-auto w-full max-w-6xl px-6 py-6">{children}</div>
      </main>
    </div>
  );
}
