import { createRoot } from 'react-dom/client'
import { Capacitor } from '@capacitor/core'
import App from './App.tsx'
import './index.css'

// Güvenli alan düzeltmelerinin kapsamı:
//  `native-shell` — iOS ve Android (Android 15+ edge-to-edge çiziyor),
//  `ios-native`   — yalnızca iOS'a özgü davranışlar için ayrıca duruyor.
if (Capacitor.isNativePlatform()) {
  document.documentElement.classList.add('native-shell');
  if (Capacitor.getPlatform() === 'ios') {
    document.documentElement.classList.add('ios-native');
  }
}

// iOS WebKit `:active` stilini yalnızca sayfada bir dokunma dinleyicisi varsa
// güvenilir biçimde uyguluyor. Basma geri bildirimi (index.css) buna dayanıyor.
document.addEventListener('touchstart', () => {}, { passive: true });

createRoot(document.getElementById("root")!).render(<App />);
