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

  // Animate scan line - FASTER
  useEffect(() => {
    if (detection?.status === 'scanning') {
      const interval = setInterval(() => {
        setScanLinePosition(prev => (prev + 4) % 100); // Faster animation
      }, 20);
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
    if (!detection) return '📐 Placez l\'angle gauche sur le repère';
    switch (detection.status) {
      case 'scanning': return '⚡ Détection rapide...';
      case 'stabilizing': return `Stabilisation ${Math.round(detection.stabilityProgress)}%`;
      case 'ready': return '✓ Validez pour confirmer';
      case 'confirmed': return 'Capture...';
      default: return 'Positionnez le linge';
    }
  };

  const getStatusIcon = () => {
    if (!detection) return <Eye className="h-5 w-5" />;
    switch (detection.status) {
      case 'scanning': return <Zap className="h-5 w-5 text-blue-400" />;
      case 'stabilizing': return <Loader2 className="h-5 w-5 animate-spin" />;
      case 'ready': return <CheckCircle className="h-5 w-5 text-green-400" />;
      case 'confirmed': return <CheckCircle className="h-5 w-5 text-green-500" />;
      default: return <Eye className="h-5 w-5" />;
    }
  };

  // Time remaining
  const getTimeRemaining = () => {
    if (!detection || detection.status !== 'stabilizing') return null;
    const remaining = Math.ceil((100 - detection.stabilityProgress) / 100); // ~1s total
    return remaining > 0 ? `~${remaining}s` : null;
  };

  return (
    <div className="absolute inset-0 pointer-events-none z-20">
      {/* Quality warnings - top bar */}
      {imageQuality && imageQuality.suggestions.length > 0 && (
        <div className="absolute top-2 left-2 right-2 z-30">
          <div className="bg-orange-500/90 backdrop-blur rounded-lg px-2 py-1.5 flex items-center gap-2 pointer-events-auto">
            <AlertCircle className="h-4 w-4 text-white flex-shrink-0" />
            <span className="text-white text-xs font-medium">
              {imageQuality.suggestions[0]}
            </span>
          </div>
        </div>
      )}

      {/* Main frame area with 90° corner guide */}
      <div className="absolute inset-2 sm:inset-4 flex items-center justify-center">
        <div
          className={cn(
            "relative w-full max-w-lg aspect-[16/10] rounded-xl border-3 transition-all duration-200",
            getStatusColor(),
            pulseAnimation && detection?.status === 'scanning' && "animate-pulse"
          )}
        >
          {/* 90° ANGLE GUIDE - LEFT CORNER */}
          <div className="absolute -left-1 top-1/2 -translate-y-1/2 z-30">
            {/* Vertical guide line */}
            <div className="absolute left-0 w-1 h-32 bg-gradient-to-b from-red-500 via-yellow-400 to-green-500 rounded-full shadow-lg" />
            {/* 90° corner marker */}
            <div className="absolute left-1 top-1/2 -translate-y-1/2">
              <div className="relative">
                {/* Corner angle indicator */}
                <svg width="50" height="50" className="text-white drop-shadow-lg">
                  {/* 90° angle lines */}
                  <line x1="5" y1="25" x2="45" y2="25" stroke="white" strokeWidth="2" strokeDasharray="4,2" />
                  <line x1="5" y1="5" x2="5" y2="45" stroke="white" strokeWidth="2" strokeDasharray="4,2" />
                  {/* 90° arc */}
                  <path d="M 5 18 A 7 7 0 0 1 12 25" fill="none" stroke="#22c55e" strokeWidth="2" />
                  {/* Angle label */}
                  <text x="15" y="18" fill="#22c55e" fontSize="10" fontWeight="bold">90°</text>
                </svg>
              </div>
            </div>
            {/* Arrow pointing to corner */}
            <div className="absolute left-12 top-1/2 -translate-y-1/2 bg-black/80 backdrop-blur px-2 py-1 rounded text-xs text-white whitespace-nowrap">
              ← Angle ici
            </div>
          </div>

          {/* Ruler scale on left */}
          <div className="absolute left-2 top-4 bottom-4 w-6 flex flex-col justify-between items-center">
            {[30, 25, 20, 15, 10, 5, 0].map((cm) => (
              <div key={cm} className="flex items-center gap-1">
                <div className={cn(
                  "w-3 h-0.5",
                  cm % 10 === 0 ? "bg-red-400" : "bg-white/60"
                )} />
                <span className="text-[8px] text-white/80">{cm}</span>
              </div>
            ))}
          </div>

          {/* Corner markers */}
          <div className="absolute -top-1 -left-1 w-6 h-6 border-t-3 border-l-3 rounded-tl-lg border-current" />
          <div className="absolute -top-1 -right-1 w-6 h-6 border-t-3 border-r-3 rounded-tr-lg border-current" />
          <div className="absolute -bottom-1 -left-1 w-6 h-6 border-b-3 border-l-3 rounded-bl-lg border-current" />
          <div className="absolute -bottom-1 -right-1 w-6 h-6 border-b-3 border-r-3 rounded-br-lg border-current" />

          {/* Fast scanning line */}
          {detection?.status === 'scanning' && (
            <div 
              className="absolute inset-x-8 h-0.5 bg-gradient-to-r from-transparent via-blue-400 to-transparent rounded"
              style={{ top: `${scanLinePosition}%` }}
            />
          )}

          {/* Center guide when no detection */}
          {!detection && (
            <div className="absolute inset-0 flex items-center justify-center">
              <div className="text-center text-white/90 px-4">
                <div className="text-3xl mb-1">📐</div>
                <p className="text-xs">Alignez le bord gauche sur l'angle 90°</p>
              </div>
            </div>
          )}

          {/* Live count during scanning */}
          {detection && detection.status === 'scanning' && detection.estimatedCount > 0 && (
            <div className="absolute inset-0 flex items-center justify-center">
              <div className="bg-black/70 backdrop-blur rounded-xl px-4 py-3 text-center">
                <div className="text-3xl font-bold text-white">{detection.estimatedCount}</div>
                <div className="text-xs text-white/70">{linenTypeName}</div>
              </div>
            </div>
          )}

          {/* Width indicator when detected */}
          {detection?.dimensions.widthCm && (
            <div className="absolute -bottom-7 left-1/2 -translate-x-1/2 flex items-center gap-1">
              <div className="h-px w-6 bg-green-400" />
              <Badge variant="secondary" className="bg-green-500/90 text-white text-xs px-2">
                <Ruler className="h-3 w-3 mr-1" />
                ~{detection.dimensions.widthCm}cm → {detection.linenType || linenTypeName}
              </Badge>
              <div className="h-px w-6 bg-green-400" />
            </div>
          )}
        </div>
      </div>

      {/* Compact status bar */}
      <div className="absolute bottom-20 left-2 right-2">
        <div className="bg-black/85 backdrop-blur rounded-xl p-3 pointer-events-auto">
          {/* Status */}
          <div className="flex items-center justify-between text-white mb-2">
            <div className="flex items-center gap-2">
              {getStatusIcon()}
              <span className="text-sm font-medium">{getStatusText()}</span>
            </div>
            {getTimeRemaining() && (
              <span className="text-xs text-white/60">{getTimeRemaining()}</span>
            )}
          </div>

          {/* Progress bar */}
          {detection?.status === 'stabilizing' && (
            <div className="w-full h-1.5 bg-white/20 rounded-full overflow-hidden mb-2">
              <div
                className="h-full bg-gradient-to-r from-yellow-400 to-green-400 transition-all duration-150"
                style={{ width: `${detection.stabilityProgress}%` }}
              />
            </div>
          )}

          {/* Ready state */}
          {detection && detection.status === 'ready' && (
            <div className="space-y-2">
              {/* Type mismatch warning */}
              {detection.linenType && detection.linenType !== linenTypeName && (
                <div className="flex items-center gap-1 text-yellow-400 text-xs">
                  <AlertCircle className="h-3 w-3" />
                  <span>Détecté: {detection.linenType}</span>
                </div>
              )}

              {/* Count + confidence */}
              <div className="flex items-center justify-between">
                <div className="text-white">
                  <span className="text-xl font-bold">{detection.estimatedCount}</span>
                  <span className="text-xs ml-1 opacity-80">{linenTypeName}</span>
                </div>
                <Badge className={cn(
                  "text-xs",
                  detection.confidence >= 0.7 ? "bg-green-500" :
                  detection.confidence >= 0.5 ? "bg-yellow-500" : "bg-red-500"
                )}>
                  {Math.round(detection.confidence * 100)}%
                </Badge>
              </div>

              {/* Validate button */}
              <button
                onClick={onValidate}
                className="w-full py-2.5 mt-1 bg-green-500 hover:bg-green-600 text-white font-semibold rounded-lg transition-colors flex items-center justify-center gap-2"
              >
                <CheckCircle className="h-4 w-4" />
                Valider
              </button>
            </div>
          )}

          {/* Instant mode */}
          {instantMode && detection?.status === 'scanning' && onInstantCapture && detection.estimatedCount > 0 && (
            <button
              onClick={onInstantCapture}
              className="w-full py-2 mt-1 bg-blue-500 hover:bg-blue-600 text-white font-medium rounded-lg transition-colors flex items-center justify-center gap-2 text-sm"
            >
              <Zap className="h-4 w-4" />
              Snap ({detection.estimatedCount})
            </button>
          )}
        </div>
      </div>

      {/* Quality badges - top right */}
      {imageQuality && (
        <div className="absolute top-12 right-2 flex flex-col gap-1">
          <Badge 
            variant="secondary" 
            className={cn(
              "text-[10px]",
              imageQuality.isBlurry ? "bg-red-500/80 text-white" : "bg-green-500/80 text-white"
            )}
          >
            {imageQuality.isBlurry ? "Flou" : "✓"}
          </Badge>
          <Badge 
            variant="secondary" 
            className={cn(
              "text-[10px]",
              imageQuality.isTooDark || imageQuality.isTooLight 
                ? "bg-orange-500/80 text-white" 
                : "bg-green-500/80 text-white"
            )}
          >
            {imageQuality.isTooDark ? "Sombre" : 
             imageQuality.isTooLight ? "Clair" : "✓"}
          </Badge>
        </div>
      )}
    </div>
  );
};

export default LinenDetectionOverlay;
