import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.aite.app',
  appName: 'Aite',
  webDir: 'native-web',
  server: {
    url: 'https://aite-app-one.vercel.app/',
    cleartext: false,
    allowNavigation: ['aite-app-one.vercel.app']
  },
  android: {
    allowMixedContent: false
  }
};

export default config;
