import { Capacitor } from '@capacitor/core';
import { Camera, CameraResultType, CameraSource } from '@capacitor/camera';

/**
 * Service unifié pour capture photo : utilise l'API native Capacitor sur APK,
 * et fallback sur un input HTML pour le web.
 */
class NativeCameraService {
  get isNative(): boolean {
    return Capacitor.isNativePlatform();
  }

  /**
   * Demande les permissions caméra (nécessaire avant le premier usage sur Android).
   */
  async requestPermissions(): Promise<boolean> {
    if (!this.isNative) return true;
    try {
      const status = await Camera.checkPermissions();
      if (status.camera === 'granted' && status.photos === 'granted') return true;
      const req = await Camera.requestPermissions({ permissions: ['camera', 'photos'] });
      return req.camera === 'granted';
    } catch (e) {
      console.warn('⚠️ Camera permission error:', e);
      return false;
    }
  }

  /**
   * Ouvre l'appareil photo natif et retourne un File.
   * @param source 'camera' pour caméra arrière, 'photos' pour galerie, 'prompt' pour choix
   */
  async takePhoto(source: 'camera' | 'photos' | 'prompt' = 'camera'): Promise<File | null> {
    if (!this.isNative) {
      throw new Error('Native camera only available on APK/iOS');
    }

    const granted = await this.requestPermissions();
    if (!granted) {
      throw new Error('Permission caméra refusée');
    }

    const cameraSource =
      source === 'camera' ? CameraSource.Camera :
      source === 'photos' ? CameraSource.Photos :
      CameraSource.Prompt;

    const photo = await Camera.getPhoto({
      quality: 80,
      allowEditing: false,
      resultType: CameraResultType.DataUrl,
      source: cameraSource,
      saveToGallery: false,
    });

    if (!photo.dataUrl) return null;

    // Convert dataUrl -> File
    const res = await fetch(photo.dataUrl);
    const blob = await res.blob();
    const ext = photo.format || 'jpg';
    return new File([blob], `photo-${Date.now()}.${ext}`, { type: blob.type || `image/${ext}` });
  }
}

export const nativeCameraService = new NativeCameraService();
