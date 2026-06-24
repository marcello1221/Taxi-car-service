/** @type {import('expo/config').ExpoConfig} */
module.exports = {
  expo: {
    name: 'Driver Platform',
    slug: 'taxi-driver',
    version: '1.0.3',
    orientation: 'portrait',
    scheme: 'taxi-driver',
    userInterfaceStyle: 'dark',
    splash: {
      backgroundColor: '#0a0e17',
    },
    ios: {
      supportsTablet: true,
      bundleIdentifier: 'com.taxicarservice.driver',
    },
    android: {
      adaptiveIcon: {
        backgroundColor: '#0a0e17',
      },
      package: 'com.taxicarservice.driver',
      versionCode: 4,
      permissions: ['INTERNET', 'VIBRATE'],
    },
    plugins: ['./plugins/withAndroidBuildFixes.js', './plugins/withAndroidLinkingQueries.js', 'expo-router'],
    extra: {
      apiUrl: process.env.EXPO_PUBLIC_API_URL || 'https://taxi-car-service-api.vercel.app',
      eas: {
        projectId: 'taxi-driver-local',
      },
    },
  },
};
