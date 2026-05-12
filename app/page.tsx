'use client';

import { App } from '@/components/App';
import { CommandCenterTweaks } from '@/components/Tweaks';
import { WorkspaceProvider } from '@/components/WorkspaceProvider';

export default function Page() {
  return (
    <WorkspaceProvider>
      <App />
      <CommandCenterTweaks />
    </WorkspaceProvider>
  );
}
