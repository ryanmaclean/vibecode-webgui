'use client';

import { useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { SettingsPanel } from '@/components/settings/SettingsPanel';
import type { AppSettings } from '@/types/settings';

export default function SettingsPage() {
  const router = useRouter();

  const handleSave = useCallback((settings: AppSettings) => {
    console.log('Settings saved:', settings.lastModified);
  }, []);

  const handleClose = useCallback(() => {
    router.back();
  }, [router]);

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-950">
      <div className="max-w-screen-2xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
        <div className="flex justify-center">
          <SettingsPanel
            onSave={handleSave}
            onClose={handleClose}
          />
        </div>
      </div>
    </div>
  );
}
