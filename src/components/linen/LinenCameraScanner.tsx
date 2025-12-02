import React, { useRef, useState, useEffect } from 'react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Camera, X, RotateCcw, CheckCircle, AlertCircle } from 'lucide-react';
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
  const [isStreaming, setIsStreaming] = useState(false);
  const [isCounting, setIsCounting] = useState(false);
  const [result, setResult] = useState<{ count: number; confidence: number; notes?: string } | null>(null);
  const [capturedImage, setCapturedImage] = useState<string | null>(null);
  const { toast } = useToast();

  useEffect(() => {
    startCamera();
    return () => stopCamera();
  }, []);

  const startCamera = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { 
          facingMode: 'environment',
          width: { ideal: 1920 },
          height: { ideal: 1080 }
        }
      });
      
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        streamRef.current = stream;
        setIsStreaming(true);
      }
    } catch (error) {
      console.error('Erreur accès caméra:', error);
      toast({
        title: "Erreur caméra",
        description: "Impossible d'accéder à la caméra. Vérifiez les permissions.",
        variant: "destructive"
      });
    }
  };

  const stopCamera = () => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(track => track.stop());
      streamRef.current = null;
    }
    setIsStreaming(false);
  };

  const capturePhoto = () => {
    if (!videoRef.current || !canvasRef.current) return;

    const video = videoRef.current;
    const canvas = canvasRef.current;
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    ctx.drawImage(video, 0, 0);
    const imageDataUrl = canvas.toDataURL('image/jpeg', 0.9);
    setCapturedImage(imageDataUrl);
    stopCamera();
    
    // Lancer automatiquement le comptage
    handleCount(imageDataUrl);
  };

  const handleCount = async (imageData: string) => {
    setIsCounting(true);
    setResult(null);

    try {
      const { data, error } = await supabase.functions.invoke('count-linen', {
        body: {
          image: imageData,
          linenTypeId,
          hotelId
        }
      });

      if (error) throw error;

      setResult({
        count: data.count,
        confidence: data.confidence,
        notes: data.notes
      });

      // Si confiance élevée, afficher succès
      if (data.confidence >= 0.7) {
        toast({
          title: "✅ Comptage réussi",
          description: `${data.count} ${linenTypeName} détecté(s)`,
        });
      } else if (data.confidence >= 0.5) {
        toast({
          title: "⚠️ Confiance moyenne",
          description: "Vérifiez le résultat ou reprenez la photo",
          variant: "default"
        });
      } else {
        toast({
          title: "⚠️ Confiance faible",
          description: "Recommandé de reprendre la photo",
          variant: "destructive"
        });
      }

    } catch (error) {
      console.error('Erreur comptage:', error);
      toast({
        title: "Erreur",
        description: "Impossible de compter le linge",
        variant: "destructive"
      });
    } finally {
      setIsCounting(false);
    }
  };

  const handleRetake = () => {
    setCapturedImage(null);
    setResult(null);
    startCamera();
  };

  const handleConfirm = async () => {
    if (!result || !capturedImage) return;

    try {
      // Convertir base64 en Blob pour l'upload
      const response = await fetch(capturedImage);
      const blob = await response.blob();
      
      // Upload photo to storage
      const fileName = `linen-${Date.now()}.jpg`;
      const { data: uploadData, error: uploadError } = await supabase.storage
        .from('linen-images')
        .upload(fileName, blob, {
          contentType: 'image/jpeg',
          upsert: false
        });

      if (uploadError) throw uploadError;

      const { data: { publicUrl } } = supabase.storage
        .from('linen-images')
        .getPublicUrl(fileName);

      onCountComplete({
        count: result.count,
        confidence: result.confidence,
        photoUrl: publicUrl,
        notes: result.notes
      });

      toast({
        title: "Photo enregistrée",
        description: `Comptage: ${result.count} ${linenTypeName}`,
      });

    } catch (error) {
      console.error('Erreur upload photo:', error);
      toast({
        title: "Erreur",
        description: "Impossible d'enregistrer la photo",
        variant: "destructive"
      });
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

  return (
    <div className="fixed inset-0 z-50 bg-black">
      <div className="relative h-full w-full flex flex-col">
        {/* Header */}
        <div className="absolute top-0 left-0 right-0 z-10 bg-gradient-to-b from-black/70 to-transparent p-4">
          <div className="flex items-center justify-between text-white">
            <div>
              <h2 className="text-xl font-bold">Scanner {linenTypeName}</h2>
              <p className="text-sm opacity-80">Prenez une photo claire de la pile</p>
            </div>
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

        {/* Video or Captured Image */}
        <div className="flex-1 relative flex items-center justify-center bg-black">
          {isStreaming && !capturedImage && (
            <video
              ref={videoRef}
              autoPlay
              playsInline
              className="w-full h-full object-contain"
            />
          )}
          
          {capturedImage && (
            <img
              src={capturedImage}
              alt="Captured"
              className="w-full h-full object-contain"
            />
          )}

          <canvas ref={canvasRef} className="hidden" />

          {/* Loading overlay */}
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

        {/* Result Display */}
        {result && capturedImage && !isCounting && (
          <div className="absolute top-20 left-4 right-4 z-10">
            <Card className="p-4 bg-white/95 backdrop-blur">
              <div className="flex items-center justify-between mb-3">
                <div>
                  <p className="text-2xl font-bold text-primary">{result.count} pièces</p>
                  <p className="text-sm text-muted-foreground">{linenTypeName}</p>
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
              {result.notes && (
                <p className="text-sm text-muted-foreground border-t pt-2">
                  💡 {result.notes}
                </p>
              )}
            </Card>
          </div>
        )}

        {/* Controls */}
        <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/70 to-transparent p-6">
          {isStreaming && !capturedImage && (
            <Button
              onClick={capturePhoto}
              size="lg"
              className="w-full h-16 text-lg rounded-full"
            >
              <Camera className="h-6 w-6 mr-2" />
              Capturer la photo
            </Button>
          )}

          {capturedImage && result && (
            <div className="flex gap-3">
              <Button
                onClick={handleRetake}
                variant="outline"
                size="lg"
                className="flex-1 h-14"
              >
                <RotateCcw className="h-5 w-5 mr-2" />
                Reprendre
              </Button>
              <Button
                onClick={handleConfirm}
                size="lg"
                className="flex-1 h-14"
                disabled={result.confidence < 0.3}
              >
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
                  ? "Confiance faible - Recommandé de reprendre" 
                  : "Vérifiez le résultat avant de confirmer"}
              </span>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
