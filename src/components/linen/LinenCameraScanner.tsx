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
    const tolerance = 10; // 10cm tolerance

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

  // Live scan loop (calls Edge Function periodically while streaming)
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

        const pileBounds = data?.pile_bounds
          ? {
              x: Number(data.pile_bounds.x ?? 0),
              y: Number(data.pile_bounds.y ?? 0),
              w: Number(data.pile_bounds.w ?? 0),
              h: Number(data.pile_bounds.h ?? 0),
            }
          : null;

        const pileDetected = Boolean(data?.pile_detected);

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

        // Keep editCount in sync with live count unless user edited manually
        if (!hasManualOverride) {
          setEditCount(count);
        }
      } catch (err: any) {
        console.error('Live scan error:', err);
        // Do not spam toasts in a loop; only show once.
        if (!hasShownLiveError) {
          toast({
            title: "Erreur du scanner",
            description: "Impossible d'analyser en temps réel. Essayez de relancer la caméra.",
            variant: 'destructive',
          });
          setHasShownLiveError(true);
        }
      } finally {
        setIsAnalyzing(false);
        isRequestInFlightRef.current = false;
      }
    };

    // Run a first tick quickly, then interval.
    tick();
    const id = window.setInterval(tick, 1200);
    return () => window.clearInterval(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isStreaming, isLiveScanning, cameraFailed, selectedLinenTypeId, hotelId, hasManualOverride, scanMode]);

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

    // Downscale for speed & bandwidth
    const maxW = 640;
    const ratio = video.videoWidth / video.videoHeight;
    const w = Math.min(maxW, video.videoWidth);
    const h = Math.round(w / ratio);

    canvas.width = w;
    canvas.height = h;
    const ctx = canvas.getContext('2d');
    if (!ctx) return null;
    ctx.drawImage(video, 0, 0, w, h);

    return canvas.toDataURL('image/jpeg', 0.6);
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

  // Constrain bounds to stay within the guide frame (80% x 60%)
  const boundsStyle = useMemo(() => {
    const b = liveResult?.pileBounds;
    if (!b || !liveResult?.pileDetected) return null;
    
    // Guide frame is centered at 10% from left, 20% from top, 80% width, 60% height
    const guideLeft = 0.10;
    const guideTop = 0.20;
    const guideWidth = 0.80;
    const guideHeight = 0.60;
    
    // Clamp bounds within guide
    const clamp = (n: number, min: number, max: number) => Math.max(min, Math.min(max, n));
    
    const left = clamp(b.x, guideLeft, guideLeft + guideWidth - 0.05);
    const top = clamp(b.y, guideTop, guideTop + guideHeight - 0.05);
    const maxW = Math.min(b.w, guideLeft + guideWidth - left);
    const maxH = Math.min(b.h, guideTop + guideHeight - top);
    
    return {
      left: `${left * 100}%`,
      top: `${top * 100}%`,
      width: `${clamp(maxW, 0, guideWidth) * 100}%`,
      height: `${clamp(maxH, 0, guideHeight) * 100}%`,
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
    return 'Scan en temps réel';
  }, [scanMode, capturedPhoto, cameraFailed, isStreaming, isLiveScanning, isAnalyzing, liveResult?.pileDetected]);

  return (
    <div className="fixed inset-0 z-50 bg-background flex flex-col">
      {/* Header with close button */}
      <div className="absolute top-0 left-0 right-0 z-20 p-4 flex items-center justify-between bg-gradient-to-b from-background/90 to-transparent">
        <div className="text-foreground">
          <h2 className="text-lg font-bold">{selectedLinenTypeName}</h2>
          <p className="text-sm opacity-70">
            {statusLabel}
          </p>
        </div>
        <Button variant="destructive" size="icon" onClick={onClose} className="h-12 w-12">
          <X className="h-7 w-7" />
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
      <div className="flex-1 relative mt-32">
        {scanMode !== 'manual' ? (
          <>
            {capturedPhoto ? (
              <img src={capturedPhoto} alt="Captured" className="w-full h-full object-cover" />
            ) : (
              <video ref={videoRef} autoPlay playsInline muted className="w-full h-full object-cover" />
            )}

            {/* Centering guide - positioned at 10%/20% with 80%/60% */}
            {isStreaming && !capturedPhoto && (
              <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                <div 
                  className="rounded-xl border-2 border-dashed border-white/70 bg-white/5"
                  style={{
                    position: 'absolute',
                    left: '10%',
                    top: '20%',
                    width: '80%',
                    height: '60%',
                  }}
                >
                  <div className="absolute inset-0 flex items-center justify-center text-white/50 text-sm">
                    Positionnez la pile ici
                  </div>
                </div>
              </div>
            )}

            {/* Pile bounds overlay - constrained to guide */}
            {boundsStyle && !capturedPhoto && (
              <div
                className="absolute border-2 border-primary rounded-lg pointer-events-none animate-pulse"
                style={boundsStyle}
              />
            )}

            {/* Live HUD */}
            {(scanMode === 'live' || capturedPhoto) && (
              <div className="absolute bottom-4 left-4 right-4 flex items-end justify-between gap-3 pointer-events-none">
                <div className="pointer-events-none rounded-xl bg-background/90 backdrop-blur px-3 py-2 border border-border shadow-lg">
                  <div className="text-xs text-muted-foreground">{selectedLinenTypeName}</div>
                  <div className="flex items-baseline gap-2">
                    <div className="text-3xl font-bold tabular-nums">{liveResult?.count ?? 0}</div>
                    <div className="text-sm text-muted-foreground">pièces</div>
                  </div>
                  <div className="flex flex-wrap items-center gap-2 mt-1">
                    <Badge variant={getConfidenceVariant(liveResult?.confidence ?? 0)} className="text-xs">
                      {Math.round((liveResult?.confidence ?? 0) * 100)}% confiance
                    </Badge>
                    {typeof liveResult?.widthCm === 'number' && liveResult.widthCm > 0 && (
                      <Badge variant="outline" className="text-xs">
                        largeur ≈ {Math.round(liveResult.widthCm)} cm
                      </Badge>
                    )}
                    {liveResult?.pilePosition && (
                      <Badge variant="outline" className="text-xs">
                        {liveResult.pilePosition}
                      </Badge>
                    )}
                  </div>
                  {lastUpdateAt && scanMode === 'live' && !capturedPhoto && (
                    <div className="mt-1 text-[11px] text-muted-foreground">
                      mis à jour il y a {Math.max(0, Math.round((Date.now() - lastUpdateAt) / 1000))}s
                    </div>
                  )}
                </div>
              </div>
            )}
            
            {/* Loading overlay */}
            {isAnalyzing && (
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
              <p className="text-muted-foreground mb-4">
                Utilisez les boutons +/- ci-dessous pour compter le linge
              </p>
            </div>
          </div>
        )}
      </div>

      {/* Hidden canvas and file input */}
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
      <div className="bg-background/95 backdrop-blur border-t border-border p-4 pb-8">
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

          {/* Retake button for captured photo */}
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

          {/* Live count + edit */}
          <div className="flex items-center justify-center gap-4">
            <Button
              variant="outline"
              size="icon"
              className="h-14 w-14 rounded-full"
              onClick={() => {
                setHasManualOverride(true);
                setEditCount(Math.max(0, editCount - 1));
              }}
            >
              <Minus className="h-6 w-6" />
            </Button>

            <div className="text-center">
              <Input
                type="number"
                value={editCount}
                onChange={(e) => {
                  setHasManualOverride(true);
                  setEditCount(Math.max(0, parseInt(e.target.value) || 0));
                }}
                className="text-4xl font-bold text-center h-16 w-28 tabular-nums"
                min={0}
              />
              <div className="flex items-center justify-center gap-2 mt-1">
                {liveResult && (
                  <Badge variant={getConfidenceVariant(liveResult.confidence)} className="text-xs">
                    {Math.round(liveResult.confidence * 100)}% confiance
                  </Badge>
                )}
                {hasManualOverride && (
                  <Badge variant="outline" className="text-xs">
                    Ajusté
                  </Badge>
                )}
              </div>
            </div>

            <Button
              variant="outline"
              size="icon"
              className="h-14 w-14 rounded-full"
              onClick={() => {
                setHasManualOverride(true);
                setEditCount(editCount + 1);
              }}
            >
              <Plus className="h-6 w-6" />
            </Button>
          </div>

          {/* Actions */}
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
                className="flex-1 h-12"
                disabled={cameraFailed}
              >
                {isLiveScanning ? (
                  <>
                    <Pause className="h-4 w-4 mr-2" />
                    Pause
                  </>
                ) : (
                  <>
                    <Play className="h-4 w-4 mr-2" />
                    Reprendre
                  </>
                )}
              </Button>
            )}

            <Button 
              variant="outline"
              onClick={onClose} 
              className={scanMode === 'live' ? 'h-12' : 'flex-1 h-12'}
            >
              <X className="h-4 w-4 mr-2" />
              Quitter
            </Button>

            <Button onClick={handleConfirm} className="flex-1 h-12">
              <CheckCircle className="h-4 w-4 mr-2" />
              Valider {editCount}
            </Button>
          </div>

          {/* Optional fallback */}
          {scanMode !== 'manual' && !cameraFailed && !capturedPhoto && (
            <Button
              onClick={() => fileInputRef.current?.click()}
              variant="ghost"
              className="w-full"
            >
              <ImageIcon className="h-4 w-4 mr-2" />
              Importer une photo (secours)
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
              La largeur détectée (≈ {Math.round(liveResult?.widthCm || 0)} cm) correspond à plusieurs types de linge.
              Veuillez sélectionner le bon type :
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
                      Dimensions: {lt.dimensions} cm
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
            Garder le type actuel ({selectedLinenTypeName})
          </Button>
        </DialogContent>
      </Dialog>
    </div>
  );
};
