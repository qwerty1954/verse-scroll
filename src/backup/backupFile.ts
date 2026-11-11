// Export to and import from a backup file. Export writes JSON to the app's cache and opens the
// share sheet (save it to Drive, Files, email it to yourself). Import merges a picked file in.
import * as DocumentPicker from 'expo-document-picker';
import { File, Paths } from 'expo-file-system';
import * as Sharing from 'expo-sharing';

import { getDb } from '@/db/database';
import { parseVerseId } from '@/esv/books';
import { requestJump } from '@/feed/jumpRequests';
import { getSettings, updateSettings } from '@/settings/store';
import { notifyReadChanged } from '@/storage/chaptersRead';
import { loadPosition, savePosition } from '@/storage/position';
import { notifySeenChanged } from '@/storage/seenVerses';
import { buildBackup, parseBackupText, BackupError } from './format';

export async function exportBackup(): Promise<void> {
  const db = await getDb();
  const chapters = await db.getAllAsync<{ book: number; chapter: number; read_at: number }>(
    'SELECT book, chapter, read_at FROM chapters_read ORDER BY book, chapter',
  );
  const seen = await db.getAllAsync<{ verse_id: number }>('SELECT verse_id FROM seen_verses ORDER BY verse_id');
  const backup = buildBackup(
    {
      readPosition: await loadPosition('read'),
      chaptersRead: chapters.map((c) => ({ book: c.book, chapter: c.chapter, readAt: c.read_at })),
      seenVerses: seen.map((r) => r.verse_id),
      settings: getSettings(),
    },
    new Date(),
  );

  const date = backup.exportedAt.slice(0, 10);
  const file = new File(Paths.cache, `verse-scroll-backup-${date}.json`);
  file.create({ overwrite: true });
  await file.write(JSON.stringify(backup, null, 2));

  if (!(await Sharing.isAvailableAsync())) {
    throw new BackupError('Sharing is not available on this device.');
  }
  await Sharing.shareAsync(file.uri, {
    mimeType: 'application/json',
    dialogTitle: 'Save your Verse Scroll backup',
    UTI: 'public.json',
  });
}

/** Reads a picked file as text, falling back to fetch if the file API can't open its address. */
async function readPickedFile(uri: string): Promise<string> {
  try {
    return await new File(uri).text();
  } catch (fileError) {
    try {
      const response = await fetch(uri);
      return await response.text();
    } catch {
      const reason = fileError instanceof Error ? fileError.message : String(fileError);
      throw new BackupError(`That file couldn't be opened (${reason}).`);
    }
  }
}

export interface ImportSummary {
  chaptersRead: number;
  seenVerses: number;
}

/** Lets you pick a backup file and merges it in. Returns null if no file was picked. */
export async function importBackup(): Promise<ImportSummary | null> {
  const picked = await DocumentPicker.getDocumentAsync({
    type: ['application/json', 'text/plain', '*/*'],
    copyToCacheDirectory: true,
  });
  if (picked.canceled || picked.assets.length === 0) return null;

  const backup = parseBackupText(await readPickedFile(picked.assets[0].uri));

  // Merge: progress and history are combined with what's already here; position and
  // settings come from the backup.
  const db = await getDb();
  await db.withExclusiveTransactionAsync(async (txn) => {
    for (const c of backup.chaptersRead) {
      await txn.runAsync(
        'INSERT OR IGNORE INTO chapters_read (book, chapter, read_at) VALUES (?, ?, ?)',
        c.book,
        c.chapter,
        c.readAt || Date.now(),
      );
    }
    for (const id of backup.seenVerses) {
      await txn.runAsync('INSERT OR IGNORE INTO seen_verses (verse_id, seen_at) VALUES (?, ?)', id, Date.now());
    }
  });
  await updateSettings(backup.settings);
  if (backup.readPosition !== null) {
    await savePosition('read', backup.readPosition);
    const { book, chapter, verse } = parseVerseId(backup.readPosition);
    requestJump({ ref: { book, chapter }, verse });
  }

  notifyReadChanged();
  notifySeenChanged();
  return { chaptersRead: backup.chaptersRead.length, seenVerses: backup.seenVerses.length };
}
