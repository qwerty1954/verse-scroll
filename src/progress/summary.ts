// Reading progress worked out from the set of chapters read. Pure, so it can be unit-tested.
import { BOOKS, chapterKey, type Book, type ChapterRef } from '../esv/books.ts';

export interface BookProgress {
  book: Book;
  read: number;
  /** 0 to 1. */
  share: number;
}

export interface ProgressSummary {
  books: BookProgress[];
  chaptersRead: number;
  totalChapters: number;
  /** 0 to 1. */
  share: number;
}

export function summarize(read: ReadonlySet<string>): ProgressSummary {
  let chaptersRead = 0;
  let totalChapters = 0;
  const books = BOOKS.map((book) => {
    let count = 0;
    for (let chapter = 1; chapter <= book.chapters; chapter++) {
      if (read.has(chapterKey({ book: book.number, chapter }))) count++;
    }
    chaptersRead += count;
    totalChapters += book.chapters;
    return { book, read: count, share: count / book.chapters };
  });
  return { books, chaptersRead, totalChapters, share: chaptersRead / totalChapters };
}

/** Whole-number percentage that only shows 100 when everything is read, and 0 only when nothing is. */
export function percentLabel(share: number): string {
  if (share <= 0) return '0%';
  if (share >= 1) return '100%';
  return `${Math.min(99, Math.max(1, Math.round(share * 100)))}%`;
}

export function isRead(read: ReadonlySet<string>, ref: ChapterRef): boolean {
  return read.has(chapterKey(ref));
}
