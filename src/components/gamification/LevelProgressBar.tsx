import React from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { TrendingUp, Zap } from 'lucide-react';

interface Props {
  currentLevel: number;
  totalXp: number;
  currentStreak: number;
}

export const LevelProgressBar: React.FC<Props> = ({ currentLevel, totalXp, currentStreak }) => {
  // Calculer l'XP nécessaire pour le prochain niveau
  const xpForCurrentLevel = Math.pow(currentLevel - 1, 2) * 100;
  const xpForNextLevel = Math.pow(currentLevel, 2) * 100;
  const xpInCurrentLevel = totalXp - xpForCurrentLevel;
  const xpNeededForNextLevel = xpForNextLevel - xpForCurrentLevel;
  const progressPercentage = (xpInCurrentLevel / xpNeededForNextLevel) * 100;

  return (
    <Card className="bg-gradient-to-r from-indigo-600 to-purple-600 border-none text-white">
      <CardContent className="pt-4 pb-4">
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
            <div className="h-12 w-12 rounded-full bg-white/20 flex items-center justify-center font-bold text-xl">
              {currentLevel}
            </div>
            <div>
              <p className="text-xs text-white/70">Niveau</p>
              <p className="font-bold text-lg">Niveau {currentLevel}</p>
            </div>
          </div>

          {currentStreak > 0 && (
            <Badge variant="secondary" className="bg-orange-500 text-white border-none flex items-center gap-1">
              🔥 {currentStreak} {currentStreak === 1 ? 'jour' : 'jours'}
            </Badge>
          )}
        </div>

        <div className="mb-2">
          <div className="flex items-center justify-between text-xs mb-1">
            <span className="flex items-center gap-1">
              <Zap className="h-3 w-3" />
              {xpInCurrentLevel} / {xpNeededForNextLevel} XP
            </span>
            <span className="flex items-center gap-1">
              <TrendingUp className="h-3 w-3" />
              Niveau {currentLevel + 1}
            </span>
          </div>
          <div className="w-full bg-white/20 rounded-full h-3 overflow-hidden">
            <div
              className="bg-gradient-to-r from-yellow-400 to-orange-500 h-3 rounded-full transition-all duration-500 shadow-lg"
              style={{ width: `${Math.min(progressPercentage, 100)}%` }}
            />
          </div>
        </div>

        <p className="text-xs text-white/70 text-center">
          Total: {totalXp} XP
        </p>
      </CardContent>
    </Card>
  );
};
