import { useCallback } from 'react';

export const useNotificationSound = () => {
  const playNotificationSound = useCallback((type: 'success' | 'warning' | 'error' | 'info' = 'info') => {
    try {
      // Create audio context for different notification types
      const audioContext = new (window.AudioContext || (window as any).webkitAudioContext)();
      
      // Different frequencies for different notification types
      const frequencies = {
        success: [523.25, 659.25, 783.99], // C5, E5, G5 - pleasant chord
        warning: [440, 554.37], // A4, C#5 - attention-grabbing
        error: [220, 246.94], // A3, B3 - lower, more serious
        info: [523.25, 698.46] // C5, F5 - neutral
      };
      
      const freq = frequencies[type];
      const duration = type === 'error' ? 0.3 : 0.2;
      
      freq.forEach((frequency, index) => {
        const oscillator = audioContext.createOscillator();
        const gainNode = audioContext.createGain();
        
        oscillator.connect(gainNode);
        gainNode.connect(audioContext.destination);
        
        oscillator.frequency.setValueAtTime(frequency, audioContext.currentTime);
        oscillator.type = 'sine';
        
        // Volume envelope
        gainNode.gain.setValueAtTime(0, audioContext.currentTime);
        gainNode.gain.linearRampToValueAtTime(0.1, audioContext.currentTime + 0.01);
        gainNode.gain.exponentialRampToValueAtTime(0.001, audioContext.currentTime + duration);
        
        const startTime = audioContext.currentTime + (index * 0.05);
        oscillator.start(startTime);
        oscillator.stop(startTime + duration);
      });
    } catch (error) {
      // Fallback: try to use system notification sound
      console.warn('Could not play custom notification sound:', error);
      try {
        // Modern browsers support system sounds
        if ('vibrate' in navigator) {
          navigator.vibrate(type === 'error' ? [200, 100, 200] : [100]);
        }
      } catch (fallbackError) {
        console.warn('No notification sound available:', fallbackError);
      }
    }
  }, []);

  return {
    playNotificationSound,
    playSuccess: () => playNotificationSound('success'),
    playWarning: () => playNotificationSound('warning'),
    playError: () => playNotificationSound('error'),
    playInfo: () => playNotificationSound('info')
  };
};