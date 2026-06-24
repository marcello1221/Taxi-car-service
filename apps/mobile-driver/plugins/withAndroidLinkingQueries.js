const { withAndroidManifest } = require('@expo/config-plugins');

function withAndroidLinkingQueries(config) {
  return withAndroidManifest(config, (config) => {
    const manifest = config.modResults;
    const queries = manifest.manifest.queries?.[0] ?? { intent: [], package: [] };
    if (!manifest.manifest.queries) {
      manifest.manifest.queries = [queries];
    }

    const intents = queries.intent ?? [];
    const packages = queries.package ?? [];

    const addIntent = (scheme) => {
      if (intents.some((item) => item.data?.some((d) => d.$?.['android:scheme'] === scheme))) return;
      intents.push({
        action: [{ $: { 'android:name': 'android.intent.action.VIEW' } }],
        data: [{ $: { 'android:scheme': scheme } }],
      });
    };

    addIntent('https');
    addIntent('http');
    addIntent('geo');
    addIntent('sms');
    addIntent('tel');

    if (!packages.some((item) => item.$?.['android:name'] === 'com.google.android.apps.maps')) {
      packages.push({ $: { 'android:name': 'com.google.android.apps.maps' } });
    }

    queries.intent = intents;
    queries.package = packages;
    manifest.manifest.queries = [queries];
    return config;
  });
}

module.exports = withAndroidLinkingQueries;
