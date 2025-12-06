import React, { useRef, useState, useEffect } from 'react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Camera, X, RotateCcw, CheckCircle, AlertCircle, ImagePlus } from 'lucide-react';
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
  const fileInputRef = useRef<HTMLInputElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const [isStreaming, setIsStreaming] = useState(false);
  const [isCounting, setIsCounting] = useState(false);
  const [result, setResult] = useState<{ count: number; confidence: number; notes?: string } | null>(null);
  const [capturedImage, setCapturedImage] = useState<string | null>(null);
  const [cameraFailed, setCameraFailed] = useState(false);
  const { toast } = useToast();

  useEffect(() => {
    startCamera();
    return () => stopCamera();
  }, []);

  const startCamera = async () => {
    try {
      // Vérifier si navigator.mediaDevices est disponible (nécessite HTTPS)
      if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
        toast({
          title: "Caméra non disponible",
          description: "La caméra nécessite une connexion sécurisée (HTTPS). Utilisez un navigateur moderne.",
          variant: "destructive"
        });
        return;
      }

      // Essayer d'abord avec la caméra arrière
      let stream: MediaStream | null = null;
      
      try {
        console.log('📷 Tentative caméra arrière...');
        stream = await navigator.mediaDevices.getUserMedia({
          video: { 
            facingMode: 'environment',
            width: { ideal: 1920 },
            height: { ideal: 1080 }
          }
        });
      } catch (envError) {
        console.log('📷 Caméra arrière non disponible, essai avec caméra frontale...', envError);
        // Fallback: essayer n'importe quelle caméra disponible
        stream = await navigator.mediaDevices.getUserMedia({
          video: {
            width: { ideal: 1280 },
            height: { ideal: 720 }
          }
        });
      }
      
      if (videoRef.current && stream) {
        videoRef.current.srcObject = stream;
        streamRef.current = stream;
        
        // Attendre que la vidéo soit prête avec timeout
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
        console.log('✅ Caméra démarrée avec succès');
      } else {
        throw new Error('Impossible d\'initialiser le flux vidéo');
      }
    } catch (error: any) {
      console.error('❌ Erreur accès caméra:', error);
      setCameraFailed(true);
      
      let errorMessage = "Impossible d'accéder à la caméra. Vous pouvez sélectionner une photo depuis votre galerie.";
      
      if (error.name === 'NotAllowedError') {
        errorMessage = "Accès à la caméra refusé. Utilisez le bouton pour sélectionner une photo.";
      } else if (error.name === 'NotFoundError') {
        errorMessage = "Aucune caméra détectée. Sélectionnez une photo depuis votre galerie.";
      } else if (error.name === 'NotReadableError') {
        errorMessage = "La caméra est utilisée ailleurs. Sélectionnez une photo.";
      } else if (!window.isSecureContext) {
        errorMessage = "HTTPS requis pour la caméra. Utilisez la galerie photo.";
      }
      
      toast({
        title: "Caméra non disponible",
        description: errorMessage,
        variant: "default"
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
    if (!videoRef.current || !canvasRef.current) {
      toast({
        title: "Erreur",
        description: "Caméra non initialisée",
        variant: "destructive"
      });
      return;
    }

    const video = videoRef.current;
    const canvas = canvasRef.current;
    
    // Vérifier que la vidéo a des dimensions valides
    if (video.videoWidth === 0 || video.videoHeight === 0) {
      toast({
        title: "Erreur",
        description: "La vidéo n'est pas encore prête. Veuillez patienter.",
        variant: "destructive"
      });
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
    setCameraFailed(false);
    startCamera();
  };

  // Fallback: sélection d'image depuis la galerie
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

  const openFilePicker = () => {
    fileInputRef.current?.click();
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

      if (uploadError) {
        console.error('Erreur upload photo:', uploadError);
        // Continuer sans la photo si l'upload échoue
        toast({
          title: "⚠️ Photo non sauvegardée",
          description: "Comptage enregistré mais photo non uploadée. Vérifiez la configuration du stockage.",
          variant: "default"
        });
        
        onCountComplete({
          count: result.count,
          confidence: result.confidence,
          photoUrl: '', // Pas de photo
          notes: result.notes
        });
        return;
      }

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
      // Fallback: enregistrer sans photo
      toast({
        title: "⚠️ Erreur upload",
        description: "Comptage enregistré sans photo",
        variant: "default"
      });
      
      onCountComplete({
        count: result.count,
        confidence: result.confidence,
        photoUrl: '',
        notes: result.notes
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

        {/* Input fichier caché pour fallback */}
        <input
          ref={fileInputRef}
          type="file"
          accept="image/*"
          capture="environment"
          className="hidden"
          onChange={handleFileSelect}
        />

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
          
          {/* Message si la caméra a échoué et pas d'image capturée */}
          {cameraFailed && !capturedImage && !isStreaming && (
            <div className="flex flex-col items-center justify-center text-white p-8 text-center">
              <Camera className="h-16 w-16 mb-4 opacity-50" />
              <p className="text-lg mb-2">Caméra non disponible</p>
              <p className="text-sm opacity-70 mb-6">Utilisez le bouton ci-dessous pour sélectionner une photo</p>
            </div>
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
          {/* Boutons caméra OU sélection fichier */}
          {!capturedImage && (
            <div className="flex flex-col gap-3">
              {isStreaming && (
                <Button
                  onClick={capturePhoto}
                  size="lg"
                  className="w-full h-16 text-lg rounded-full"
                >
                  <Camera className="h-6 w-6 mr-2" />
                  Capturer la photo
                </Button>
              )}
              
              {/* Bouton pour sélectionner depuis la galerie (toujours visible comme fallback) */}
              <Button
                onClick={openFilePicker}
                size="lg"
                variant={cameraFailed ? "default" : "outline"}
                className={`w-full h-14 ${cameraFailed ? 'rounded-full' : ''}`}
              >
                <ImagePlus className="h-5 w-5 mr-2" />
                {cameraFailed ? 'Sélectionner une photo' : 'Choisir depuis la galerie'}
              </Button>
            </div>
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
