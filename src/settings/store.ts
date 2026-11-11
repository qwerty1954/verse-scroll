// Live settings: read once from SQLite at startup, kept in memory, saved on every change.
// Screens subscribe through useSettings() and re-render when a setting changes.
import { useSyncExternalStore } from 'react';
import { Appearance } from 'react-native';

import { getDb } from '@/db/database';
import { DEFAULT_SETTINGS, sanitizeSettings, type Settings } from './values';

let current: Settings = DEFAULT_SETTINGS;
let loaded = false;
const listeners = new Set<() => void>();

function emit() {
  listeners.forEach((l) => l());
}

/** Applies the theme to the whole app, including system dialogs. */
function applyTheme(theme: Settings['theme']) {
  Appearance.setColorScheme(theme === 'system' ? 'unspecified' : theme);
}

export async function loadSettings(): Promise<Settings> {
  if (loaded) return current;
  try {
    const db = await getDb();
    const rows = await db.getAllAsync<{ key: string; value: string }>('SELECT key, value FROM settings');
    const raw: Record<string, unknown> = {};
    for (const r of rows) {
      try {
        raw[r.key] = JSON.parse(r.value);
      } catch {
        // Ignore a damaged value; the default is used instead.
      }
    }
    current = sanitizeSettings(raw);
  } catch (e) {
    console.warn('Loading settings failed', e);
  }
  loaded = true;
  applyTheme(current.theme);
  emit();
  return current;
}

export function getSettings(): Settings {
  return current;
}

export async function updateSettings(patch: Partial<Settings>): Promise<void> {
  const next = sanitizeSettings({ ...current, ...patch });
  const changed = (Object.keys(next) as (keyof Settings)[]).filter((k) => next[k] !== current[k]);
  if (changed.length === 0) return;
  current = next;
  if (changed.includes('theme')) applyTheme(next.theme);
  emit();
  try {
    const db = await getDb();
    for (const key of changed) {
      await db.runAsync(
        'INSERT OR REPLACE INTO settings (key, value) VALUES (?, ?)',
        key,
        JSON.stringify(next[key]),
      );
    }
  } catch (e) {
    console.warn('Saving settings failed', e);
  }
}

function subscribe(listener: () => void) {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

export function useSettings(): Settings {
  return useSyncExternalStore(subscribe, getSettings, getSettings);
}

/** True once stored settings have been read, so screens don't flash the defaults. */
export function useSettingsLoaded(): boolean {
  return useSyncExternalStore(subscribe, () => loaded, () => loaded);
}
