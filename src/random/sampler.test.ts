/// <reference types="node" />
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { RECENT_CHAPTERS, Sampler, seededRandom, type WeightTable } from './sampler.ts';
import { WEIGHTS } from '../data/weights.ts';

// A tiny Bible: book 1 (OT) with two chapters, book 40 (NT) with one.
function tinyTable(): WeightTable {
  const table: WeightTable = Array.from({ length: 66 }, () => []);
  table[0] = [
    [1, 1, 1],
    [1, 1],
  ];
  table[39] = [[1, 1, 1, 1]];
  return table;
}

test('never repeats a verse and stops when the pool is empty', () => {
  const sampler = new Sampler(tinyTable(), 'all', new Set());
  const random = seededRandom(1);
  const drawn: number[] = [];
  for (let i = 0; i < 20; i++) {
    const id = sampler.draw(random);
    if (id === null) break;
    drawn.push(id);
  }
  assert.equal(drawn.length, 9);
  assert.equal(new Set(drawn).size, 9);
  assert.equal(sampler.draw(random), null);
});

test('skips verses already seen', () => {
  const seen = new Set([1001001, 1001002, 1001003, 1002001, 1002002]);
  const sampler = new Sampler(tinyTable(), 'all', seen);
  const random = seededRandom(2);
  const drawn = [1, 2, 3, 4].map(() => sampler.draw(random));
  assert.deepEqual([...drawn].sort(), [40001001, 40001002, 40001003, 40001004]);
  assert.equal(sampler.draw(random), null);
});

test('the filter limits draws to one testament', () => {
  const sampler = new Sampler(tinyTable(), 'NT', new Set());
  const random = seededRandom(3);
  for (let i = 0; i < 4; i++) {
    const id = sampler.draw(random);
    assert.ok(id !== null && Math.floor(id / 1_000_000) === 40);
  }
  assert.equal(sampler.draw(random), null);
  sampler.setFilter('OT');
  assert.equal(Math.floor((sampler.draw(random) ?? 0) / 1_000_000), 1);
});

test('avoids repeating a chapter from the last few cards while others remain', () => {
  const sampler = new Sampler(WEIGHTS, 'all', new Set());
  const random = seededRandom(4);
  const chapters: number[] = [];
  for (let i = 0; i < 300; i++) chapters.push(Math.floor((sampler.draw(random) ?? 0) / 1000));
  chapters.forEach((ch, i) => {
    const window = chapters.slice(Math.max(0, i - RECENT_CHAPTERS), i);
    assert.ok(!window.includes(ch), `chapter ${ch} repeated at card ${i}`);
  });
});

test('heavier verses come up more often', () => {
  const table: WeightTable = Array.from({ length: 66 }, () => []);
  // Chapter 1: one heavy verse; chapters 2 to 11: one light verse each (so the recent-chapter
  // rule doesn't interfere). Each run draws once from a fresh sampler.
  table[0] = [[10], ...Array.from({ length: 10 }, () => [1])];
  const random = seededRandom(5);
  let heavy = 0;
  for (let i = 0; i < 2000; i++) {
    if (new Sampler(table, 'all', new Set()).draw(random) === 1001001) heavy++;
  }
  // Expected share 10 / 20 = 50%.
  assert.ok(heavy > 850 && heavy < 1150, `heavy drawn ${heavy} times`);
});

test('the real weight table covers all 31,103 verse numbers with positive weights', () => {
  const flat = WEIGHTS.flat(2);
  assert.equal(flat.length, 31103);
  assert.ok(flat.every((w) => w >= 10));
});
