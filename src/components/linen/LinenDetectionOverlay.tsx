import React, { useState, useEffect } from 'react';
import { cn } from '@/lib/utils';
import { CheckCircle, AlertCircle, Ruler, Loader2, Zap, Target, MoveLeft, MoveRight, Smartphone } from 'lucide-react';
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
  stabilityProgress: number;
  // New: pile position info
  pilePosition?: 'centered' | 'left' | 'right' | null;
  pileBounds?: {
    x: number; // 0-1 relative to frame
    y: number;
    width: number;
    height: number;
  } | null;
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

// Déterminer le type de linge suggéré par la largeur
const suggestLinenTypeByWidth = (widthCm: number | null): string | null => {
  if (!widthCm) return null;
  if (widthCm > 150) return 'Draps';
  if (widthCm >= 50 && widthCm <= 100) return 'Serviettes';
  if (widthCm >= 40 && widthCm < 55) return 'Taies';
  return null;
};

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

  // Animate scan line - FAST
  useEffect(() => {
    if (detection?.status === 'scanning') {
      const interval = setInterval(() => {
        setScanLinePosition(prev => (prev + 5) % 100);
      }, 15);
      return () => clearInterval(interval);
    }
  }, [detection?.status]);

  if (!isActive) return null;

  // Pile position guidance
  const pilePosition = detection?.pilePosition || null;
  const needsRepositioning = pilePosition === 'left' || pilePosition === 'right';
  const pileBounds = detection?.pileBounds || null;

  // Alignment status: check if pile is detected and positioned correctly
  const isAligned = detection && detection.estimatedCount > 0 && detection.confidence >= 0.5 && !needsRepositioning;
  const alignmentColor = isAligned ? '#22c55e' : '#ef4444'; // green : red

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
    if (!detection) return '📐 Alignez sur la règle "0"';
    switch (detection.status) {
      case 'scanning': return '⚡ Détection ultra-rapide...';
      case 'stabilizing': return `⏳ Stabilisation ${Math.round(detection.stabilityProgress)}%`;
      case 'ready': return '✅ Pile détectée - Validez';
      case 'confirmed': return '📸 Capture HD...';
      default: return 'Positionnez le linge';
    }
  };

  const getStatusIcon = () => {
    if (!detection) return <Target className="h-5 w-5" />;
    switch (detection.status) {
      case 'scanning': return <Zap className="h-5 w-5 text-blue-400" />;
      case 'stabilizing': return <Loader2 className="h-5 w-5 animate-spin" />;
      case 'ready': return <CheckCircle className="h-5 w-5 text-green-400" />;
      case 'confirmed': return <CheckCircle className="h-5 w-5 text-green-500" />;
      default: return <Target className="h-5 w-5" />;
    }
  };

  const getTimeRemaining = () => {
    if (!detection || detection.status !== 'stabilizing') return null;
    const remaining = Math.ceil((100 - detection.stabilityProgress) / 50);
    return remaining > 0 ? `~${remaining}s` : null;
  };

  // Suggested type based on width
  const suggestedType = suggestLinenTypeByWidth(detection?.dimensions.widthCm || null);

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

      {/* Main frame with enhanced 90° framing guide */}
      <div className="absolute inset-2 sm:inset-4 flex items-center justify-center">
        <div
          className={cn(
            "relative w-full max-w-lg aspect-[4/3] rounded-xl border-3 transition-all duration-200",
            getStatusColor(),
            pulseAnimation && detection?.status === 'scanning' && "animate-pulse"
          )}
        >
          {/* ========== LEFT SIDE: 90° ANGLE GUIDE + VERTICAL RULER ========== */}
          <div className="absolute -left-2 top-0 bottom-0 w-10 z-40">
            {/* Colored vertical ruler - gradient from 0 (bottom) to 30 (top) */}
            <div className="absolute left-0 top-0 bottom-0 w-2 bg-gradient-to-t from-green-500 via-yellow-400 to-red-500 rounded-full shadow-lg" />
            
            {/* Ruler scale marks */}
            <div className="absolute left-3 top-0 bottom-0 flex flex-col justify-between py-1">
              {[30, 25, 20, 15, 10, 5, 0].map((cm) => (
                <div key={cm} className="flex items-center gap-0.5">
                  <div className={cn(
                    "h-0.5",
                    cm === 0 ? "w-4 bg-green-400" : cm % 10 === 0 ? "w-3 bg-red-400" : "w-2 bg-white/60"
                  )} />
                  <span className={cn(
                    "text-[9px] font-bold",
                    cm === 0 ? "text-green-400" : "text-white/80"
                  )}>{cm}</span>
                </div>
              ))}
            </div>
          </div>

          {/* ========== BOTTOM: HORIZONTAL "ZERO" REFERENCE LINE ========== */}
          <div className="absolute -bottom-1 left-8 right-2 z-40">
            {/* Zero line - the starting point for pile measurement */}
            <div className="relative">
              {/* Main zero line */}
              <div 
                className="h-1 rounded-full shadow-lg"
                style={{ 
                  backgroundColor: alignmentColor,
                  boxShadow: `0 0 10px ${alignmentColor}80`
                }}
              />
              
              {/* Zero label */}
              <div 
                className="absolute -left-6 top-1/2 -translate-y-1/2 px-1.5 py-0.5 rounded text-[10px] font-bold shadow"
                style={{ backgroundColor: alignmentColor, color: 'white' }}
              >
                0
              </div>
              
              {/* Instruction arrow pointing up */}
              <div className="absolute left-1/2 -translate-x-1/2 -top-6 flex flex-col items-center">
                <span className="text-white text-lg">↑</span>
                <span 
                  className="text-[9px] font-medium px-1.5 py-0.5 rounded whitespace-nowrap"
                  style={{ backgroundColor: `${alignmentColor}CC`, color: 'white' }}
                >
                  Base de la pile ici
                </span>
              </div>
            </div>
          </div>

          {/* ========== 90° CORNER INDICATOR (bottom-left) ========== */}
          <div className="absolute -left-1 -bottom-1 z-50">
            <svg width="60" height="60" className="drop-shadow-lg">
              {/* 90° angle lines */}
              <line 
                x1="5" y1="55" x2="55" y2="55" 
                stroke={alignmentColor} 
                strokeWidth="3" 
                strokeLinecap="round"
              />
              <line 
                x1="5" y1="5" x2="5" y2="55" 
                stroke={alignmentColor} 
                strokeWidth="3" 
                strokeLinecap="round"
              />
              
              {/* 90° arc indicator */}
              <path 
                d="M 5 45 A 10 10 0 0 1 15 55" 
                fill="none" 
                stroke={alignmentColor} 
                strokeWidth="2" 
              />
              
              {/* 90° label */}
              <text 
                x="18" 
                y="48" 
                fill={alignmentColor} 
                fontSize="11" 
                fontWeight="bold"
              >
                90°
              </text>
              
              {/* Corner dot */}
              <circle cx="5" cy="55" r="4" fill={alignmentColor} />
            </svg>
            
            {/* Alignment status badge */}
            <div 
              className="absolute top-0 left-14 px-2 py-0.5 rounded text-[9px] font-bold shadow-lg whitespace-nowrap"
              style={{ backgroundColor: alignmentColor, color: 'white' }}
            >
              {isAligned ? '✓ Aligné' : '✗ Alignez'}
            </div>
          </div>

          {/* Corner markers (top corners only) */}
          <div className="absolute -top-1 -left-1 w-6 h-6 border-t-3 border-l-3 rounded-tl-lg border-current" />
          <div className="absolute -top-1 -right-1 w-6 h-6 border-t-3 border-r-3 rounded-tr-lg border-current" />

          {/* ========== PILE CONTOUR VISUALIZATION ========== */}
          {pileBounds && detection && detection.estimatedCount > 0 && (
            <div 
              className="absolute transition-all duration-200 pointer-events-none"
              style={{
                left: `${pileBounds.x * 100}%`,
                top: `${pileBounds.y * 100}%`,
                width: `${pileBounds.width * 100}%`,
                height: `${pileBounds.height * 100}%`,
              }}
            >
              {/* Animated contour border */}
              <div 
                className={cn(
                  "absolute inset-0 border-2 rounded-lg",
                  isAligned ? "border-green-400" : "border-yellow-400",
                  "animate-pulse"
                )}
                style={{
                  boxShadow: isAligned 
                    ? '0 0 20px rgba(34, 197, 94, 0.5), inset 0 0 10px rgba(34, 197, 94, 0.2)' 
                    : '0 0 20px rgba(250, 204, 21, 0.5), inset 0 0 10px rgba(250, 204, 21, 0.2)'
                }}
              />
              
              {/* Corner highlight markers */}
              <div className="absolute -top-1 -left-1 w-4 h-4 border-t-2 border-l-2 border-green-400 rounded-tl" />
              <div className="absolute -top-1 -right-1 w-4 h-4 border-t-2 border-r-2 border-green-400 rounded-tr" />
              <div className="absolute -bottom-1 -left-1 w-4 h-4 border-b-2 border-l-2 border-green-400 rounded-bl" />
              <div className="absolute -bottom-1 -right-1 w-4 h-4 border-b-2 border-r-2 border-green-400 rounded-br" />
              
              {/* Pile label */}
              <div className="absolute -top-6 left-1/2 -translate-x-1/2 bg-green-500/90 text-white text-[10px] font-bold px-2 py-0.5 rounded whitespace-nowrap">
                📦 Pile détectée
              </div>
            </div>
          )}

          {/* ========== REPOSITIONING GUIDE ========== */}
          {needsRepositioning && detection && detection.estimatedCount > 0 && (
            <div className="absolute inset-0 flex items-center justify-center z-50">
              <div className="bg-orange-500/95 backdrop-blur-sm rounded-xl px-4 py-3 flex flex-col items-center gap-2 shadow-xl animate-bounce">
                <div className="flex items-center gap-3 text-white">
                  {pilePosition === 'left' ? (
                    <>
                      <MoveRight className="h-8 w-8" />
                      <div className="text-center">
                        <p className="font-bold text-sm">Déplacez vers la droite</p>
                        <p className="text-xs opacity-80">Pile trop à gauche</p>
                      </div>
                    </>
                  ) : (
                    <>
                      <MoveLeft className="h-8 w-8" />
                      <div className="text-center">
                        <p className="font-bold text-sm">Déplacez vers la gauche</p>
                        <p className="text-xs opacity-80">Pile trop à droite</p>
                      </div>
                    </>
                  )}
                </div>
                <div className="flex items-center gap-1 text-white/80 text-[10px]">
                  <Smartphone className="h-3 w-3" />
                  <span>Centrez la pile dans le cadre</span>
                </div>
              </div>
            </div>
          )}

          {/* Fast scanning line */}
          {detection?.status === 'scanning' && !needsRepositioning && (
            <div 
              className="absolute inset-x-10 h-0.5 bg-gradient-to-r from-transparent via-blue-400 to-transparent rounded"
              style={{ top: `${100 - scanLinePosition}%` }}
            />
          )}

          {/* Center guide when no detection */}
          {!detection && (
            <div className="absolute inset-0 flex items-center justify-center">
              <div className="text-center text-white/90 px-4">
                <div className="text-4xl mb-2">📐</div>
                <p className="text-sm font-medium">Alignez le bord gauche</p>
                <p className="text-xs text-white/70">sur l'angle 90° en bas à gauche</p>
                <p className="text-[10px] text-green-400 mt-2">Base de la pile = ligne "0"</p>
              </div>
            </div>
          )}

          {/* Live count during scanning */}
          {detection && detection.status === 'scanning' && detection.estimatedCount > 0 && (
            <div className="absolute inset-0 flex items-center justify-center">
              <div className="bg-black/80 backdrop-blur rounded-xl px-5 py-4 text-center">
                <div className="text-4xl font-bold text-white">{detection.estimatedCount}</div>
                <div className="text-sm text-white/70">{linenTypeName}</div>
                {detection.dimensions.widthCm && (
                  <div className="text-xs text-blue-400 mt-1">
                    ~{Math.round(detection.dimensions.widthCm)}cm largeur
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Width indicator when detected */}
          {detection?.dimensions.widthCm && (
            <div className="absolute -top-8 left-1/2 -translate-x-1/2 flex items-center gap-1">
              <Badge variant="secondary" className="bg-blue-500/90 text-white text-xs px-2">
                <Ruler className="h-3 w-3 mr-1" />
                {Math.round(detection.dimensions.widthCm)}cm
                {suggestedType && ` → ${suggestedType}`}
              </Badge>
            </div>
          )}
        </div>
      </div>

      {/* Compact status bar */}
      <div className="absolute bottom-20 left-2 right-2">
        <div className="bg-black/90 backdrop-blur rounded-xl p-3 pointer-events-auto">
          {/* Status header */}
          <div className="flex items-center justify-between text-white mb-2">
            <div className="flex items-center gap-2">
              {getStatusIcon()}
              <span className="text-sm font-medium">{getStatusText()}</span>
            </div>
            <div className="flex items-center gap-2">
              {getTimeRemaining() && (
                <span className="text-xs text-white/60">{getTimeRemaining()}</span>
              )}
              {/* Alignment indicator dot */}
              <div 
                className="w-3 h-3 rounded-full shadow"
                style={{ backgroundColor: alignmentColor }}
              />
            </div>
          </div>

          {/* Progress bar */}
          {detection?.status === 'stabilizing' && (
            <div className="w-full h-2 bg-white/20 rounded-full overflow-hidden mb-2">
              <div
                className="h-full bg-gradient-to-r from-yellow-400 to-green-400 transition-all duration-100"
                style={{ width: `${detection.stabilityProgress}%` }}
              />
            </div>
          )}

          {/* Ready state */}
          {detection && detection.status === 'ready' && (
            <div className="space-y-2">
              {/* Type suggestion based on width */}
              {suggestedType && suggestedType !== linenTypeName && (
                <div className="flex items-center gap-1 text-blue-400 text-xs">
                  <AlertCircle className="h-3 w-3" />
                  <span>Suggéré: {suggestedType} ({Math.round(detection.dimensions.widthCm || 0)}cm)</span>
                </div>
              )}

              {/* Count + confidence */}
              <div className="flex items-center justify-between">
                <div className="text-white">
                  <span className="text-2xl font-bold">{detection.estimatedCount}</span>
                  <span className="text-sm ml-1.5 opacity-80">{linenTypeName}</span>
                </div>
                <Badge className={cn(
                  "text-xs",
                  detection.confidence >= 0.7 ? "bg-green-500" :
                  detection.confidence >= 0.5 ? "bg-yellow-500" : "bg-red-500"
                )}>
                  {Math.round(detection.confidence * 100)}%
                </Badge>
              </div>

              {/* Validate button - ONLY if aligned */}
              <button
                onClick={onValidate}
                disabled={!isAligned}
                className={cn(
                  "w-full py-3 mt-1 font-semibold rounded-lg transition-colors flex items-center justify-center gap-2",
                  isAligned 
                    ? "bg-green-500 hover:bg-green-600 text-white" 
                    : "bg-gray-500 text-gray-300 cursor-not-allowed"
                )}
              >
                <CheckCircle className="h-4 w-4" />
                {isAligned ? 'Valider et enregistrer' : 'Alignez d\'abord'}
              </button>
            </div>
          )}

          {/* Instant mode button */}
          {instantMode && detection?.status === 'scanning' && onInstantCapture && detection.estimatedCount > 0 && isAligned && (
            <button
              onClick={onInstantCapture}
              className="w-full py-2 mt-1 bg-blue-500 hover:bg-blue-600 text-white font-medium rounded-lg transition-colors flex items-center justify-center gap-2 text-sm"
            >
              <Zap className="h-4 w-4" />
              Snap instantané ({detection.estimatedCount})
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
            {imageQuality.isBlurry ? "📷 Flou" : "✓ Net"}
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
            {imageQuality.isTooDark ? "🔆 Sombre" : 
             imageQuality.isTooLight ? "☀️ Clair" : "✓ Lum."}
          </Badge>
        </div>
      )}
    </div>
  );
};

export default LinenDetectionOverlay;
