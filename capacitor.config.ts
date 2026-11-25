import type { CapacitorConfig } from '@capacitor/cli';
const config: CapacitorConfig = {
  appId: 'com.nurox.musictestbed',
  appName: 'Music Testbed',
  webDir: 'dist',
  server: { hostname: 'com.nurox.musictestbed', androidScheme: 'https' },
  android: { backgroundColor: '#101414', allowMixedContent: false },
};
export default config;
