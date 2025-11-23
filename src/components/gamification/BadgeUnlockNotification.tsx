import React, { useEffect, useState } from 'react';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Sparkles, Star } from 'lucide-react';

interface BadgeData {
  code: string;
  name: string;
  description: string;
  icon: string;
  rarity: string;
  points: number;
}

interface Props {
  badge: BadgeData;
  onClose: () => void;
}

export const BadgeUnlockNotification: React.FC<Props> = ({ badge, onClose }) => {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    // Animation d'entrée
    setTimeout(() => setVisible(true), 100);
    
    // Auto-fermeture après 5 secondes
    const timer = setTimeout(() => {
      setVisible(false);
      setTimeout(onClose, 300);
    }, 5000);

    return () => clearTimeout(timer);
  }, [onClose]);

  const getRarityColor = (rarity: string) => {
    switch (rarity) {
      case 'legendary': return 'from-yellow-500 via-orange-500 to-red-500';
      case 'epic': return 'from-purple-500 via-pink-500 to-purple-600';
      case 'rare': return 'from-blue-500 via-cyan-500 to-blue-600';
      default: return 'from-gray-400 via-gray-500 to-gray-600';
    }
  };

  return (
    <div
      className={`fixed top-4 right-4 z-50 transition-all duration-300 transform ${
        visible ? 'translate-x-0 opacity-100' : 'translate-x-full opacity-0'
      }`}
    >
      <Card className={`p-6 max-w-sm bg-gradient-to-br ${getRarityColor(badge.rarity)} shadow-2xl border-2 border-white/50 relative overflow-hidden`}>
        <div className="absolute inset-0 bg-white/10 backdrop-blur-sm" />
        
        {/* Étoiles animées */}
        <div className="absolute inset-0 overflow-hidden">
          {[...Array(6)].map((_, i) => (
            <Star
              key={i}
              className="absolute text-white/30 animate-pulse"
              style={{
                top: `${Math.random() * 100}%`,
                left: `${Math.random() * 100}%`,
                animationDelay: `${i * 0.3}s`,
                fontSize: `${10 + Math.random() * 20}px`
              }}
            />
          ))}
        </div>

        <div className="relative z-10">
          <div className="flex items-center gap-2 mb-3">
            <Sparkles className="h-5 w-5 text-white animate-bounce" />
            <h3 className="text-white font-bold text-lg">Nouveau Badge !</h3>
          </div>
          
          <div className="flex items-center gap-4 mb-3">
            <div className="text-6xl">{badge.icon}</div>
            <div className="flex-1 text-white">
              <h4 className="font-bold text-xl mb-1">{badge.name}</h4>
              <p className="text-sm text-white/90">{badge.description}</p>
            </div>
          </div>

          <div className="flex items-center justify-between">
            <Badge variant="secondary" className="bg-white/20 text-white border-white/30">
              {badge.rarity.toUpperCase()}
            </Badge>
            <div className="text-white font-bold text-lg">
              +{badge.points} XP
            </div>
          </div>
        </div>
      </Card>
    </div>
  );
};
