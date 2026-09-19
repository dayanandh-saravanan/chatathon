import AgentDock from '@/components/agent/agent-panel';
import { AppShell } from '@/components/sidequest-sidebar';
import { ensureSeeded, getConversation, getViewer } from '@/lib/data/service';

/**
 * Server shell: it seeds the store on first hit and hands the viewer down as
 * plain props, so the interactive chrome below can stay a client component
 * without pulling the data layer into the browser bundle.
 *
 * The agent dock is mounted here rather than per-page: it is fixed-positioned,
 * so it sits outside the shell's scroll container, and mounting it once is what
 * makes the agent reachable from all five routes.
 */
export default async function AppLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  await ensureSeeded();
  const [viewer, conversation] = await Promise.all([getViewer(), getConversation()]);

  return (
    <>
      <AppShell viewer={viewer}>{children}</AppShell>
      <AgentDock viewerName={viewer.name} initialMessages={conversation} />
    </>
  );
}
