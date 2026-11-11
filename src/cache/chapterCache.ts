// Chapter cache in SQLite, kept within the ESV API storage terms by cacheRules.ts.
import { getDb } from '@/db/database';
import { bookVerseTotal, type ChapterRef } from '@/esv/books';
import type { ParsedHeading, ParsedVerse } from '@/esv/parse';
import { planCacheWrite, type CachedChapterMeta } from './cacheRules';

export interface CachedChapter {
  ref: ChapterRef;
  verses: ParsedVerse[];
  headings: ParsedHeading[];
}

interface Row {
  verses_json: string;
  headings_json: string;
}

/** Returns the cached chapter, or null, and marks it as just viewed. */
export async function readCachedChapter(ref: ChapterRef): Promise<CachedChapter | null> {
  const db = await getDb();
  const row = await db.getFirstAsync<Row>(
    'SELECT verses_json, headings_json FROM chapter_cache WHERE book = ? AND chapter = ?',
    ref.book,
    ref.chapter,
  );
  if (!row) return null;
  await db.runAsync(
    'UPDATE chapter_cache SET last_viewed_at = ? WHERE book = ? AND chapter = ?',
    Date.now(),
    ref.book,
    ref.chapter,
  );
  return { ref, verses: JSON.parse(row.verses_json), headings: JSON.parse(row.headings_json) };
}

/** Stores a chapter if the rules allow it, evicting older chapters to make room. */
export async function writeCachedChapter(chapter: CachedChapter): Promise<void> {
  const db = await getDb();
  const existing = await db.getAllAsync<{
    book: number;
    chapter: number;
    verse_count: number;
    last_viewed_at: number;
  }>('SELECT book, chapter, verse_count, last_viewed_at FROM chapter_cache');

  const metas: CachedChapterMeta[] = existing.map((r) => ({
    book: r.book,
    chapter: r.chapter,
    verseCount: r.verse_count,
    lastViewedAt: r.last_viewed_at,
  }));
  const plan = planCacheWrite(
    metas,
    { book: chapter.ref.book, chapter: chapter.ref.chapter, verseCount: chapter.verses.length },
    bookVerseTotal,
  );
  if (!plan.store) return;

  const now = Date.now();
  await db.withExclusiveTransactionAsync(async (txn) => {
    for (const e of plan.evict) {
      await txn.runAsync('DELETE FROM chapter_cache WHERE book = ? AND chapter = ?', e.book, e.chapter);
    }
    await txn.runAsync(
      `INSERT OR REPLACE INTO chapter_cache
         (book, chapter, verse_count, verses_json, headings_json, fetched_at, last_viewed_at)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
      chapter.ref.book,
      chapter.ref.chapter,
      chapter.verses.length,
      JSON.stringify(chapter.verses),
      JSON.stringify(chapter.headings),
      now,
      now,
    );
  });
}

/** Verses currently cached, for the Settings screen and debugging. */
export async function cachedVerseTotal(): Promise<number> {
  const db = await getDb();
  const row = await db.getFirstAsync<{ total: number | null }>('SELECT SUM(verse_count) AS total FROM chapter_cache');
  return row?.total ?? 0;
}

export async function clearChapterCache(): Promise<void> {
  const db = await getDb();
  await db.runAsync('DELETE FROM chapter_cache');
}
