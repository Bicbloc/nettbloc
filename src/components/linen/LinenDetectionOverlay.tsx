import React, { useState, useEffect } from 'react';
import { cn } from '@/lib/utils';
import { CheckCircle, AlertCircle, Ruler, Eye, Loader2 } from 'lucide-react';
import { Badge } from '@/components/ui/badge';

interface DetectionState {
  status: 'scanning' | 'stabilizing' | 'ready' | 'confirmed';
  linenType: string | null;
  estimatedCount: number;
  dimensions: {
    widthCm: number | null;
    heightCm: number | null;
  };
  confidence: number;
  stabilityProgress: number; // 0-100
}

interface LinenDetectionOverlayProps {
  detection: DetectionState | null;
  isActive: boolean;
  onValidate: () => void;
  linenTypeName: string;
}

export const LinenDetectionOverlay: React.FC<LinenDetectionOverlayProps> = ({
  detection,
  isActive,
  onValidate,
  linenTypeName,
}) => {
  const [pulseAnimation, setPulseAnimation] = useState(true);

  useEffect(() => {
    if (detection?.status === 'ready') {
      setPulseAnimation(false);
    } else {
      setPulseAnimation(true);
    }
  }, [detection?.status]);

  if (!isActive) return null;

  const getStatusColor = () => {
    if (!detection) return 'border-white/50';
    switch (detection.status) {
      case 'scanning': return 'border-blue-400';
      case 'stabilizing': return 'border-yellow-400';
      case 'ready': return 'border-green-400';
      case 'confirmed': return 'border-green-500';
      default: return 'border-white/50';
    }
  };

  const getStatusText = () => {
    if (!detection) return 'Positionnez le linge dans le cadre';
    switch (detection.status) {
      case 'scanning': return 'Détection en cours...';
      case 'stabilizing': return 'Stabilisation... Ne bougez plus';
      case 'ready': return '✓ Pile détectée - Appuyez pour valider';
      case 'confirmed': return 'Capture en cours...';
      default: return 'Positionnez le linge';
    }
  };

  const getStatusIcon = () => {
    if (!detection) return <Eye className="h-5 w-5" />;
    switch (detection.status) {
      case 'scanning': return <Loader2 className="h-5 w-5 animate-spin" />;
      case 'stabilizing': return <Loader2 className="h-5 w-5 animate-spin" />;
      case 'ready': return <CheckCircle className="h-5 w-5 text-green-400" />;
      case 'confirmed': return <CheckCircle className="h-5 w-5 text-green-500" />;
      default: return <Eye className="h-5 w-5" />;
    }
  };

  return (
    <div className="absolute inset-0 pointer-events-none z-20">
      {/* Detection frame - like ID scanner */}
      <div className="absolute inset-4 sm:inset-8 flex items-center justify-center">
        <div
          className={cn(
            "relative w-full max-w-md aspect-[4/3] rounded-2xl border-4 transition-all duration-500",
            getStatusColor(),
            pulseAnimation && "animate-pulse"
          )}
        >
          {/* Corner markers */}
          <div className="absolute -top-1 -left-1 w-8 h-8 border-t-4 border-l-4 rounded-tl-lg border-current" />
          <div className="absolute -top-1 -right-1 w-8 h-8 border-t-4 border-r-4 rounded-tr-lg border-current" />
          <div className="absolute -bottom-1 -left-1 w-8 h-8 border-b-4 border-l-4 rounded-bl-lg border-current" />
          <div className="absolute -bottom-1 -right-1 w-8 h-8 border-b-4 border-r-4 rounded-br-lg border-current" />

          {/* Scanning line animation */}
          {detection?.status === 'scanning' && (
            <div className="absolute inset-x-2 top-0 h-1 bg-gradient-to-r from-transparent via-blue-400 to-transparent animate-scan-line" />
          )}

          {/* Center guide */}
          {!detection && (
            <div className="absolute inset-0 flex items-center justify-center">
              <div className="text-center text-white/80">
                <div className="text-4xl mb-2">📦</div>
                <p className="text-sm">Placez la pile de linge ici</p>
              </div>
            </div>
          )}

          {/* Dimension indicators when detected */}
          {detection?.dimensions.widthCm && (
            <>
              {/* Width indicator - top */}
              <div className="absolute -top-8 left-1/2 -translate-x-1/2 flex items-center gap-1">
                <div className="h-px w-4 bg-green-400" />
                <Badge variant="secondary" className="bg-green-500/90 text-white text-xs px-2">
                  <Ruler className="h-3 w-3 mr-1" />
                  ~{detection.dimensions.widthCm} cm
                </Badge>
                <div className="h-px w-4 bg-green-400" />
              </div>

              {/* Height indicator - right */}
              {detection.dimensions.heightCm && (
                <div className="absolute -right-12 top-1/2 -translate-y-1/2 flex flex-col items-center gap-1">
                  <div className="w-px h-4 bg-green-400" />
                  <Badge variant="secondary" className="bg-green-500/90 text-white text-xs px-2 rotate-90">
                    {detection.dimensions.heightCm} cm
                  </Badge>
                  <div className="w-px h-4 bg-green-400" />
                </div>
              )}
            </>
          )}
        </div>
      </div>

      {/* Status bar at bottom */}
      <div className="absolute bottom-24 left-4 right-4">
        <div className="bg-black/80 backdrop-blur rounded-xl p-4 pointer-events-auto">
          {/* Status message */}
          <div className="flex items-center justify-center gap-2 text-white mb-3">
            {getStatusIcon()}
            <span className="text-sm font-medium">{getStatusText()}</span>
          </div>

          {/* Stability progress bar */}
          {detection?.status === 'stabilizing' && (
            <div className="w-full h-2 bg-white/20 rounded-full overflow-hidden mb-3">
              <div
                className="h-full bg-gradient-to-r from-yellow-400 to-green-400 transition-all duration-300"
                style={{ width: `${detection.stabilityProgress}%` }}
              />
            </div>
          )}

          {/* Detection info when ready */}
          {detection && detection.status === 'ready' && (
            <div className="space-y-2">
              {/* Detected type suggestion */}
              {detection.linenType && detection.linenType !== linenTypeName && (
                <div className="flex items-center gap-2 text-yellow-400 text-xs">
                  <AlertCircle className="h-4 w-4" />
                  <span>Détecté: {detection.linenType} (attendu: {linenTypeName})</span>
                </div>
              )}

              {/* Count and confidence */}
              <div className="flex items-center justify-between">
                <div className="text-white">
                  <span className="text-2xl font-bold">{detection.estimatedCount}</span>
                  <span className="text-sm ml-2 opacity-80">{linenTypeName}</span>
                </div>
                <Badge className={cn(
                  detection.confidence >= 0.7 ? "bg-green-500" :
                  detection.confidence >= 0.5 ? "bg-yellow-500" : "bg-red-500"
                )}>
                  {Math.round(detection.confidence * 100)}%
                </Badge>
              </div>

              {/* Dimensions info */}
              {detection.dimensions.widthCm && (
                <div className="text-xs text-white/60 flex items-center gap-2">
                  <Ruler className="h-3 w-3" />
                  <span>
                    Largeur: ~{detection.dimensions.widthCm} cm
                    {detection.dimensions.heightCm && ` | Hauteur: ~${detection.dimensions.heightCm} cm`}
                  </span>
                </div>
              )}

              {/* Validate button */}
              <button
                onClick={onValidate}
                className="w-full py-3 mt-2 bg-green-500 hover:bg-green-600 text-white font-semibold rounded-lg transition-colors flex items-center justify-center gap-2"
              >
                <CheckCircle className="h-5 w-5" />
                Valider et capturer
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Add scan-line animation */}
      <style>{`
        @keyframes scan-line {
          0% { transform: translateY(0); opacity: 0; }
          50% { opacity: 1; }
          100% { transform: translateY(calc(100% * 3)); opacity: 0; }
        }
        .animate-scan-line {
          animation: scan-line 2s ease-in-out infinite;
        }
      `}</style>
    </div>
  );
};

export default LinenDetectionOverlay;
