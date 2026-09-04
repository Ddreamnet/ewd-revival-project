import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.englishwithdilara.app',
  appName: 'English with Dilara',
  webDir: 'dist',
  plugins: {
    PushNotifications: {
      presentationOptions: ["badge", "sound", "alert"]
    },
    // Capacitor 8'de durum çubuğu / gesture bar çekirdeğe taşındı: eklenti adı
    // SystemBars. Buradaki eski `StatusBar` bloğu @capacitor/status-bar kurulu
    // olmadığı için hiçbir şey yapmıyordu.
    // `insetsHandling: "css"` Android 15+ cihazlarda --safe-area-inset-* CSS
    // değişkenlerini <html> üzerine yazar; panel bunları env() ile birlikte
    // max() içinde kullanıyor (src/styles/panel.css).
    SystemBars: {
      style: 'DEFAULT',
      insetsHandling: 'css'
    },
    Keyboard: {
      resize: "body",
    },
    SplashScreen: {
      launchAutoHide: false,
      backgroundColor: "#FFF8EF",  // panelin krem zemini — açılışta beyaz/pembe flaş olmasın
      showSpinner: false,
      splashFullScreen: true,
      splashImmersive: true,
      androidScaleType: "CENTER_CROP",
    }
  }
};

export default config;
