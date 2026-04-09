import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'dev.kubovibe.app',
  appName: 'kubovibe',
  webDir: 'dist',
  server: {
    url: 'https://5ce8b966-167f-4e5a-be1c-165ac92bd64e.lovableproject.com?forceHideBadge=true',
    cleartext: true,
  },
  plugins: {
    UnityAds: {
      gameIdAndroid: 'zw52l859eq65bwtg',
      gameIdIos: 'zw52l859eq65bwtg',
      testMode: false,
    },
  },
};

export default config;
