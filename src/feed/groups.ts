// Groups a chapter's verses into cards of up to N verses. Groups are aligned to verse numbers
// (with 3 per card: 1-3, 4-6, ...), so Read and Random agree on which verses share a card,
// and a verse the ESV omits simply leaves its group one verse short.

export interface NumberedVerse {
  number: number;
  text: string;
}

export function groupStart(verse: number, size: number): number {
  return Math.floor((verse - 1) / size) * size + 1;
}

/** First and last verse numbers of the group holding this verse. */
export function groupRange(verse: number, size: number, chapterVerses: number): { start: number; end: number } {
  const start = groupStart(verse, size);
  return { start, end: Math.min(start + size - 1, chapterVerses) };
}

export function chunkVerses<T extends NumberedVerse>(verses: T[], size: number): T[][] {
  const groups: T[][] = [];
  let currentStart = -1;
  for (const verse of verses) {
    const start = groupStart(verse.number, size);
    if (start !== currentStart) {
      groups.push([]);
      currentStart = start;
    }
    groups[groups.length - 1].push(verse);
  }
  return groups;
}

/** "John 3:16", or "John 3:16–18" for a group. */
export function rangeLabel(bookName: string, chapter: number, verses: NumberedVerse[]): string {
  const first = verses[0].number;
  const last = verses[verses.length - 1].number;
  return first === last ? `${bookName} ${chapter}:${first}` : `${bookName} ${chapter}:${first}–${last}`;
}
