import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'app.lovable.b36a7a8c909b4be7a22cf96dedec2bb4',
  appName: 'nettobloc',
  webDir: 'dist',
  server: {
    url: 'https://nettobloc.bicbloc.eu?forceHideBadge=true&mode=staff',
    cleartext: true
  },
  plugins: {
    PushNotifications: {
      presentationOptions: ["badge", "sound", "alert"]
    }
  }
};

export default config;