import { Capacitor } from '@capacitor/core';
import { PushNotifications } from '@capacitor/push-notifications';
import { supabase } from '@/integrations/supabase/client';
import { storageService } from '@/services/storageService';

/**
 * Service de notifications push (FCM) pour l'APK Capacitor.
 * - Demande la permission
 * - Enregistre l'appareil auprès de FCM
 * - Stocke le token FCM dans `device_push_tokens` (ciblage par hôtel)
 *
 * Le push ne fonctionne que dans l'APK installé (pas dans la preview navigateur).
 */
class PushNotificationService {
  private initialized = false;
  private currentToken: string | null = null;

  get isNative(): boolean {
    return Capacitor.isNativePlatform();
  }

  /** Déduit le type d'utilisateur courant à partir du stockage local. */
  private getUserType(): string {
    try {
      if (localStorage.getItem('housekeeper_profile')) return 'housekeeper';
      if (localStorage.getItem('governess_profile')) return 'governess';
      if (localStorage.getItem('technician_profile')) return 'technician';
      if (localStorage.getItem('cafetiere_profile')) return 'cafetiere';
    } catch { /* ignore */ }
    return 'staff';
  }

  private async saveToken(token: string): Promise<void> {
    this.currentToken = token;
    const hotelId = storageService.getHotelId();
    if (!hotelId) {
      // L'hôtel n'est pas encore choisi : on réessaiera via refreshHotelBinding().
      return;
    }
    try {
      await supabase
        .from('device_push_tokens')
        .upsert(
          {
            token,
            hotel_id: hotelId,
            user_type: this.getUserType(),
            platform: Capacitor.getPlatform(),
          },
          { onConflict: 'token' },
        );
    } catch (e) {
      console.warn('⚠️ Échec enregistrement token push:', e);
    }
  }

  /**
   * À appeler après le choix de l'hôtel : associe le token déjà obtenu
   * à l'hôtel courant.
   */
  async refreshHotelBinding(): Promise<void> {
    if (this.currentToken) {
      await this.saveToken(this.currentToken);
    }
  }

  async initialize(): Promise<void> {
    if (!this.isNative || this.initialized) return;
    this.initialized = true;

    try {
      let perm = await PushNotifications.checkPermissions();
      if (perm.receive !== 'granted') {
        perm = await PushNotifications.requestPermissions();
      }
      if (perm.receive !== 'granted') {
        console.warn('📱 Permission push refusée');
        return;
      }

      PushNotifications.addListener('registration', (token) => {
        console.log('📱 Token FCM obtenu');
        this.saveToken(token.value);
      });

      PushNotifications.addListener('registrationError', (err) => {
        console.warn('📱 Erreur enregistrement push:', err);
      });

      await PushNotifications.register();
    } catch (e) {
      console.warn('⚠️ Échec init push notifications:', e);
    }
  }
}

export const pushNotificationService = new PushNotificationService();
