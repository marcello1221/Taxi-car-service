import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { SafeAreaProvider } from 'react-native-safe-area-context';

export default function RootLayout() {
  return (
    <SafeAreaProvider>
      <StatusBar style="light" />
      <Stack
        screenOptions={{
          headerStyle: { backgroundColor: '#0a0e17' },
          headerTintColor: '#f59e0b',
          headerTitleStyle: { fontWeight: '700' },
          contentStyle: { backgroundColor: '#0a0e17' },
          headerShown: false,
        }}
      />
    </SafeAreaProvider>
  );
}
