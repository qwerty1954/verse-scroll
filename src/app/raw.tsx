// Spike check: shows exactly what the ESV API returns for a chapter and how the parser split it,
// so the parser's assumptions can be checked against real text.
import { useEffect, useState } from 'react';
import { Platform, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';

import { fetchPassageRaw, type EsvResponse } from '@/esv/client';
import { parsePassageText } from '@/esv/parse';
import { loadApiKey } from '@/storage/apiKey';
import { useTheme } from '@/theme';

const mono = { fontFamily: Platform.select({ ios: 'Menlo', default: 'monospace' }) };

export default function RawScreen() {
  const theme = useTheme();
  const [query, setQuery] = useState('John 3');
  const [response, setResponse] = useState<EsvResponse | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function run(q: string) {
    // State is only set after the first await, so the on-mount effect never sets it synchronously.
    const key = await loadApiKey();
    setError(null);
    setResponse(null);
    if (!key) return setError('No API key saved.');
    try {
      setResponse(await fetchPassageRaw(q, key));
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    }
  }

  // Fetch John 3 on open; state is set only when the response (or error) arrives.
  useEffect(() => {
    let cancelled = false;
    loadApiKey()
      .then((key) => (key ? fetchPassageRaw('John 3', key) : Promise.reject(new Error('No API key saved.'))))
      .then(
        (result) => !cancelled && setResponse(result),
        (e: unknown) => !cancelled && setError(e instanceof Error ? e.message : String(e)),
      );
    return () => {
      cancelled = true;
    };
  }, []);

  const passage = response?.passages.at(0) ?? '';
  const parsed = passage ? parsePassageText(passage) : null;

  return (
    <ScrollView
      style={{ backgroundColor: theme.background }}
      contentContainerStyle={styles.content}
      contentInsetAdjustmentBehavior="automatic"
    >
      <Text style={[styles.hint, { color: theme.muted }]}>
        Try a prose chapter (John 3), poetry (Psalm 23), and a chapter with several headings (Matthew 5).
      </Text>
      <View style={styles.row}>
        <TextInput
          value={query}
          onChangeText={setQuery}
          autoCapitalize="none"
          style={[styles.input, { color: theme.text, borderColor: theme.border }]}
        />
        <Pressable onPress={() => run(query)} style={[styles.button, { backgroundColor: theme.accent }]}>
          <Text style={{ color: theme.background, fontWeight: '600' }}>Fetch</Text>
        </Pressable>
      </View>

      {error && <Text style={{ color: theme.danger }}>{error}</Text>}

      {parsed && (
        <>
          <Text style={[styles.heading, { color: theme.text }]}>
            Parsed: {parsed.verses.length} verses, {parsed.headings.length} headings
          </Text>
          {parsed.headings.map((h) => (
            <Text key={`${h.beforeVerse}-${h.text}`} style={{ color: theme.accent }}>
              Heading before v{h.beforeVerse}: {h.text}
            </Text>
          ))}
          {parsed.verses.map((v) => (
            <Text key={v.number} style={{ color: theme.text }}>
              <Text style={{ color: theme.muted }}>{v.number} </Text>
              {v.text}
            </Text>
          ))}
          <Text style={[styles.heading, { color: theme.text }]}>Raw passage text</Text>
          <Text selectable style={[mono, styles.raw, { color: theme.text, borderColor: theme.border }]}>
            {JSON.stringify(passage)}
          </Text>
          <Text style={[styles.heading, { color: theme.text }]}>Full JSON</Text>
          <Text selectable style={[mono, styles.raw, { color: theme.muted, borderColor: theme.border }]}>
            {JSON.stringify({ ...response, passages: ['(shown above)'] }, null, 2)}
          </Text>
        </>
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  content: { padding: 16, gap: 10 },
  hint: { fontSize: 14 },
  row: { flexDirection: 'row', gap: 8 },
  input: { flex: 1, borderWidth: 1, borderRadius: 8, padding: 10, fontSize: 16 },
  button: { paddingHorizontal: 16, justifyContent: 'center', borderRadius: 8 },
  heading: { fontSize: 16, fontWeight: '600', marginTop: 16 },
  raw: { fontSize: 11, borderWidth: 1, borderRadius: 8, padding: 8 },
});
