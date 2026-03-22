import type { ReactNode } from 'react';

import { ExecutorShell } from './executor-shell';

export default function ExecutorLayout({ children }: { children: ReactNode }) {
  return <ExecutorShell>{children}</ExecutorShell>;
}
