import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Camera, X, CheckCircle, Minus, Plus, Loader2, Pause, Play, ImageIcon, AlertCircle } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog';

interface LinenType {
  id: string;
  name: string;
  dimensions: string | null;
}

interface LinenCameraScannerProps {
  linenTypeId: string;
  linenTypeName: string;
  hotelId: string;
  onCountComplete: (result: { count: number; confidence: number; photoUrl: string; notes?: string; detectedLinenTypeId?: string }) => void;
  onClose: () => void;
}

// Parse width from dimensions string (e.g., "140x200" -> 140)
const parseWidthFromDimensions = (dimensions: string | null): number | null => {
  if (!dimensions) return null;
  const match = dimensions.match(/^(\d+)/);
  return match ? parseInt(match[1], 10) : null;
};

// Guide frame constants (percentage of video area)
const GUIDE_LEFT = 10; // 10%
const GUIDE_TOP = 15; // 15%
const GUIDE_WIDTH = 80; // 80%
const GUIDE_HEIGHT = 70; // 70%

export const LinenCameraScanner: React.FC<LinenCameraScannerProps> = ({
  linenTypeId,
  linenTypeName,
  hotelId,
  onCountComplete,
  onClose,
}) => {
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const isRequestInFlightRef = useRef(false);
  
  const [isStreaming, setIsStreaming] = useState(false);
  const [isLiveScanning, setIsLiveScanning] = useState(true);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [liveResult, setLiveResult] = useState<{
    count: number;
    confidence: number;
    widthCm?: number | null;
    pileDetected?: boolean;
    pileBounds?: { x: number; y: number; w: number; h: number } | null;
    pilePosition?: string | null;
    mode?: string | null;
  } | null>(null);
  const [cameraFailed, setCameraFailed] = useState(false);
  const [editCount, setEditCount] = useState(0);
  const [hasManualOverride, setHasManualOverride] = useState(false);
  const [lastUpdateAt, setLastUpdateAt] = useState<number | null>(null);
  const [hasShownLiveError, setHasShownLiveError] = useState(false);
  const [scanMode, setScanMode] = useState<'live' | 'photo' | 'manual'>('live');
  const [capturedPhoto, setCapturedPhoto] = useState<string | null>(null);
  
  // Linen type detection
  const [linenTypes, setLinenTypes] = useState<LinenType[]>([]);
  const [matchingLinenTypes, setMatchingLinenTypes] = useState<LinenType[]>([]);
  const [showLinenTypeSelector, setShowLinenTypeSelector] = useState(false);
  const [selectedLinenTypeId, setSelectedLinenTypeId] = useState<string>(linenTypeId);
  const [selectedLinenTypeName, setSelectedLinenTypeName] = useState<string>(linenTypeName);
  
  const { toast } = useToast();

  // Load linen types for width detection
  useEffect(() => {
    const loadLinenTypes = async () => {
      const { data, error } = await supabase
        .from('linen_types')
        .select('id, name, dimensions')
        .eq('hotel_id', hotelId)
        .eq('is_active', true);
      
      if (!error && data) {
        setLinenTypes(data);
      }
    };
    loadLinenTypes();
  }, [hotelId]);

  // Detect matching linen types based on width
  useEffect(() => {
    if (!liveResult?.widthCm || linenTypes.length === 0) {
      setMatchingLinenTypes([]);
      return;
    }

    const detectedWidth = liveResult.widthCm;
    const tolerance = 15; // 15cm tolerance

    const matches = linenTypes.filter(lt => {
      const width = parseWidthFromDimensions(lt.dimensions);
      if (!width) return false;
      return Math.abs(width - detectedWidth) <= tolerance;
    });

    setMatchingLinenTypes(matches);

    // If multiple matches found, prompt user to select
    if (matches.length > 1) {
      setShowLinenTypeSelector(true);
    } else if (matches.length === 1 && matches[0].id !== selectedLinenTypeId) {
      // Auto-select if only one match
      setSelectedLinenTypeId(matches[0].id);
      setSelectedLinenTypeName(matches[0].name);
      toast({
        title: "Type de linge détecté",
        description: `${matches[0].name} détecté (largeur ≈ ${Math.round(detectedWidth)}cm)`,
      });
    }
  }, [liveResult?.widthCm, linenTypes, selectedLinenTypeId, toast]);

  // Start camera on mount
  useEffect(() => {
    if (scanMode === 'live' || scanMode === 'photo') {
      startCamera();
    }
    return () => stopCamera();
  }, [scanMode]);

  // Live scan loop
  useEffect(() => {
    if (!isStreaming || !isLiveScanning || cameraFailed || scanMode !== 'live') return;

    const tick = async () => {
      if (isRequestInFlightRef.current) return;
      if (!videoRef.current || !canvasRef.current) return;
      if (videoRef.current.videoWidth === 0 || videoRef.current.videoHeight === 0) return;

      isRequestInFlightRef.current = true;
      setIsAnalyzing(true);
      try {
        const imageData = captureFrameDataUrl();
        if (!imageData) return;

        const { data, error } = await supabase.functions.invoke('count-linen', {
          body: {
            image: imageData,
            linenTypeId: selectedLinenTypeId,
            hotelId,
            quickDetect: true,
          },
        });

        if (error) throw error;

        const count = Number(data?.count ?? 0);
        const confidence = Number(data?.confidence ?? 0);
        const widthCm = data?.dimensions?.width_cm ?? null;

        // Parse pile bounds - these are relative to full image (0-1)
        const rawBounds = data?.pile_bounds;
        let pileBounds = null;
        if (rawBounds && (rawBounds.w > 0 || rawBounds.h > 0)) {
          pileBounds = {
            x: Number(rawBounds.x ?? 0),
            y: Number(rawBounds.y ?? 0),
            w: Number(rawBounds.w ?? 0),
            h: Number(rawBounds.h ?? 0),
          };
        }

        const pileDetected = Boolean(data?.pile_detected) || count > 0;

        setLiveResult({
          count,
          confidence,
          widthCm,
          pileDetected,
          pileBounds,
          pilePosition: data?.pile_position ?? null,
          mode: data?.mode ?? null,
        });
        setLastUpdateAt(Date.now());
        setHasShownLiveError(false);

        if (!hasManualOverride) {
          setEditCount(count);
        }
      } catch (err: any) {
        console.error('Live scan error:', err);
        if (!hasShownLiveError) {
          toast({
            title: "Erreur du scanner",
            description: "Impossible d'analyser. Réessayez ou utilisez le mode photo.",
            variant: 'destructive',
          });
          setHasShownLiveError(true);
        }
      } finally {
        setIsAnalyzing(false);
        isRequestInFlightRef.current = false;
      }
    };

    tick();
    const id = window.setInterval(tick, 1500); // Slightly slower for better accuracy
    return () => window.clearInterval(id);
  }, [isStreaming, isLiveScanning, cameraFailed, selectedLinenTypeId, hotelId, hasManualOverride, scanMode, hasShownLiveError, toast]);

  const startCamera = async () => {
    try {
      if (!navigator.mediaDevices?.getUserMedia) {
        setCameraFailed(true);
        return;
      }

      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: 'environment', width: { ideal: 1280 }, height: { ideal: 720 } }
      }).catch(() => 
        navigator.mediaDevices.getUserMedia({ video: true })
      );
      
      if (!stream || !videoRef.current) {
        setCameraFailed(true);
        return;
      }

      streamRef.current = stream;
      videoRef.current.srcObject = stream;
      await videoRef.current.play();
      setIsStreaming(true);
      setCameraFailed(false);
    } catch (error) {
      console.error('Camera error:', error);
      setCameraFailed(true);
    }
  };

  const stopCamera = () => {
    streamRef.current?.getTracks().forEach(track => track.stop());
    streamRef.current = null;
    setIsStreaming(false);
  };

  const captureFrameDataUrl = () => {
    const video = videoRef.current;
    const canvas = canvasRef.current;
    if (!video || !canvas) return null;

    const maxW = 800;
    const ratio = video.videoWidth / video.videoHeight;
    const w = Math.min(maxW, video.videoWidth);
    const h = Math.round(w / ratio);

    canvas.width = w;
    canvas.height = h;
    const ctx = canvas.getContext('2d');
    if (!ctx) return null;
    ctx.drawImage(video, 0, 0, w, h);

    return canvas.toDataURL('image/jpeg', 0.75);
  };

  const handleCapturePhoto = async () => {
    const imageData = captureFrameDataUrl();
    if (!imageData) return;
    
    setCapturedPhoto(imageData);
    setIsLiveScanning(false);
    setIsAnalyzing(true);

    try {
      const { data, error } = await supabase.functions.invoke('count-linen', {
        body: { image: imageData, linenTypeId: selectedLinenTypeId, hotelId },
      });
      
      if (error) throw error;
      
      const count = Number(data?.count ?? 0);
      const confidence = Number(data?.confidence ?? 0);
      const widthCm = data?.dimensions?.width_cm ?? null;
      
      setLiveResult({ count, confidence, widthCm, pileDetected: true, pileBounds: null });
      setEditCount(count);
      setHasManualOverride(false);
      
      toast({
        title: "Photo analysée",
        description: `${count} pièce(s) détectée(s) avec ${Math.round(confidence * 100)}% de confiance`,
      });
    } catch (err) {
      console.error('Photo analysis error:', err);
      toast({
        title: "Erreur d'analyse",
        description: 'Réessayez ou comptez manuellement',
        variant: 'destructive',
      });
      setLiveResult({ count: 0, confidence: 0, pileDetected: false, pileBounds: null });
      setEditCount(0);
    } finally {
      setIsAnalyzing(false);
    }
  };

  const handleRetakePhoto = () => {
    setCapturedPhoto(null);
    setIsLiveScanning(scanMode === 'live');
    setLiveResult(null);
    setEditCount(0);
    setHasManualOverride(false);
  };

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (ev) => {
      const data = ev.target?.result as string;
      setCapturedPhoto(data);
      setIsLiveScanning(false);
      
      (async () => {
        setIsAnalyzing(true);
        try {
          const { data: res, error } = await supabase.functions.invoke('count-linen', {
            body: { image: data, linenTypeId: selectedLinenTypeId, hotelId },
          });
          if (error) throw error;
          const count = Number(res?.count ?? 0);
          const confidence = Number(res?.confidence ?? 0);
          const widthCm = res?.dimensions?.width_cm ?? null;
          setLiveResult({ count, confidence, widthCm, pileDetected: true, pileBounds: null });
          setEditCount(count);
          setHasManualOverride(false);
        } catch (err) {
          console.error('Analysis error:', err);
          toast({
            title: "Erreur d'analyse",
            description: 'Réessayez ou comptez manuellement',
            variant: 'destructive',
          });
          setLiveResult({ count: 0, confidence: 0, pileDetected: false, pileBounds: null });
          setEditCount(0);
        } finally {
          setIsAnalyzing(false);
        }
      })();
    };
    reader.readAsDataURL(file);
  };

  const handleConfirm = () => {
    const confidence = liveResult?.confidence ?? 0;
    const notes = liveResult?.pileDetected === false ? 'Aucune pile détectée (vérifiez le cadrage)' : undefined;
    onCountComplete({ 
      count: editCount, 
      confidence, 
      photoUrl: capturedPhoto || '', 
      notes,
      detectedLinenTypeId: selectedLinenTypeId !== linenTypeId ? selectedLinenTypeId : undefined
    });
  };

  const handleLinenTypeSelect = (lt: LinenType) => {
    setSelectedLinenTypeId(lt.id);
    setSelectedLinenTypeName(lt.name);
    setShowLinenTypeSelector(false);
    toast({
      title: "Type de linge sélectionné",
      description: lt.name,
    });
  };

  const getConfidenceVariant = (c: number) => (c >= 0.7 ? 'default' : c >= 0.5 ? 'secondary' : 'outline');

  // Convert AI bounds (relative to full image) to position inside the white guide frame
  const boundsStyle = useMemo(() => {
    const b = liveResult?.pileBounds;
    if (!b || !liveResult?.pileDetected) return null;
    if (b.w <= 0 && b.h <= 0) return null;
    
    // The guide frame position (in % of container)
    const guideL = GUIDE_LEFT / 100;
    const guideT = GUIDE_TOP / 100;
    const guideW = GUIDE_WIDTH / 100;
    const guideH = GUIDE_HEIGHT / 100;
    
    // AI returns bounds relative to full image (0-1)
    // We need to constrain them inside the guide frame
    const clamp = (val: number, min: number, max: number) => Math.max(min, Math.min(max, val));
    
    // Convert bounds to be relative to guide frame
    // If AI bounds are within the guide area, show them inside the guide
    const relX = clamp(b.x, guideL, guideL + guideW);
    const relY = clamp(b.y, guideT, guideT + guideH);
    const maxW = Math.min(b.w, guideL + guideW - relX);
    const maxH = Math.min(b.h, guideT + guideH - relY);
    
    // Only show if bounds have meaningful size
    if (maxW < 0.05 || maxH < 0.05) return null;
    
    return {
      left: `${relX * 100}%`,
      top: `${relY * 100}%`,
      width: `${clamp(maxW, 0.05, guideW) * 100}%`,
      height: `${clamp(maxH, 0.05, guideH) * 100}%`,
    } as React.CSSProperties;
  }, [liveResult?.pileBounds, liveResult?.pileDetected]);

  const statusLabel = useMemo(() => {
    if (scanMode === 'manual') return 'Comptage manuel';
    if (capturedPhoto) return 'Photo capturée';
    if (cameraFailed) return 'Caméra indisponible';
    if (!isStreaming) return 'Initialisation…';
    if (!isLiveScanning) return 'Pause';
    if (isAnalyzing) return 'Analyse…';
    if (liveResult?.pileDetected === false) return 'Aucune pile détectée';
    if (liveResult?.count && liveResult.count > 0) return `${liveResult.count} détecté(s)`;
    return 'Scan en temps réel';
  }, [scanMode, capturedPhoto, cameraFailed, isStreaming, isLiveScanning, isAnalyzing, liveResult?.pileDetected, liveResult?.count]);

  return (
    <div className="fixed inset-0 z-50 bg-background flex flex-col">
      {/* Header */}
      <div className="absolute top-0 left-0 right-0 z-20 p-4 flex items-center justify-between bg-gradient-to-b from-background/95 to-transparent">
        <div className="text-foreground">
          <h2 className="text-lg font-bold">{selectedLinenTypeName}</h2>
          <p className="text-sm opacity-70">{statusLabel}</p>
        </div>
        <Button variant="destructive" size="icon" onClick={onClose} className="h-12 w-12 rounded-full">
          <X className="h-6 w-6" />
        </Button>
      </div>

      {/* Mode selector */}
      <div className="absolute top-20 left-4 right-4 z-20 flex gap-2">
        <Button
          variant={scanMode === 'live' ? 'default' : 'outline'}
          size="sm"
          onClick={() => {
            setScanMode('live');
            setCapturedPhoto(null);
            setIsLiveScanning(true);
          }}
          className="flex-1"
        >
          <Play className="h-4 w-4 mr-1" />
          Temps réel
        </Button>
        <Button
          variant={scanMode === 'photo' ? 'default' : 'outline'}
          size="sm"
          onClick={() => {
            setScanMode('photo');
            setCapturedPhoto(null);
            setIsLiveScanning(false);
          }}
          className="flex-1"
        >
          <Camera className="h-4 w-4 mr-1" />
          Photo
        </Button>
        <Button
          variant={scanMode === 'manual' ? 'default' : 'outline'}
          size="sm"
          onClick={() => {
            setScanMode('manual');
            stopCamera();
            setCapturedPhoto(null);
            setIsLiveScanning(false);
          }}
          className="flex-1"
        >
          <Plus className="h-4 w-4 mr-1" />
          Manuel
        </Button>
      </div>

      {/* Camera view / Manual mode */}
      <div className="flex-1 relative mt-28">
        {scanMode !== 'manual' ? (
          <>
            {capturedPhoto ? (
              <img src={capturedPhoto} alt="Captured" className="w-full h-full object-cover" />
            ) : (
              <video ref={videoRef} autoPlay playsInline muted className="w-full h-full object-cover" />
            )}

            {/* FIXED white guide frame - pile must be inside this */}
            {isStreaming && !capturedPhoto && (
              <div 
                className="absolute pointer-events-none border-4 border-white/90 rounded-2xl shadow-lg"
                style={{
                  left: `${GUIDE_LEFT}%`,
                  top: `${GUIDE_TOP}%`,
                  width: `${GUIDE_WIDTH}%`,
                  height: `${GUIDE_HEIGHT}%`,
                }}
              >
                {/* Corner markers for better visibility */}
                <div className="absolute top-0 left-0 w-8 h-8 border-t-4 border-l-4 border-white rounded-tl-xl" />
                <div className="absolute top-0 right-0 w-8 h-8 border-t-4 border-r-4 border-white rounded-tr-xl" />
                <div className="absolute bottom-0 left-0 w-8 h-8 border-b-4 border-l-4 border-white rounded-bl-xl" />
                <div className="absolute bottom-0 right-0 w-8 h-8 border-b-4 border-r-4 border-white rounded-br-xl" />
                
                {/* Center text */}
                <div className="absolute inset-0 flex items-center justify-center">
                  <div className="bg-black/40 backdrop-blur-sm px-4 py-2 rounded-lg">
                    <span className="text-white text-sm font-medium">
                      📍 Placez la pile ici
                    </span>
                  </div>
                </div>
              </div>
            )}

            {/* MOVING purple/violet detection bounds - stays INSIDE white frame */}
            {boundsStyle && !capturedPhoto && (
              <div
                className="absolute border-4 border-primary rounded-xl pointer-events-none shadow-lg"
                style={{
                  ...boundsStyle,
                  boxShadow: '0 0 20px rgba(147, 51, 234, 0.5)',
                }}
              >
                {/* Pulse animation indicator */}
                <div className="absolute inset-0 border-2 border-primary/50 rounded-xl animate-ping" />
              </div>
            )}

            {/* Live result HUD */}
            {(scanMode === 'live' || capturedPhoto) && liveResult && (
              <div className="absolute bottom-4 left-4 right-4 pointer-events-none">
                <div className="rounded-2xl bg-background/95 backdrop-blur-md px-4 py-3 border border-border shadow-xl">
                  <div className="flex items-center justify-between">
                    <div>
                      <div className="text-xs text-muted-foreground mb-1">{selectedLinenTypeName}</div>
                      <div className="flex items-baseline gap-2">
                        <span className="text-4xl font-bold tabular-nums">{liveResult.count}</span>
                        <span className="text-sm text-muted-foreground">pièces</span>
                      </div>
                    </div>
                    <div className="flex flex-col items-end gap-1">
                      <Badge variant={getConfidenceVariant(liveResult.confidence)} className="text-xs">
                        {Math.round(liveResult.confidence * 100)}%
                      </Badge>
                      {typeof liveResult.widthCm === 'number' && liveResult.widthCm > 0 && (
                        <Badge variant="outline" className="text-xs">
                          ≈ {Math.round(liveResult.widthCm)} cm
                        </Badge>
                      )}
                    </div>
                  </div>
                  {lastUpdateAt && scanMode === 'live' && !capturedPhoto && (
                    <div className="mt-2 text-[11px] text-muted-foreground text-center">
                      Dernière analyse: il y a {Math.max(0, Math.round((Date.now() - lastUpdateAt) / 1000))}s
                    </div>
                  )}
                </div>
              </div>
            )}
            
            {/* Loading overlay */}
            {isAnalyzing && !liveResult && (
              <div className="absolute inset-0 bg-background/60 flex items-center justify-center">
                <div className="text-center text-foreground">
                  <Loader2 className="h-12 w-12 animate-spin mx-auto mb-3" />
                  <p className="text-lg font-medium">Comptage IA...</p>
                </div>
              </div>
            )}

            {/* Camera fallback */}
            {cameraFailed && !capturedPhoto && (
              <div className="absolute inset-0 flex items-center justify-center bg-background">
                <div className="text-center text-foreground p-6">
                  <Camera className="h-16 w-16 mx-auto mb-4 opacity-50" />
                  <p className="mb-4">Caméra indisponible</p>
                  <Button onClick={() => fileInputRef.current?.click()}>
                    📷 Choisir une photo
                  </Button>
                </div>
              </div>
            )}
          </>
        ) : (
          // Manual mode
          <div className="flex items-center justify-center h-full bg-muted/30">
            <div className="text-center p-8">
              <div className="text-6xl mb-4">📋</div>
              <h3 className="text-xl font-bold mb-2">Comptage manuel</h3>
              <p className="text-muted-foreground">
                Utilisez les boutons +/- ci-dessous
              </p>
            </div>
          </div>
        )}
      </div>

      {/* Hidden elements */}
      <canvas ref={canvasRef} className="hidden" />
      <input
        ref={fileInputRef}
        type="file"
        accept="image/*"
        capture="environment"
        onChange={handleFileSelect}
        className="hidden"
      />

      {/* Bottom controls */}
      <div className="bg-background border-t border-border p-4 pb-8">
        <div className="space-y-4">
          {/* Photo mode capture button */}
          {scanMode === 'photo' && !capturedPhoto && isStreaming && (
            <Button 
              onClick={handleCapturePhoto} 
              className="w-full h-14 text-lg"
              disabled={isAnalyzing}
            >
              <Camera className="h-6 w-6 mr-2" />
              Prendre la photo
            </Button>
          )}

          {/* Retake button */}
          {capturedPhoto && (
            <Button 
              onClick={handleRetakePhoto} 
              variant="outline"
              className="w-full"
            >
              <Camera className="h-4 w-4 mr-2" />
              Reprendre la photo
            </Button>
          )}

          {/* Manual count controls */}
          <div className="flex items-center justify-center gap-6">
            <Button
              variant="outline"
              size="icon"
              className="h-16 w-16 rounded-full text-2xl"
              onClick={() => {
                setHasManualOverride(true);
                setEditCount(Math.max(0, editCount - 1));
              }}
            >
              <Minus className="h-8 w-8" />
            </Button>

            <div className="text-center">
              <Input
                type="number"
                value={editCount}
                onChange={(e) => {
                  setHasManualOverride(true);
                  setEditCount(Math.max(0, parseInt(e.target.value) || 0));
                }}
                className="text-5xl font-bold text-center h-20 w-32 tabular-nums"
                min={0}
              />
              {hasManualOverride && (
                <Badge variant="outline" className="mt-2 text-xs">
                  Modifié manuellement
                </Badge>
              )}
            </div>

            <Button
              variant="outline"
              size="icon"
              className="h-16 w-16 rounded-full text-2xl"
              onClick={() => {
                setHasManualOverride(true);
                setEditCount(editCount + 1);
              }}
            >
              <Plus className="h-8 w-8" />
            </Button>
          </div>

          {/* Action buttons */}
          <div className="flex gap-3">
            {scanMode === 'live' && (
              <Button
                variant="outline"
                onClick={() => {
                  if (!isStreaming) {
                    startCamera();
                    return;
                  }
                  setIsLiveScanning((v) => !v);
                }}
                className="h-14"
                disabled={cameraFailed}
              >
                {isLiveScanning ? <Pause className="h-5 w-5" /> : <Play className="h-5 w-5" />}
              </Button>
            )}

            <Button 
              variant="outline"
              onClick={onClose} 
              className="flex-1 h-14"
            >
              <X className="h-5 w-5 mr-2" />
              Quitter
            </Button>

            <Button onClick={handleConfirm} className="flex-1 h-14 text-lg">
              <CheckCircle className="h-5 w-5 mr-2" />
              Valider {editCount}
            </Button>
          </div>

          {/* Import fallback */}
          {scanMode !== 'manual' && !cameraFailed && !capturedPhoto && (
            <Button
              onClick={() => fileInputRef.current?.click()}
              variant="ghost"
              className="w-full"
            >
              <ImageIcon className="h-4 w-4 mr-2" />
              Importer une photo
            </Button>
          )}
        </div>
      </div>

      {/* Linen type selector dialog */}
      <Dialog open={showLinenTypeSelector} onOpenChange={setShowLinenTypeSelector}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <AlertCircle className="h-5 w-5 text-amber-500" />
              Plusieurs types de linge détectés
            </DialogTitle>
            <DialogDescription>
              Largeur détectée: ≈ {Math.round(liveResult?.widthCm || 0)} cm
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-2 mt-4">
            {matchingLinenTypes.map((lt) => (
              <Button
                key={lt.id}
                variant={lt.id === selectedLinenTypeId ? 'default' : 'outline'}
                className="w-full justify-start h-auto py-3"
                onClick={() => handleLinenTypeSelect(lt)}
              >
                <div className="text-left">
                  <div className="font-medium">{lt.name}</div>
                  {lt.dimensions && (
                    <div className="text-sm text-muted-foreground">
                      {lt.dimensions} cm
                    </div>
                  )}
                </div>
              </Button>
            ))}
          </div>
          <Button 
            variant="ghost" 
            className="w-full mt-2"
            onClick={() => setShowLinenTypeSelector(false)}
          >
            Garder: {selectedLinenTypeName}
          </Button>
        </DialogContent>
      </Dialog>
    </div>
  );
};
