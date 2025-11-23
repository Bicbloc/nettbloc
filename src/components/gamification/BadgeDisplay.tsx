import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Lock } from 'lucide-react';

interface BadgeData {
  code: string;
  name: string;
  description: string;
  icon: string;
  rarity: string;
  points: number;
  unlocked?: boolean;
  unlocked_at?: string;
}

interface Props {
  badges: BadgeData[];
  title?: string;
}

export const BadgeDisplay: React.FC<Props> = ({ badges, title = "Badges" }) => {
  const getRarityStyles = (rarity: string) => {
    switch (rarity) {
      case 'legendary':
        return 'bg-gradient-to-br from-yellow-400 via-orange-500 to-red-500 border-yellow-300';
      case 'epic':
        return 'bg-gradient-to-br from-purple-500 via-pink-500 to-purple-600 border-purple-400';
      case 'rare':
        return 'bg-gradient-to-br from-blue-500 via-cyan-500 to-blue-600 border-blue-400';
      default:
        return 'bg-gradient-to-br from-gray-400 via-gray-500 to-gray-600 border-gray-400';
    }
  };

  const getRarityLabel = (rarity: string) => {
    switch (rarity) {
      case 'legendary': return '🌟 Légendaire';
      case 'epic': return '💜 Épique';
      case 'rare': return '💎 Rare';
      default: return '⚪ Commun';
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>{title} ({badges.filter(b => b.unlocked).length}/{badges.length})</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-4">
          {badges.map((badge) => (
            <div
              key={badge.code}
              className={`relative rounded-lg p-4 border-2 transition-all ${
                badge.unlocked
                  ? getRarityStyles(badge.rarity) + ' shadow-lg hover:scale-105 cursor-pointer'
                  : 'bg-gray-100 border-gray-300 opacity-50'
              }`}
            >
              {!badge.unlocked && (
                <div className="absolute inset-0 flex items-center justify-center bg-black/30 rounded-lg backdrop-blur-sm">
                  <Lock className="h-8 w-8 text-white" />
                </div>
              )}
              
              <div className="text-center">
                <div className={`text-5xl mb-2 ${!badge.unlocked && 'grayscale'}`}>
                  {badge.icon}
                </div>
                <h4 className={`font-bold text-sm mb-1 ${badge.unlocked ? 'text-white' : 'text-gray-600'}`}>
                  {badge.name}
                </h4>
                <p className={`text-xs mb-2 ${badge.unlocked ? 'text-white/80' : 'text-gray-500'}`}>
                  {badge.description}
                </p>
                
                {badge.unlocked ? (
                  <div className="space-y-1">
                    <Badge variant="secondary" className="text-xs bg-white/20 text-white border-white/30">
                      {getRarityLabel(badge.rarity)}
                    </Badge>
                    <p className="text-xs text-white/70">
                      +{badge.points} XP
                    </p>
                    {badge.unlocked_at && (
                      <p className="text-xs text-white/60">
                        {new Date(badge.unlocked_at).toLocaleDateString('fr-FR', {
                          day: 'numeric',
                          month: 'short'
                        })}
                      </p>
                    )}
                  </div>
                ) : (
                  <Badge variant="outline" className="text-xs">
                    Verrouillé
                  </Badge>
                )}
              </div>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
};
