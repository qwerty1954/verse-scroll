// ESV API client. Terms: https://api.esv.org/ — non-commercial use, at most 60 requests a minute,
// at most 500 verses (and never more than half a book) stored on the device.
import { chapterLabel, type ChapterRef } from './books';
import { parsePassageText, type ParsedChapter } from './parse';

const ENDPOINT = 'https://api.esv.org/v3/passage/text/';

// Options from https://api.esv.org/docs/passage-text/
const PARAMS: Record<string, string> = {
  'include-passage-references': 'false',
  'include-verse-numbers': 'true',
  'include-first-verse-numbers': 'true',
  'include-footnotes': 'false',
  'include-footnote-body': 'false',
  'include-headings': 'true',
  'include-short-copyright': 'false',
  'include-copyright': 'false',
  'include-passage-horizontal-lines': 'false',
  'include-heading-horizontal-lines': 'false',
  'include-selahs': 'true',
  'indent-using': 'space',
  'indent-paragraphs': '2',
  'indent-poetry': 'true',
  'indent-poetry-lines': '4',
  'line-length': '0',
};

export interface EsvResponse {
  query: string;
  canonical: string;
  parsed: number[][];
  passages: string[];
  passage_meta?: unknown[];
}

export class EsvError extends Error {
  constructor(
    message: string,
    readonly status: number,
  ) {
    super(message);
  }
}

// Keep at least a second between requests so the app stays far under 60 a minute.
const MIN_GAP_MS = 1000;
let lastRequestAt = 0;
let queue: Promise<unknown> = Promise.resolve();

function throttled<T>(task: () => Promise<T>): Promise<T> {
  const run = queue.then(async () => {
    const wait = lastRequestAt + MIN_GAP_MS - Date.now();
    if (wait > 0) await new Promise((resolve) => setTimeout(resolve, wait));
    lastRequestAt = Date.now();
    return task();
  });
  queue = run.catch(() => undefined);
  return run;
}

export function fetchPassageRaw(query: string, apiKey: string): Promise<EsvResponse> {
  const url = `${ENDPOINT}?${new URLSearchParams({ q: query, ...PARAMS }).toString()}`;
  return throttled(async () => {
    const response = await fetch(url, { headers: { Authorization: `Token ${apiKey}` } });
    if (!response.ok) {
      const message =
        response.status === 401 || response.status === 403
          ? 'The ESV API key was rejected. Check it in Settings.'
          : response.status === 429
            ? 'Too many requests to the ESV API. Wait a minute and try again.'
            : `ESV API error ${response.status}`;
      throw new EsvError(message, response.status);
    }
    return (await response.json()) as EsvResponse;
  });
}

export interface FetchedChapter extends ParsedChapter {
  ref: ChapterRef;
  raw: EsvResponse;
}

export async function fetchChapter(ref: ChapterRef, apiKey: string): Promise<FetchedChapter> {
  const raw = await fetchPassageRaw(chapterLabel(ref), apiKey);
  const parsed = parsePassageText(raw.passages.at(0) ?? '');
  return { ref, raw, ...parsed };
}
