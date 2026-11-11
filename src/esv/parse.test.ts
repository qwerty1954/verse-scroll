/// <reference types="node" />
// Run with: npm test
// Uses placeholder text shaped like the ESV API's plain-text output, not real Scripture.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { parsePassageText } from './parse.ts';

test('single verse, as in the API docs example shape', () => {
  const result = parsePassageText('\n  [35] Alpha beta. (ESV)');
  assert.deepEqual(result.verses, [{ number: 35, text: 'Alpha beta.' }]);
  assert.deepEqual(result.headings, []);
});

test('prose paragraphs with a heading in the middle', () => {
  const raw = [
    'First Heading',
    '',
    '  [1] One one one. [2] Two two',
    '  two.',
    '',
    'Second Heading',
    '',
    '  [3] Three three. [4] Four.',
  ].join('\n');

  const result = parsePassageText(raw);
  assert.deepEqual(result.verses.map((v) => v.number), [1, 2, 3, 4]);
  assert.equal(result.verses[1].text, 'Two two two.');
  assert.deepEqual(result.headings, [
    { text: 'First Heading', beforeVerse: 1 },
    { text: 'Second Heading', beforeVerse: 3 },
  ]);
  // Headings never leak into verse text.
  assert.ok(!result.verses.some((v) => v.text.includes('Heading')));
});

test('poetry keeps its line breaks', () => {
  const raw = [
    '    [1] Line one of verse one,',
    '        line two of verse one.',
    '    [2] Verse two.',
  ].join('\n');

  const result = parsePassageText(raw);
  assert.equal(result.verses[0].text, 'Line one of verse one,\nline two of verse one.');
  assert.equal(result.verses[1].text, 'Verse two.');
});

test('a psalm superscription is a second heading line before verse 1', () => {
  const raw = ['Section Title', '', 'A Song of Someone.', '', '    [1] Line one,', '        line two.'].join('\n');
  const result = parsePassageText(raw);
  assert.deepEqual(result.headings, [
    { text: 'Section Title', beforeVerse: 1 },
    { text: 'A Song of Someone.', beforeVerse: 1 },
  ]);
  assert.equal(result.verses[0].text, 'Line one,\nline two.');
});

test('poetry with extra spaces after the verse number and space-only blank lines', () => {
  const raw = ['    [1]   Line one,', '        line two.', '      ', '    [2]   Line three.'].join('\n');
  const result = parsePassageText(raw);
  assert.deepEqual(result.verses, [
    { number: 1, text: 'Line one,\nline two.' },
    { number: 2, text: 'Line three.' },
  ]);
});
