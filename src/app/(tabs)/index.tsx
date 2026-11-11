import Ionicons from '@expo/vector-icons/Ionicons';
import { Link, Redirect, router, useFocusEffect } from 'expo-router';
import { useCallback, useEffect, useRef, useState } from 'react';
import { ActivityIndicator, Linking, Pressable, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { parseVerseId } from '@/esv/books';
import { Feed, type StartPoint } from '@/feed/Feed';
import { onJumpRequest, takePendingJump } from '@/feed/jumpRequests';
import { loadApiKey } from '@/storage/apiKey';
import { useSettings } from '@/settings/store';
import { loadPosition } from '@/storage/position';
import { useTheme } from '@/theme';

/** First launch opens on Genesis 1:1. */
const FIRST_START: StartPoint = { ref: { book: 1, chapter: 1 }, verse: 1 };

interface Ready {
  apiKey: string | null;
  start: StartPoint;
  /** Changes on every jump, so the feed starts fresh at the new place. */
  feedKey: number;
}

export default function ReadScreen() {
  const theme = useTheme();
  const insets = useSafeAreaInsets();
  const [ready, setReady] = useState<Ready | null>(null);

  // Re-read the key whenever this screen comes back into focus, e.g. after Settings.
  // The start point is read once; after that the feed keeps its own place,
  // unless the picker left a jump waiting.
  useFocusEffect(
    useCallback(() => {
      let cancelled = false;
      (async () => {
        const apiKey = await loadApiKey();
        let start = FIRST_START;
        try {
          const saved = await loadPosition('read');
          if (saved !== null) {
            const { book, chapter, verse } = parseVerseId(saved);
            start = { ref: { book, chapter }, verse };
          }
        } catch (e) {
          console.warn('Loading position failed', e);
        }
        if (cancelled) return;
        const jump = takePendingJump();
        setReady((prev) => {
          if (jump) {
            return { apiKey, start: jump, feedKey: (prev?.feedKey ?? 0) + 1 };
          }
          return prev && prev.apiKey === apiKey ? prev : { apiKey, start, feedKey: 0 };
        });
      })();
      return () => {
        cancelled = true;
      };
    }, []),
  );

  // A new card size regroups the verses, so restart the feed at the last saved verse.
  const { cardSize } = useSettings();
  const lastCardSize = useRef(cardSize);
  useEffect(() => {
    if (lastCardSize.current === cardSize) return;
    lastCardSize.current = cardSize;
    let cancelled = false;
    loadPosition('read')
      .then((saved) => {
        if (cancelled || saved === null) return;
        const { book, chapter, verse } = parseVerseId(saved);
        setReady((prev) =>
          prev ? { ...prev, start: { ref: { book, chapter }, verse }, feedKey: prev.feedKey + 1 } : prev,
        );
      })
      .catch((e) => console.warn('Loading position failed', e));
    return () => {
      cancelled = true;
    };
  }, [cardSize]);

  // If this screen is already open when a chapter is picked, jump straight away.
  useEffect(
    () =>
      onJumpRequest(() => {
        const jump = takePendingJump();
        if (!jump) return;
        setReady((prev) => (prev ? { ...prev, start: jump, feedKey: prev.feedKey + 1 } : prev));
      }),
    [],
  );

  if (!ready) {
    return (
      <View style={[styles.center, { backgroundColor: theme.background }]}>
        <ActivityIndicator color={theme.muted} />
      </View>
    );
  }
  if (ready.apiKey === null) return <Redirect href="/settings" />;

  return (
    <Feed
      key={`${ready.apiKey}-${ready.feedKey}`}
      apiKey={ready.apiKey}
      start={ready.start}
      renderHeader={({ current, currentRef, loading }) => (
        <View style={[styles.header, { paddingTop: insets.top + 8 }]} pointerEvents="box-none">
          <Pressable
            onPress={() => router.push({ pathname: '/picker', params: { book: String(currentRef.book) } })}
            style={styles.titleRow}
            hitSlop={8}
            accessibilityRole="button"
            accessibilityLabel={`${current}. Choose a chapter`}
          >
            <Text style={[styles.current, { color: theme.text }]}>{current}</Text>
            <Ionicons name="chevron-down" size={16} color={theme.muted} />
            {loading && <ActivityIndicator size="small" color={theme.muted} />}
          </Pressable>
          <View style={styles.links}>
            <Pressable onPress={() => Linking.openURL('https://www.esv.org')} hitSlop={8}>
              <Text style={[styles.link, { color: theme.muted }]}>esv.org</Text>
            </Pressable>
            <Link href="/settings" style={[styles.link, { color: theme.accent }]}>
              Settings
            </Link>
          </View>
        </View>
      )}
    />
  );
}

const styles = StyleSheet.create({
  center: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  header: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    paddingHorizontal: 20,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  titleRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  current: { fontSize: 16, fontWeight: '600' },
  links: { flexDirection: 'row', gap: 16 },
  link: { fontSize: 15 },
});
