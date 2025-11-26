import { useState, useRef } from "react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Camera, Upload, Loader2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

interface LinenPhotoCounterProps {
  linenTypeId: string;
  hotelId: string;
  onCountComplete: (count: number, confidence: number, photoUrl: string) => void;
}

export const LinenPhotoCounter = ({
  linenTypeId,
  hotelId,
  onCountComplete,
}: LinenPhotoCounterProps) => {
  const [isCounting, setIsCounting] = useState(false);
  const [preview, setPreview] = useState<string>("");
  const [result, setResult] = useState<any>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const cameraInputRef = useRef<HTMLInputElement>(null);

  const handleFileSelect = async (file: File) => {
    if (!file) return;

    const reader = new FileReader();
    reader.onloadend = () => {
      setPreview(reader.result as string);
    };
    reader.readAsDataURL(file);

    setIsCounting(true);
    setResult(null);

    try {
      const base64Image = await new Promise<string>((resolve) => {
        const r = new FileReader();
        r.onloadend = () => resolve(r.result as string);
        r.readAsDataURL(file);
      });

      const { data, error } = await supabase.functions.invoke("count-linen", {
        body: {
          image: base64Image,
          linenTypeId,
          hotelId,
        },
      });

      if (error) throw error;

      setResult(data);
      
      // Upload photo to storage
      const fileExt = file.name.split(".").pop();
      const fileName = `${hotelId}/${linenTypeId}/${Date.now()}.${fileExt}`;

      const { error: uploadError } = await supabase.storage
        .from("linen-images")
        .upload(fileName, file);

      if (uploadError) throw uploadError;

      const { data: { publicUrl } } = supabase.storage
        .from("linen-images")
        .getPublicUrl(fileName);

      onCountComplete(data.count, data.confidence, publicUrl);
      
      toast.success(`${data.count} pièces détectées (confiance: ${Math.round(data.confidence * 100)}%)`);
    } catch (error: any) {
      toast.error("Erreur lors du comptage : " + error.message);
    } finally {
      setIsCounting(false);
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex gap-2">
        <Button
          onClick={() => cameraInputRef.current?.click()}
          variant="outline"
          className="flex-1"
          disabled={isCounting}
          type="button"
        >
          {isCounting ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Camera className="h-4 w-4 mr-2" />}
          {isCounting ? "Analyse..." : "Prendre une photo"}
        </Button>
        <Button
          onClick={() => fileInputRef.current?.click()}
          variant="outline"
          className="flex-1"
          disabled={isCounting}
          type="button"
        >
          {isCounting ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Upload className="h-4 w-4 mr-2" />}
          {isCounting ? "Analyse..." : "Choisir une photo"}
        </Button>
      </div>

      <input
        ref={cameraInputRef}
        type="file"
        accept="image/*"
        capture="environment"
        className="hidden"
        onChange={(e) => e.target.files?.[0] && handleFileSelect(e.target.files[0])}
      />
      <input
        ref={fileInputRef}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={(e) => e.target.files?.[0] && handleFileSelect(e.target.files[0])}
      />

      {preview && (
        <Card className="p-4 space-y-4">
          <img src={preview} alt="Preview" className="w-full rounded-lg" />
          
          {isCounting && (
            <div className="flex items-center justify-center gap-2 text-muted-foreground">
              <Loader2 className="h-4 w-4 animate-spin" />
              Analyse en cours...
            </div>
          )}

          {result && !isCounting && (
            <div className="space-y-2">
              <div className="text-center">
                <div className="text-3xl font-bold">{result.count}</div>
                <div className="text-sm text-muted-foreground">pièces détectées</div>
              </div>
              <div className="flex items-center justify-between text-sm">
                <span className="text-muted-foreground">Confiance</span>
                <span className="font-medium">{Math.round(result.confidence * 100)}%</span>
              </div>
              {result.notes && (
                <div className="text-sm text-muted-foreground italic">{result.notes}</div>
              )}
            </div>
          )}
        </Card>
      )}
    </div>
  );
};