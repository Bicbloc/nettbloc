import React from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { Sparkles, ClipboardList, Info } from "lucide-react";
import { toast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { useLanguage } from "@/contexts/LanguageContext";

interface ImportModeSwitchProps {
  hotelId: string | null;
  currentMode: 'auto' | 'manual';
  onModeChange: (mode: 'auto' | 'manual') => void;
}

export function ImportModeSwitch({ hotelId, currentMode, onModeChange }: ImportModeSwitchProps) {
  const { t } = useLanguage();

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
          title: newMode === 'auto' ? t.importMode.aiModeActivated : t.importMode.manualModeActivated,
          description: newMode === 'auto' 
            ? t.importMode.aiModeDesc
            : t.importMode.manualModeDesc,
        });
      } catch (error: any) {
        console.error('Error updating import mode:', error);
        toast({
          variant: "destructive",
          title: t.common.error,
          description: t.importMode.errorChangingMode,
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
              {t.importMode.title}
            </CardTitle>
            <CardDescription>
              {t.importMode.subtitle}
            </CardDescription>
          </div>
          <div className="flex items-center gap-3">
            <div className={`flex items-center gap-2 px-3 py-1.5 rounded-full transition-colors ${
              currentMode === 'manual' 
                ? 'bg-secondary text-secondary-foreground' 
                : 'text-muted-foreground'
            }`}>
              <ClipboardList className="h-4 w-4" />
              <span className="text-sm font-medium">{t.common.manual}</span>
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
              <span className="text-sm font-medium">{t.dashboard.ia} {t.common.auto}</span>
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
                <p className="text-sm font-medium">{t.importMode.aiEnabled}</p>
                <p className="text-xs text-muted-foreground mt-1">
                  {t.importMode.aiEnabledDesc}
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
                <p className="text-sm font-medium">{t.importMode.manualEnabled}</p>
                <p className="text-xs text-muted-foreground mt-1">
                  {t.importMode.manualEnabledDesc}
                </p>
                <div className="flex gap-2 mt-2">
                  <Badge variant="outline" className="text-xs">🚪 {t.rooms.fullClean}</Badge>
                  <Badge variant="outline" className="text-xs">🛏️ {t.rooms.quickClean}</Badge>
                  <Badge variant="outline" className="text-xs">✅ {t.rooms.clean}</Badge>
                </div>
              </div>
            </div>
          )}
        </div>
        
        {currentMode === 'manual' && (
          <div className="mt-3 flex items-center gap-2 text-xs text-muted-foreground">
            <Info className="h-3 w-3" />
            <span>{t.importMode.manualFreeNote}</span>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
