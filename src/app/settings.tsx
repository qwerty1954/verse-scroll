import { Link, router } from 'expo-router';
import { useEffect, useState } from 'react';
import { Alert, Linking, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';

import { exportBackup, importBackup } from '@/backup/backupFile';
import { cachedVerseTotal, clearChapterCache } from '@/cache/chapterCache';
import { MAX_CACHED_VERSES } from '@/cache/cacheRules';
import { fetchPassageRaw } from '@/esv/client';
import { updateSettings, useSettings } from '@/settings/store';
import { TEXT_SIZES, type Settings, type TextSize, type ThemeSetting } from '@/settings/values';
import { clearApiKey, loadApiKey, saveApiKey } from '@/storage/apiKey';
import { useTheme, type Theme } from '@/theme';

const TEXT_SIZE_LABELS: Record<TextSize, string> = { small: 'Small', medium: 'Medium', large: 'Large', xlarge: 'Extra large' };
const THEME_OPTIONS: { value: ThemeSetting; label: string }[] = [
  { value: 'system', label: 'System' },
  { value: 'light', label: 'Light' },
  { value: 'dark', label: 'Dark' },
];

function Segmented<T extends string | number>({
  options,
  value,
  onChange,
  theme,
}: {
  options: { value: T; label: string }[];
  value: T;
  onChange: (value: T) => void;
  theme: Theme;
}) {
  return (
    <View style={[styles.segmented, { borderColor: theme.border }]}>
      {options.map((o) => {
        const active = o.value === value;
        return (
          <Pressable
            key={String(o.value)}
            onPress={() => onChange(o.value)}
            style={[styles.segment, active && { backgroundColor: theme.accent }]}
            accessibilityRole="button"
            accessibilityState={{ selected: active }}
          >
            <Text style={[styles.segmentText, { color: active ? theme.background : theme.text }]}>{o.label}</Text>
          </Pressable>
        );
      })}
    </View>
  );
}

// Standard ESV notice. Confirm the current wording on esv.org before relying on it.
const ESV_NOTICE =
  'Scripture quotations are from the ESV® Bible (The Holy Bible, English Standard Version®), ' +
  '© 2001 by Crossway, a publishing ministry of Good News Publishers. Used by permission. ' +
  'All rights reserved.';

export default function SettingsScreen() {
  const theme = useTheme();
  const [draft, setDraft] = useState('');
  const [hasKey, setHasKey] = useState(false);
  const [status, setStatus] = useState<string | null>(null);

  const [cached, setCached] = useState<number | null>(null);
  const settings = useSettings();
  const set = (patch: Partial<Settings>) => updateSettings(patch);
  const [backupStatus, setBackupStatus] = useState<string | null>(null);

  async function doExport() {
    setBackupStatus(null);
    try {
      await exportBackup();
    } catch (e) {
      setBackupStatus(e instanceof Error ? e.message : String(e));
    }
  }

  function confirmImport() {
    Alert.alert(
      'Import a backup?',
      'Chapters read and Random history are added to what is here. Your reading position and settings are replaced.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Choose file',
          onPress: async () => {
            setBackupStatus(null);
            try {
              const result = await importBackup();
              if (result) {
                setBackupStatus(
                  `Imported ${result.chaptersRead} chapters read and ${result.seenVerses} verses seen in Random.`,
                );
              }
            } catch (e) {
              setBackupStatus(e instanceof Error ? e.message : String(e));
            }
          },
        },
      ],
    );
  }

  useEffect(() => {
    loadApiKey().then((key) => setHasKey(key !== null));
    cachedVerseTotal()
      .then(setCached)
      .catch(() => setCached(null));
  }, []);

  async function clearCache() {
    await clearChapterCache();
    setCached(0);
  }

  async function save() {
    if (!draft.trim()) return;
    setStatus('Checking key…');
    await saveApiKey(draft);
    const key = await loadApiKey();
    try {
      await fetchPassageRaw('John 11:35', key ?? '');
      setHasKey(true);
      setDraft('');
      setStatus('Key works.');
      if (router.canGoBack()) router.back();
      else router.replace('/');
    } catch (e) {
      await clearApiKey();
      setHasKey(false);
      setStatus(e instanceof Error ? e.message : String(e));
    }
  }

  async function remove() {
    await clearApiKey();
    setHasKey(false);
    setStatus('Key removed.');
  }

  return (
    <ScrollView
      style={{ backgroundColor: theme.background }}
      contentContainerStyle={styles.content}
      contentInsetAdjustmentBehavior="automatic"
      keyboardShouldPersistTaps="handled"
    >
      <Text style={[styles.heading, { color: theme.text }]}>Reading</Text>
      <Text style={[styles.label, { color: theme.muted }]}>Verses per card</Text>
      <Segmented
        options={[1, 2, 3, 4, 5].map((n) => ({ value: n, label: String(n) }))}
        value={settings.cardSize}
        onChange={(cardSize) => set({ cardSize })}
        theme={theme}
      />
      <Text style={[styles.label, { color: theme.muted }]}>Text size</Text>
      <Segmented
        options={TEXT_SIZES.map((t) => ({ value: t, label: TEXT_SIZE_LABELS[t] }))}
        value={settings.textSize}
        onChange={(textSize) => set({ textSize })}
        theme={theme}
      />
      <Text style={[styles.label, { color: theme.muted }]}>Theme</Text>
      <Segmented options={THEME_OPTIONS} value={settings.theme} onChange={(t) => set({ theme: t })} theme={theme} />

      <Text style={[styles.heading, { color: theme.text, marginTop: 40 }]}>Backup</Text>
      <Text style={[styles.body, { color: theme.muted }]}>
        Saves chapters read, Random history, your reading position and settings to a file. No Bible text is
        included.
      </Text>
      <View style={styles.row}>
        <Pressable onPress={doExport} style={[styles.button, { backgroundColor: theme.accent }]}>
          <Text style={[styles.buttonText, { color: theme.background }]}>Export backup</Text>
        </Pressable>
        <Pressable onPress={confirmImport} style={[styles.button, { borderColor: theme.border, borderWidth: 1 }]}>
          <Text style={[styles.buttonText, { color: theme.text }]}>Import backup</Text>
        </Pressable>
      </View>
      {backupStatus && <Text style={[styles.body, { color: theme.muted }]}>{backupStatus}</Text>}

      <Text style={[styles.heading, { color: theme.text, marginTop: 40 }]}>ESV API key</Text>
      <Text style={[styles.body, { color: theme.muted }]}>
        {hasKey
          ? 'A key is saved on this device. Paste a new one to replace it.'
          : 'Verses come from the ESV API, which needs a free key for non-commercial use.'}
      </Text>
      <Pressable onPress={() => Linking.openURL('https://api.esv.org/')}>
        <Text style={[styles.link, { color: theme.accent }]}>Get a key at api.esv.org</Text>
      </Pressable>

      <TextInput
        value={draft}
        onChangeText={setDraft}
        placeholder="Paste your key"
        placeholderTextColor={theme.muted}
        autoCapitalize="none"
        autoCorrect={false}
        secureTextEntry
        style={[styles.input, { color: theme.text, borderColor: theme.border }]}
      />
      <View style={styles.row}>
        <Pressable onPress={save} style={[styles.button, { backgroundColor: theme.accent }]}>
          <Text style={[styles.buttonText, { color: theme.background }]}>Save key</Text>
        </Pressable>
        {hasKey && (
          <Pressable onPress={remove} style={[styles.button, { borderColor: theme.border, borderWidth: 1 }]}>
            <Text style={[styles.buttonText, { color: theme.text }]}>Remove key</Text>
          </Pressable>
        )}
      </View>
      {status && <Text style={[styles.body, { color: theme.muted }]}>{status}</Text>}

      <Text style={[styles.heading, { color: theme.text, marginTop: 40 }]}>Offline storage</Text>
      <Text style={[styles.body, { color: theme.muted }]}>
        {cached === null
          ? 'Recently read chapters are kept for offline reading.'
          : `${cached} of ${MAX_CACHED_VERSES} verses kept for offline reading. The ESV terms limit how much can be stored.`}
      </Text>
      <Pressable onPress={clearCache} style={[styles.button, styles.alignStart, { borderColor: theme.border, borderWidth: 1 }]}>
        <Text style={[styles.buttonText, { color: theme.text }]}>Clear stored chapters</Text>
      </Pressable>

      <Text style={[styles.heading, { color: theme.text, marginTop: 40 }]}>About the text</Text>
      <Text style={[styles.body, { color: theme.muted }]}>{ESV_NOTICE}</Text>
      <Pressable onPress={() => Linking.openURL('https://www.esv.org')}>
        <Text style={[styles.link, { color: theme.accent }]}>www.esv.org</Text>
      </Pressable>
      <Text style={[styles.body, { color: theme.muted, marginTop: 12 }]}>
        Random mode favors well-known passages using cross-references from OpenBible.info, licensed CC BY.
      </Text>
      <Pressable onPress={() => Linking.openURL('https://www.openbible.info/labs/cross-references/')}>
        <Text style={[styles.link, { color: theme.accent }]}>OpenBible.info cross-references</Text>
      </Pressable>

      <Link href="/raw" style={[styles.link, { color: theme.muted, marginTop: 40 }]}>
        Developer: raw API response
      </Link>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  content: { padding: 20, gap: 12 },
  heading: { fontSize: 18, fontWeight: '600' },
  body: { fontSize: 15, lineHeight: 21 },
  link: { fontSize: 15 },
  input: { borderWidth: 1, borderRadius: 10, padding: 12, fontSize: 16, marginTop: 8 },
  row: { flexDirection: 'row', gap: 12 },
  button: { paddingVertical: 12, paddingHorizontal: 18, borderRadius: 10 },
  buttonText: { fontSize: 15, fontWeight: '600' },
  alignStart: { alignSelf: 'flex-start' },
  label: { fontSize: 14, marginTop: 8 },
  segmented: { flexDirection: 'row', borderWidth: 1, borderRadius: 10, overflow: 'hidden' },
  segment: { flex: 1, paddingVertical: 10, alignItems: 'center' },
  segmentText: { fontSize: 14 },
});
