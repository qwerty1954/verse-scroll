// In Order feed: one verse per full-screen card, a divider card at the start of each chapter.
// Chapters load from the cache or the ESV API as you near either end, and the card on screen
// is saved so the app reopens where you left off.
//
// Adding a chapter above the current card relies on maintainVisibleContentPosition to keep the
// same card on screen; the spike confirmed this on Android.
import { type ReactNode, useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  AppState,
  FlatList,
  type LayoutChangeEvent,
  type ListViewToken,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';

import {
  chapterKey,
  chapterLabel,
  getBook,
  nextChapter,
  previousChapter,
  verseId,
  type ChapterRef,
} from '@/esv/books';
import { loadChapter, type LoadedChapter } from '@/esv/chapterSource';
import type { ParsedVerse } from '@/esv/parse';
import { useSettings } from '@/settings/store';
import { setChapterRead } from '@/storage/chaptersRead';
import { savePosition } from '@/storage/position';
import { useTheme } from '@/theme';
import { DividerCard, EndCard, VerseCard } from './Card';
import { chunkVerses, rangeLabel } from './groups';

type FeedItem =
  | { kind: 'divider'; key: string; ref: ChapterRef }
  | { kind: 'verse'; key: string; ref: ChapterRef; verses: ParsedVerse[] }
  | { kind: 'end'; key: string };

function toItems(chapters: LoadedChapter[], reachedEnd: boolean, cardSize: number): FeedItem[] {
  const items: FeedItem[] = [];
  for (const chapter of chapters) {
    const key = chapterKey(chapter.ref);
    items.push({ kind: 'divider', key: `d-${key}`, ref: chapter.ref });
    for (const group of chunkVerses(chapter.verses, cardSize)) {
      items.push({ kind: 'verse', key: `v-${key}:${group[0].number}`, ref: chapter.ref, verses: group });
    }
  }
  if (reachedEnd) items.push({ kind: 'end', key: 'end' });
  return items;
}

/** List index to open on: the card holding the saved verse, or the divider (index 0) when verse is 0. */
function startIndex(chapter: LoadedChapter, verse: number, cardSize: number): number {
  if (verse <= 0) return 0;
  const groups = chunkVerses(chapter.verses, cardSize);
  const position = groups.findIndex((g) => g[g.length - 1].number >= verse);
  return position === -1 ? groups.length : position + 1;
}

function cardReference(ref: ChapterRef, verses: ParsedVerse[]): string {
  return rangeLabel(getBook(ref.book).name, ref.chapter, verses);
}

/** Load the previous chapter when the visible card is this close to the top. */
const TOP_DISTANCE = 3;
/** Load the next chapter when this many screens from the end, so it's ready before you get there. */
const END_THRESHOLD = 15;
/** Wait this long after the last swipe before saving the position. */
const SAVE_DELAY_MS = 800;

type Direction = 'next' | 'previous';

export interface StartPoint {
  ref: ChapterRef;
  /** Verse to open on; 0 opens on the chapter's divider card. */
  verse: number;
}

interface FeedProps {
  apiKey: string;
  start: StartPoint;
  /** Header drawn over the feed. Receives the reference of the card on screen. */
  renderHeader: (info: { current: string; currentRef: ChapterRef; loading: boolean }) => ReactNode;
}

export function Feed({ apiKey, start, renderHeader }: FeedProps) {
  const theme = useTheme();
  const { cardSize: cardSizeSetting } = useSettings();
  const [height, setHeight] = useState(0);
  const [chapters, setChapters] = useState<LoadedChapter[]>([]);
  const [reachedEnd, setReachedEnd] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [failed, setFailed] = useState<'start' | Direction | null>(null);
  const [loading, setLoading] = useState(false);
  const [current, setCurrent] = useState({ label: chapterLabel(start.ref), ref: start.ref });
  const [initialIndex, setInitialIndex] = useState(0);
  /** Bumped to retry the first chapter after a failure. */
  const [startAttempt, setStartAttempt] = useState(0);

  // Card size is fixed for the life of this feed; the Read screen restarts the feed when it changes.
  const [cardSize] = useState(() => cardSizeSetting);
  const items = useMemo(() => toItems(chapters, reachedEnd, cardSize), [chapters, reachedEnd, cardSize]);

  // Values the stable FlatList callbacks read. They're updated after each render, never during it.
  const chaptersRef = useRef(chapters);
  const busy = useRef(false);
  useLayoutEffect(() => {
    chaptersRef.current = chapters;
  }, [chapters]);

  // The first chapter. State is only set once it arrives (or fails).
  useEffect(() => {
    let cancelled = false;
    busy.current = true;
    loadChapter(start.ref, apiKey)
      .then((chapter) => {
        if (cancelled) return;
        setInitialIndex(startIndex(chapter, start.verse, cardSize));
        setChapters([chapter]);
      })
      .catch((e: unknown) => {
        if (cancelled) return;
        setError(e instanceof Error ? e.message : String(e));
        setFailed('start');
      })
      .finally(() => {
        busy.current = false;
      });
    return () => {
      cancelled = true;
    };
  }, [apiKey, start.ref, start.verse, startAttempt, cardSize]);

  // Neighbouring chapters, loaded from scroll callbacks.
  const loadNeighbour = useCallback(
    async (direction: Direction) => {
      const loaded = chaptersRef.current;
      if (busy.current || loaded.length === 0) return;
      const target =
        direction === 'next' ? nextChapter(loaded[loaded.length - 1].ref) : previousChapter(loaded[0].ref);
      if (!target) {
        if (direction === 'next') setReachedEnd(true);
        return;
      }

      busy.current = true;
      setLoading(true);
      setError(null);
      setFailed(null);
      try {
        const chapter = await loadChapter(target, apiKey);
        setChapters((prev) => (direction === 'previous' ? [chapter, ...prev] : [...prev, chapter]));
      } catch (e) {
        setError(e instanceof Error ? e.message : String(e));
        setFailed(direction);
      } finally {
        busy.current = false;
        setLoading(false);
      }
    },
    [apiKey],
  );
  const loadNeighbourRef = useRef(loadNeighbour);
  useLayoutEffect(() => {
    loadNeighbourRef.current = loadNeighbour;
  }, [loadNeighbour]);

  const retry = () => {
    if (failed === 'start') {
      setError(null);
      setFailed(null);
      setStartAttempt((n) => n + 1);
    } else if (failed) {
      loadNeighbour(failed);
    }
  };

  // Save the position once swiping settles. A pending save is written straight away when the
  // app goes to the background or the feed closes, so a quick swipe-then-exit isn't lost.
  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const pendingSave = useRef<number | null>(null);
  const flushSave = useCallback(() => {
    if (saveTimer.current) clearTimeout(saveTimer.current);
    saveTimer.current = null;
    const id = pendingSave.current;
    pendingSave.current = null;
    if (id !== null) savePosition('read', id).catch((e) => console.warn('Saving position failed', e));
  }, []);

  useEffect(() => {
    const sub = AppState.addEventListener('change', (state) => {
      if (state !== 'active') flushSave();
    });
    return () => {
      sub.remove();
      flushSave();
    };
  }, [flushSave]);

  // A chapter counts as read once its last verse has been on screen, even if skimmed.
  const markedRead = useRef(new Set<string>());
  const markReadIfLast = useCallback((ref: ChapterRef, verse: number) => {
    const key = chapterKey(ref);
    if (markedRead.current.has(key)) return;
    const chapter = chaptersRef.current.find((c) => chapterKey(c.ref) === key);
    if (!chapter || chapter.verses.at(-1)?.number !== verse) return;
    markedRead.current.add(key);
    setChapterRead(ref, true).catch((e) => console.warn('Marking chapter read failed', e));
  }, []);

  // FlatList doesn't allow this callback to change after mount, so it has no changing deps.
  const onViewableItemsChanged = useCallback(
    ({ viewableItems }: { viewableItems: ListViewToken[] }) => {
      const first = viewableItems.find((v) => v.isViewable);
      if (!first || first.index == null) return;
      const item = first.item as FeedItem;

      if (item.kind === 'verse') {
        const last = item.verses[item.verses.length - 1].number;
        setCurrent({ label: cardReference(item.ref, item.verses), ref: item.ref });
        markReadIfLast(item.ref, last);
        pendingSave.current = verseId(item.ref.book, item.ref.chapter, item.verses[0].number);
        if (saveTimer.current) clearTimeout(saveTimer.current);
        saveTimer.current = setTimeout(flushSave, SAVE_DELAY_MS);
      } else if (item.kind === 'divider') {
        setCurrent({ label: chapterLabel(item.ref), ref: item.ref });
      }

      if (first.index < TOP_DISTANCE) loadNeighbourRef.current('previous');
    },
    [flushSave, markReadIfLast],
  );

  const onLayout = (e: LayoutChangeEvent) => setHeight(e.nativeEvent.layout.height);

  return (
    <View style={[styles.root, { backgroundColor: theme.background }]} onLayout={onLayout}>
      {height > 0 && items.length > 0 && (
        <FlatList
          data={items}
          keyExtractor={(item) => item.key}
          renderItem={({ item }) => {
            if (item.kind === 'divider') return <DividerCard height={height} label={chapterLabel(item.ref)} />;
            if (item.kind === 'end') return <EndCard height={height} />;
            return <VerseCard height={height} verses={item.verses} reference={cardReference(item.ref, item.verses)} />;
          }}
          getItemLayout={(_, index) => ({ length: height, offset: height * index, index })}
          initialScrollIndex={initialIndex}
          pagingEnabled
          decelerationRate="fast"
          showsVerticalScrollIndicator={false}
          maintainVisibleContentPosition={{ minIndexForVisible: 0 }}
          onEndReached={() => loadNeighbour('next')}
          onEndReachedThreshold={END_THRESHOLD}
          onViewableItemsChanged={onViewableItemsChanged}
          viewabilityConfig={{ itemVisiblePercentThreshold: 60 }}
          windowSize={5}
          initialNumToRender={3}
        />
      )}

      {items.length === 0 && !error && (
        <View style={styles.center}>
          <ActivityIndicator color={theme.muted} />
        </View>
      )}

      {error && failed && (
        <View style={[styles.errorBox, { borderColor: theme.border, backgroundColor: theme.background }]}>
          <Text style={[styles.errorText, { color: theme.danger }]}>{error}</Text>
          <Pressable onPress={retry} hitSlop={8}>
            <Text style={[styles.retry, { color: theme.accent }]}>Try again</Text>
          </Pressable>
        </View>
      )}

      {renderHeader({ current: current.label, currentRef: current.ref, loading })}
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  center: { ...StyleSheet.absoluteFill, justifyContent: 'center', alignItems: 'center' },
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
});
