import { Fragment, type ReactNode } from 'react';
import { StyleSheet, Text, useWindowDimensions, View } from 'react-native';

import { TEXT_SCALE } from '@/settings/values';
import { useSettings } from '@/settings/store';
import { serifFont, useTheme } from '@/theme';
import type { NumberedVerse } from './groups';

interface VerseCardProps {
  height: number;
  /** One verse, or a group shown with verse numbers. */
  verses: NumberedVerse[];
  reference: string;
  /** Optional content under the reference, e.g. a button. */
  footer?: ReactNode;
}

const BASE_FONT = 27;
const MIN_FONT = 13;

export function VerseCard({ height, verses, reference, footer }: VerseCardProps) {
  const theme = useTheme();
  const { textSize } = useSettings();
  const { width } = useWindowDimensions();

  // Pick the chosen size, shrunk only as far as needed for the text to fit on one screen.
  // Rough fit: each character takes about 0.5 x 1.45 of the font size squared.
  const length = verses.reduce((sum, v) => sum + v.text.length + 4, 0);
  const textArea = (width - 64) * height * 0.62;
  const fitFont = Math.sqrt(textArea / (Math.max(length, 1) * 0.5 * 1.45));
  const fontSize = Math.max(MIN_FONT, Math.min(BASE_FONT * TEXT_SCALE[textSize], fitFont));
  const numbered = verses.length > 1;

  return (
    <View style={[styles.card, { height }]}>
      <Text style={[styles.verse, { color: theme.text, fontSize, lineHeight: fontSize * 1.45 }]}>
        {verses.map((v, i) => (
          <Fragment key={v.number}>
            {numbered && (
              <Text style={{ color: theme.accent, fontSize: fontSize * 0.55 }}>
                {i === 0 ? '' : ' '}
                {v.number}
                {'\u2009'}
              </Text>
            )}
            {v.text}
          </Fragment>
        ))}
      </Text>
      <Text style={[styles.reference, { color: theme.muted }]}>
        {reference}
        <Text style={{ color: theme.accent }}>{'  ·  ESV'}</Text>
      </Text>
      {footer}
    </View>
  );
}

interface DividerCardProps {
  height: number;
  label: string;
}

export function DividerCard({ height, label }: DividerCardProps) {
  const theme = useTheme();
  return (
    <View style={[styles.card, { height }]}>
      <View style={[styles.rule, { backgroundColor: theme.border }]} />
      <Text style={[styles.divider, { color: theme.text }]}>{label}</Text>
      <View style={[styles.rule, { backgroundColor: theme.border }]} />
    </View>
  );
}

export function EndCard({ height }: { height: number }) {
  const theme = useTheme();
  return (
    <View style={[styles.card, { height }]}>
      <Text style={[styles.divider, { color: theme.text }]}>The end of Revelation</Text>
      <Text style={[styles.reference, { color: theme.muted, marginTop: 0 }]}>
        {"You've reached the last verse of the Bible."}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 32,
  },
  verse: {
    fontFamily: serifFont,
    textAlign: 'center',
  },
  reference: {
    marginTop: 28,
    fontSize: 15,
    letterSpacing: 0.3,
  },
  divider: {
    fontFamily: serifFont,
    fontSize: 34,
    marginVertical: 20,
  },
  rule: {
    width: 48,
    height: 1,
  },
});
