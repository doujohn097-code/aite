import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.aite.app',
  appName: 'Aite',
  webDir: 'public',
  // تحميل الموقع من Vercel — التحديثات الحية تصل للمستخدمين فوراً
  server: {
    url: 'https://aite-app-one.vercel.app',
    cleartext: false
  },
  android: {
    allowMixedContent: false,
    captureInput: true,
    webContentsDebuggingEnabled: false,
    logging: true
  },
  plugins: {
    PushNotifications: {
      presentationOptions: ['badge', 'sound', 'alert']
    }
  }
};

export default config;
