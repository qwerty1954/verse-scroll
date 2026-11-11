// Gets a chapter from the cache when it's there, otherwise from the ESV API, caching the result.
import { readCachedChapter, writeCachedChapter, type CachedChapter } from '@/cache/chapterCache';
import type { ChapterRef } from './books';
import { EsvError, fetchChapter } from './client';

export type LoadedChapter = CachedChapter;

export class OfflineError extends Error {
  constructor() {
    super("You're offline. Chapters you've read recently still work.");
  }
}

export async function loadChapter(ref: ChapterRef, apiKey: string): Promise<LoadedChapter> {
  try {
    const cached = await readCachedChapter(ref);
    if (cached) return cached;
  } catch (e) {
    // A broken cache shouldn't stop reading; fall through to the network.
    console.warn('Chapter cache read failed', e);
  }

  let fetched;
  try {
    fetched = await fetchChapter(ref, apiKey);
  } catch (e) {
    if (e instanceof EsvError) throw e;
    // fetch() rejects with a TypeError when there's no connection.
    throw new OfflineError();
  }

  const chapter: LoadedChapter = { ref, verses: fetched.verses, headings: fetched.headings };
  writeCachedChapter(chapter).catch((e) => console.warn('Chapter cache write failed', e));
  return chapter;
}
