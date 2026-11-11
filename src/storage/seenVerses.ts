// Verses already shown in Random mode, stored as verse ids only.
import { getDb } from '@/db/database';

type Listener = () => void;
const resetListeners = new Set<Listener>();

/** Lets the Random feed start over when its history is reset from another screen. */
export function onSeenReset(listener: Listener): () => void {
  resetListeners.add(listener);
  return () => {
    resetListeners.delete(listener);
  };
}

export async function loadSeen(): Promise<Set<number>> {
  const db = await getDb();
  const rows = await db.getAllAsync<{ verse_id: number }>('SELECT verse_id FROM seen_verses');
  return new Set(rows.map((r) => r.verse_id));
}

export async function markSeen(verseId: number): Promise<void> {
  const db = await getDb();
  await db.runAsync('INSERT OR IGNORE INTO seen_verses (verse_id, seen_at) VALUES (?, ?)', verseId, Date.now());
}

export async function seenCount(): Promise<number> {
  const db = await getDb();
  const row = await db.getFirstAsync<{ n: number }>('SELECT COUNT(*) AS n FROM seen_verses');
  return row?.n ?? 0;
}

/** Tells the Random feed and Progress to reload, e.g. after a backup import. */
export function notifySeenChanged() {
  resetListeners.forEach((l) => l());
}

export async function clearSeen(): Promise<void> {
  const db = await getDb();
  await db.runAsync('DELETE FROM seen_verses');
  notifySeenChanged();
}
