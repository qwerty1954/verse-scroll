import { Redirect, useFocusEffect } from 'expo-router';
import { useCallback, useState } from 'react';
import { ActivityIndicator, StyleSheet, View } from 'react-native';

import { RandomFeed } from '@/random/RandomFeed';
import { loadApiKey } from '@/storage/apiKey';
import { useTheme } from '@/theme';

export default function RandomScreen() {
  const theme = useTheme();
  const [apiKey, setApiKey] = useState<string | null | undefined>(undefined);

  useFocusEffect(
    useCallback(() => {
      let cancelled = false;
      loadApiKey().then((key) => !cancelled && setApiKey(key));
      return () => {
        cancelled = true;
      };
    }, []),
  );

  if (apiKey === undefined) {
    return (
      <View style={[styles.center, { backgroundColor: theme.background }]}>
        <ActivityIndicator color={theme.muted} />
      </View>
    );
  }
  if (apiKey === null) return <Redirect href="/settings" />;
  return <RandomFeed key={apiKey} apiKey={apiKey} />;
}

const styles = StyleSheet.create({
  center: { flex: 1, justifyContent: 'center', alignItems: 'center' },
});
