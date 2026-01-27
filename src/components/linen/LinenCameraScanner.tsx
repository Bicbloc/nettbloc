import React, { useRef, useState, useEffect, useCallback } from 'react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Camera, X, RotateCcw, CheckCircle, AlertCircle, ImagePlus, Hash, Eye, Minus, Plus } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';

interface LinenCameraScannerProps {
  linenTypeId: string;
  linenTypeName: string;
  hotelId: string;
  onCountComplete: (result: { count: number; confidence: number; photoUrl: string; notes?: string }) => void;
  onClose: () => void;
}

interface DetectionResult {
  count: number;
  confidence: number;
  boxes?: Array<{ x: number; y: number; width: number; height: number }>;
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
  const overlayCanvasRef = useRef<HTMLCanvasElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const animationFrameRef = useRef<number | null>(null);
  const lastDetectionRef = useRef<DetectionResult | null>(null);
  
  const [isStreaming, setIsStreaming] = useState(false);
  const [isCounting, setIsCounting] = useState(false);
  const [result, setResult] = useState<{ count: number; confidence: number; notes?: string } | null>(null);
  const [capturedImage, setCapturedImage] = useState<string | null>(null);
  const [cameraFailed, setCameraFailed] = useState(false);
  const [mode, setMode] = useState<'camera' | 'manual'>('camera');
  const [manualCount, setManualCount] = useState(0);
  const [liveDetection, setLiveDetection] = useState<DetectionResult | null>(null);
  const [isLiveDetecting, setIsLiveDetecting] = useState(false);
  
  // État pour la correction du comptage IA
  const [showCorrectionInput, setShowCorrectionInput] = useState(false);
  const [correctedCount, setCorrectedCount] = useState(0);

  const fileInputId = `linen-photo-input-${linenTypeId}`;
  
  const { toast } = useToast();

  useEffect(() => {
    if (mode === 'camera') {
      startCamera();
    }
    return () => {
      stopCamera();
      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current);
      }
    };
  }, [mode]);

  // Live detection loop
  const runLiveDetection = useCallback(async () => {
    if (!videoRef.current || !overlayCanvasRef.current || !isStreaming || capturedImage) {
      return;
    }

    const video = videoRef.current;
    const overlayCanvas = overlayCanvasRef.current;
    const ctx = overlayCanvas.getContext('2d');
    
    if (!ctx || video.videoWidth === 0) {
      animationFrameRef.current = requestAnimationFrame(runLiveDetection);
      return;
    }

    // Sync overlay canvas size with video
    overlayCanvas.width = video.videoWidth;
    overlayCanvas.height = video.videoHeight;

    // Clear previous overlay
    ctx.clearRect(0, 0, overlayCanvas.width, overlayCanvas.height);

    // Run detection every ~1 second to avoid overloading
    if (!isLiveDetecting) {
      setIsLiveDetecting(true);
      
      try {
        // Capture current frame
        const tempCanvas = document.createElement('canvas');
        tempCanvas.width = video.videoWidth;
        tempCanvas.height = video.videoHeight;
        const tempCtx = tempCanvas.getContext('2d');
        if (tempCtx) {
          tempCtx.drawImage(video, 0, 0);
          const frameData = tempCanvas.toDataURL('image/jpeg', 0.5); // Lower quality for speed
          
          // Call detection API
          const { data, error } = await supabase.functions.invoke('count-linen', {
            body: {
              image: frameData,
              linenTypeId,
              hotelId,
              liveMode: true // Indicate this is for live preview
            }
          });

          if (!error && data) {
            const detection: DetectionResult = {
              count: data.count || 0,
              confidence: data.confidence || 0,
              boxes: data.boxes || []
            };
            lastDetectionRef.current = detection;
            setLiveDetection(detection);
          }
        }
      } catch (err) {
        console.log('Live detection error (ignored):', err);
      } finally {
        setIsLiveDetecting(false);
      }
    }

    // Draw overlay with last detection result
    if (lastDetectionRef.current) {
      drawOverlay(ctx, lastDetectionRef.current, overlayCanvas.width, overlayCanvas.height);
    }

    // Continue loop
    animationFrameRef.current = requestAnimationFrame(runLiveDetection);
  }, [isStreaming, capturedImage, isLiveDetecting, linenTypeId, hotelId]);

  // Start live detection when streaming
  useEffect(() => {
    if (isStreaming && !capturedImage && mode === 'camera') {
      animationFrameRef.current = requestAnimationFrame(runLiveDetection);
    }
    return () => {
      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current);
      }
    };
  }, [isStreaming, capturedImage, mode, runLiveDetection]);

  const drawOverlay = (ctx: CanvasRenderingContext2D, detection: DetectionResult, width: number, height: number) => {
    // Draw semi-transparent background with grid lines
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.3)';
    ctx.lineWidth = 1;
    
    // Grid lines
    const gridSize = 5;
    for (let i = 1; i < gridSize; i++) {
      // Vertical
      ctx.beginPath();
      ctx.moveTo((width / gridSize) * i, 0);
      ctx.lineTo((width / gridSize) * i, height);
      ctx.stroke();
      // Horizontal
      ctx.beginPath();
      ctx.moveTo(0, (height / gridSize) * i);
      ctx.lineTo(width, (height / gridSize) * i);
      ctx.stroke();
    }

    // Draw detection boxes if available
    if (detection.boxes && detection.boxes.length > 0) {
      ctx.strokeStyle = '#22c55e'; // Green
      ctx.lineWidth = 3;
      ctx.fillStyle = 'rgba(34, 197, 94, 0.2)';

      detection.boxes.forEach((box, index) => {
        ctx.beginPath();
        ctx.rect(box.x, box.y, box.width, box.height);
        ctx.fill();
        ctx.stroke();

        // Draw number label
        ctx.fillStyle = '#22c55e';
        ctx.font = 'bold 24px sans-serif';
        ctx.fillText(`${index + 1}`, box.x + 5, box.y + 25);
      });
    }

    // Draw count indicator at top
    const countBgHeight = 60;
    ctx.fillStyle = 'rgba(0, 0, 0, 0.7)';
    ctx.fillRect(0, 0, width, countBgHeight);

    ctx.fillStyle = '#ffffff';
    ctx.font = 'bold 28px sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText(`Détecté: ${detection.count} ${linenTypeName}`, width / 2, 40);

    // Draw confidence bar
    const barWidth = width * 0.6;
    const barHeight = 8;
    const barX = (width - barWidth) / 2;
    const barY = countBgHeight - 15;

    ctx.fillStyle = 'rgba(255, 255, 255, 0.3)';
    ctx.fillRect(barX, barY, barWidth, barHeight);

    const confidenceColor = detection.confidence >= 0.7 ? '#22c55e' : 
                           detection.confidence >= 0.5 ? '#f59e0b' : '#ef4444';
    ctx.fillStyle = confidenceColor;
    ctx.fillRect(barX, barY, barWidth * detection.confidence, barHeight);

    ctx.textAlign = 'left';
  };

  const startCamera = async () => {
    try {
      if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
        setCameraFailed(true);
        toast({
          title: "Caméra non disponible",
          description: "Utilisez le mode manuel ou sélectionnez une photo.",
          variant: "destructive"
        });
        return;
      }

      let stream: MediaStream | null = null;
      
      try {
        stream = await navigator.mediaDevices.getUserMedia({
          video: { 
            facingMode: 'environment',
            width: { ideal: 1920 },
            height: { ideal: 1080 }
          }
        });
      } catch (envError) {
        stream = await navigator.mediaDevices.getUserMedia({
          video: { width: { ideal: 1280 }, height: { ideal: 720 } }
        });
      }
      
      if (videoRef.current && stream) {
        videoRef.current.srcObject = stream;
        streamRef.current = stream;
        
        await Promise.race([
          new Promise<void>((resolve) => {
            if (videoRef.current) {
              videoRef.current.onloadedmetadata = () => {
                videoRef.current?.play().catch(console.error);
                resolve();
              };
            }
          }),
          new Promise<void>((_, reject) => setTimeout(() => reject(new Error('Timeout')), 10000))
        ]);
        
        setIsStreaming(true);
      }
    } catch (error: any) {
      console.error('Erreur accès caméra:', error);
      setCameraFailed(true);
      toast({
        title: "Caméra non disponible",
        description: "Utilisez le mode manuel ou sélectionnez une photo.",
        variant: "default"
      });
    }
  };

  const stopCamera = () => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(track => track.stop());
      streamRef.current = null;
    }
    if (animationFrameRef.current) {
      cancelAnimationFrame(animationFrameRef.current);
    }
    setIsStreaming(false);
    setLiveDetection(null);
    lastDetectionRef.current = null;
  };

  const capturePhoto = () => {
    if (!videoRef.current || !canvasRef.current) {
      toast({ title: "Erreur", description: "Caméra non initialisée", variant: "destructive" });
      return;
    }

    const video = videoRef.current;
    const canvas = canvasRef.current;
    
    if (video.videoWidth === 0 || video.videoHeight === 0) {
      toast({ title: "Erreur", description: "La vidéo n'est pas encore prête.", variant: "destructive" });
      return;
    }
    
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    ctx.drawImage(video, 0, 0);
    const imageDataUrl = canvas.toDataURL('image/jpeg', 0.9);
    setCapturedImage(imageDataUrl);
    stopCamera();
    
    // Use live detection result if available, otherwise run full analysis
    if (liveDetection && liveDetection.confidence >= 0.5) {
      setResult({
        count: liveDetection.count,
        confidence: liveDetection.confidence,
        notes: `Détection en temps réel`
      });
      toast({
        title: "✅ Photo capturée",
        description: `${liveDetection.count} ${linenTypeName} détecté(s)`,
      });
    } else {
      handleCount(imageDataUrl);
    }
  };

  const handleCount = async (imageData: string) => {
    setIsCounting(true);
    setResult(null);

    try {
      const { data, error } = await supabase.functions.invoke('count-linen', {
        body: { image: imageData, linenTypeId, hotelId }
      });

      if (error) {
        // Gestion erreur 402 (crédits IA insuffisants)
        const errorMsg = error.message || '';
        if (errorMsg.includes('402') || errorMsg.includes('credits') || errorMsg.includes('Payment')) {
          toast({ 
            title: "Crédits IA insuffisants", 
            description: "Utilisez le mode manuel pour compter le linge.", 
            variant: "default" 
          });
          setMode('manual');
          return;
        }
        throw error;
      }

      setResult({
        count: data.count,
        confidence: data.confidence,
        notes: data.notes
      });

      if (data.confidence >= 0.7) {
        toast({ title: "✅ Comptage réussi", description: `${data.count} ${linenTypeName} détecté(s)` });
      } else if (data.confidence >= 0.5) {
        toast({ title: "⚠️ Confiance moyenne", description: "Vérifiez le résultat", variant: "default" });
      } else {
        toast({ title: "⚠️ Confiance faible", description: "Recommandé de reprendre", variant: "destructive" });
      }
    } catch (error: any) {
      console.error('Erreur comptage:', error);
      toast({ 
        title: "Erreur", 
        description: "Impossible de compter. Utilisez le mode manuel.", 
        variant: "destructive" 
      });
      setMode('manual');
    } finally {
      setIsCounting(false);
    }
  };

  const handleRetake = () => {
    setCapturedImage(null);
    setResult(null);
    setCameraFailed(false);
    setLiveDetection(null);
    lastDetectionRef.current = null;
    startCamera();
  };

  const handleFileSelect = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (e) => {
      const imageData = e.target?.result as string;
      setCapturedImage(imageData);
      stopCamera();
      handleCount(imageData);
    };
    reader.readAsDataURL(file);
  };

  // Fonction pour sauvegarder la correction d'apprentissage
  const saveTrainingSample = async (aiCount: number, actualCount: number, photoUrl: string) => {
    if (aiCount === actualCount) return; // Pas de correction nécessaire
    
    try {
      const { error } = await supabase
        .from('linen_training_samples')
        .insert({
          hotel_id: hotelId,
          linen_type_id: linenTypeId,
          ai_predicted_count: aiCount,
          actual_count: actualCount,
          image_url: photoUrl || 'no-image',
          notes: `Correction: IA a compté ${aiCount}, réel: ${actualCount}`,
          created_by: 'housekeeper'
        });
      
      if (error) {
        console.error('Erreur sauvegarde apprentissage:', error);
      } else {
        console.log('✅ Correction sauvegardée pour apprentissage');
        toast({
          title: "🧠 Apprentissage enregistré",
          description: "Le système apprendra de cette correction",
        });
      }
    } catch (err) {
      console.error('Erreur sauvegarde sample:', err);
    }
  };

  const handleConfirm = async () => {
    // For manual mode
    if (mode === 'manual') {
      onCountComplete({
        count: manualCount,
        confidence: 1.0,
        photoUrl: '',
        notes: 'Comptage manuel'
      });
      toast({
        title: "✅ Comptage enregistré",
        description: `${manualCount} ${linenTypeName} (manuel)`,
      });
      return;
    }

    // For camera/photo mode
    if (!result || !capturedImage) return;
    
    // Déterminer le compte final (corrigé ou original)
    const finalCount = showCorrectionInput ? correctedCount : result.count;
    const wasCorrection = showCorrectionInput && correctedCount !== result.count;

    try {
      const response = await fetch(capturedImage);
      const blob = await response.blob();
      
      const fileName = `linen-${Date.now()}.jpg`;
      const { error: uploadError } = await supabase.storage
        .from('linen-images')
        .upload(fileName, blob, { contentType: 'image/jpeg', upsert: false });

      let publicUrl = '';
      if (!uploadError) {
        const { data } = supabase.storage.from('linen-images').getPublicUrl(fileName);
        publicUrl = data.publicUrl;
      }

      // Si c'était une correction, sauvegarder pour apprentissage
      if (wasCorrection) {
        await saveTrainingSample(result.count, correctedCount, publicUrl);
      }

      if (uploadError) {
        toast({ title: "⚠️ Photo non sauvegardée", description: "Comptage enregistré sans photo", variant: "default" });
      }
      
      onCountComplete({ 
        count: finalCount, 
        confidence: wasCorrection ? 1.0 : result.confidence, 
        photoUrl: publicUrl, 
        notes: wasCorrection ? `Corrigé manuellement (IA: ${result.count})` : result.notes 
      });
      
      toast({ 
        title: wasCorrection ? "✏️ Correction enregistrée" : "Photo enregistrée", 
        description: `Comptage: ${finalCount} ${linenTypeName}` 
      });
    } catch (error) {
      console.error('Erreur upload photo:', error);
      onCountComplete({ count: finalCount, confidence: result.confidence, photoUrl: '', notes: result.notes });
    }
  };

  // Fonction pour activer le mode correction
  const handleEnableCorrection = () => {
    if (result) {
      setCorrectedCount(result.count);
      setShowCorrectionInput(true);
    }
  };

  const getConfidenceColor = (confidence: number) => {
    if (confidence >= 0.7) return 'bg-green-500';
    if (confidence >= 0.5) return 'bg-orange-500';
    return 'bg-red-500';
  };

  const getConfidenceText = (confidence: number) => {
    if (confidence >= 0.7) return 'Excellente';
    if (confidence >= 0.5) return 'Moyenne';
    return 'Faible';
  };

  // Manual counting UI
  if (mode === 'manual') {
    return (
      <div className="fixed inset-0 z-50 bg-background flex flex-col">
        <div className="p-4 border-b flex items-center justify-between">
          <div>
            <h2 className="text-xl font-bold">Comptage manuel</h2>
            <p className="text-sm text-muted-foreground">{linenTypeName}</p>
          </div>
          <div className="flex gap-2">
            <Button variant="outline" size="sm" onClick={() => setMode('camera')}>
              <Camera className="h-4 w-4 mr-1" />
              Caméra
            </Button>
            <Button variant="ghost" size="icon" onClick={onClose}>
              <X className="h-6 w-6" />
            </Button>
          </div>
        </div>

        <div className="flex-1 flex flex-col items-center justify-center p-8">
          <div className="text-6xl mb-8">📦</div>
          <p className="text-lg text-muted-foreground mb-8">Comptez le linge manuellement</p>
          
          <div className="flex items-center gap-4 mb-8">
            <Button
              variant="outline"
              size="lg"
              className="h-16 w-16 rounded-full"
              onClick={() => setManualCount(Math.max(0, manualCount - 1))}
            >
              <Minus className="h-8 w-8" />
            </Button>
            
            <div className="text-center">
              <Input
                type="number"
                value={manualCount}
                onChange={(e) => setManualCount(Math.max(0, parseInt(e.target.value) || 0))}
                className="text-4xl font-bold text-center h-20 w-32"
                min={0}
              />
              <p className="text-sm text-muted-foreground mt-2">pièces</p>
            </div>
            
            <Button
              variant="outline"
              size="lg"
              className="h-16 w-16 rounded-full"
              onClick={() => setManualCount(manualCount + 1)}
            >
              <Plus className="h-8 w-8" />
            </Button>
          </div>

          {/* Quick add buttons */}
          <div className="flex gap-2 mb-8">
            {[5, 10, 20, 50].map(num => (
              <Button
                key={num}
                variant="secondary"
                onClick={() => setManualCount(manualCount + num)}
              >
                +{num}
              </Button>
            ))}
          </div>
        </div>

        <div className="p-4 border-t">
          <Button
            onClick={handleConfirm}
            disabled={manualCount === 0}
            size="lg"
            className="w-full h-14 text-lg"
          >
            <CheckCircle className="h-5 w-5 mr-2" />
            Confirmer {manualCount} pièces
          </Button>
        </div>
      </div>
    );
  }

  // Camera mode UI
  return (
    <div className="fixed inset-0 z-50 bg-black">
      <div className="relative h-full w-full flex flex-col">
        {/* Header */}
        <div className="absolute top-0 left-0 right-0 z-10 bg-gradient-to-b from-black/70 to-transparent p-4">
          <div className="flex items-center justify-between text-white">
            <div>
              <h2 className="text-xl font-bold">Scanner {linenTypeName}</h2>
              <p className="text-sm opacity-80">
                {isStreaming && liveDetection ? (
                  <span className="flex items-center gap-1">
                    <Eye className="h-4 w-4 animate-pulse" />
                    Détection en temps réel active
                  </span>
                ) : (
                  'Prenez une photo claire de la pile'
                )}
              </p>
            </div>
            <div className="flex gap-2">
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setMode('manual')}
                className="text-white hover:bg-white/20"
              >
                <Hash className="h-4 w-4 mr-1" />
                Manuel
              </Button>
              <Button
                variant="ghost"
                size="icon"
                onClick={onClose}
                className="text-white hover:bg-white/20"
              >
                <X className="h-6 w-6" />
              </Button>
            </div>
          </div>
        </div>

        <input
          ref={fileInputRef}
          id={fileInputId}
          type="file"
          accept="image/*"
          capture="environment"
          className="sr-only"
          onChange={handleFileSelect}
        />

        {/* Helper function to trigger file input */}
        {(() => {
          const triggerFileInput = () => {
            fileInputRef.current?.click();
          };
          
          return (
            <>
              {/* Video with overlay */}
              <div className="flex-1 relative flex items-center justify-center bg-black">
                {isStreaming && !capturedImage && (
                  <>
                    <video
                      ref={videoRef}
                      autoPlay
                      playsInline
                      className="w-full h-full object-contain"
                    />
                    <canvas
                      ref={overlayCanvasRef}
                      className="absolute inset-0 w-full h-full object-contain pointer-events-none"
                    />
                  </>
                )}
                
                {/* Fallback: caméra indisponible */}
                {cameraFailed && !capturedImage && !isStreaming && (
                  <div className="flex flex-col items-center justify-center text-white p-8 text-center">
                    <Camera className="h-16 w-16 mb-4 opacity-50" />
                    <p className="text-lg mb-2">Caméra non disponible</p>
                    <p className="text-sm opacity-70 mb-6">Utilisez le mode manuel ou sélectionnez une photo</p>
                    <div className="flex flex-col gap-3 w-full max-w-sm">
                      <Button 
                        size="lg" 
                        variant="secondary"
                        onClick={triggerFileInput}
                      >
                        <Camera className="h-5 w-5 mr-2" />
                        Ouvrir l'appareil photo
                      </Button>
                      <Button onClick={() => setMode('manual')} variant="secondary" size="lg">
                        <Hash className="h-5 w-5 mr-2" />
                        Passer en mode manuel
                      </Button>
                    </div>
                  </div>
                )}

                {/* Fallback: en cours d'initialisation (évite un écran noir) */}
                {!cameraFailed && !capturedImage && !isStreaming && (
                  <div className="flex flex-col items-center justify-center text-white p-8 text-center">
                    <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-white/80 mb-4" />
                    <p className="text-lg mb-2">Initialisation de la caméra…</p>
                    <p className="text-sm opacity-70 mb-6">Si rien ne s'affiche, utilisez la prise de photo.</p>
                    <Button 
                      size="lg" 
                      variant="secondary"
                      onClick={triggerFileInput}
                    >
                      <Camera className="h-5 w-5 mr-2" />
                      Prendre une photo
                    </Button>
                  </div>
                )}
          
          {capturedImage && (
            <img src={capturedImage} alt="Captured" className="w-full h-full object-contain" />
          )}

          <canvas ref={canvasRef} className="hidden" />

          {isCounting && (
            <div className="absolute inset-0 bg-black/70 flex items-center justify-center">
              <Card className="p-6 text-center">
                <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto mb-4" />
                <p className="text-lg font-semibold">Analyse en cours...</p>
                <p className="text-sm text-muted-foreground">L'IA compte le linge</p>
              </Card>
            </div>
          )}
        </div>

        {/* Live detection indicator */}
        {isStreaming && liveDetection && !capturedImage && (
          <div className="absolute top-20 left-4 right-4 z-10">
            <Card className="p-3 bg-black/80 text-white backdrop-blur border-green-500">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="w-3 h-3 bg-green-500 rounded-full animate-pulse" />
                  <span className="text-2xl font-bold">{liveDetection.count}</span>
                  <span className="text-sm opacity-80">{linenTypeName}</span>
                </div>
                <Badge className={getConfidenceColor(liveDetection.confidence)}>
                  {Math.round(liveDetection.confidence * 100)}%
                </Badge>
              </div>
            </Card>
          </div>
        )}

        {/* Result Display with Correction Option */}
        {result && capturedImage && !isCounting && (
          <div className="absolute top-20 left-4 right-4 z-10">
            <Card className="p-4 bg-white/95 backdrop-blur">
              <div className="flex items-center justify-between mb-3">
                <div>
                  {showCorrectionInput ? (
                    <div className="flex items-center gap-2">
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-10 w-10 rounded-full"
                        onClick={() => setCorrectedCount(Math.max(0, correctedCount - 1))}
                      >
                        <Minus className="h-5 w-5" />
                      </Button>
                      <Input
                        type="number"
                        value={correctedCount}
                        onChange={(e) => setCorrectedCount(Math.max(0, parseInt(e.target.value) || 0))}
                        className="w-20 h-10 text-xl font-bold text-center"
                        min={0}
                      />
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-10 w-10 rounded-full"
                        onClick={() => setCorrectedCount(correctedCount + 1)}
                      >
                        <Plus className="h-5 w-5" />
                      </Button>
                    </div>
                  ) : (
                    <>
                      <p className="text-2xl font-bold text-primary">{result.count} pièces</p>
                      <p className="text-sm text-muted-foreground">{linenTypeName}</p>
                    </>
                  )}
                </div>
                <div className="text-right">
                  <Badge className={getConfidenceColor(result.confidence)}>
                    {getConfidenceText(result.confidence)}
                  </Badge>
                  <p className="text-xs text-muted-foreground mt-1">
                    {Math.round(result.confidence * 100)}% confiance
                  </p>
                </div>
              </div>
              
              {/* Bouton de correction */}
              {!showCorrectionInput && (
                <Button 
                  variant="outline" 
                  size="sm" 
                  className="w-full text-orange-600 border-orange-300 hover:bg-orange-50"
                  onClick={handleEnableCorrection}
                >
                  ✏️ Corriger le comptage
                </Button>
              )}
              
              {showCorrectionInput && correctedCount !== result.count && (
                <div className="text-sm text-orange-600 mt-2 flex items-center gap-1">
                  <AlertCircle className="h-4 w-4" />
                  L'IA apprendra de cette correction !
                </div>
              )}
              
              {result.notes && !showCorrectionInput && (
                <p className="text-sm text-muted-foreground border-t pt-2 mt-2">💡 {result.notes}</p>
              )}
            </Card>
          </div>
        )}

        {/* Controls */}
        <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/70 to-transparent p-6">
          {!capturedImage && (
            <div className="flex flex-col gap-3">
              {isStreaming && (
                <Button onClick={capturePhoto} size="lg" className="w-full h-16 text-lg rounded-full">
                  <Camera className="h-6 w-6 mr-2" />
                  {liveDetection ? `Capturer (${liveDetection.count} détecté)` : 'Capturer la photo'}
                </Button>
              )}
              
              <Button
                size="lg"
                variant={cameraFailed ? "default" : "outline"}
                className={`w-full h-14 ${cameraFailed ? 'rounded-full' : ''}`}
                onClick={triggerFileInput}
              >
                <ImagePlus className="h-5 w-5 mr-2" />
                {cameraFailed ? "Ouvrir l'appareil photo" : "Prendre une photo (ou galerie)"}
              </Button>
            </div>
          )}

          {capturedImage && result && (
            <div className="flex gap-3">
              <Button onClick={handleRetake} variant="outline" size="lg" className="flex-1 h-14">
                <RotateCcw className="h-5 w-5 mr-2" />
                Reprendre
              </Button>
              <Button onClick={handleConfirm} size="lg" className="flex-1 h-14" disabled={result.confidence < 0.3}>
                <CheckCircle className="h-5 w-5 mr-2" />
                Confirmer
              </Button>
            </div>
          )}

          {result && result.confidence < 0.6 && (
            <div className="mt-3 flex items-center justify-center gap-2 text-white text-sm">
              <AlertCircle className="h-4 w-4" />
              <span>
                {result.confidence < 0.5 
                  ? "Confiance faible - Recommandé de reprendre ou passer en mode manuel" 
                  : "Vérifiez le résultat avant de confirmer"}
              </span>
            </div>
          )}
        </div>
            </>
          );
        })()}
      </div>
    </div>
  );
};
