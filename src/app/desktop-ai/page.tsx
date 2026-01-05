import { DesktopAIPanel } from '@/components/ai/DesktopAIPanel';
import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Desktop AI Panel',
  description: 'Interact with the VibeCode desktop runtime via the new AI panel.',
};

export default function DesktopAIDemoPage() {
  return (
    <main className="mx-auto flex min-h-screen w-full max-w-5xl flex-col gap-6 px-4 py-12 text-slate-100">
      <header className="space-y-3">
        <p className="text-xs uppercase tracking-[0.3em] text-emerald-400">Desktop Preview</p>
        <h1 className="text-3xl font-semibold text-white">VibeCode Desktop AI Panel</h1>
        <p className="text-sm text-slate-400">
          This page renders the DesktopAIPanel so we can validate the new Tauri IPC hook in a real Next.js route.
          When the app runs outside the desktop runtime you will see a graceful fallback.
        </p>
      </header>
      <DesktopAIPanel placeholder="Ask VibeCode to run a command or describe your workspace" />
    </main>
  );
}
