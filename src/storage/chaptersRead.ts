// Which chapters have been read, stored as references only.
import { getDb } from '@/db/database';
import { chapterKey, type ChapterRef } from '@/esv/books';

type Listener = () => void;
const listeners = new Set<Listener>();

/** Lets screens refresh when a chapter is marked or unmarked anywhere in the app. */
export function subscribeToReadChanges(listener: Listener): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

/** Tells screens that chapters read changed, e.g. after a backup import. */
export function notifyReadChanged() {
  listeners.forEach((l) => l());
}

export async function loadReadSet(): Promise<Set<string>> {
  const db = await getDb();
  const rows = await db.getAllAsync<{ book: number; chapter: number }>('SELECT book, chapter FROM chapters_read');
  return new Set(rows.map((r) => chapterKey(r)));
}

export async function setChapterRead(ref: ChapterRef, read: boolean): Promise<void> {
  const db = await getDb();
  if (read) {
    await db.runAsync(
      'INSERT OR IGNORE INTO chapters_read (book, chapter, read_at) VALUES (?, ?, ?)',
      ref.book,
      ref.chapter,
      Date.now(),
    );
  } else {
    await db.runAsync('DELETE FROM chapters_read WHERE book = ? AND chapter = ?', ref.book, ref.chapter);
  }
  notifyReadChanged();
}
