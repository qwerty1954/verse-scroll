/// <reference types="node" />
import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  BOOKS,
  bookVerseTotal,
  chapterVerseCount,
  nextChapter,
  parseVerseId,
  previousChapter,
  verseId,
} from './books.ts';
import { bookLimit } from '../cache/cacheRules.ts';

test('66 books and 1,189 chapters', () => {
  assert.equal(BOOKS.length, 66);
  assert.equal(BOOKS.reduce((sum, b) => sum + b.chapters, 0), 1189);
});

test('every chapter has a verse count', () => {
  for (const book of BOOKS) {
    for (let chapter = 1; chapter <= book.chapters; chapter++) {
      assert.ok(chapterVerseCount({ book: book.number, chapter }) > 0, `${book.name} ${chapter}`);
    }
  }
});

test('ESV-style counts confirmed against the live API in the spike', () => {
  assert.equal(chapterVerseCount({ book: 43, chapter: 3 }), 36); // John 3
  assert.equal(chapterVerseCount({ book: 40, chapter: 5 }), 48); // Matthew 5
  assert.equal(chapterVerseCount({ book: 19, chapter: 23 }), 6); // Psalm 23
});

test('one-chapter books can never be cached whole', () => {
  for (const book of BOOKS.filter((b) => b.chapters === 1)) {
    const verses = chapterVerseCount({ book: book.number, chapter: 1 });
    assert.ok(verses > bookLimit(bookVerseTotal(book.number)), book.name);
  }
});

test('chapter navigation crosses book boundaries and stops at the ends', () => {
  assert.deepEqual(nextChapter({ book: 1, chapter: 50 }), { book: 2, chapter: 1 });
  assert.deepEqual(previousChapter({ book: 2, chapter: 1 }), { book: 1, chapter: 50 });
  assert.equal(previousChapter({ book: 1, chapter: 1 }), null);
  assert.equal(nextChapter({ book: 66, chapter: 22 }), null);
});

test('verse ids round-trip', () => {
  assert.equal(verseId(43, 3, 16), 43003016);
  assert.deepEqual(parseVerseId(43003016), { book: 43, chapter: 3, verse: 16 });
});
