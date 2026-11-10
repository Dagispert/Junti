import { DarkTheme, DefaultTheme, Stack, ThemeProvider } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { ActivityIndicator, useColorScheme, View } from 'react-native';

import { AuthScreen, ProfileSetup } from '@/components/auth-screen';
import { useTheme } from '@/constants/theme';
import { StoreProvider, useStore } from '@/data/store';

export default function RootLayout() {
  const dark = useColorScheme() === 'dark';
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
    <Stack screenOptions={{ headerShown: false }}>
      <Stack.Screen name="publish" options={{ presentation: 'modal' }} />
      <Stack.Screen name="new-group" options={{ presentation: 'modal' }} />
      <Stack.Screen name="join" options={{ presentation: 'modal' }} />
    </Stack>
  );
}
