// Chỉ chạy trên native (Android/iOS)
try {
  const { registerGlobals } = require('@livekit/react-native');
  registerGlobals();
} catch (e) {
  console.warn('LiveKit native module not available:', e);
}
