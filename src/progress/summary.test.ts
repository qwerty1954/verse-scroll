/// <reference types="node" />
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { chapterKey } from '../esv/books.ts';
import { percentLabel, summarize } from './summary.ts';

test('empty progress', () => {
  const s = summarize(new Set());
  assert.equal(s.chaptersRead, 0);
  assert.equal(s.totalChapters, 1189);
  assert.equal(s.books.length, 66);
  assert.equal(percentLabel(s.share), '0%');
});

test('counts chapters per book and overall', () => {
  const read = new Set([
    chapterKey({ book: 43, chapter: 1 }),
    chapterKey({ book: 43, chapter: 2 }),
    chapterKey({ book: 65, chapter: 1 }), // Jude, a one-chapter book
  ]);
  const s = summarize(read);
  const john = s.books.find((b) => b.book.name === 'John')!;
  const jude = s.books.find((b) => b.book.name === 'Jude')!;
  assert.equal(john.read, 2);
  assert.equal(john.share, 2 / 21);
  assert.equal(jude.share, 1);
  assert.equal(s.chaptersRead, 3);
});

test('ignores keys that are not real chapters', () => {
  const s = summarize(new Set(['43:99', 'junk']));
  assert.equal(s.chaptersRead, 0);
});

test('percent label never rounds a little progress down to 0 or a lot up to 100', () => {
  assert.equal(percentLabel(1 / 1189), '1%');
  assert.equal(percentLabel(1188 / 1189), '99%');
  assert.equal(percentLabel(1), '100%');
  assert.equal(percentLabel(0.5), '50%');
});
