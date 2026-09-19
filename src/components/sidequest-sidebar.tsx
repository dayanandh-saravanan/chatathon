'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import {
  CalendarRange,
  ChevronLeft,
  ChevronRight,
  Gauge,
  HeartHandshake,
  Sparkles,
  Target,
  Users,
  type LucideIcon,
} from 'lucide-react';

import type { TeamMember } from '@/lib/domain/types';
import { cn } from '@/lib/utils';

interface NavItem {
  href: string;
  label: string;
  icon: LucideIcon;
}

const NAV: NavItem[] = [
  { href: '/today', label: 'Today', icon: Gauge },
  { href: '/plan', label: 'Plan', icon: CalendarRange },
  { href: '/quests', label: 'Quests', icon: Target },
  { href: '/feed', label: 'Feed', icon: Users },
  { href: '/team', label: 'Team', icon: HeartHandshake },
];

const EXPANDED_WIDTH = 240;
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
      className="relative z-20 flex h-full shrink-0 flex-col border-r border-border/70 animate-smooth ease-liquid"
      style={{
        width: collapsed ? COLLAPSED_WIDTH : EXPANDED_WIDTH,
        background: 'rgba(250, 250, 252, 0.72)',
        backdropFilter: 'blur(32px) saturate(180%)',
        WebkitBackdropFilter: 'blur(32px) saturate(180%)',
        // Purple inner glow reads as the product's accent without tinting content.
        boxShadow:
          'inset 0 0 60px -28px hsl(var(--primary) / 0.45), inset -1px 0 0 rgba(255,255,255,0.6)',
      }}
    >
      <Wordmark collapsed={collapsed} />

      <nav className="flex flex-1 flex-col gap-1 px-2 pt-2">
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
        className="absolute -right-3 top-[26px] z-30 flex h-6 w-6 items-center justify-center rounded-full border border-border bg-white/90 text-muted-foreground shadow-soft animate-smooth ease-liquid hover:text-foreground hover:shadow-medium"
        style={{ backdropFilter: 'blur(12px)', WebkitBackdropFilter: 'blur(12px)' }}
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
      href="/today"
      className="flex h-16 items-center gap-2.5 px-4 no-tap"
      aria-label="SideQuest home"
    >
      <span className="gradient-purple-blue flex h-8 w-8 shrink-0 items-center justify-center rounded-xl shadow-soft">
        <Sparkles className="h-4 w-4 text-white" />
      </span>
      {!collapsed && (
        <span
          className="truncate bg-clip-text text-[17px] font-semibold tracking-tight text-transparent"
          style={{
            backgroundImage:
              'linear-gradient(135deg, hsl(var(--primary)) 0%, hsl(var(--secondary)) 100%)',
          }}
        >
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
        'group flex h-10 items-center gap-3 rounded-xl px-2.5 text-sm font-medium animate-smooth ease-liquid no-tap',
        collapsed && 'justify-center px-0',
        active
          ? 'gradient-purple-blue text-white shadow-soft'
          : 'text-muted-foreground hover:bg-white/70 hover:text-foreground',
      )}
    >
      <Icon className={cn('h-[18px] w-[18px] shrink-0', active && 'text-white')} />
      {!collapsed && <span className="truncate">{item.label}</span>}
    </Link>
  );
}

function ViewerChip({ viewer, collapsed }: { viewer: TeamMember; collapsed: boolean }) {
  const firstName = viewer.name.split(' ')[0];

  return (
    <div className="border-t border-border/60 p-2">
      <div
        className={cn(
          'flex items-center gap-2.5 rounded-xl px-2 py-2',
          collapsed && 'justify-center px-0',
        )}
        title={collapsed ? `${viewer.name} · ${viewer.role}` : undefined}
      >
        <span
          className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-[11px] font-semibold"
          style={{
            backgroundColor: `hsl(${viewer.accent} / 0.16)`,
            color: `hsl(${viewer.accent})`,
            boxShadow: `inset 0 0 0 1px hsl(${viewer.accent} / 0.28)`,
          }}
        >
          {viewer.initials}
        </span>
        {!collapsed && (
          <span className="min-w-0 leading-tight">
            <span className="block truncate text-[13px] font-medium text-foreground">
              {firstName}
            </span>
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
    <div className="flex h-screen overflow-hidden bg-white">
      <SideQuestSidebar viewer={viewer} collapsed={collapsed} onToggle={toggle} />
      <main className="relative flex-1 overflow-y-auto">
        {/* Whisper of the brand gradient behind the content, fixed to the pane
            so scrolling does not drag it. */}
        <div
          aria-hidden="true"
          className="gradient-overlay pointer-events-none absolute inset-x-0 top-0 h-80"
          style={{
            maskImage: 'linear-gradient(to bottom, black, transparent)',
            WebkitMaskImage: 'linear-gradient(to bottom, black, transparent)',
          }}
        />
        <div className="relative mx-auto w-full max-w-5xl px-6 py-8 sm:px-8 sm:py-10">
          {children}
        </div>
      </main>
    </div>
  );
}
