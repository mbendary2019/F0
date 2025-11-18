'use client';
import { useEffect, useMemo, useState } from 'react';
import type { PeerPresence } from '@/lib/collab/types';

export function useLiveCursors(awareness: any, selfId: string) {
  const [peers, setPeers] = useState<PeerPresence[]>([]);

  useEffect(() => {
    if (!awareness) return;

    const onChange = () => {
      const states = Array.from(awareness.getStates().entries());
      const mapped: PeerPresence[] = states
        .filter(([clientId, _]) => String(clientId) !== selfId)
        .map(([_, s]) => s as PeerPresence);
      setPeers(mapped);
    };

    awareness.on('change', onChange);
    onChange();

    return () => awareness.off('change', onChange);
  }, [awareness, selfId]);

  return useMemo(() => ({ peers }), [peers]);
}
