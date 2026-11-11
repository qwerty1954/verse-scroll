// The 66 books in canonical order with their chapter and verse counts.
import { VERSE_COUNTS } from '../data/verseCounts.ts';

export type Testament = 'OT' | 'NT';

export interface Book {
  /** 1-based position, matching the first two digits of ESV verse ids (Genesis = 1, John = 43). */
  number: number;
  name: string;
  chapters: number;
  testament: Testament;
}

const OT: [string, number][] = [
  ['Genesis', 50], ['Exodus', 40], ['Leviticus', 27], ['Numbers', 36], ['Deuteronomy', 34],
  ['Joshua', 24], ['Judges', 21], ['Ruth', 4], ['1 Samuel', 31], ['2 Samuel', 24],
  ['1 Kings', 22], ['2 Kings', 25], ['1 Chronicles', 29], ['2 Chronicles', 36], ['Ezra', 10],
  ['Nehemiah', 13], ['Esther', 10], ['Job', 42], ['Psalms', 150], ['Proverbs', 31],
  ['Ecclesiastes', 12], ['Song of Solomon', 8], ['Isaiah', 66], ['Jeremiah', 52], ['Lamentations', 5],
  ['Ezekiel', 48], ['Daniel', 12], ['Hosea', 14], ['Joel', 3], ['Amos', 9],
  ['Obadiah', 1], ['Jonah', 4], ['Micah', 7], ['Nahum', 3], ['Habakkuk', 3],
  ['Zephaniah', 3], ['Haggai', 2], ['Zechariah', 14], ['Malachi', 4],
];

const NT: [string, number][] = [
  ['Matthew', 28], ['Mark', 16], ['Luke', 24], ['John', 21], ['Acts', 28],
  ['Romans', 16], ['1 Corinthians', 16], ['2 Corinthians', 13], ['Galatians', 6], ['Ephesians', 6],
  ['Philippians', 4], ['Colossians', 4], ['1 Thessalonians', 5], ['2 Thessalonians', 3], ['1 Timothy', 6],
  ['2 Timothy', 4], ['Titus', 3], ['Philemon', 1], ['Hebrews', 13], ['James', 5],
  ['1 Peter', 5], ['2 Peter', 3], ['1 John', 5], ['2 John', 1], ['3 John', 1],
  ['Jude', 1], ['Revelation', 22],
];

export const BOOKS: Book[] = [
  ...OT.map(([name, chapters], i) => ({ number: i + 1, name, chapters, testament: 'OT' as const })),
  ...NT.map(([name, chapters], i) => ({ number: i + 40, name, chapters, testament: 'NT' as const })),
];

export function getBook(number: number): Book {
  const book = BOOKS.at(number - 1);
  if (!book) throw new Error(`No book ${number}`);
  return book;
}

/** A chapter location, e.g. { book: 43, chapter: 3 } for John 3. */
export interface ChapterRef {
  book: number;
  chapter: number;
}

export function chapterKey(ref: ChapterRef): string {
  return `${ref.book}:${ref.chapter}`;
}

export function chapterLabel(ref: ChapterRef): string {
  return `${getBook(ref.book).name} ${ref.chapter}`;
}

/** The chapter after this one, crossing into the next book; null after Revelation 22. */
export function nextChapter(ref: ChapterRef): ChapterRef | null {
  if (ref.chapter < getBook(ref.book).chapters) return { book: ref.book, chapter: ref.chapter + 1 };
  if (ref.book < BOOKS.length) return { book: ref.book + 1, chapter: 1 };
  return null;
}

/** The chapter before this one, crossing into the previous book; null before Genesis 1. */
export function previousChapter(ref: ChapterRef): ChapterRef | null {
  if (ref.chapter > 1) return { book: ref.book, chapter: ref.chapter - 1 };
  if (ref.book > 1) return { book: ref.book - 1, chapter: getBook(ref.book - 1).chapters };
  return null;
}

/** Verse id in the ESV API's scheme: BBCCCVVV, e.g. John 3:16 = 43003016. */
export function verseId(book: number, chapter: number, verse: number): number {
  return book * 1_000_000 + chapter * 1_000 + verse;
}

export function parseVerseId(id: number): { book: number; chapter: number; verse: number } {
  return { book: Math.floor(id / 1_000_000), chapter: Math.floor(id / 1_000) % 1_000, verse: id % 1_000 };
}

/** Highest verse number in a chapter (ESV-style versification). */
export function chapterVerseCount(ref: ChapterRef): number {
  const count = VERSE_COUNTS.at(ref.book - 1)?.at(ref.chapter - 1);
  if (count === undefined) throw new Error(`No chapter ${ref.book}:${ref.chapter}`);
  return count;
}

/** Highest verse numbers summed over a book's chapters. */
export function bookVerseTotal(book: number): number {
  const chapters = VERSE_COUNTS.at(book - 1);
  if (!chapters) throw new Error(`No book ${book}`);
  return chapters.reduce((sum, n) => sum + n, 0);
}
