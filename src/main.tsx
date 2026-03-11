import { createRoot } from 'react-dom/client'
import { Capacitor } from '@capacitor/core'
import App from './App.tsx'
import './index.css'

// Add ios-native class only on iOS native app — scopes all safe area CSS overrides
if (Capacitor.isNativePlatform() && Capacitor.getPlatform() === 'ios') {
  document.documentElement.classList.add('ios-native');
}

createRoot(document.getElementById("root")!).render(<App />);
