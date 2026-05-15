'use client';

import { App } from '@/components/App';
import { CommandCenterTweaks } from '@/components/Tweaks';
import { WorkspaceProvider } from '@/components/WorkspaceProvider';
import { AppErrorBoundary } from '@/components/AppErrorBoundary';

export default function Page() {
  return (
    <AppErrorBoundary>
      <WorkspaceProvider>
        <App />
        <CommandCenterTweaks />
      </WorkspaceProvider>
    </AppErrorBoundary>
  );
}
