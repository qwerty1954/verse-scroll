// Book and chapter picker. Tap a chapter to read it; press and hold to mark it read or unread.
import { router, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';

import { BOOKS, getBook, verseId, type Book } from '@/esv/books';
import { requestJump } from '@/feed/jumpRequests';
import { isRead } from '@/progress/summary';
import { useReadSet } from '@/progress/useReadSet';
import { setChapterRead } from '@/storage/chaptersRead';
import { savePosition } from '@/storage/position';
import { useTheme, type Theme } from '@/theme';

export default function PickerScreen() {
  const theme = useTheme();
  const params = useLocalSearchParams<{ book?: string }>();
  const initial = Number(params.book);
  const [bookNumber, setBookNumber] = useState<number | null>(
    Number.isInteger(initial) && initial >= 1 && initial <= BOOKS.length ? initial : null,
  );
  const read = useReadSet() ?? new Set<string>();

  return (
    <ScrollView
      style={{ backgroundColor: theme.background }}
      contentContainerStyle={styles.content}
      contentInsetAdjustmentBehavior="automatic"
    >
      {bookNumber === null ? (
        <BookList read={read} theme={theme} onPick={setBookNumber} />
      ) : (
        <ChapterGrid book={getBook(bookNumber)} read={read} theme={theme} onBack={() => setBookNumber(null)} />
      )}
    </ScrollView>
  );
}

function BookList({ read, theme, onPick }: { read: Set<string>; theme: Theme; onPick: (book: number) => void }) {
  return (
    <>
      {(['OT', 'NT'] as const).map((testament) => (
        <View key={testament} style={styles.section}>
          <Text style={[styles.sectionTitle, { color: theme.muted }]}>
            {testament === 'OT' ? 'Old Testament' : 'New Testament'}
          </Text>
          {BOOKS.filter((b) => b.testament === testament).map((b) => {
            let count = 0;
            for (let c = 1; c <= b.chapters; c++) if (isRead(read, { book: b.number, chapter: c })) count++;
            return (
              <Pressable
                key={b.number}
                onPress={() => onPick(b.number)}
                style={({ pressed }) => [styles.bookRow, { borderColor: theme.border }, pressed && { opacity: 0.6 }]}
                accessibilityRole="button"
              >
                <Text style={[styles.bookName, { color: theme.text }]}>{b.name}</Text>
                <Text style={[styles.bookCount, { color: count === b.chapters ? theme.accent : theme.muted }]}>
                  {count > 0 ? `${count} / ${b.chapters}` : `${b.chapters}`}
                </Text>
              </Pressable>
            );
          })}
        </View>
      ))}
    </>
  );
}

function ChapterGrid({
  book,
  read,
  theme,
  onBack,
}: {
  book: Book;
  read: Set<string>;
  theme: Theme;
  onBack: () => void;
}) {
  const open = async (chapter: number) => {
    const ref = { book: book.number, chapter };
    // Save the new place first, so any Read screen that opens next starts there.
    try {
      await savePosition('read', verseId(ref.book, ref.chapter, 1));
    } catch (e) {
      console.warn('Saving position failed', e);
    }
    requestJump({ ref, verse: 1 });
    // Go back to the tabs already open (not a new copy), then show the Read tab.
    router.dismissTo('/');
  };
  const toggle = (chapter: number) => {
    const ref = { book: book.number, chapter };
    setChapterRead(ref, !isRead(read, ref)).catch((e) => console.warn('Updating chapter failed', e));
  };

  return (
    <>
      <Pressable onPress={onBack} hitSlop={8} accessibilityRole="button">
        <Text style={[styles.back, { color: theme.accent }]}>‹ All books</Text>
      </Pressable>
      <Text style={[styles.gridTitle, { color: theme.text }]}>{book.name}</Text>
      <Text style={[styles.hint, { color: theme.muted }]}>
        Tap a chapter to read it. Press and hold to mark it read or unread.
      </Text>
      <View style={styles.grid}>
        {Array.from({ length: book.chapters }, (_, i) => i + 1).map((chapter) => {
          const done = isRead(read, { book: book.number, chapter });
          return (
            <Pressable
              key={chapter}
              onPress={() => open(chapter)}
              onLongPress={() => toggle(chapter)}
              style={({ pressed }) => [
                styles.cell,
                { borderColor: done ? theme.accent : theme.border, backgroundColor: done ? theme.accent : 'transparent' },
                pressed && { opacity: 0.6 },
              ]}
              accessibilityRole="button"
              accessibilityLabel={`${book.name} ${chapter}${done ? ', read' : ''}`}
              accessibilityHint="Opens the chapter. Press and hold to mark it read or unread."
            >
              <Text style={[styles.cellText, { color: done ? theme.background : theme.text }]}>{chapter}</Text>
            </Pressable>
          );
        })}
      </View>
    </>
  );
}

const styles = StyleSheet.create({
  content: { padding: 20, paddingBottom: 40 },
  section: { marginBottom: 24 },
  sectionTitle: { fontSize: 13, fontWeight: '600', textTransform: 'uppercase', letterSpacing: 0.6, marginBottom: 4 },
  bookRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  bookName: { fontSize: 16 },
  bookCount: { fontSize: 14, fontVariant: ['tabular-nums'] },
  back: { fontSize: 16, marginBottom: 16 },
  gridTitle: { fontSize: 24, fontWeight: '600' },
  hint: { fontSize: 14, marginTop: 4, marginBottom: 16 },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  cell: {
    width: 52,
    height: 52,
    borderRadius: 10,
    borderWidth: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  cellText: { fontSize: 16, fontVariant: ['tabular-nums'] },
});
