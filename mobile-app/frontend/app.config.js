const appJson = require('./app.json');

module.exports = ({ config }) => {
  const googleMapsAndroidApiKey =
    process.env.EXPO_PUBLIC_GOOGLE_MAPS_ANDROID_API_KEY || process.env.EXPO_PUBLIC_GOOGLE_MAPS_API_KEY;
  const googleMapsIosApiKey =
    process.env.EXPO_PUBLIC_GOOGLE_MAPS_IOS_API_KEY || process.env.EXPO_PUBLIC_GOOGLE_MAPS_API_KEY;

  return {
    ...appJson.expo,
    ...config,
    ios: {
      ...appJson.expo.ios,
      ...config?.ios,
      config: {
        ...(appJson.expo.ios?.config || {}),
        ...(config?.ios?.config || {}),
        googleMapsApiKey: googleMapsIosApiKey,
      },
    },
    android: {
      ...appJson.expo.android,
      ...config?.android,
      config: {
        ...(appJson.expo.android?.config || {}),
        ...(config?.android?.config || {}),
        googleMaps: {
          ...(appJson.expo.android?.config?.googleMaps || {}),
          ...(config?.android?.config?.googleMaps || {}),
          apiKey: googleMapsAndroidApiKey,
        },
      },
    },
  };
};
