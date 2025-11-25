import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card } from "@/components/ui/card";
import { toast } from "sonner";
import { Camera, Upload, TestTube2 } from "lucide-react";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";

interface LinenTrainingManagerProps {
  hotelId: string;
}

export const LinenTrainingManager = ({ hotelId }: LinenTrainingManagerProps) => {
  const queryClient = useQueryClient();
  const [selectedLinenType, setSelectedLinenType] = useState<string>("");
  const [actualCount, setActualCount] = useState("");
  const [notes, setNotes] = useState("");
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string>("");
  const [isTesting, setIsTesting] = useState(false);
  const [testResult, setTestResult] = useState<any>(null);

  const { data: linenTypes = [] } = useQuery({
    queryKey: ["linen-types", hotelId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("linen_types")
        .select("*")
        .eq("hotel_id", hotelId)
        .eq("is_active", true)
        .order("display_order");
      if (error) throw error;
      return data;
    },
  });

  const { data: trainingSamples = [] } = useQuery({
    queryKey: ["training-samples", hotelId, selectedLinenType],
    queryFn: async () => {
      if (!selectedLinenType) return [];
      const { data, error } = await supabase
        .from("linen_training_samples")
        .select("*, linen_types(name)")
        .eq("linen_type_id", selectedLinenType)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data;
    },
    enabled: !!selectedLinenType,
  });

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setSelectedFile(file);
      const url = URL.createObjectURL(file);
      setPreviewUrl(url);
    }
  };

  const uploadMutation = useMutation({
    mutationFn: async () => {
      if (!selectedFile || !selectedLinenType || !actualCount) {
        throw new Error("Données manquantes");
      }

      const fileExt = selectedFile.name.split(".").pop();
      const fileName = `${hotelId}/${selectedLinenType}/${Date.now()}.${fileExt}`;

      const { error: uploadError } = await supabase.storage
        .from("linen-images")
        .upload(fileName, selectedFile);

      if (uploadError) throw uploadError;

      const { data: { publicUrl } } = supabase.storage
        .from("linen-images")
        .getPublicUrl(fileName);

      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Non authentifié");

      const { error: insertError } = await supabase
        .from("linen_training_samples")
        .insert({
          hotel_id: hotelId,
          linen_type_id: selectedLinenType,
          image_url: publicUrl,
          actual_count: parseInt(actualCount),
          notes,
          created_by: user.id,
        });

      if (insertError) throw insertError;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["training-samples"] });
      toast.success("Exemple ajouté avec succès");
      setSelectedFile(null);
      setPreviewUrl("");
      setActualCount("");
      setNotes("");
    },
    onError: (error: any) => toast.error(error.message),
  });

  const testAI = async () => {
    if (!selectedFile || !selectedLinenType) {
      toast.error("Sélectionnez une photo et un type de linge");
      return;
    }

    setIsTesting(true);
    setTestResult(null);

    try {
      const reader = new FileReader();
      reader.readAsDataURL(selectedFile);
      reader.onloadend = async () => {
        const base64Image = reader.result as string;

        const { data, error } = await supabase.functions.invoke("count-linen", {
          body: {
            image: base64Image,
            linenTypeId: selectedLinenType,
            hotelId,
          },
        });

        if (error) throw error;
        setTestResult(data);
        toast.success("Test IA terminé");
      };
    } catch (error: any) {
      toast.error("Erreur lors du test : " + error.message);
    } finally {
      setIsTesting(false);
    }
  };

  const accuracy = trainingSamples.length > 0
    ? trainingSamples.filter((s: any) => 
        s.ai_predicted_count && Math.abs(s.ai_predicted_count - s.actual_count) <= 2
      ).length / trainingSamples.length * 100
    : 0;

  return (
    <div className="space-y-6">
      <div>
        <h3 className="text-lg font-semibold mb-2">Entraîner l'IA au comptage</h3>
        <p className="text-sm text-muted-foreground">
          Ajoutez des exemples de photos avec le nombre réel pour améliorer la précision de l'IA
        </p>
      </div>

      <Card className="p-4 space-y-4">
        <div className="grid grid-cols-2 gap-4">
          <div>
            <Label>Type de linge</Label>
            <Select value={selectedLinenType} onValueChange={setSelectedLinenType}>
              <SelectTrigger>
                <SelectValue placeholder="Sélectionner..." />
              </SelectTrigger>
              <SelectContent>
                {linenTypes.map((type: any) => (
                  <SelectItem key={type.id} value={type.id}>
                    {type.icon} {type.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label>Nombre réel de pièces</Label>
            <Input
              type="number"
              value={actualCount}
              onChange={(e) => setActualCount(e.target.value)}
              placeholder="Ex: 15"
            />
          </div>
        </div>

        <div>
          <Label>Photo de la pile</Label>
          <div className="mt-2 space-y-2">
            <Input
              type="file"
              accept="image/*"
              onChange={handleFileChange}
              className="cursor-pointer"
            />
            {previewUrl && (
              <img src={previewUrl} alt="Preview" className="w-full max-w-md rounded-lg" />
            )}
          </div>
        </div>

        <div>
          <Label>Notes (optionnel)</Label>
          <Textarea
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            placeholder="Ex: Pile bien alignée, éclairage naturel"
          />
        </div>

        <div className="flex gap-2">
          <Button onClick={testAI} disabled={!selectedFile || isTesting} variant="outline">
            <TestTube2 className="h-4 w-4 mr-2" />
            {isTesting ? "Test en cours..." : "Tester l'IA"}
          </Button>
          <Button onClick={() => uploadMutation.mutate()} disabled={!selectedFile || !actualCount}>
            <Upload className="h-4 w-4 mr-2" />
            Ajouter l'exemple
          </Button>
        </div>

        {testResult && (
          <Card className="p-4 bg-muted">
            <div className="space-y-2">
              <div className="font-semibold">Résultat du test IA :</div>
              <div>Comptage prédit : <span className="font-bold">{testResult.count}</span> pièces</div>
              <div>Confiance : <span className="font-bold">{Math.round(testResult.confidence * 100)}%</span></div>
              {testResult.notes && <div className="text-sm">{testResult.notes}</div>}
            </div>
          </Card>
        )}
      </Card>

      {selectedLinenType && (
        <Card className="p-4">
          <h4 className="font-semibold mb-3">Historique des exemples</h4>
          <div className="space-y-2">
            <div className="text-sm">
              Précision actuelle : <span className="font-bold">{accuracy.toFixed(0)}%</span>
              {" "}({trainingSamples.length} exemples)
            </div>
            <div className="grid gap-2 max-h-64 overflow-y-auto">
              {trainingSamples.map((sample: any) => (
                <div key={sample.id} className="flex items-center gap-3 p-2 bg-muted rounded">
                  <img src={sample.image_url} alt="" className="w-16 h-16 object-cover rounded" />
                  <div className="flex-1 text-sm">
                    <div>Réel : {sample.actual_count} pièces</div>
                    {sample.ai_predicted_count && (
                      <div className={
                        Math.abs(sample.ai_predicted_count - sample.actual_count) <= 2
                          ? "text-green-600"
                          : "text-orange-600"
                      }>
                        IA : {sample.ai_predicted_count} pièces
                      </div>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </Card>
      )}
    </div>
  );
};