import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';

export default function RootLayout() {
  return (
    <>
      <StatusBar style="light" />
      <Stack
        screenOptions={{
          headerStyle: { backgroundColor: '#0a0e17' },
          headerTintColor: '#00d4aa',
          headerTitleStyle: { fontWeight: '700' },
          contentStyle: { backgroundColor: '#0a0e17' },
        }}
      />
    </>
  );
}
