// One SQLite database for everything the app keeps on the device.
// Only chapter_cache holds ESV text; every other table stores references.
import * as SQLite from 'expo-sqlite';

const SCHEMA_VERSION = 4;

let opening: Promise<SQLite.SQLiteDatabase> | null = null;

export function getDb(): Promise<SQLite.SQLiteDatabase> {
  opening ??= open();
  return opening;
}

async function open(): Promise<SQLite.SQLiteDatabase> {
  const db = await SQLite.openDatabaseAsync('versescroll.db');
  const row = await db.getFirstAsync<{ user_version: number }>('PRAGMA user_version');
  const version = row?.user_version ?? 0;

  if (version < 1) {
    await db.execAsync(`
      PRAGMA journal_mode = WAL;
      CREATE TABLE IF NOT EXISTS chapter_cache (
        book INTEGER NOT NULL,
        chapter INTEGER NOT NULL,
        verse_count INTEGER NOT NULL,
        verses_json TEXT NOT NULL,
        headings_json TEXT NOT NULL,
        fetched_at INTEGER NOT NULL,
        last_viewed_at INTEGER NOT NULL,
        PRIMARY KEY (book, chapter)
      );
      CREATE TABLE IF NOT EXISTS position (
        mode TEXT PRIMARY KEY NOT NULL,
        verse_id INTEGER NOT NULL,
        updated_at INTEGER NOT NULL
      );
      PRAGMA user_version = 1;
    `);
  }

  if (version < 2) {
    await db.execAsync(`
      CREATE TABLE IF NOT EXISTS chapters_read (
        book INTEGER NOT NULL,
        chapter INTEGER NOT NULL,
        read_at INTEGER NOT NULL,
        PRIMARY KEY (book, chapter)
      );
      PRAGMA user_version = 2;
    `);
  }

  if (version < 3) {
    await db.execAsync(`
      CREATE TABLE IF NOT EXISTS seen_verses (
        verse_id INTEGER PRIMARY KEY NOT NULL,
        seen_at INTEGER NOT NULL
      );
      PRAGMA user_version = 3;
    `);
  }

  if (version < 4) {
    await db.execAsync(`
      CREATE TABLE IF NOT EXISTS settings (
        key TEXT PRIMARY KEY NOT NULL,
        value TEXT NOT NULL
      );
      PRAGMA user_version = ${SCHEMA_VERSION};
    `);
  }
  return db;
}
