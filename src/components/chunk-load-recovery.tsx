'use client';

import { useEffect } from 'react';

const RECOVERY_KEY = 'apex:chunk-recovery-attempted';

export function ChunkLoadRecovery() {
  useEffect(() => {
    const handleChunkError = (event: ErrorEvent) => {
      const error = event.error as { name?: string; message?: string } | undefined;
      const message = `${error?.name ?? ''} ${error?.message ?? ''} ${event.message ?? ''}`;

      if (!/ChunkLoadError|Loading chunk|dynamically imported module/i.test(message)) {
        return;
      }

      if (window.sessionStorage.getItem(RECOVERY_KEY) === '1') {
        return;
      }

      window.sessionStorage.setItem(RECOVERY_KEY, '1');
      const url = new URL(window.location.href);
      url.searchParams.set('_chunk_refresh', Date.now().toString());
      window.location.replace(url.toString());
    };

    window.addEventListener('error', handleChunkError);
    return () => window.removeEventListener('error', handleChunkError);
  }, []);

  return null;
}
