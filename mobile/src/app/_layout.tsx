import { Caveat_600SemiBold, Caveat_700Bold, useFonts } from '@expo-google-fonts/caveat';
import { DarkTheme, DefaultTheme, Stack, ThemeProvider } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, useColorScheme, View } from 'react-native';

import { AuthScreen, ProfileSetup } from '@/components/auth-screen';
import { IntroCinematic } from '@/components/cinematics';
import { useTheme } from '@/constants/theme';
import { StoreProvider, useStore } from '@/data/store';
import { setupInstallable } from '@/lib/push';

export default function RootLayout() {
  const dark = useColorScheme() === 'dark';
  useFonts({ Caveat_600SemiBold, Caveat_700Bold });
  useEffect(setupInstallable, []);
  return (
    <ThemeProvider value={dark ? DarkTheme : DefaultTheme}>
      <StoreProvider>
        <Gate />
        <StatusBar style="auto" />
      </StoreProvider>
    </ThemeProvider>
  );
}

/** Sin sesión no se llega a ninguna pantalla de la app. */
function Gate() {
  const { status } = useStore();
  const [intro, setIntro] = useState(true);
  const endIntro = useCallback(() => setIntro(false), []);
  const theme = useTheme();
  if (status === 'loading') {
    return (
      <View style={{ flex: 1, justifyContent: 'center', backgroundColor: theme.background }}>
        <ActivityIndicator color={theme.textSecondary} />
      </View>
    );
  }
  if (status === 'signedOut') return <AuthScreen />;
  if (status === 'needsProfile') return <ProfileSetup />;
  return (
    <View style={{ flex: 1 }}>
      <Stack screenOptions={{ headerShown: false }}>
        <Stack.Screen name="publish" options={{ presentation: 'modal' }} />
        <Stack.Screen name="new-group" options={{ presentation: 'modal' }} />
        <Stack.Screen name="join" options={{ presentation: 'modal' }} />
        <Stack.Screen name="settings" options={{ presentation: 'modal' }} />
        <Stack.Screen name="group-settings" options={{ presentation: 'modal' }} />
        <Stack.Screen name="add-song" options={{ presentation: 'modal' }} />
        <Stack.Screen name="event" options={{ presentation: 'modal' }} />
        <Stack.Screen
          name="recap"
          options={{ presentation: 'fullScreenModal', animation: 'fade' }}
        />
        <Stack.Screen name="moment/[id]" options={{ presentation: 'modal' }} />
      </Stack>
      {intro && <IntroCinematic onDone={endIntro} />}
    </View>
  );
}
