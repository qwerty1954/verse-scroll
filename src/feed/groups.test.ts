/// <reference types="node" />
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { chunkVerses, groupRange, rangeLabel } from './groups.ts';
import { sanitizeSettings, DEFAULT_SETTINGS } from '../settings/values.ts';

const verses = (...numbers: number[]) => numbers.map((number) => ({ number, text: `v${number}` }));

test('one verse per card leaves verses as they are', () => {
  assert.deepEqual(
    chunkVerses(verses(1, 2, 3), 1).map((g) => g.map((v) => v.number)),
    [[1], [2], [3]],
  );
});

test('groups align to verse numbers and the last group can be short', () => {
  assert.deepEqual(
    chunkVerses(verses(1, 2, 3, 4, 5, 6, 7), 3).map((g) => g.map((v) => v.number)),
    [[1, 2, 3], [4, 5, 6], [7]],
  );
});

test('an omitted verse leaves its group one short instead of shifting the rest', () => {
  // Verse 21 is missing, as in Matthew 17 in the ESV.
  assert.deepEqual(
    chunkVerses(verses(19, 20, 22, 23), 2).map((g) => g.map((v) => v.number)),
    [[19, 20], [22], [23]],
  );
});

test('group range for a drawn verse', () => {
  assert.deepEqual(groupRange(5, 3, 36), { start: 4, end: 6 });
  assert.deepEqual(groupRange(35, 5, 36), { start: 31, end: 35 });
  assert.deepEqual(groupRange(36, 5, 36), { start: 36, end: 36 });
});

test('range labels', () => {
  assert.equal(rangeLabel('John', 3, verses(16)), 'John 3:16');
  assert.equal(rangeLabel('John', 3, verses(16, 17, 18)), 'John 3:16–18');
});

test('settings validation keeps good values and replaces bad ones', () => {
  assert.deepEqual(sanitizeSettings(null), DEFAULT_SETTINGS);
  assert.deepEqual(sanitizeSettings({ cardSize: 3, textSize: 'large', theme: 'dark', randomFilter: 'NT' }), {
    cardSize: 3,
    textSize: 'large',
    theme: 'dark',
    randomFilter: 'NT',
  });
  assert.deepEqual(sanitizeSettings({ cardSize: 9, textSize: 'huge', theme: 'blue', randomFilter: 1 }), DEFAULT_SETTINGS);
});
