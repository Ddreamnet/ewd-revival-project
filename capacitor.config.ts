import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.englishwithdilara.app',
  appName: 'English with Dilara',
  webDir: 'dist',
  plugins: {
    PushNotifications: {
      presentationOptions: ["badge", "sound", "alert"]
    },
    StatusBar: {
      overlaysWebView: true,  // varsayılan; açıkça belirtiliyor
      style: 'DEFAULT'
    }
  }
};

export default config;
