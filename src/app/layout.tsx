import type { Metadata } from 'next';
import { Inter, JetBrains_Mono } from 'next/font/google';

import { GlassFilters } from '@/components/glass-filters';

import './globals.css';

const inter = Inter({
  subsets: ['latin'],
  variable: '--font-inter',
  display: 'swap',
});

const jetbrainsMono = JetBrains_Mono({
  subsets: ['latin'],
  variable: '--font-jetbrains-mono',
  display: 'swap',
});

export const metadata: Metadata = {
  title: 'SideQuest — protect the part of your life work keeps eating',
  description:
    'SideQuest reads your calendar load and your recovery signals, turns them into one capacity score, and only books hobby time in windows where you can actually show up.',
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en">
      <body className={`${inter.variable} ${jetbrainsMono.variable} antialiased`}>
        {children}
        {/* SVG filters back the .glass-container / .glass-button classes; they
            must exist exactly once in the tree, so they live at the root. */}
        <GlassFilters />
      </body>
    </html>
  );
}
