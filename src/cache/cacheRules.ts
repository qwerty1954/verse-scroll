// Decides what the chapter cache may keep, under the ESV API terms (https://api.esv.org/):
// no more than 500 verses stored, and never more than half of any book.
//
// Pure logic with no storage, so it can be unit-tested. chapterCache.ts applies the plan.

/** Total verses the cache may hold. 50 under the API limit of 500, for headroom. */
export const MAX_CACHED_VERSES = 450;

/**
 * Share of a book the cache may hold. The API allows half; 45% leaves a margin because book
 * totals come from verse numbering, which counts a few verses the ESV omits.
 */
export const MAX_BOOK_SHARE = 0.45;

export interface CachedChapterMeta {
  book: number;
  chapter: number;
  /** Verses actually stored for this chapter. */
  verseCount: number;
  /** Epoch ms of the last time this chapter was read from the cache or stored. */
  lastViewedAt: number;
}

export interface IncomingChapter {
  book: number;
  chapter: number;
  verseCount: number;
}

export interface CachePlan {
  /** False when this chapter can never be cached, e.g. a one-chapter book. */
  store: boolean;
  /** Chapters to delete before storing, oldest first. */
  evict: { book: number; chapter: number }[];
}

export function bookLimit(bookTotal: number): number {
  return Math.floor(bookTotal * MAX_BOOK_SHARE);
}

export function planCacheWrite(
  existing: CachedChapterMeta[],
  incoming: IncomingChapter,
  bookTotal: (book: number) => number,
): CachePlan {
  const limitForBook = bookLimit(bookTotal(incoming.book));
  if (incoming.verseCount > limitForBook || incoming.verseCount > MAX_CACHED_VERSES) {
    return { store: false, evict: [] };
  }

  // Storing a chapter that's already cached replaces it, so leave its old row out of the totals.
  const isSame = (c: { book: number; chapter: number }) =>
    c.book === incoming.book && c.chapter === incoming.chapter;
  const remaining = existing.filter((c) => !isSame(c)).sort((a, b) => a.lastViewedAt - b.lastViewedAt);
  const evict: CachePlan['evict'] = [];

  const total = () => remaining.reduce((sum, c) => sum + c.verseCount, 0);
  const sameBook = () =>
    remaining.filter((c) => c.book === incoming.book).reduce((sum, c) => sum + c.verseCount, 0);

  const drop = (index: number) => {
    const [removed] = remaining.splice(index, 1);
    evict.push({ book: removed.book, chapter: removed.chapter });
  };

  // First make room within the book, dropping that book's least recently viewed chapters.
  while (sameBook() + incoming.verseCount > limitForBook) {
    drop(remaining.findIndex((c) => c.book === incoming.book));
  }
  // Then make room overall, dropping the least recently viewed chapters of any book.
  while (total() + incoming.verseCount > MAX_CACHED_VERSES) {
    drop(0);
  }

  return { store: true, evict };
}
