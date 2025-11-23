import React, { useEffect, useState } from 'react';
import { Card } from '@/components/ui/card';
import { TrendingUp, Zap } from 'lucide-react';

interface Props {
  newLevel: number;
  onClose: () => void;
}

export const LevelUpNotification: React.FC<Props> = ({ newLevel, onClose }) => {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    setTimeout(() => setVisible(true), 100);
    
    const timer = setTimeout(() => {
      setVisible(false);
      setTimeout(onClose, 300);
    }, 4000);

    return () => clearTimeout(timer);
  }, [onClose]);

  return (
    <div
      className={`fixed top-4 right-4 z-50 transition-all duration-300 transform ${
        visible ? 'translate-x-0 opacity-100 scale-100' : 'translate-x-full opacity-0 scale-90'
      }`}
    >
      <Card className="p-6 max-w-sm bg-gradient-to-br from-emerald-500 via-green-500 to-teal-600 shadow-2xl border-2 border-white/50 relative overflow-hidden">
        <div className="absolute inset-0">
          <div className="absolute inset-0 bg-white/10 animate-pulse" />
          {[...Array(8)].map((_, i) => (
            <Zap
              key={i}
              className="absolute text-yellow-300 animate-ping"
              style={{
                top: `${Math.random() * 100}%`,
                left: `${Math.random() * 100}%`,
                animationDelay: `${i * 0.2}s`,
                opacity: 0.6
              }}
            />
          ))}
        </div>

        <div className="relative z-10 text-center">
          <TrendingUp className="h-16 w-16 text-white mx-auto mb-3 animate-bounce" />
          <h3 className="text-white font-bold text-2xl mb-2">
            🎉 NIVEAU SUPÉRIEUR !
          </h3>
          <div className="text-6xl font-black text-white mb-2 drop-shadow-lg">
            {newLevel}
          </div>
          <p className="text-white/90 text-sm">
            Continuez comme ça ! Vous progressez rapidement !
          </p>
        </div>
      </Card>
    </div>
  );
};
