// Text for one Random card: a verse, or a group of verses from one chapter. Uses the chapter
// cache when the chapter happens to be stored, otherwise asks the ESV API for just those
// verses. Random verses aren't stored.
import { readCachedChapter } from '@/cache/chapterCache';
import { verseId, type ChapterRef } from '@/esv/books';
import { OfflineError } from '@/esv/chapterSource';
import { EsvError, fetchPassageRaw } from '@/esv/client';
import { parsePassageText, type ParsedVerse } from '@/esv/parse';

/**
 * Verses start..end of a chapter. Verses the ESV omits (e.g. Matthew 17:21) are simply absent,
 * so the result can be empty.
 */
export async function loadVerses(ref: ChapterRef, start: number, end: number, apiKey: string): Promise<ParsedVerse[]> {
  const inRange = (v: ParsedVerse) => v.number >= start && v.number <= end;
  try {
    const cached = await readCachedChapter(ref);
    if (cached) return cached.verses.filter(inRange);
  } catch (e) {
    console.warn('Chapter cache read failed', e);
  }

  const first = verseId(ref.book, ref.chapter, start);
  const last = verseId(ref.book, ref.chapter, end);
  let raw;
  try {
    raw = await fetchPassageRaw(first === last ? String(first) : `${first}-${last}`, apiKey);
  } catch (e) {
    if (e instanceof EsvError) throw e;
    throw new OfflineError();
  }
  return parsePassageText(raw.passages.at(0) ?? '').verses.filter(inRange);
}
