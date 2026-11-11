import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useEffect } from 'react';
import { View } from 'react-native';

import { loadSettings, useSettingsLoaded } from '@/settings/store';
import { useTheme } from '@/theme';

export default function RootLayout() {
  const theme = useTheme();
  const settingsLoaded = useSettingsLoaded();

  useEffect(() => {
    loadSettings();
  }, []);

  // Wait for stored settings (theme, card size) so the first screen doesn't flash the defaults.
  if (!settingsLoaded) return <View style={{ flex: 1, backgroundColor: theme.background }} />;

  return (
    <>
      <StatusBar style="auto" />
      <Stack
        screenOptions={{
          headerTransparent: false,
          headerStyle: { backgroundColor: theme.background },
          headerTintColor: theme.text,
          contentStyle: { backgroundColor: theme.background },
        }}
      >
        <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
        <Stack.Screen name="picker" options={{ title: 'Choose a chapter', presentation: 'modal' }} />
        <Stack.Screen name="settings" options={{ title: 'Settings' }} />
        <Stack.Screen name="raw" options={{ title: 'Raw response' }} />
      </Stack>
    </>
  );
}
