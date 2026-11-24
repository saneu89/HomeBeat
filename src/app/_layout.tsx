import { DarkTheme, Stack, ThemeProvider } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { StatusBar } from 'expo-status-bar';
import { useCallback, useEffect, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';

import { PoTokenWebView } from '@/components/PoTokenWebView';
import { Toast } from '@/components/Toast';
import { StateView } from '@/components/ui/StateView';
import { getDb } from '@/database/db';
import { colors, spacing } from '@/theme/theme';

SplashScreen.preventAutoHideAsync();

const navigationTheme = {
  ...DarkTheme,
  colors: {
    ...DarkTheme.colors,
    primary: colors.accent,
    background: colors.background,
    card: colors.background,
    text: colors.text,
    border: colors.border,
    notification: colors.accent,
  },
};

export default function RootLayout() {
  const [state, setState] = useState<'loading' | 'ready' | { error: string }>('loading');

  const init = useCallback(() => {
    setState('loading');
    getDb()
      .then(() => setState('ready'))
      .catch((e: unknown) => setState({ error: e instanceof Error ? e.message : String(e) }))
      .finally(() => SplashScreen.hideAsync());
  }, []);

  useEffect(init, [init]);

  return (
    <SafeAreaProvider>
      <ThemeProvider value={navigationTheme}>
        <StatusBar style="light" />
        {state === 'ready' ? (
          <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: colors.background } }}>
            <Stack.Screen name="(tabs)" />
            <Stack.Screen name="settings" options={{ animation: 'slide_from_right' }} />
            <Stack.Screen name="player" options={{ presentation: 'fullScreenModal', animation: 'slide_from_bottom' }} />
          </Stack>
        ) : state === 'loading' ? (
          <View style={styles.center} />
        ) : (
          <View style={styles.center}>
            <StateView kind="error" title="Datenbank konnte nicht geöffnet werden" message={state.error} onRetry={init} />
          </View>
        )}
        <Toast />
        <PoTokenWebView />
      </ThemeProvider>
    </SafeAreaProvider>
  );
}

const styles = StyleSheet.create({
  center: { flex: 1, justifyContent: 'center', padding: spacing.screen, backgroundColor: colors.background },
});
