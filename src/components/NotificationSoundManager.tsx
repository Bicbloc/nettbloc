import { useEffect, useRef, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Bell, BellOff, Volume2, VolumeX } from 'lucide-react';
import { cn } from '@/lib/utils';

interface NotificationSoundManagerProps {
  notificationCount: number;
  onToggleSound: (enabled: boolean) => void;
  soundEnabled: boolean;
}

export function NotificationSoundManager({
  notificationCount,
  onToggleSound,
  soundEnabled
}: NotificationSoundManagerProps) {
  const [previousCount, setPreviousCount] = useState(notificationCount);
  const audioRef = useRef<HTMLAudioElement | null>(null);

  // Initialize audio
  useEffect(() => {
    // Créer un son de notification simple
    const audioContext = new (window.AudioContext || (window as any).webkitAudioContext)();
    
    const createNotificationSound = () => {
      const duration = 0.3;
      const sampleRate = audioContext.sampleRate;
      const numSamples = duration * sampleRate;
      const buffer = audioContext.createBuffer(1, numSamples, sampleRate);
      const data = buffer.getChannelData(0);

      // Générer un son de notification agréable
      for (let i = 0; i < numSamples; i++) {
        const time = i / sampleRate;
        const frequency1 = 800; // Note principale
        const frequency2 = 1200; // Harmonique
        data[i] = (
          Math.sin(2 * Math.PI * frequency1 * time) * 0.3 +
          Math.sin(2 * Math.PI * frequency2 * time) * 0.2
        ) * Math.exp(-time * 3); // Diminution progressive
      }

      return buffer;
    };

    const playSound = () => {
      if (!soundEnabled || !audioContext) return;

      try {
        const source = audioContext.createBufferSource();
        const gainNode = audioContext.createGain();
        
        source.buffer = createNotificationSound();
        source.connect(gainNode);
        gainNode.connect(audioContext.destination);
        
        gainNode.gain.setValueAtTime(0.1, audioContext.currentTime);
        source.start();
      } catch (error) {
        console.error('Erreur lors de la lecture du son:', error);
      }
    };

    // Jouer le son si le nombre de notifications a augmenté
    if (notificationCount > previousCount && previousCount >= 0) {
      playSound();
    }
    
    setPreviousCount(notificationCount);
  }, [notificationCount, previousCount, soundEnabled]);

  return (
    <div className="flex items-center gap-2">
      <Button
        variant="ghost"
        size="sm"
        onClick={() => onToggleSound(!soundEnabled)}
        className={cn(
          "p-2",
          soundEnabled ? "text-green-600 hover:text-green-700" : "text-gray-400 hover:text-gray-500"
        )}
        title={soundEnabled ? "Désactiver les sons" : "Activer les sons"}
      >
        {soundEnabled ? (
          <Volume2 className="h-4 w-4" />
        ) : (
          <VolumeX className="h-4 w-4" />
        )}
      </Button>
      
      <div className="relative">
        <Button
          variant="ghost"
          size="sm"
          className="p-2"
        >
          {notificationCount > 0 ? (
            <BellOff className="h-4 w-4 text-orange-600" />
          ) : (
            <Bell className="h-4 w-4 text-gray-600" />
          )}
        </Button>
        
        {notificationCount > 0 && (
          <Badge 
            variant="destructive" 
            className={cn(
              "absolute -top-1 -right-1 h-5 w-5 p-0 flex items-center justify-center text-xs",
              "animate-pulse"
            )}
          >
            {notificationCount > 99 ? '99+' : notificationCount}
          </Badge>
        )}
      </div>
    </div>
  );
}