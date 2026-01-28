import React, { useState, useEffect } from 'react';
import { cn } from '@/lib/utils';
import { CheckCircle, AlertCircle, Ruler, Eye, Loader2, Zap, Camera } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { ImageQuality } from '@/utils/imageProcessing';

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
  imageQuality?: ImageQuality | null;
  instantMode?: boolean;
  onInstantCapture?: () => void;
}

export const LinenDetectionOverlay: React.FC<LinenDetectionOverlayProps> = ({
  detection,
  isActive,
  onValidate,
  linenTypeName,
  imageQuality,
  instantMode = false,
  onInstantCapture,
}) => {
  const [pulseAnimation, setPulseAnimation] = useState(true);
  const [scanLinePosition, setScanLinePosition] = useState(0);

  useEffect(() => {
    if (detection?.status === 'ready') {
      setPulseAnimation(false);
    } else {
      setPulseAnimation(true);
    }
  }, [detection?.status]);

  // Animate scan line
  useEffect(() => {
    if (detection?.status === 'scanning') {
      const interval = setInterval(() => {
        setScanLinePosition(prev => (prev + 2) % 100);
      }, 30);
      return () => clearInterval(interval);
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
      case 'scanning': return 'Détection rapide...';
      case 'stabilizing': return `Stabilisation... ${Math.round(detection.stabilityProgress)}%`;
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

  // Estimated time remaining for stabilization
  const getTimeRemaining = () => {
    if (!detection || detection.status !== 'stabilizing') return null;
    const remaining = Math.ceil((100 - detection.stabilityProgress) / 50); // ~2 seconds total
    return remaining > 0 ? `~${remaining}s` : null;
  };

  return (
    <div className="absolute inset-0 pointer-events-none z-20">
      {/* Quality indicators - top bar */}
      {imageQuality && imageQuality.suggestions.length > 0 && (
        <div className="absolute top-4 left-4 right-4 z-30">
          <div className="bg-orange-500/90 backdrop-blur rounded-lg px-3 py-2 flex items-center gap-2 pointer-events-auto">
            <AlertCircle className="h-4 w-4 text-white flex-shrink-0" />
            <span className="text-white text-sm font-medium">
              {imageQuality.suggestions[0]}
            </span>
          </div>
        </div>
      )}

      {/* Detection frame - like ID scanner */}
      <div className="absolute inset-4 sm:inset-8 flex items-center justify-center">
        <div
          className={cn(
            "relative w-full max-w-md aspect-[4/3] rounded-2xl border-4 transition-all duration-300",
            getStatusColor(),
            pulseAnimation && detection?.status === 'scanning' && "animate-pulse"
          )}
        >
          {/* Corner markers */}
          <div className="absolute -top-1 -left-1 w-8 h-8 border-t-4 border-l-4 rounded-tl-lg border-current" />
          <div className="absolute -top-1 -right-1 w-8 h-8 border-t-4 border-r-4 rounded-tr-lg border-current" />
          <div className="absolute -bottom-1 -left-1 w-8 h-8 border-b-4 border-l-4 rounded-bl-lg border-current" />
          <div className="absolute -bottom-1 -right-1 w-8 h-8 border-b-4 border-r-4 rounded-br-lg border-current" />

          {/* Scanning line animation */}
          {detection?.status === 'scanning' && (
            <div 
              className="absolute inset-x-2 h-1 bg-gradient-to-r from-transparent via-blue-400 to-transparent rounded"
              style={{ top: `${scanLinePosition}%` }}
            />
          )}

          {/* Center guide when no detection */}
          {!detection && (
            <div className="absolute inset-0 flex items-center justify-center">
              <div className="text-center text-white/80">
                <div className="text-4xl mb-2">📦</div>
                <p className="text-sm">Placez la pile de linge ici</p>
              </div>
            </div>
          )}

          {/* Live count preview during scanning */}
          {detection && detection.status === 'scanning' && detection.estimatedCount > 0 && (
            <div className="absolute inset-0 flex items-center justify-center">
              <div className="bg-black/60 backdrop-blur rounded-xl px-6 py-4 text-center">
                <div className="text-4xl font-bold text-white">{detection.estimatedCount}</div>
                <div className="text-sm text-white/70">{linenTypeName}</div>
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
          <div className="flex items-center justify-between text-white mb-3">
            <div className="flex items-center gap-2">
              {getStatusIcon()}
              <span className="text-sm font-medium">{getStatusText()}</span>
            </div>
            {getTimeRemaining() && (
              <span className="text-xs text-white/60">{getTimeRemaining()}</span>
            )}
          </div>

          {/* Stability progress bar */}
          {detection?.status === 'stabilizing' && (
            <div className="w-full h-2 bg-white/20 rounded-full overflow-hidden mb-3">
              <div
                className="h-full bg-gradient-to-r from-yellow-400 to-green-400 transition-all duration-200"
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

          {/* Instant mode button */}
          {instantMode && detection?.status === 'scanning' && onInstantCapture && (
            <button
              onClick={onInstantCapture}
              className="w-full py-3 mt-2 bg-blue-500 hover:bg-blue-600 text-white font-semibold rounded-lg transition-colors flex items-center justify-center gap-2"
            >
              <Zap className="h-5 w-5" />
              Snap Instant
            </button>
          )}
        </div>
      </div>

      {/* Image quality indicators - corner badges */}
      {imageQuality && (
        <div className="absolute top-16 right-4 flex flex-col gap-1">
          {/* Sharpness */}
          <Badge 
            variant="secondary" 
            className={cn(
              "text-xs",
              imageQuality.isBlurry ? "bg-red-500/80 text-white" : "bg-green-500/80 text-white"
            )}
          >
            {imageQuality.isBlurry ? "🔍 Flou" : "✓ Net"}
          </Badge>
          
          {/* Brightness */}
          <Badge 
            variant="secondary" 
            className={cn(
              "text-xs",
              imageQuality.isTooDark || imageQuality.isTooLight 
                ? "bg-orange-500/80 text-white" 
                : "bg-green-500/80 text-white"
            )}
          >
            {imageQuality.isTooDark ? "🌙 Sombre" : 
             imageQuality.isTooLight ? "☀️ Clair" : "✓ Lumière"}
          </Badge>
        </div>
      )}
    </div>
  );
};

export default LinenDetectionOverlay;
