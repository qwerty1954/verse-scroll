/// <reference types="node" />
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { MAX_CACHED_VERSES, planCacheWrite, type CachedChapterMeta } from './cacheRules.ts';

// Book 1 has 1,000 verses (limit 450), book 2 has 100 (limit 45), book 3 has 20 (limit 9).
const totals: Record<number, number> = { 1: 1000, 2: 100, 3: 20 };
const bookTotal = (book: number) => totals[book];

const meta = (book: number, chapter: number, verseCount: number, lastViewedAt: number): CachedChapterMeta => ({
  book,
  chapter,
  verseCount,
  lastViewedAt,
});

test('stores into an empty cache', () => {
  assert.deepEqual(planCacheWrite([], { book: 1, chapter: 1, verseCount: 30 }, bookTotal), {
    store: true,
    evict: [],
  });
});

test('refuses a chapter larger than its book share, such as a one-chapter book', () => {
  assert.deepEqual(planCacheWrite([], { book: 3, chapter: 1, verseCount: 20 }, bookTotal), {
    store: false,
    evict: [],
  });
});

test('evicts the oldest chapters of the same book to stay under the book share', () => {
  const existing = [meta(2, 1, 20, 100), meta(2, 2, 20, 200), meta(1, 1, 30, 50)];
  const plan = planCacheWrite(existing, { book: 2, chapter: 3, verseCount: 10 }, bookTotal);
  // Book 2 holds 40; adding 10 would make 50 > 45, so its oldest chapter goes. Book 1 is untouched.
  assert.deepEqual(plan, { store: true, evict: [{ book: 2, chapter: 1 }] });
});

test('evicts the least recently viewed chapters overall to stay under the total', () => {
  const existing = [meta(1, 1, 200, 300), meta(1, 2, 200, 100)];
  const plan = planCacheWrite(existing, { book: 2, chapter: 1, verseCount: 40 }, bookTotal);
  // 400 + 40 = 440 fits under 450.
  assert.deepEqual(plan, { store: true, evict: [] });

  const fuller = [...existing, meta(2, 2, 40, 200)];
  const plan2 = planCacheWrite(fuller, { book: 1, chapter: 3, verseCount: 30 }, bookTotal);
  // Book 1 would reach 430 <= 450, but the total 470 > 450: the oldest chapter (1:2) goes.
  assert.deepEqual(plan2, { store: true, evict: [{ book: 1, chapter: 2 }] });
});

test('re-storing a cached chapter replaces it instead of counting it twice', () => {
  const existing = [meta(2, 1, 40, 100)];
  const plan = planCacheWrite(existing, { book: 2, chapter: 1, verseCount: 40 }, bookTotal);
  assert.deepEqual(plan, { store: true, evict: [] });
});

test('never plans more than the total limit', () => {
  const existing = Array.from({ length: 30 }, (_, i) => meta(1, i + 1, 15, i));
  const plan = planCacheWrite(existing, { book: 1, chapter: 40, verseCount: 25 }, bookTotal);
  const evicted = new Set(plan.evict.map((e) => e.chapter));
  const kept = existing.filter((c) => !evicted.has(c.chapter)).reduce((s, c) => s + c.verseCount, 0);
  assert.ok(kept + 25 <= MAX_CACHED_VERSES);
  // Oldest go first.
  assert.deepEqual([...evicted].sort((a, b) => a - b), [1, 2]);
});
