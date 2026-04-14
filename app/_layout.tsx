import { DarkTheme, ThemeProvider } from '@react-navigation/native'
import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import 'react-native-reanimated';
import { useFonts } from 'expo-font'
import {
    Cinzel_700Bold,
    Cinzel_900Black,
} from '@expo-google-fonts/cinzel'

import { SummonerProvider } from '@/contexts/summoner'
import { HomeConfigProvider } from '@/contexts/home-config'
import { ToastProvider } from '@/components/toast'
import { LoL } from '@/constants/theme'

export const unstable_settings = {
  anchor: '(tabs)',
};

export default function RootLayout() {
    useFonts({ Cinzel_700Bold, Cinzel_900Black })

  return (
      // Force dark theme — RiftTrack uses the LoL dark palette exclusively
      <ThemeProvider value={DarkTheme}>
          <SummonerProvider>
              <HomeConfigProvider>
                  <ToastProvider>
                  <Stack>
                      <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
                      <Stack.Screen
                          name="settings"
                          options={{
                              title: 'Réglages',
                              headerStyle: { backgroundColor: LoL.bg },
                              headerTintColor: LoL.gold,
                              headerTitleStyle: {
                                  color: LoL.goldLight,
                                  fontWeight: '700',
                              },
                              headerShadowVisible: false,
                          }}
                      />
                      <Stack.Screen
                          name="match-detail"
                          options={{
                              title: 'Détail de la partie',
                              headerStyle: { backgroundColor: LoL.bg },
                              headerTintColor: LoL.gold,
                              headerTitleStyle: { color: LoL.goldLight, fontWeight: '700' },
                              headerShadowVisible: false,
                          }}
                      />

                  </Stack>
                  <StatusBar style="light" />
                  </ToastProvider>
              </HomeConfigProvider>
          </SummonerProvider>
    </ThemeProvider>
  );
}
