import type { CapacitorConfig } from '@capacitor/cli';
const config: CapacitorConfig = {
  appId: 'com.nurox.musictestbed.backgroundpoc',
  appName: 'Music Testbed PoC',
  webDir: 'dist',
  server: { hostname: 'com.nurox.musictestbed.backgroundpoc', androidScheme: 'https' },
  android: { backgroundColor: '#101414', allowMixedContent: false },
};
export default config;
