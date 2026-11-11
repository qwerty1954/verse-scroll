import { useEffect, useState } from 'react';

import { loadReadSet, subscribeToReadChanges } from '@/storage/chaptersRead';

/** The set of chapter keys read ("43:3"), kept current as chapters are marked anywhere in the app. */
export function useReadSet(): Set<string> | null {
  const [read, setRead] = useState<Set<string> | null>(null);

  useEffect(() => {
    let cancelled = false;
    const refresh = () => {
      loadReadSet()
        .then((set) => !cancelled && setRead(set))
        .catch((e) => console.warn('Loading chapters read failed', e));
    };
    refresh();
    const unsubscribe = subscribeToReadChanges(refresh);
    return () => {
      cancelled = true;
      unsubscribe();
    };
  }, []);

  return read;
}
