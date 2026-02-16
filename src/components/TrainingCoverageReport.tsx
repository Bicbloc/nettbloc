import { useState } from "react";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Progress } from "@/components/ui/progress";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { CoverageMetadata } from "@/services/pdfService";
import { 
  ChevronDown, ChevronUp, BarChart3, AlertTriangle, 
  CheckCircle, Brain, Layers, Search, TrendingUp 
} from "lucide-react";

interface TrainingCoverageReportProps {
  coverage: CoverageMetadata;
}

export function TrainingCoverageReport({ coverage }: TrainingCoverageReportProps) {
  const [isOpen, setIsOpen] = useState(false);

  const coveragePercent = coverage.trainedModelRoomCount > 0
    ? Math.round((Math.min(coverage.trainedModelRoomCount, coverage.finalRoomCount) / coverage.finalRoomCount) * 100)
    : 0;

  const gapCount = coverage.missingFromPhase0.length + coverage.missingFromTraining.length;
  const hasGaps = gapCount > 0;
  const statusColor = coveragePercent >= 90 ? "text-green-600" : coveragePercent >= 70 ? "text-amber-600" : "text-red-600";

  return (
    <Collapsible open={isOpen} onOpenChange={setIsOpen}>
      <CollapsibleTrigger asChild>
        <Button variant="outline" size="sm" className="w-full justify-between gap-2">
          <div className="flex items-center gap-2">
            <BarChart3 className="h-4 w-4 text-primary" />
            <span className="text-xs font-medium">Diagnostic couverture IA</span>
            {coverage.trainedModelUsed ? (
              <Badge variant="secondary" className="text-[10px] px-1.5 py-0">
                <Brain className="h-3 w-3 mr-0.5" />
                Modèle actif
              </Badge>
            ) : (
              <Badge variant="outline" className="text-[10px] px-1.5 py-0 text-muted-foreground">
                Pas de modèle
              </Badge>
            )}
            {hasGaps && (
              <Badge variant="destructive" className="text-[10px] px-1.5 py-0">
                {gapCount} écart{gapCount > 1 ? 's' : ''}
              </Badge>
            )}
          </div>
          {isOpen ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
        </Button>
      </CollapsibleTrigger>

      <CollapsibleContent className="mt-2">
        <Card className="p-4 space-y-4 border-primary/20">
          {/* Room count comparison */}
          <div>
            <h4 className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-2 flex items-center gap-1.5">
              <Layers className="h-3.5 w-3.5" />
              Comparaison des comptages
            </h4>
            <div className="grid grid-cols-3 gap-2">
              <div className="p-2 rounded-md bg-blue-50 border border-blue-200 text-center">
                <p className="text-lg font-bold text-blue-700">{coverage.phase0RoomCount}</p>
                <p className="text-[10px] text-blue-600">Parser format</p>
              </div>
              <div className="p-2 rounded-md bg-purple-50 border border-purple-200 text-center">
                <p className="text-lg font-bold text-purple-700">{coverage.trainedModelRoomCount}</p>
                <p className="text-[10px] text-purple-600">Modèle entraîné</p>
              </div>
              <div className="p-2 rounded-md bg-emerald-50 border border-emerald-200 text-center">
                <p className="text-lg font-bold text-emerald-700">{coverage.finalRoomCount}</p>
                <p className="text-[10px] text-emerald-600">Total final</p>
              </div>
            </div>
            {coverage.supplementedByTraining > 0 && (
              <p className="text-xs text-primary mt-1.5 flex items-center gap-1">
                <TrendingUp className="h-3 w-3" />
                +{coverage.supplementedByTraining} chambre{coverage.supplementedByTraining > 1 ? 's' : ''} ajoutée{coverage.supplementedByTraining > 1 ? 's' : ''} par le modèle entraîné
              </p>
            )}
          </div>

          {/* Coverage bar */}
          {coverage.trainedModelUsed && (
            <div>
              <div className="flex items-center justify-between mb-1">
                <span className="text-xs text-muted-foreground">Couverture entraînement</span>
                <span className={`text-xs font-bold ${statusColor}`}>{coveragePercent}%</span>
              </div>
              <Progress value={coveragePercent} className="h-2" />
            </div>
          )}

          {/* Per-pattern match stats */}
          {coverage.perPatternStats.length > 0 && (
            <div>
              <h4 className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-2 flex items-center gap-1.5">
                <Search className="h-3.5 w-3.5" />
                Statuts détectés
              </h4>
              <div className="flex flex-wrap gap-1.5">
                {coverage.perPatternStats.map(stat => (
                  <Badge key={stat.keyword} variant="outline" className="text-xs gap-1">
                    <span className="font-mono font-bold">{stat.keyword}</span>
                    <span className="text-muted-foreground">×{stat.matchedCount}</span>
                  </Badge>
                ))}
              </div>
            </div>
          )}

          {/* Gap analysis */}
          {hasGaps && (
            <div>
              <h4 className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-2 flex items-center gap-1.5">
                <AlertTriangle className="h-3.5 w-3.5 text-amber-500" />
                Analyse des écarts
              </h4>
              
              {coverage.missingFromPhase0.length > 0 && (
                <div className="mb-2">
                  <p className="text-[11px] text-purple-700 font-medium mb-1">
                    Trouvées par le modèle entraîné uniquement ({coverage.missingFromPhase0.length}):
                  </p>
                  <ScrollArea className="max-h-[60px]">
                    <div className="flex flex-wrap gap-1">
                      {coverage.missingFromPhase0.map(room => (
                        <Badge key={room} className="text-[10px] bg-purple-100 text-purple-800 border-purple-300">
                          {room}
                        </Badge>
                      ))}
                    </div>
                  </ScrollArea>
                </div>
              )}

              {coverage.missingFromTraining.length > 0 && (
                <div>
                  <p className="text-[11px] text-blue-700 font-medium mb-1">
                    Trouvées par le parser uniquement ({coverage.missingFromTraining.length}):
                  </p>
                  <ScrollArea className="max-h-[60px]">
                    <div className="flex flex-wrap gap-1">
                      {coverage.missingFromTraining.map(room => (
                        <Badge key={room} className="text-[10px] bg-blue-100 text-blue-800 border-blue-300">
                          {room}
                        </Badge>
                      ))}
                    </div>
                  </ScrollArea>
                </div>
              )}
            </div>
          )}

          {/* No gaps = all good */}
          {!hasGaps && coverage.trainedModelUsed && (
            <div className="flex items-center gap-2 text-xs text-green-600">
              <CheckCircle className="h-4 w-4" />
              <span>Parser et modèle entraîné détectent les mêmes chambres — aucun écart.</span>
            </div>
          )}

          {/* Format info */}
          <div className="pt-2 border-t text-[10px] text-muted-foreground flex items-center justify-between">
            <span>Format: <span className="font-mono">{coverage.formatDetected}</span> ({coverage.formatConfidence}%)</span>
            {coverage.trainedPatternCount > 0 && (
              <span>{coverage.trainedPatternCount} patterns entraînés</span>
            )}
          </div>
        </Card>
      </CollapsibleContent>
    </Collapsible>
  );
}
