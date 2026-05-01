const { withAppBuildGradle } = require('@expo/config-plugins');

const MISSING_DIMENSION = "missingDimensionStrategy 'react-native-camera', 'general'";

module.exports = function withReactNativeCameraFix(config) {
  return withAppBuildGradle(config, (gradleConfig) => {
    if (gradleConfig.modResults.language !== 'groovy') {
      return gradleConfig;
    }

    const { contents } = gradleConfig.modResults;
    if (contents.includes(MISSING_DIMENSION)) {
      return gradleConfig;
    }

    gradleConfig.modResults.contents = contents.replace(
      /defaultConfig\s*\{/,
      `defaultConfig {\n        ${MISSING_DIMENSION}`
    );

    return gradleConfig;
  });
};
