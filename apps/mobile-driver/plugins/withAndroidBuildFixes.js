const { withGradleProperties, withProjectBuildGradle } = require('@expo/config-plugins');

function withAndroidBuildFixes(config) {
  config = withGradleProperties(config, (config) => {
    config.modResults.push({
      type: 'property',
      key: 'android.kotlinVersion',
      value: '1.9.25',
    });
    return config;
  });

  return withProjectBuildGradle(config, (config) => {
    let contents = config.modResults.contents;

    if (!contents.match(/\next \{\s*\n\s*kotlinVersion = findProperty\('android.kotlinVersion'\)/)) {
      contents = contents.replace(
        'apply plugin: "com.facebook.react.rootproject"',
        `ext {\n    kotlinVersion = findProperty('android.kotlinVersion') ?: '1.9.25'\n}\n\napply plugin: "com.facebook.react.rootproject"`
      );
    }

    contents = contents.replace(
      "classpath('org.jetbrains.kotlin:kotlin-gradle-plugin')",
      "classpath(\"org.jetbrains.kotlin:kotlin-gradle-plugin:${kotlinVersion}\")"
    );

    config.modResults.contents = contents;
    return config;
  });
}

module.exports = withAndroidBuildFixes;
