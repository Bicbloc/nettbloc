import { ReactNode, useRef } from 'react';
import { nativeCameraService } from '@/services/nativeCameraService';
import { useToast } from '@/hooks/use-toast';

interface NativeCameraInputProps {
  /** Callback appelé avec le File capturé */
  onCapture: (file: File) => void;
  /** Source: caméra, galerie, ou choix */
  source?: 'camera' | 'photos' | 'prompt';
  /** Accept attribute pour le fallback HTML input */
  accept?: string;
  /** Classes pour le label wrapper */
  className?: string;
  /** Contenu visible (icône, texte) */
  children: ReactNode;
  /** Désactivé */
  disabled?: boolean;
}

/**
 * Wrapper universel pour la prise de photo qui fonctionne :
 * - En APK/iOS : utilise Camera native Capacitor (permissions + UI native)
 * - Sur le Web : fallback sur <input type="file" capture>
 *
 * Remplace les <label><input type="file" capture></label> dans toute l'app.
 */
export function NativeCameraInput({
  onCapture,
  source = 'camera',
  accept = 'image/*',
  className,
  children,
  disabled,
}: NativeCameraInputProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const { toast } = useToast();

  const handleClick = async (e: React.MouseEvent) => {
    if (disabled) return;
    if (nativeCameraService.isNative) {
      e.preventDefault();
      try {
        const file = await nativeCameraService.takePhoto(source);
        if (file) onCapture(file);
      } catch (err: any) {
        const msg = err?.message || '';
        if (msg.includes('cancelled') || msg.includes('User cancelled')) return;
        toast({
          title: 'Erreur caméra',
          description: msg || "Impossible d'ouvrir l'appareil photo",
          variant: 'destructive',
        });
      }
      return;
    }
    inputRef.current?.click();
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0];
    if (f) onCapture(f);
    e.target.value = '';
  };

  return (
    <button
      type="button"
      onClick={handleClick}
      disabled={disabled}
      className={className}
    >
      {children}
      {!nativeCameraService.isNative && (
        <input
          ref={inputRef}
          type="file"
          accept={accept}
          capture={source === 'camera' ? 'environment' : undefined}
          className="hidden"
          onChange={handleFileChange}
          disabled={disabled}
        />
      )}
    </button>
  );
}
