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
      overlaysWebView: true,
      style: 'DEFAULT'
    },
    Keyboard: {
      resize: "body",
    },
    SplashScreen: {
      launchAutoHide: false,
      backgroundColor: "#fdf2f8",
      showSpinner: false,
      splashFullScreen: true,
      splashImmersive: true,
      androidScaleType: "CENTER_CROP",
    }
  }
};

export default config;
