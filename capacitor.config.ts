import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.englishwithdilara.app',
  appName: 'English with Dilara',
  webDir: 'dist',
  server: {
    url: 'https://62e18515-e696-45ea-b179-36f540b9f09d.lovableproject.com?forceHideBadge=true',
    cleartext: true,
  },
};

export default config;
