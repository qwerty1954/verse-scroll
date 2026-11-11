// Backup file format: reading progress, Random history, position and settings.
// References and settings only, never ESV text. Pure, so it can be unit-tested.
import { BOOKS, parseVerseId } from '../esv/books.ts';
import { sanitizeSettings, type Settings } from '../settings/values.ts';

export const BACKUP_APP = 'verse-scroll';
export const BACKUP_VERSION = 1;

export interface Backup {
  app: typeof BACKUP_APP;
  version: number;
  exportedAt: string;
  /** Last verse viewed in the Read tab, as a verse id. */
  readPosition: number | null;
  chaptersRead: { book: number; chapter: number; readAt: number }[];
  seenVerses: number[];
  settings: Settings;
}

function isRealChapter(book: number, chapter: number): boolean {
  const b = BOOKS.at(book - 1);
  return Number.isInteger(book) && Number.isInteger(chapter) && !!b && book >= 1 && chapter >= 1 && chapter <= b.chapters;
}

function isRealVerseId(id: unknown): id is number {
  if (typeof id !== 'number' || !Number.isInteger(id)) return false;
  const { book, chapter, verse } = parseVerseId(id);
  return isRealChapter(book, chapter) && verse >= 1 && verse <= 176;
}

export class BackupError extends Error {}

/** Checks a parsed backup file and drops anything that isn't a real chapter or verse. */
export function parseBackup(input: unknown): Backup {
  const raw = (input && typeof input === 'object' ? input : null) as Record<string, unknown> | null;
  if (!raw || raw.app !== BACKUP_APP) throw new BackupError("This isn't a Verse Scroll backup file.");
  if (typeof raw.version !== 'number' || raw.version > BACKUP_VERSION) {
    throw new BackupError('This backup is from a newer version of the app.');
  }

  const chapters = Array.isArray(raw.chaptersRead) ? raw.chaptersRead : [];
  const seen = Array.isArray(raw.seenVerses) ? raw.seenVerses : [];
  return {
    app: BACKUP_APP,
    version: BACKUP_VERSION,
    exportedAt: typeof raw.exportedAt === 'string' ? raw.exportedAt : '',
    readPosition: isRealVerseId(raw.readPosition) ? raw.readPosition : null,
    chaptersRead: chapters
      .filter((c): c is Record<string, unknown> => !!c && typeof c === 'object')
      .map((c) => ({ book: Number(c.book), chapter: Number(c.chapter), readAt: Number(c.readAt) || 0 }))
      .filter((c) => isRealChapter(c.book, c.chapter)),
    seenVerses: [...new Set(seen.filter(isRealVerseId))],
    settings: sanitizeSettings(raw.settings),
  };
}

export function buildBackup(data: Omit<Backup, 'app' | 'version' | 'exportedAt'>, now: Date): Backup {
  return { app: BACKUP_APP, version: BACKUP_VERSION, exportedAt: now.toISOString(), ...data };
}

/** Parses backup text, tolerating a byte-order mark or whitespace some apps add when saving. */
export function parseBackupText(text: string): Backup {
  const cleaned = text.replace(/^\uFEFF/, '').trim();
  if (cleaned === '') throw new BackupError('That file is empty.');
  let json: unknown;
  try {
    json = JSON.parse(cleaned);
  } catch {
    const start = cleaned.slice(0, 24).replace(/\s+/g, ' ');
    throw new BackupError(`That file isn't a Verse Scroll backup (it starts with "${start}").`);
  }
  return parseBackup(json);
}
