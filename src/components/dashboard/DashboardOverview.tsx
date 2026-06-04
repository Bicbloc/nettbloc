/**
 * Composant Vue d'ensemble du dashboard
 * Extrait de Index.tsx pour modularité
 */

import { useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { Calendar, Layers, UserIcon, ChevronDown } from "lucide-react";
import { Room, CleaningConfig } from "@/services/pdfService";
import { PdfWorkflowDialog } from "@/components/PdfWorkflowDialog";
import { ConfigDialog } from "@/components/ConfigDialog";
import { StatsOverview } from "@/components/StatsOverview";
import { ActiveUsersPanel } from "@/components/ActiveUsersPanel";
import { HousekeeperManagement } from "@/components/HousekeeperManagement";

interface DashboardOverviewProps {
  rooms: Room[];
  housekeeperNames: string[];
  cleaningConfig: CleaningConfig;
  currentHotelId: string | null;
  isPremium: boolean;
  onPdfProcessed: (data: Room[], housekeepers?: string[], method?: 'random' | 'floor' | 'cleaning-type') => void;
  onConfigChange: (config: CleaningConfig) => void;
  onHousekeeperNamesChange: (names: string[]) => void;
  onDistribute: () => void;
}

export function DashboardOverview({
  rooms,
  housekeeperNames,
  cleaningConfig,
  currentHotelId,
  isPremium,
  onPdfProcessed,
  onConfigChange,
  onHousekeeperNamesChange,
  onDistribute,
}: DashboardOverviewProps) {
  const fullCleaningRooms = rooms.filter(r => r.cleaningType === 'full').length;
  const quickCleaningRooms = rooms.filter(r => r.cleaningType === 'quick').length;
  const twinRooms = rooms.filter(r => r.isTwin).length;

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Stats Overview Component */}
      <StatsOverview rooms={rooms} housekeeperCount={housekeeperNames.length} />

      {/* Grid responsive améliorée */}
      <div className="grid gap-4 sm:gap-6 grid-cols-1 lg:grid-cols-2">
        {/* Actions rapides */}
        <Card className="group border-border/50 bg-gradient-to-br from-card to-card/80 hover:shadow-xl hover:shadow-primary/5 transition-all duration-300 hover:-translate-y-1">
          <CardHeader className="pb-3">
            <div className="flex items-center gap-3">
              <div className="p-2.5 rounded-xl bg-primary/10 text-primary group-hover:bg-primary group-hover:text-primary-foreground transition-colors duration-300">
                <Calendar className="h-5 w-5" />
              </div>
              <div>
                <CardTitle className="text-lg font-semibold">Actions rapides</CardTitle>
                <CardDescription className="text-xs mt-0.5">
                  Gérez votre planning
                </CardDescription>
              </div>
            </div>
          </CardHeader>
          <CardContent className="space-y-3 pt-0">
            <PdfWorkflowDialog 
              hotelId={currentHotelId}
              onWorkflowComplete={onPdfProcessed}
            />
            <ConfigDialog 
              config={cleaningConfig} 
              onConfigChange={onConfigChange}
              housekeeperNames={housekeeperNames}
              onHousekeeperNamesChange={onHousekeeperNamesChange}
              isPremium={isPremium}
            />
            <Button 
              onClick={onDistribute}
              className="w-full bg-gradient-to-r from-primary to-primary/80 hover:from-primary/90 hover:to-primary/70 shadow-lg shadow-primary/20"
              disabled={housekeeperNames.length === 0 || rooms.length === 0}
            >
              <Calendar className="mr-2 h-4 w-4" />
              Distribuer automatiquement
            </Button>
          </CardContent>
        </Card>

        {/* Résumé du planning */}
        <Card className="group border-border/50 bg-gradient-to-br from-card to-card/80 hover:shadow-xl hover:shadow-info/5 transition-all duration-300 hover:-translate-y-1">
          <CardHeader className="pb-3">
            <div className="flex items-center gap-3">
              <div className="p-2.5 rounded-xl bg-info/10 text-info group-hover:bg-info group-hover:text-white transition-colors duration-300">
                <Layers className="h-5 w-5" />
              </div>
              <div>
                <CardTitle className="text-lg font-semibold">Résumé planning</CardTitle>
                <CardDescription className="text-xs mt-0.5">
                  Aperçu des nettoyages
                </CardDescription>
              </div>
            </div>
          </CardHeader>
          <CardContent className="pt-0">
            <div className="space-y-3">
              <div className="flex justify-between items-center p-3 rounded-lg bg-muted/50 hover:bg-muted transition-colors">
                <span className="text-sm text-muted-foreground">Chambres doubles</span>
                <span className="text-sm font-bold text-foreground">{twinRooms}</span>
              </div>
              <div className="flex justify-between items-center p-3 rounded-lg bg-muted/50 hover:bg-muted transition-colors">
                <span className="text-sm text-muted-foreground">Temps total estimé</span>
                <span className="text-sm font-bold text-foreground">
                  {Math.round(
                    (fullCleaningRooms * cleaningConfig.fullCleaningTime + 
                     quickCleaningRooms * cleaningConfig.quickCleaningTime) / 60
                  )}h
                </span>
              </div>
              <div className="flex justify-between items-center p-3 rounded-lg bg-muted/50 hover:bg-muted transition-colors">
                <span className="text-sm text-muted-foreground">Temps moyen/pers.</span>
                <span className="text-sm font-bold text-foreground">
                  {housekeeperNames.length > 0 ? 
                    Math.round(
                      (fullCleaningRooms * cleaningConfig.fullCleaningTime + 
                       quickCleaningRooms * cleaningConfig.quickCleaningTime) / 
                      (60 * housekeeperNames.length)
                    ) : 0
                  }h
                </span>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
      
      {/* Active Users Panel - sous les deux colonnes */}
      <ActiveUsersPanel />
      
      {/* Section Personnel - Design amélioré */}
      <Card className="border-border/50 bg-gradient-to-br from-card to-card/80">
        <CardHeader className="border-b border-border/50">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
            <div className="flex items-center gap-3">
              <div className="p-2.5 rounded-xl bg-success/10 text-success">
                <UserIcon className="h-5 w-5" />
              </div>
              <div>
                <CardTitle className="text-lg font-semibold">Personnel</CardTitle>
                <CardDescription className="text-xs mt-0.5">
                  Gérez vos femmes de chambre et leurs codes d'accès
                </CardDescription>
              </div>
            </div>
            <Badge variant="outline" className="w-fit text-xs px-3 py-1">
              {housekeeperNames.length} membre{housekeeperNames.length > 1 ? 's' : ''}
            </Badge>
          </div>
        </CardHeader>
        <CardContent className="pt-6">
          <HousekeeperManagement />
        </CardContent>
      </Card>
    </div>
  );
}
