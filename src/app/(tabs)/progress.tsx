import { router } from 'expo-router';
import { useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, Alert, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { percentLabel, summarize, type BookProgress } from '@/progress/summary';
import { useReadSet } from '@/progress/useReadSet';
import { clearSeen, onSeenReset, seenCount } from '@/storage/seenVerses';
import { serifFont, useTheme, type Theme } from '@/theme';

export default function ProgressScreen() {
  const theme = useTheme();
  const insets = useSafeAreaInsets();
  const read = useReadSet();
  const summary = useMemo(() => (read ? summarize(read) : null), [read]);
  const [seen, setSeen] = useState<number | null>(null);

  // Refreshed whenever the Progress tab is drawn again and after a reset.
  useEffect(() => {
    let cancelled = false;
    const refresh = () => {
      seenCount()
        .then((n) => !cancelled && setSeen(n))
        .catch(() => undefined);
    };
    refresh();
    const unsubscribe = onSeenReset(refresh);
    return () => {
      cancelled = true;
      unsubscribe();
    };
  }, [read]);

  const confirmReset = () => {
    Alert.alert('Reset Random history?', 'Random will be able to show every verse again.', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Reset', style: 'destructive', onPress: () => clearSeen().catch(() => undefined) },
    ]);
  };

  if (!summary) {
    return (
      <View style={[styles.center, { backgroundColor: theme.background }]}>
        <ActivityIndicator color={theme.muted} />
      </View>
    );
  }

  const ot = summary.books.filter((b) => b.book.testament === 'OT');
  const nt = summary.books.filter((b) => b.book.testament === 'NT');

  return (
    <ScrollView
      style={{ backgroundColor: theme.background }}
      contentContainerStyle={[styles.content, { paddingTop: insets.top + 16 }]}
    >
      <Text style={[styles.title, { color: theme.text }]}>Progress</Text>
      <Text style={[styles.overall, { color: theme.text }]}>{percentLabel(summary.share)}</Text>
      <Text style={[styles.subtitle, { color: theme.muted }]}>
        {summary.chaptersRead} of {summary.totalChapters} chapters read
      </Text>
      <Bar share={summary.share} theme={theme} height={8} />

      <Section title="Old Testament" books={ot} theme={theme} />
      <Section title="New Testament" books={nt} theme={theme} />

      <View style={styles.section}>
        <Text style={[styles.sectionTitle, { color: theme.text }]}>Random</Text>
        <Text style={[styles.subtitle, { color: theme.muted }]}>
          {seen === null ? 'Verses you have seen in Random are skipped.' : `${seen} verses seen in Random.`}
        </Text>
        <Pressable
          onPress={confirmReset}
          style={[styles.resetButton, { borderColor: theme.border }]}
          accessibilityRole="button"
        >
          <Text style={[styles.resetText, { color: theme.text }]}>Reset Random history</Text>
        </Pressable>
      </View>
    </ScrollView>
  );
}

function Section({ title, books, theme }: { title: string; books: BookProgress[]; theme: Theme }) {
  const read = books.reduce((sum, b) => sum + b.read, 0);
  const total = books.reduce((sum, b) => sum + b.book.chapters, 0);
  return (
    <View style={styles.section}>
      <View style={styles.sectionHeader}>
        <Text style={[styles.sectionTitle, { color: theme.text }]}>{title}</Text>
        <Text style={[styles.count, { color: theme.muted }]}>
          {read} / {total}
        </Text>
      </View>
      {books.map((b) => (
        <Pressable
          key={b.book.number}
          onPress={() => router.push({ pathname: '/picker', params: { book: String(b.book.number) } })}
          style={({ pressed }) => [styles.row, pressed && { opacity: 0.6 }]}
          accessibilityRole="button"
          accessibilityLabel={`${b.book.name}, ${b.read} of ${b.book.chapters} chapters read`}
        >
          <View style={styles.rowText}>
            <Text style={[styles.bookName, { color: theme.text }]}>{b.book.name}</Text>
            <Text style={[styles.count, { color: b.share === 1 ? theme.accent : theme.muted }]}>
              {b.read} / {b.book.chapters}
            </Text>
          </View>
          <Bar share={b.share} theme={theme} height={4} />
        </Pressable>
      ))}
    </View>
  );
}

function Bar({ share, theme, height }: { share: number; theme: Theme; height: number }) {
  return (
    <View style={[styles.track, { height, borderRadius: height / 2, backgroundColor: theme.border }]}>
      <View
        style={{
          width: `${Math.round(share * 1000) / 10}%`,
          height,
          borderRadius: height / 2,
          backgroundColor: theme.accent,
        }}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  center: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  content: { paddingHorizontal: 20, paddingBottom: 32 },
  title: { fontSize: 16, fontWeight: '600' },
  overall: { fontFamily: serifFont, fontSize: 44, marginTop: 12 },
  subtitle: { fontSize: 15, marginBottom: 12 },
  track: { overflow: 'hidden' },
  section: { marginTop: 32 },
  sectionHeader: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 8 },
  sectionTitle: { fontSize: 17, fontWeight: '600' },
  row: { paddingVertical: 10 },
  rowText: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 6 },
  bookName: { fontSize: 15 },
  count: { fontSize: 14, fontVariant: ['tabular-nums'] },
  resetButton: { alignSelf: 'flex-start', borderWidth: 1, borderRadius: 10, paddingVertical: 10, paddingHorizontal: 16 },
  resetText: { fontSize: 15, fontWeight: '600' },
});
