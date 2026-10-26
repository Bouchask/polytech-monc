const baseConfig = require('./app.json').expo;
const androidMapsKey = process.env.GOOGLE_MAPS_ANDROID_API_KEY || process.env.EXPO_PUBLIC_GOOGLE_MAPS_ANDROID_API_KEY;

module.exports = {
  expo: {
    ...baseConfig,
    plugins: [
      ...baseConfig.plugins,
      ['react-native-maps', androidMapsKey ? { androidGoogleMapsApiKey: androidMapsKey } : {}],
      ['expo-audio', {
        microphonePermission: 'Palesso utilise le microphone uniquement pour joindre un message audio à votre demande.',
        recordAudioAndroid: true,
        enableBackgroundRecording: false,
        enableBackgroundPlayback: false,
      }],
    ],
  },
};
