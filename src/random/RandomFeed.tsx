// Random feed: full-screen cards of weighted random verses, never repeating until every verse
// in the filter has been seen. The next few cards are prepared ahead of the one on screen.
import { router } from 'expo-router';
import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  FlatList,
  type LayoutChangeEvent,
  type ListViewToken,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { WEIGHTS } from '@/data/weights';
import { chapterVerseCount, getBook, parseVerseId, verseId, type ChapterRef } from '@/esv/books';
import type { ParsedVerse } from '@/esv/parse';
import { VerseCard } from '@/feed/Card';
import { groupRange, rangeLabel } from '@/feed/groups';
import { requestJump } from '@/feed/jumpRequests';
import { updateSettings, useSettings } from '@/settings/store';
import { savePosition } from '@/storage/position';
import { clearSeen, loadSeen, markSeen, onSeenReset } from '@/storage/seenVerses';
import { serifFont, useTheme } from '@/theme';
import { Sampler, type RandomFilter } from './sampler';
import { loadVerses } from './verseSource';

interface Card {
  ref: ChapterRef;
  verses: ParsedVerse[];
  /** Every verse id the card covers, including ones the ESV omits. */
  ids: number[];
}

/** Keep this many cards ready beyond the one on screen. */
const AHEAD = 3;

const FILTERS: { value: RandomFilter; label: string }[] = [
  { value: 'all', label: 'All' },
  { value: 'OT', label: 'Old Testament' },
  { value: 'NT', label: 'New Testament' },
];

function cardKey(card: Card): string {
  return String(verseId(card.ref.book, card.ref.chapter, card.verses[0].number));
}

export function RandomFeed({ apiKey }: { apiKey: string }) {
  const theme = useTheme();
  const insets = useSafeAreaInsets();
  const [height, setHeight] = useState(0);
  const { randomFilter: filter, cardSize } = useSettings();
  const setFilter = (value: RandomFilter) => updateSettings({ randomFilter: value });
  const [cards, setCards] = useState<Card[]>([]);
  const [done, setDone] = useState(false);
  const [error, setError] = useState<string | null>(null);
  /** Bumped to start over: after a filter change or a reset. */
  const [generation, setGeneration] = useState(0);

  const sampler = useRef<Sampler | null>(null);
  /** Verses shown so far, mirrored in the database. */
  const seen = useRef<Set<number>>(new Set());
  const visibleIndex = useRef(0);
  const busy = useRef(false);
  const cardsRef = useRef(cards);
  /** A drawn verse whose text failed to load, retried by Try again. */
  const failedId = useRef<number | null>(null);
  useLayoutEffect(() => {
    cardsRef.current = cards;
  }, [cards]);

  const cardSizeRef = useRef(cardSize);
  useLayoutEffect(() => {
    cardSizeRef.current = cardSize;
  }, [cardSize]);

  const rememberSeen = useCallback((ids: number[]) => {
    for (const id of ids) {
      if (seen.current.has(id)) continue;
      seen.current.add(id);
      markSeen(id).catch((e) => console.warn('Saving seen verse failed', e));
    }
  }, []);

  // Prepare cards until AHEAD are ready past the one on screen, or the pool runs out.
  const fill = useCallback(async () => {
    if (busy.current || !sampler.current) return;
    busy.current = true;
    const s = sampler.current;
    try {
      while (s === sampler.current && cardsRef.current.length - 1 - visibleIndex.current < AHEAD) {
        const id = failedId.current ?? s.draw();
        failedId.current = null;
        if (id === null) {
          setDone(true);
          break;
        }
        // Expand the drawn verse to its group, the same verses that share a card in Read.
        const { book, chapter, verse } = parseVerseId(id);
        const ref = { book, chapter };
        const { start, end } = groupRange(verse, cardSizeRef.current, chapterVerseCount(ref));
        const ids: number[] = [];
        for (let v = start; v <= end; v++) {
          ids.push(verseId(book, chapter, v));
          s.exclude(verseId(book, chapter, v));
        }
        let verses: ParsedVerse[];
        try {
          verses = await loadVerses(ref, start, end, apiKey);
        } catch (e) {
          failedId.current = id;
          setError(e instanceof Error ? e.message : String(e));
          break;
        }
        if (s !== sampler.current) break;
        if (verses.length === 0) {
          // Verse numbers the ESV leaves out: never offer them again.
          rememberSeen(ids);
          continue;
        }
        const next = [...cardsRef.current, { ref, verses, ids }];
        cardsRef.current = next;
        setCards(next);
      }
    } finally {
      busy.current = false;
      // The filter changed or history was reset mid-load: fill for the new sampler.
      if (s !== sampler.current) setTimeout(() => fillRef.current(), 0);
    }
  }, [apiKey, rememberSeen]);
  const fillRef = useRef(fill);
  useLayoutEffect(() => {
    fillRef.current = fill;
  }, [fill]);

  // Start (or start over) with a sampler built from the verses seen so far.
  useEffect(() => {
    let cancelled = false;
    loadSeen()
      .catch(() => new Set<number>())
      .then((stored) => {
        if (cancelled) return;
        stored.forEach((id) => seen.current.add(id));
        sampler.current = new Sampler(WEIGHTS, filter, new Set(seen.current));
        visibleIndex.current = 0;
        cardsRef.current = [];
        failedId.current = null;
        setCards([]);
        setDone(false);
        setError(null);
        fill();
      });
    return () => {
      cancelled = true;
    };
  }, [filter, cardSize, generation, fill]);

  useEffect(
    () =>
      onSeenReset(() => {
        seen.current = new Set();
        setGeneration((n) => n + 1);
      }),
    [],
  );

  const onViewableItemsChanged = useCallback(
    ({ viewableItems }: { viewableItems: ListViewToken[] }) => {
      const first = viewableItems.find((v) => v.isViewable);
      if (!first || first.index == null) return;
      visibleIndex.current = first.index;
      rememberSeen((first.item as Card).ids);
      fill();
    },
    [fill, rememberSeen],
  );

  const readInContext = async (card: Card) => {
    const verse = card.verses[0].number;
    try {
      await savePosition('read', verseId(card.ref.book, card.ref.chapter, verse));
    } catch (e) {
      console.warn('Saving position failed', e);
    }
    requestJump({ ref: card.ref, verse });
    router.navigate('/');
  };

  const retry = () => {
    setError(null);
    fill();
  };

  const onLayout = (e: LayoutChangeEvent) => setHeight(e.nativeEvent.layout.height);
  const showDone = done && cards.length === 0;

  return (
    <View style={[styles.root, { backgroundColor: theme.background }]} onLayout={onLayout}>
      {height > 0 && cards.length > 0 && (
        <FlatList
          key={`${filter}-${cardSize}-${generation}`}
          data={cards}
          keyExtractor={cardKey}
          renderItem={({ item }) => (
            <VerseCard
              height={height}
              verses={item.verses}
              reference={rangeLabel(getBook(item.ref.book).name, item.ref.chapter, item.verses)}
              footer={
                <Pressable onPress={() => readInContext(item)} hitSlop={8} style={styles.contextButton}>
                  <Text style={[styles.contextText, { color: theme.accent }]}>Read in context</Text>
                </Pressable>
              }
            />
          )}
          getItemLayout={(_, index) => ({ length: height, offset: height * index, index })}
          pagingEnabled
          decelerationRate="fast"
          showsVerticalScrollIndicator={false}
          onViewableItemsChanged={onViewableItemsChanged}
          viewabilityConfig={{ itemVisiblePercentThreshold: 60 }}
          windowSize={5}
          initialNumToRender={2}
          ListFooterComponent={
            done ? <DoneCard height={height} onReset={() => clearSeen().catch(() => undefined)} /> : undefined
          }
        />
      )}

      {showDone && height > 0 && <DoneCard height={height} onReset={() => clearSeen().catch(() => undefined)} />}

      {cards.length === 0 && !done && !error && (
        <View style={styles.center}>
          <ActivityIndicator color={theme.muted} />
        </View>
      )}

      {error && (
        <View style={[styles.errorBox, { borderColor: theme.border, backgroundColor: theme.background }]}>
          <Text style={[styles.errorText, { color: theme.danger }]}>{error}</Text>
          <Pressable onPress={retry} hitSlop={8}>
            <Text style={[styles.retry, { color: theme.accent }]}>Try again</Text>
          </Pressable>
        </View>
      )}

      <View style={[styles.header, { paddingTop: insets.top + 8 }]} pointerEvents="box-none">
        {FILTERS.map((f) => {
          const active = f.value === filter;
          return (
            <Pressable
              key={f.value}
              onPress={() => setFilter(f.value)}
              style={[
                styles.chip,
                { borderColor: active ? theme.accent : theme.border, backgroundColor: active ? theme.accent : theme.background },
              ]}
              accessibilityRole="button"
              accessibilityState={{ selected: active }}
            >
              <Text style={[styles.chipText, { color: active ? theme.background : theme.text }]}>{f.label}</Text>
            </Pressable>
          );
        })}
      </View>
    </View>
  );
}

function DoneCard({ height, onReset }: { height: number; onReset: () => void }) {
  const theme = useTheme();
  return (
    <View style={[styles.done, { height }]}>
      <Text style={[styles.doneTitle, { color: theme.text }]}>{"You've seen every passage"}</Text>
      <Text style={[styles.doneBody, { color: theme.muted }]}>
        Reset to start drawing from the whole list again.
      </Text>
      <Pressable onPress={onReset} style={[styles.resetButton, { backgroundColor: theme.accent }]}>
        <Text style={[styles.resetText, { color: theme.background }]}>Reset Random history</Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  center: { ...StyleSheet.absoluteFill, justifyContent: 'center', alignItems: 'center' },
  header: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    paddingHorizontal: 16,
    flexDirection: 'row',
    gap: 8,
  },
  chip: { paddingVertical: 6, paddingHorizontal: 12, borderRadius: 16, borderWidth: 1 },
  chipText: { fontSize: 14 },
  contextButton: { marginTop: 20 },
  contextText: { fontSize: 15, fontWeight: '600' },
  errorBox: {
    position: 'absolute',
    left: 16,
    right: 16,
    bottom: 48,
    padding: 16,
    borderRadius: 12,
    borderWidth: 1,
  },
  errorText: { fontSize: 15, marginBottom: 8 },
  retry: { fontSize: 15, fontWeight: '600' },
  done: { justifyContent: 'center', alignItems: 'center', paddingHorizontal: 32 },
  doneTitle: { fontFamily: serifFont, fontSize: 28, textAlign: 'center', marginBottom: 12 },
  doneBody: { fontSize: 15, textAlign: 'center', marginBottom: 24 },
  resetButton: { paddingVertical: 12, paddingHorizontal: 20, borderRadius: 10 },
  resetText: { fontSize: 15, fontWeight: '600' },
});
