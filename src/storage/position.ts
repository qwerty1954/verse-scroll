// Last card viewed in each mode, stored as a verse id.
import { getDb } from '@/db/database';

export type FeedMode = 'read' | 'random';

export async function loadPosition(mode: FeedMode): Promise<number | null> {
  const db = await getDb();
  const row = await db.getFirstAsync<{ verse_id: number }>('SELECT verse_id FROM position WHERE mode = ?', mode);
  return row?.verse_id ?? null;
}

export async function savePosition(mode: FeedMode, verseId: number): Promise<void> {
  const db = await getDb();
  await db.runAsync(
    'INSERT OR REPLACE INTO position (mode, verse_id, updated_at) VALUES (?, ?, ?)',
    mode,
    verseId,
    Date.now(),
  );
}
