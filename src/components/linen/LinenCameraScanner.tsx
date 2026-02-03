import React, { useRef, useState, useEffect, useCallback } from 'react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Camera, X, RotateCcw, CheckCircle, Minus, Plus, Loader2 } from 'lucide-react';
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
  
  const [isStreaming, setIsStreaming] = useState(false);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [result, setResult] = useState<{ count: number; confidence: number } | null>(null);
  const [capturedImage, setCapturedImage] = useState<string | null>(null);
  const [cameraFailed, setCameraFailed] = useState(false);
  const [editCount, setEditCount] = useState(0);
  
  const { toast } = useToast();

  // Start camera on mount
  useEffect(() => {
    startCamera();
    return () => stopCamera();
  }, []);

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

  const capturePhoto = useCallback(() => {
    const video = videoRef.current;
    const canvas = canvasRef.current;
    if (!video || !canvas) return;

    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    ctx.drawImage(video, 0, 0);
    const imageData = canvas.toDataURL('image/jpeg', 0.85);
    
    setCapturedImage(imageData);
    stopCamera();
    analyzeImage(imageData);
  }, []);

  const analyzeImage = async (imageData: string) => {
    setIsAnalyzing(true);
    try {
      const { data, error } = await supabase.functions.invoke('count-linen', {
        body: { image: imageData, linenTypeId, hotelId }
      });

      if (error) throw error;

      const count = data?.count || 0;
      const confidence = data?.confidence || 0;
      setResult({ count, confidence });
      setEditCount(count);
    } catch (error) {
      console.error('Analysis error:', error);
      toast({ title: "Erreur d'analyse", description: "Réessayez ou comptez manuellement", variant: "destructive" });
      setResult({ count: 0, confidence: 0 });
      setEditCount(0);
    } finally {
      setIsAnalyzing(false);
    }
  };

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (ev) => {
      const data = ev.target?.result as string;
      setCapturedImage(data);
      stopCamera();
      analyzeImage(data);
    };
    reader.readAsDataURL(file);
  };

  const handleRetake = () => {
    setCapturedImage(null);
    setResult(null);
    startCamera();
  };

  const handleConfirm = async () => {
    if (!capturedImage) return;

    try {
      // Upload image
      const response = await fetch(capturedImage);
      const blob = await response.blob();
      const fileName = `linen-${Date.now()}.jpg`;
      
      await supabase.storage.from('linen-images').upload(fileName, blob, { contentType: 'image/jpeg' });
      const { data } = supabase.storage.from('linen-images').getPublicUrl(fileName);

      onCountComplete({
        count: editCount,
        confidence: result?.confidence || 1,
        photoUrl: data.publicUrl,
        notes: editCount !== result?.count ? `Corrigé (IA: ${result?.count})` : undefined
      });
    } catch (error) {
      // Still complete even if upload fails
      onCountComplete({ count: editCount, confidence: result?.confidence || 1, photoUrl: '' });
    }
  };

  const getConfidenceColor = (c: number) => c >= 0.7 ? 'bg-green-500' : c >= 0.5 ? 'bg-orange-500' : 'bg-red-500';

  return (
    <div className="fixed inset-0 z-50 bg-black flex flex-col">
      {/* Header with close button */}
      <div className="absolute top-0 left-0 right-0 z-20 p-4 flex items-center justify-between bg-gradient-to-b from-black/80 to-transparent">
        <div className="text-white">
          <h2 className="text-lg font-bold">{linenTypeName}</h2>
          <p className="text-sm opacity-70">
            {isAnalyzing ? 'Analyse en cours...' : capturedImage ? 'Vérifiez le comptage' : 'Prenez une photo'}
          </p>
        </div>
        <Button variant="ghost" size="icon" onClick={onClose} className="text-white hover:bg-white/20 h-12 w-12">
          <X className="h-7 w-7" />
        </Button>
      </div>

      {/* Camera / Image view */}
      <div className="flex-1 relative">
        {capturedImage ? (
          <img src={capturedImage} alt="Captured" className="w-full h-full object-contain" />
        ) : (
          <>
            <video
              ref={videoRef}
              autoPlay
              playsInline
              muted
              className="w-full h-full object-cover"
            />
            {/* Centering guide */}
            {isStreaming && (
              <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                <div className="border-2 border-dashed border-white/50 rounded-xl w-[80%] h-[60%]" />
              </div>
            )}
          </>
        )}
        
        {/* Loading overlay */}
        {isAnalyzing && (
          <div className="absolute inset-0 bg-black/60 flex items-center justify-center">
            <div className="text-center text-white">
              <Loader2 className="h-12 w-12 animate-spin mx-auto mb-3" />
              <p className="text-lg font-medium">Comptage IA...</p>
            </div>
          </div>
        )}

        {/* Camera fallback */}
        {cameraFailed && !capturedImage && (
          <div className="absolute inset-0 flex items-center justify-center bg-gray-900">
            <div className="text-center text-white p-6">
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
      <div className="bg-black p-4 pb-8">
        {!capturedImage ? (
          <div className="flex gap-3 justify-center">
            <Button
              onClick={() => fileInputRef.current?.click()}
              variant="outline"
              className="h-14 px-6 bg-white/10 border-white/30 text-white"
            >
              📁 Galerie
            </Button>
            <Button
              onClick={capturePhoto}
              disabled={!isStreaming}
              className="h-16 w-16 rounded-full bg-white text-black hover:bg-gray-200"
            >
              <Camera className="h-8 w-8" />
            </Button>
          </div>
        ) : result && !isAnalyzing ? (
          <div className="space-y-4">
            {/* Result display with edit controls */}
            <div className="flex items-center justify-center gap-4">
              <Button
                variant="outline"
                size="icon"
                className="h-12 w-12 rounded-full bg-white/10 border-white/30 text-white"
                onClick={() => setEditCount(Math.max(0, editCount - 1))}
              >
                <Minus className="h-5 w-5" />
              </Button>
              
              <div className="text-center">
                <Input
                  type="number"
                  value={editCount}
                  onChange={(e) => setEditCount(Math.max(0, parseInt(e.target.value) || 0))}
                  className="text-3xl font-bold text-center h-14 w-24 bg-white/10 border-white/30 text-white"
                  min={0}
                />
                <div className="flex items-center justify-center gap-2 mt-1">
                  <Badge className={`${getConfidenceColor(result.confidence)} text-white text-xs`}>
                    {Math.round(result.confidence * 100)}% confiance
                  </Badge>
                  {editCount !== result.count && (
                    <Badge variant="outline" className="border-orange-400 text-orange-400 text-xs">
                      Modifié
                    </Badge>
                  )}
                </div>
              </div>
              
              <Button
                variant="outline"
                size="icon"
                className="h-12 w-12 rounded-full bg-white/10 border-white/30 text-white"
                onClick={() => setEditCount(editCount + 1)}
              >
                <Plus className="h-5 w-5" />
              </Button>
            </div>

            {/* Action buttons */}
            <div className="flex gap-3">
              <Button
                variant="outline"
                onClick={handleRetake}
                className="flex-1 h-12 bg-white/10 border-white/30 text-white"
              >
                <RotateCcw className="h-4 w-4 mr-2" />
                Reprendre
              </Button>
              <Button
                onClick={handleConfirm}
                className="flex-1 h-12 bg-green-600 hover:bg-green-700 text-white"
              >
                <CheckCircle className="h-4 w-4 mr-2" />
                Valider {editCount}
              </Button>
            </div>
          </div>
        ) : null}
      </div>
    </div>
  );
};
