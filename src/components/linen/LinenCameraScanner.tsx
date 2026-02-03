import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Camera, X, CheckCircle, Minus, Plus, Loader2, Pause, Play } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';

interface LinenCameraScannerProps {
  linenTypeId: string;
  linenTypeName: string;
  hotelId: string;
  onCountComplete: (result: { count: number; confidence: number; photoUrl: string; notes?: string }) => void;
  onClose: () => void;
}

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
  
  const { toast } = useToast();

  // Start camera on mount
  useEffect(() => {
    startCamera();
    return () => stopCamera();
  }, []);

  // Live scan loop (calls Edge Function periodically while streaming)
  useEffect(() => {
    if (!isStreaming || !isLiveScanning || cameraFailed) return;

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
            linenTypeId,
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
  }, [isStreaming, isLiveScanning, cameraFailed, linenTypeId, hotelId, hasManualOverride]);

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

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (ev) => {
      const data = ev.target?.result as string;
      // One-shot analysis fallback (if camera not available)
      (async () => {
        setIsAnalyzing(true);
        try {
          const { data: res, error } = await supabase.functions.invoke('count-linen', {
            body: { image: data, linenTypeId, hotelId },
          });
          if (error) throw error;
          const count = Number(res?.count ?? 0);
          const confidence = Number(res?.confidence ?? 0);
          setLiveResult({ count, confidence, pileDetected: true, pileBounds: null });
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
    onCountComplete({ count: editCount, confidence, photoUrl: '', notes });
  };

  const getConfidenceVariant = (c: number) => (c >= 0.7 ? 'default' : c >= 0.5 ? 'secondary' : 'outline');

  const boundsStyle = useMemo(() => {
    const b = liveResult?.pileBounds;
    if (!b || !liveResult?.pileDetected) return null;
    const clamp = (n: number) => Math.max(0, Math.min(1, n));
    return {
      left: `${clamp(b.x) * 100}%`,
      top: `${clamp(b.y) * 100}%`,
      width: `${clamp(b.w) * 100}%`,
      height: `${clamp(b.h) * 100}%`,
    } as React.CSSProperties;
  }, [liveResult?.pileBounds, liveResult?.pileDetected]);

  const statusLabel = useMemo(() => {
    if (cameraFailed) return 'Caméra indisponible';
    if (!isStreaming) return 'Initialisation…';
    if (!isLiveScanning) return 'Pause';
    if (isAnalyzing) return 'Analyse…';
    if (liveResult?.pileDetected === false) return 'Aucune pile détectée';
    return 'Scan en temps réel';
  }, [cameraFailed, isStreaming, isLiveScanning, isAnalyzing, liveResult?.pileDetected]);

  return (
    <div className="fixed inset-0 z-50 bg-background flex flex-col">
      {/* Header with close button */}
      <div className="absolute top-0 left-0 right-0 z-20 p-4 flex items-center justify-between bg-gradient-to-b from-background/80 to-transparent">
        <div className="text-foreground">
          <h2 className="text-lg font-bold">{linenTypeName}</h2>
          <p className="text-sm opacity-70">
            {statusLabel}
          </p>
        </div>
        <Button variant="ghost" size="icon" onClick={onClose} className="h-12 w-12">
          <X className="h-7 w-7" />
        </Button>
      </div>

      {/* Camera view */}
      <div className="flex-1 relative">
        <video ref={videoRef} autoPlay playsInline muted className="w-full h-full object-cover" />

        {/* Centering guide */}
        {isStreaming && (
          <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
            <div className="rounded-xl w-[80%] h-[60%] border-2 border-dashed border-border bg-background/5" />
          </div>
        )}

        {/* Pile bounds overlay */}
        {boundsStyle && (
          <div
            className="absolute border-2 border-primary/70 rounded-lg pointer-events-none"
            style={boundsStyle}
          />
        )}

        {/* Live HUD */}
        <div className="absolute bottom-24 left-4 right-4 flex items-end justify-between gap-3 pointer-events-none">
          <div className="pointer-events-none rounded-xl bg-background/80 backdrop-blur px-3 py-2 border border-border shadow-sm">
            <div className="text-xs text-muted-foreground">{linenTypeName}</div>
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
            {lastUpdateAt && (
              <div className="mt-1 text-[11px] text-muted-foreground">
                mis à jour il y a {Math.max(0, Math.round((Date.now() - lastUpdateAt) / 1000))}s
              </div>
            )}
          </div>
        </div>
        
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
        {cameraFailed && (
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
          {/* Live count + edit */}
          <div className="flex items-center justify-center gap-4">
            <Button
              variant="outline"
              size="icon"
              className="h-12 w-12 rounded-full"
              onClick={() => {
                setHasManualOverride(true);
                setEditCount(Math.max(0, editCount - 1));
              }}
            >
              <Minus className="h-5 w-5" />
            </Button>

            <div className="text-center">
              <Input
                type="number"
                value={editCount}
                onChange={(e) => {
                  setHasManualOverride(true);
                  setEditCount(Math.max(0, parseInt(e.target.value) || 0));
                }}
                className="text-3xl font-bold text-center h-14 w-24 tabular-nums"
                min={0}
              />
              <div className="flex items-center justify-center gap-2 mt-1">
                <Badge variant={getConfidenceVariant(liveResult?.confidence ?? 0)} className="text-xs">
                  {Math.round((liveResult?.confidence ?? 0) * 100)}% confiance
                </Badge>
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
              className="h-12 w-12 rounded-full"
              onClick={() => {
                setHasManualOverride(true);
                setEditCount(editCount + 1);
              }}
            >
              <Plus className="h-5 w-5" />
            </Button>
          </div>

          {/* Actions */}
          <div className="flex gap-3">
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

            <Button onClick={handleConfirm} className="flex-1 h-12">
              <CheckCircle className="h-4 w-4 mr-2" />
              Valider {editCount}
            </Button>
          </div>

          {/* Optional fallback */}
          {!cameraFailed && (
            <Button
              onClick={() => fileInputRef.current?.click()}
              variant="ghost"
              className="w-full"
            >
              Importer une photo (secours)
            </Button>
          )}
        </div>
      </div>
    </div>
  );
};
