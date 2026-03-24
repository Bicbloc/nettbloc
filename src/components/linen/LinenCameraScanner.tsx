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

const parseWidthFromDimensions = (dimensions: string | null): number | null => {
  if (!dimensions) return null;
  const match = dimensions.match(/^(\d+)/);
  return match ? parseInt(match[1], 10) : null;
};

// Enlarged white guide frame dimensions
const GUIDE_LEFT = 5;
const GUIDE_TOP = 8;
const GUIDE_WIDTH = 90;
const GUIDE_HEIGHT = 60;

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
  const recentCountsRef = useRef<number[]>([]);
  const stableCountRef = useRef<number | null>(null);
  
  const [isStreaming, setIsStreaming] = useState(false);
  const [isLiveScanning, setIsLiveScanning] = useState(true);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
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
  const [isStabilized, setIsStabilized] = useState(false);
  const [stabilizationProgress, setStabilizationProgress] = useState(0);
  
  
  const [linenTypes, setLinenTypes] = useState<LinenType[]>([]);
  const [matchingLinenTypes, setMatchingLinenTypes] = useState<LinenType[]>([]);
  const [showLinenTypeSelector, setShowLinenTypeSelector] = useState(false);
  const [selectedLinenTypeId, setSelectedLinenTypeId] = useState<string>(linenTypeId);
  const [selectedLinenTypeName, setSelectedLinenTypeName] = useState<string>(linenTypeName);
  
  const { toast } = useToast();

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

  useEffect(() => {
    if (!liveResult?.widthCm || linenTypes.length === 0) {
      setMatchingLinenTypes([]);
      return;
    }

    const detectedWidth = liveResult.widthCm;
    const tolerance = 15;

    const matches = linenTypes.filter(lt => {
      const width = parseWidthFromDimensions(lt.dimensions);
      if (!width) return false;
      return Math.abs(width - detectedWidth) <= tolerance;
    });

    setMatchingLinenTypes(matches);

    if (matches.length > 1) {
      setShowLinenTypeSelector(true);
    } else if (matches.length === 1 && matches[0].id !== selectedLinenTypeId) {
      setSelectedLinenTypeId(matches[0].id);
      setSelectedLinenTypeName(matches[0].name);
    }
  }, [liveResult?.widthCm, linenTypes, selectedLinenTypeId]);

  useEffect(() => {
    if (scanMode === 'live' || scanMode === 'photo') {
      startCamera();
    }
    return () => stopCamera();
  }, [scanMode]);

  // Stabilization: require 3 consistent counts before accepting result
  const STABILIZATION_REQUIRED = 3;

  // Live scan loop
  useEffect(() => {
    if (!isStreaming || !isLiveScanning || cameraFailed || scanMode !== 'live') return;
    if (isStabilized) return; // pause when stabilized

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

        // Stabilization logic: track recent counts
        const recent = recentCountsRef.current;
        recent.push(count);
        if (recent.length > STABILIZATION_REQUIRED) {
          recent.shift();
        }
        
        const allSame = recent.length >= STABILIZATION_REQUIRED && 
          recent.every(c => c === recent[0]) && recent[0] > 0;
        
        setStabilizationProgress(recent.length);

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

        if (allSame) {
          // Result is stable - auto-pause for validation
          stableCountRef.current = count;
          setIsStabilized(true);
          setEditCount(count);
          setHasManualOverride(false);
        } else if (!hasManualOverride) {
          setEditCount(count);
        }
      } catch (err: any) {
        console.error('Live scan error:', err);
        if (!hasShownLiveError) {
          toast({
            title: "Erreur du scanner",
            description: "Impossible d'analyser. Réessayez.",
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
    const id = window.setInterval(tick, 1500);
    return () => window.clearInterval(id);
  }, [isStreaming, isLiveScanning, cameraFailed, selectedLinenTypeId, hotelId, hasManualOverride, scanMode, hasShownLiveError, toast, isStabilized]);

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

  const captureFrameDataUrl = (quality = 0.75) => {
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

    return canvas.toDataURL('image/jpeg', quality);
  };

  // Upload photo to Supabase storage
  const uploadPhotoToStorage = async (dataUrl: string): Promise<string | null> => {
    try {
      const base64Data = dataUrl.split(',')[1];
      if (!base64Data) return null;

      const byteCharacters = atob(base64Data);
      const byteNumbers = new Array(byteCharacters.length);
      for (let i = 0; i < byteCharacters.length; i++) {
        byteNumbers[i] = byteCharacters.charCodeAt(i);
      }
      const byteArray = new Uint8Array(byteNumbers);
      const blob = new Blob([byteArray], { type: 'image/jpeg' });

      const fileName = `linen-scan-${Date.now()}-${Math.random().toString(36).substring(7)}.jpg`;
      const filePath = `${hotelId}/${fileName}`;

      const { data, error } = await supabase.storage
        .from('linen-scans')
        .upload(filePath, blob, {
          contentType: 'image/jpeg',
          upsert: false,
        });

      if (error) {
        console.error('Upload error:', error);
        // Try creating bucket if not exists
        if (error.message?.includes('not found')) {
        }
        return null;
      }

      const { data: urlData } = supabase.storage
        .from('linen-scans')
        .getPublicUrl(filePath);

      return urlData?.publicUrl || null;
    } catch (err) {
      console.error('Upload failed:', err);
      return null;
    }
  };

  const handleCapturePhoto = async () => {
    const imageData = captureFrameDataUrl(0.85);
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
        description: `${count} pièce(s) détectée(s)`,
      });
    } catch (err) {
      console.error('Photo analysis error:', err);
      toast({
        title: "Erreur d'analyse",
        description: 'Comptez manuellement',
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
    setIsStabilized(false);
    setStabilizationProgress(0);
    
    recentCountsRef.current = [];
    stableCountRef.current = null;
  };

  const handleResumeScan = () => {
    setIsStabilized(false);
    setStabilizationProgress(0);
    recentCountsRef.current = [];
    stableCountRef.current = null;
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
            description: 'Comptez manuellement',
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

  const handleConfirm = async () => {
    setIsUploading(true);
    
    try {
      // Capture current frame if in live mode (no captured photo yet)
      let photoToUpload = capturedPhoto;
      if (!photoToUpload && scanMode === 'live' && isStreaming) {
        photoToUpload = captureFrameDataUrl(0.85);
      }

      // Upload photo to storage for admin visibility
      let uploadedUrl = '';
      if (photoToUpload) {
        const url = await uploadPhotoToStorage(photoToUpload);
        uploadedUrl = url || '';
      }

      const confidence = liveResult?.confidence ?? 0;
      const notes = liveResult?.pileDetected === false ? 'Aucune pile détectée' : undefined;
      
      onCountComplete({ 
        count: editCount, 
        confidence, 
        photoUrl: uploadedUrl,
        notes,
        detectedLinenTypeId: selectedLinenTypeId !== linenTypeId ? selectedLinenTypeId : undefined
      });
    } catch (err) {
      console.error('Confirm error:', err);
      // Still complete even if upload fails
      onCountComplete({ 
        count: editCount, 
        confidence: liveResult?.confidence ?? 0, 
        photoUrl: '',
        notes: 'Photo non sauvegardée'
      });
    } finally {
      setIsUploading(false);
    }
  };

  const handleLinenTypeSelect = (lt: LinenType) => {
    setSelectedLinenTypeId(lt.id);
    setSelectedLinenTypeName(lt.name);
    setShowLinenTypeSelector(false);
  };

  const getConfidenceVariant = (c: number) => (c >= 0.7 ? 'default' : c >= 0.5 ? 'secondary' : 'outline');

  const boundsStyle = useMemo(() => {
    const b = liveResult?.pileBounds;
    if (!b || !liveResult?.pileDetected) return null;
    if (b.w <= 0 && b.h <= 0) return null;
    
    const guideL = GUIDE_LEFT / 100;
    const guideT = GUIDE_TOP / 100;
    const guideW = GUIDE_WIDTH / 100;
    const guideH = GUIDE_HEIGHT / 100;
    
    const clamp = (val: number, min: number, max: number) => Math.max(min, Math.min(max, val));
    
    const relX = clamp(b.x, guideL, guideL + guideW);
    const relY = clamp(b.y, guideT, guideT + guideH);
    const maxW = Math.min(b.w, guideL + guideW - relX);
    const maxH = Math.min(b.h, guideT + guideH - relY);
    
    if (maxW < 0.05 || maxH < 0.05) return null;
    
    return {
      left: `${relX * 100}%`,
      top: `${relY * 100}%`,
      width: `${clamp(maxW, 0.05, guideW) * 100}%`,
      height: `${clamp(maxH, 0.05, guideH) * 100}%`,
    } as React.CSSProperties;
  }, [liveResult?.pileBounds, liveResult?.pileDetected]);

  const displayCount = hasManualOverride ? editCount : (liveResult?.count ?? editCount);

  return (
    <div className="fixed inset-0 z-50 bg-black flex flex-col">
      {/* Header - simplified with just the type name */}
      <div className="absolute top-0 left-0 right-0 z-20 p-3 flex items-center justify-center">
        <div className="bg-black/70 backdrop-blur-sm rounded-xl px-4 py-2 text-center">
          <h2 className="text-white font-bold text-lg">{selectedLinenTypeName}</h2>
          <p className="text-white/70 text-xs">
            {scanMode === 'manual' ? 'Mode manuel' : scanMode === 'photo' ? 'Mode photo' : 'Temps réel'}
          </p>
        </div>
      </div>

      {/* PROMINENT REAL-TIME COUNT DISPLAY */}
      <div className="absolute top-20 left-0 right-0 z-20 flex justify-center pointer-events-none">
        <div className={`rounded-2xl px-8 py-4 shadow-2xl ${isStabilized ? 'bg-green-600 text-white' : 'bg-primary text-primary-foreground'}`}>
          <div className="text-center">
            <div className="text-6xl font-black tabular-nums">{displayCount}</div>
            <div className="text-lg font-medium opacity-90">
              {isStabilized ? '✅ Résultat stabilisé' : 'pièces détectées'}
            </div>
            {!isStabilized && scanMode === 'live' && stabilizationProgress > 0 && (
              <div className="flex items-center justify-center gap-1 mt-2">
                {Array.from({ length: STABILIZATION_REQUIRED }).map((_, i) => (
                  <div
                    key={i}
                    className={`h-2 w-6 rounded-full ${i < stabilizationProgress ? 'bg-white' : 'bg-white/30'}`}
                  />
                ))}
                <span className="text-xs ml-2 opacity-75">Stabilisation...</span>
              </div>
            )}
            
            {liveResult?.confidence && liveResult.confidence > 0 && (
              <Badge variant="secondary" className="mt-2">
                {Math.round(liveResult.confidence * 100)}% confiance
              </Badge>
            )}
          </div>
        </div>
      </div>

      {/* Camera view */}
      <div className="flex-1 relative">
        {scanMode !== 'manual' ? (
          <>
            {capturedPhoto ? (
              <img src={capturedPhoto} alt="Captured" className="w-full h-full object-cover" />
            ) : (
              <video ref={videoRef} autoPlay playsInline muted className="w-full h-full object-cover" />
            )}

            {/* Fixed white guide frame */}
            {isStreaming && !capturedPhoto && (
              <div 
                className="absolute pointer-events-none border-4 border-white rounded-2xl"
                style={{
                  left: `${GUIDE_LEFT}%`,
                  top: `${GUIDE_TOP}%`,
                  width: `${GUIDE_WIDTH}%`,
                  height: `${GUIDE_HEIGHT}%`,
                }}
              >
                <div className="absolute top-0 left-0 w-10 h-10 border-t-4 border-l-4 border-white rounded-tl-xl" />
                <div className="absolute top-0 right-0 w-10 h-10 border-t-4 border-r-4 border-white rounded-tr-xl" />
                <div className="absolute bottom-0 left-0 w-10 h-10 border-b-4 border-l-4 border-white rounded-bl-xl" />
                <div className="absolute bottom-0 right-0 w-10 h-10 border-b-4 border-r-4 border-white rounded-br-xl" />
              </div>
            )}

            {/* Mode selector bar - BELOW WHITE FRAME */}
            {isStreaming && !capturedPhoto && (
              <div 
                className="absolute z-20 left-1/2 -translate-x-1/2 flex gap-1 bg-black/80 backdrop-blur-sm p-1 rounded-xl"
                style={{ top: `${GUIDE_TOP + GUIDE_HEIGHT + 2}%` }}
              >
                <Button
                  variant={scanMode === 'live' ? 'default' : 'ghost'}
                  size="sm"
                  onClick={() => {
                    setScanMode('live');
                    setCapturedPhoto(null);
                    setIsLiveScanning(true);
                    setHasManualOverride(false);
                  }}
                  className="text-white h-9 px-3"
                >
                  <Play className="h-4 w-4 mr-1" />
                  Temps réel
                </Button>
                <Button
                  variant={scanMode === 'photo' ? 'default' : 'ghost'}
                  size="sm"
                  onClick={() => {
                    setScanMode('photo');
                    setCapturedPhoto(null);
                    setIsLiveScanning(false);
                  }}
                  className="text-white h-9 px-3"
                >
                  <Camera className="h-4 w-4 mr-1" />
                  Photo
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => {
                    setScanMode('manual');
                    stopCamera();
                    setCapturedPhoto(null);
                    setIsLiveScanning(false);
                    setHasManualOverride(true);
                  }}
                  className="text-white h-9 px-3"
                >
                  <Plus className="h-4 w-4 mr-1" />
                  Manuel
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={onClose}
                  className="text-white h-9 px-3"
                >
                  <X className="h-4 w-4 mr-1" />
                  Quitter
                </Button>
              </div>
            )}

            {/* Purple detection bounds inside white frame */}
            {boundsStyle && !capturedPhoto && (
              <div
                className="absolute border-4 border-purple-500 rounded-xl pointer-events-none"
                style={boundsStyle}
              />
            )}

            {/* Width badge */}
            {liveResult?.widthCm && liveResult.widthCm > 0 && !capturedPhoto && (
              <div className="absolute bottom-48 left-4 z-20">
                <Badge variant="secondary" className="text-sm px-3 py-1">
                  Largeur ≈ {Math.round(liveResult.widthCm)} cm
                </Badge>
              </div>
            )}

            {/* VALIDATE BUTTON - Shown when stabilized or result available */}
            {liveResult && liveResult.count > 0 && !isAnalyzing && !capturedPhoto && (
              <div className="absolute bottom-6 left-4 right-4 z-20 space-y-2">
                {isStabilized && (
                  <Button 
                    onClick={handleResumeScan} 
                    variant="outline"
                    className="w-full h-10 text-white border-white/50 bg-black/40 hover:bg-black/60"
                  >
                    <Play className="h-4 w-4 mr-2" />
                    Re-scanner
                  </Button>
                )}
                <Button 
                  onClick={handleConfirm} 
                  className={`w-full h-14 text-lg shadow-2xl ${isStabilized ? 'bg-green-600 hover:bg-green-700 animate-pulse' : 'bg-green-600/70 hover:bg-green-700'}`}
                  disabled={isUploading}
                >
                  {isUploading ? (
                    <Loader2 className="h-6 w-6 mr-2 animate-spin" />
                  ) : (
                    <CheckCircle className="h-6 w-6 mr-2" />
                  )}
                  Valider {displayCount} et enregistrer
                </Button>
              </div>
            )}

            {/* Loading overlay */}
            {(isAnalyzing || isUploading) && (
              <div className="absolute inset-0 bg-black/60 flex items-center justify-center z-30">
                <div className="text-center text-white">
                  <Loader2 className="h-16 w-16 animate-spin mx-auto mb-3" />
                  <p className="text-xl font-medium">
                    {isUploading ? 'Enregistrement...' : 'Analyse IA...'}
                  </p>
                </div>
              </div>
            )}

            {/* Camera fallback */}
            {cameraFailed && !capturedPhoto && (
              <div className="absolute inset-0 flex items-center justify-center bg-black">
                <div className="text-center text-white p-6">
                  <Camera className="h-16 w-16 mx-auto mb-4 opacity-50" />
                  <p className="mb-4">Caméra indisponible</p>
                  <Button onClick={() => fileInputRef.current?.click()} variant="secondary">
                    📷 Choisir une photo
                  </Button>
                </div>
              </div>
            )}
          </>
        ) : (
          <div className="flex items-center justify-center h-full bg-muted/10">
            <div className="text-center p-8 text-white">
              <div className="text-7xl mb-4">✋</div>
              <h3 className="text-2xl font-bold mb-2">Comptage manuel</h3>
              <p className="text-white/70">
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

      {/* Bottom controls - SIMPLIFIED */}
      <div className="bg-background border-t border-border p-4 pb-6 space-y-3">
        {/* Mode selector for manual mode or when camera not streaming */}
        {(scanMode === 'manual' || !isStreaming || capturedPhoto) && (
          <div className="flex gap-2 bg-muted p-1 rounded-lg">
            <Button
              variant={scanMode === 'live' ? 'default' : 'ghost'}
              size="sm"
              onClick={() => {
                setScanMode('live');
                setCapturedPhoto(null);
                setIsLiveScanning(true);
                setHasManualOverride(false);
              }}
              className="flex-1"
            >
              <Play className="h-4 w-4 mr-1" />
              Temps réel
            </Button>
            <Button
              variant={scanMode === 'photo' ? 'default' : 'ghost'}
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
              variant={scanMode === 'manual' ? 'default' : 'ghost'}
              size="sm"
              onClick={() => {
                setScanMode('manual');
                stopCamera();
                setCapturedPhoto(null);
                setIsLiveScanning(false);
                setHasManualOverride(true);
              }}
              className="flex-1"
            >
              <Plus className="h-4 w-4 mr-1" />
              Manuel
            </Button>
          </div>
        )}

        {/* Photo mode: capture button */}
        {scanMode === 'photo' && !capturedPhoto && isStreaming && (
          <Button 
            onClick={handleCapturePhoto} 
            className="w-full h-12"
            disabled={isAnalyzing}
          >
            <Camera className="h-5 w-5 mr-2" />
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
            Reprendre
          </Button>
        )}

        {/* Manual count adjustment */}
        <div className="flex items-center justify-center gap-4">
          <Button
            variant="outline"
            size="icon"
            className="h-12 w-12 rounded-full text-xl"
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
              className="text-3xl font-bold text-center h-14 w-24 tabular-nums"
              min={0}
            />
            {hasManualOverride && (
              <Badge variant="outline" className="mt-1 text-xs">Modifié</Badge>
            )}
          </div>

          <Button
            variant="outline"
            size="icon"
            className="h-12 w-12 rounded-full text-xl"
            onClick={() => {
              setHasManualOverride(true);
              setEditCount(editCount + 1);
            }}
          >
            <Plus className="h-6 w-6" />
          </Button>
        </div>

        {/* Action buttons - Validate prominently shown when result available, or in captured/manual mode */}
        {(capturedPhoto || scanMode === 'manual' || (liveResult && liveResult.count >= 0)) && (
          <Button 
            onClick={handleConfirm} 
            className="w-full h-14 text-lg bg-green-600 hover:bg-green-700"
            disabled={isUploading}
          >
            {isUploading ? (
              <Loader2 className="h-6 w-6 mr-2 animate-spin" />
            ) : (
              <CheckCircle className="h-6 w-6 mr-2" />
            )}
            Valider {editCount} et enregistrer la photo
          </Button>
        )}

        {/* Quit button - always visible */}
        <Button
          variant="outline"
          onClick={onClose}
          className="w-full h-10"
        >
          <X className="h-5 w-5 mr-2" />
          Quitter sans enregistrer
        </Button>

        {/* Import fallback - smaller */}
        {scanMode !== 'manual' && !cameraFailed && !capturedPhoto && (
          <Button
            onClick={() => fileInputRef.current?.click()}
            variant="ghost"
            size="sm"
            className="w-full text-sm"
          >
            <ImageIcon className="h-4 w-4 mr-2" />
            Importer une photo
          </Button>
        )}
      </div>

      {/* Linen type selector */}
      <Dialog open={showLinenTypeSelector} onOpenChange={setShowLinenTypeSelector}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <AlertCircle className="h-5 w-5 text-amber-500" />
              Plusieurs types détectés
            </DialogTitle>
            <DialogDescription>
              Largeur ≈ {Math.round(liveResult?.widthCm || 0)} cm
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
                    <div className="text-sm text-muted-foreground">{lt.dimensions} cm</div>
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
