/// <reference types="node" />
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { buildBackup, parseBackup, parseBackupText, BackupError } from './format.ts';
import { DEFAULT_SETTINGS } from '../settings/values.ts';

const sample = buildBackup(
  {
    readPosition: 43003016,
    chaptersRead: [{ book: 43, chapter: 3, readAt: 1 }],
    seenVerses: [19023001, 45008028],
    settings: { ...DEFAULT_SETTINGS, cardSize: 3, theme: 'dark' },
  },
  new Date('2026-11-10T00:00:00Z'),
);

test('a backup survives a round trip through JSON', () => {
  assert.deepEqual(parseBackup(JSON.parse(JSON.stringify(sample))), sample);
});

test('rejects files that are not Verse Scroll backups', () => {
  assert.throws(() => parseBackup({ hello: 'world' }), BackupError);
  assert.throws(() => parseBackup(null), BackupError);
  assert.throws(() => parseBackup({ ...sample, version: 99 }), BackupError);
});

test('drops chapters and verses that do not exist, keeps the rest', () => {
  const messy = {
    ...sample,
    readPosition: 99001001,
    chaptersRead: [{ book: 43, chapter: 3, readAt: 1 }, { book: 43, chapter: 22 }, { book: 0, chapter: 1 }, 'junk'],
    seenVerses: [19023001, 19023001, 'x', 67001001, 1.5],
    settings: { cardSize: 12 },
  };
  const parsed = parseBackup(messy);
  assert.equal(parsed.readPosition, null);
  assert.deepEqual(parsed.chaptersRead, [{ book: 43, chapter: 3, readAt: 1 }]);
  assert.deepEqual(parsed.seenVerses, [19023001]);
  assert.deepEqual(parsed.settings, DEFAULT_SETTINGS);
});

test('reads backup text with a byte-order mark and surrounding whitespace', () => {
  const text = '\uFEFF\n  ' + JSON.stringify(sample) + '\n';
  assert.deepEqual(parseBackupText(text), sample);
});

test('explains what is wrong with text that is not a backup', () => {
  assert.throws(() => parseBackupText(''), /empty/);
  assert.throws(() => parseBackupText('<html>Sign in'), /starts with "<html>Sign in"/);
});
