// Splits the ESV API's plain-text passage into verses.
//
// Assumed input shape (from https://api.esv.org/docs/passage-text/), requested with
// passage references, footnotes and copyright turned off and headings on:
//   - Section headings sit on their own line with no indentation.
//   - Paragraphs start with an indent and contain "[n]" verse markers.
//   - Poetry lines are indented further and may carry no marker.
// The spike's "Raw response" screen exists to confirm these assumptions against real chapters.

export interface ParsedVerse {
  /** Verse number within the chapter. */
  number: number;
  /** Verse text; poetry line breaks are kept as "\n". */
  text: string;
}

export interface ParsedHeading {
  text: string;
  /** The verse this heading sits directly above. */
  beforeVerse: number;
}

export interface ParsedChapter {
  verses: ParsedVerse[];
  headings: ParsedHeading[];
}

const VERSE_MARKER = /\[(\d+)\]/g;
const POETRY_INDENT = 4;

function indentOf(line: string): number {
  const match = line.match(/^[ \t]*/);
  return match ? match[0].replace(/\t/g, '    ').length : 0;
}

export function parsePassageText(raw: string): ParsedChapter {
  const text = raw.replace(/\(ESV\)\s*$/, '').replace(/\r\n/g, '\n');

  const headings: ParsedHeading[] = [];
  let pendingHeadings: string[] = [];
  // Body text with verse markers, headings removed. Poetry lines keep a "\n" before them.
  let body = '';

  for (const line of text.split('\n')) {
    const trimmed = line.trim();
    if (trimmed === '') continue;

    const indent = indentOf(line);
    const hasMarker = /\[\d+\]/.test(trimmed);

    if (indent === 0 && !hasMarker) {
      pendingHeadings.push(trimmed);
      continue;
    }

    if (pendingHeadings.length > 0) {
      // A heading belongs to the first verse marker that follows it.
      const firstMarker = trimmed.match(/\[(\d+)\]/);
      if (firstMarker) {
        for (const h of pendingHeadings) {
          headings.push({ text: h, beforeVerse: Number(firstMarker[1]) });
        }
        pendingHeadings = [];
      }
    }

    const isPoetry = indent >= POETRY_INDENT;
    const separator = body === '' ? '' : isPoetry ? '\n' : ' ';
    body += separator + trimmed;
  }

  const verses: ParsedVerse[] = [];
  const markers = [...body.matchAll(VERSE_MARKER)];
  markers.forEach((match, i) => {
    const start = (match.index ?? 0) + match[0].length;
    const end = i + 1 < markers.length ? markers[i + 1].index ?? body.length : body.length;
    const verseText = body
      .slice(start, end)
      .split('\n')
      .map((part) => part.replace(/\s+/g, ' ').trim())
      .filter((part) => part !== '')
      .join('\n');
    verses.push({ number: Number(match[1]), text: verseText });
  });

  return { verses, headings };
}
