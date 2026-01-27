import React from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { Sparkles, ClipboardList, Info } from "lucide-react";
import { toast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";

interface ImportModeSwitchProps {
  hotelId: string | null;
  currentMode: 'auto' | 'manual';
  onModeChange: (mode: 'auto' | 'manual') => void;
}

export function ImportModeSwitch({ hotelId, currentMode, onModeChange }: ImportModeSwitchProps) {
  const handleToggle = async (checked: boolean) => {
    const newMode = checked ? 'auto' : 'manual';
    
    if (hotelId) {
      try {
        const { error } = await supabase
          .from('hotels')
          .update({ import_mode: newMode })
          .eq('id', hotelId);

        if (error) throw error;

        toast({
          title: newMode === 'auto' ? "🤖 Mode IA activé" : "📝 Mode Manuel activé",
          description: newMode === 'auto' 
            ? "L'extraction automatique des chambres est activée."
            : "Vous pouvez saisir les chambres manuellement.",
        });
      } catch (error: any) {
        console.error('Error updating import mode:', error);
        toast({
          variant: "destructive",
          title: "Erreur",
          description: "Impossible de modifier le mode d'import.",
        });
        return;
      }
    }

    onModeChange(newMode);
  };

  return (
    <Card className="border-2">
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <div className="space-y-1">
            <CardTitle className="text-base flex items-center gap-2">
              Mode d'import des chambres
            </CardTitle>
            <CardDescription>
              Choisissez comment ajouter vos chambres quotidiennement
            </CardDescription>
          </div>
          <div className="flex items-center gap-3">
            <div className={`flex items-center gap-2 px-3 py-1.5 rounded-full transition-colors ${
              currentMode === 'manual' 
                ? 'bg-secondary text-secondary-foreground' 
                : 'text-muted-foreground'
            }`}>
              <ClipboardList className="h-4 w-4" />
              <span className="text-sm font-medium">Manuel</span>
            </div>
            
            <Switch
              checked={currentMode === 'auto'}
              onCheckedChange={handleToggle}
              className="data-[state=checked]:bg-primary"
            />
            
            <div className={`flex items-center gap-2 px-3 py-1.5 rounded-full transition-colors ${
              currentMode === 'auto' 
                ? 'bg-primary/10 text-primary' 
                : 'text-muted-foreground'
            }`}>
              <Sparkles className="h-4 w-4" />
              <span className="text-sm font-medium">IA Auto</span>
            </div>
          </div>
        </div>
      </CardHeader>
      <CardContent>
        <div className={`p-3 rounded-lg transition-colors ${
          currentMode === 'auto' 
            ? 'bg-primary/5 border border-primary/20' 
            : 'bg-secondary/50 border border-secondary'
        }`}>
          {currentMode === 'auto' ? (
            <div className="flex items-start gap-3">
              <Sparkles className="h-5 w-5 text-primary mt-0.5" />
              <div>
                <p className="text-sm font-medium">Reconnaissance IA activée</p>
                <p className="text-xs text-muted-foreground mt-1">
                  Importez un rapport PDF de votre PMS. L'IA extraira automatiquement les chambres, 
                  statuts et types de nettoyage (À blanc, Recouche).
                </p>
                <div className="flex gap-2 mt-2">
                  <Badge variant="secondary" className="text-xs">Mews</Badge>
                  <Badge variant="secondary" className="text-xs">Apaleo</Badge>
                  <Badge variant="secondary" className="text-xs">Opera</Badge>
                  <Badge variant="secondary" className="text-xs">+10 PMS</Badge>
                </div>
              </div>
            </div>
          ) : (
            <div className="flex items-start gap-3">
              <ClipboardList className="h-5 w-5 text-secondary-foreground mt-0.5" />
              <div>
                <p className="text-sm font-medium">Saisie manuelle activée</p>
                <p className="text-xs text-muted-foreground mt-1">
                  Entrez vos chambres une par une avec leur numéro, type de nettoyage 
                  (À blanc, Recouche, Propre) et statut.
                </p>
                <div className="flex gap-2 mt-2">
                  <Badge variant="outline" className="text-xs">🚪 À blanc</Badge>
                  <Badge variant="outline" className="text-xs">🛏️ Recouche</Badge>
                  <Badge variant="outline" className="text-xs">✅ Propre</Badge>
                </div>
              </div>
            </div>
          )}
        </div>
        
        {currentMode === 'manual' && (
          <div className="mt-3 flex items-center gap-2 text-xs text-muted-foreground">
            <Info className="h-3 w-3" />
            <span>Le mode manuel est inclus dans tous les plans sans frais IA.</span>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
