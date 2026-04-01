import { Capacitor } from '@capacitor/core';
import { LocalNotifications } from '@capacitor/local-notifications';
import { Haptics, ImpactStyle, NotificationType } from '@capacitor/haptics';

/**
 * Service de notifications natives pour l'APK Capacitor.
 * Gère les notifications locales, la vibration et le son.
 */
class NativeNotificationService {
  private initialized = false;

  get isNative(): boolean {
    return Capacitor.isNativePlatform();
  }

  /**
   * Initialise les permissions de notification sur la plateforme native.
   */
  async initialize(): Promise<void> {
    if (!this.isNative || this.initialized) return;

    try {
      const permStatus = await LocalNotifications.checkPermissions();
      if (permStatus.display === 'prompt' || permStatus.display === 'prompt-with-rationale') {
        await LocalNotifications.requestPermissions();
      }
      this.initialized = true;
      console.log('📱 Native notifications initialized');
    } catch (error) {
      console.warn('⚠️ Failed to initialize native notifications:', error);
    }
  }

  /**
   * Envoie une notification locale avec son et vibration.
   */
  async sendNotification(options: {
    title: string;
    body: string;
    id?: number;
  }): Promise<void> {
    if (!this.isNative) return;

    try {
      // Vibration
      await Haptics.notification({ type: NotificationType.Warning });

      // Notification locale avec son par défaut du système
      await LocalNotifications.schedule({
        notifications: [
          {
            id: options.id || Date.now(),
            title: options.title,
            body: options.body,
            sound: 'default',
            smallIcon: 'ic_stat_icon_config_sample',
            largeIcon: 'ic_launcher',
          },
        ],
      });
    } catch (error) {
      console.warn('⚠️ Failed to send native notification:', error);
    }
  }

  /**
   * Vibration courte pour feedback tactile.
   */
  async vibrate(style: 'light' | 'medium' | 'heavy' = 'medium'): Promise<void> {
    if (!this.isNative) return;

    try {
      const impactMap = {
        light: ImpactStyle.Light,
        medium: ImpactStyle.Medium,
        heavy: ImpactStyle.Heavy,
      };
      await Haptics.impact({ style: impactMap[style] });
    } catch (error) {
      // Silently fail on non-native
    }
  }

  /**
   * Vibration type notification (succès, warning, erreur).
   */
  async notificationHaptic(type: 'success' | 'warning' | 'error' = 'warning'): Promise<void> {
    if (!this.isNative) return;

    try {
      const typeMap = {
        success: NotificationType.Success,
        warning: NotificationType.Warning,
        error: NotificationType.Error,
      };
      await Haptics.notification({ type: typeMap[type] });
    } catch (error) {
      // Silently fail
    }
  }
}

export const nativeNotificationService = new NativeNotificationService();
