import React from 'react';

interface RulerGuideProps {
  isVisible: boolean;
  detectedRuler?: boolean;
  pileHeightCm?: number;
}

/**
 * Overlay de guidage pour le placement de la règle et de la pile de linge
 * Affiche des zones cibles et des conseils en temps réel
 */
export const RulerGuide: React.FC<RulerGuideProps> = ({ 
  isVisible, 
  detectedRuler = false,
  pileHeightCm 
}) => {
  if (!isVisible) return null;

  return (
    <div className="absolute inset-0 pointer-events-none">
      {/* Zone cible pour la règle (côté gauche) */}
      <div className="absolute left-4 top-1/4 bottom-1/4 w-12 border-2 border-dashed border-blue-400 rounded-lg flex items-center justify-center bg-blue-400/10">
        <span className="text-blue-400 text-xs font-medium transform -rotate-90 whitespace-nowrap">
          📏 RÈGLE ICI
        </span>
      </div>
      
      {/* Zone cible pour la pile de linge (centre) */}
      <div className="absolute left-1/4 right-8 top-1/6 bottom-1/6 border-2 border-dashed border-green-400 rounded-lg bg-green-400/5">
        <div className="absolute top-2 left-1/2 transform -translate-x-1/2 bg-black/60 text-white px-3 py-1 rounded-full text-xs">
          🧺 Placez la pile ici
        </div>
      </div>
      
      {/* Indicateur de détection de règle */}
      <div className={`absolute bottom-4 left-4 right-4 py-2 px-4 rounded-lg text-center text-sm font-medium transition-colors ${
        detectedRuler 
          ? 'bg-green-500/90 text-white' 
          : 'bg-yellow-500/90 text-black'
      }`}>
        {detectedRuler ? (
          <>
            ✅ Règle détectée
            {pileHeightCm && ` - Hauteur pile: ${pileHeightCm.toFixed(1)} cm`}
          </>
        ) : (
          <>📏 Placez la règle étalon colorée à côté de la pile</>
        )}
      </div>

      {/* Ligne de référence horizontale pour montrer l'alignement */}
      <div className="absolute left-0 right-0 top-1/2 h-px bg-white/30" />
      
      {/* Conseils de qualité (coins) */}
      <div className="absolute top-2 right-2 text-xs text-white/80 bg-black/50 px-2 py-1 rounded">
        💡 Bonne lumière = meilleur résultat
      </div>
    </div>
  );
};

/**
 * Overlay affichant le résultat du calcul basé sur la règle
 */
interface RulerCalculationOverlayProps {
  isVisible: boolean;
  pileHeightCm: number;
  itemThicknessCm: number;
  calculatedCount: number;
  confidence: number;
}

export const RulerCalculationOverlay: React.FC<RulerCalculationOverlayProps> = ({
  isVisible,
  pileHeightCm,
  itemThicknessCm,
  calculatedCount,
  confidence
}) => {
  if (!isVisible) return null;

  return (
    <div className="absolute top-16 left-1/2 transform -translate-x-1/2 bg-black/80 text-white p-4 rounded-xl shadow-lg max-w-xs text-center">
      <div className="text-3xl font-bold text-green-400 mb-2">
        {calculatedCount} pièces
      </div>
      <div className="text-sm space-y-1">
        <div className="flex justify-between">
          <span className="text-gray-400">Hauteur pile:</span>
          <span>{pileHeightCm.toFixed(1)} cm</span>
        </div>
        <div className="flex justify-between">
          <span className="text-gray-400">Épaisseur/pièce:</span>
          <span>{itemThicknessCm} cm</span>
        </div>
        <div className="flex justify-between">
          <span className="text-gray-400">Calcul:</span>
          <span>{pileHeightCm.toFixed(1)} ÷ {itemThicknessCm}</span>
        </div>
      </div>
      <div className="mt-2 pt-2 border-t border-white/20">
        <div className="flex items-center justify-center gap-2">
          <div 
            className="h-2 w-20 bg-gray-700 rounded-full overflow-hidden"
            title={`Confiance: ${(confidence * 100).toFixed(0)}%`}
          >
            <div 
              className={`h-full ${confidence >= 0.8 ? 'bg-green-500' : confidence >= 0.6 ? 'bg-yellow-500' : 'bg-red-500'}`}
              style={{ width: `${confidence * 100}%` }}
            />
          </div>
          <span className="text-xs">{(confidence * 100).toFixed(0)}%</span>
        </div>
      </div>
    </div>
  );
};
