import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.aite.app',
  appName: 'Aite',
  webDir: 'native-web',
  server: {
    url: 'https://aite.salemdopamine.workers.dev/',
    cleartext: false,
    allowNavigation: ['aite.salemdopamine.workers.dev']
  },
  android: {
    allowMixedContent: false
  }
};

export default config;
