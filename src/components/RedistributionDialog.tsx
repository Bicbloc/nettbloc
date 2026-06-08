import { useState, useEffect, useRef } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription } from '@/components/ui/card';
import { Checkbox } from '@/components/ui/checkbox';
import { Shuffle, Layers, Zap, Calendar, Users, UserPlus, AlertCircle, Sparkles, ArrowLeft, ArrowRight, ClipboardCheck, ClipboardList, Repeat } from 'lucide-react';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { isHousekeeperNew } from '@/utils/newHousekeepers';
import { InventoryAssignmentCard } from '@/components/dashboard/InventoryAssignmentCard';
import {
  GovernessRedistributionStep, GovStepHandle, GovStepConfig,
} from '@/components/governess/GovernessRedistributionStep';

interface RedistributionDialogProps {
  isOpen: boolean;
  onClose: () => void;
  onRedistribute: (method: RedistributionMethod, selectedHousekeepers: string[]) => void;
  housekeeperCount: number;
  roomCount: number;
  housekeeperNames: string[];
  onAddHousekeeper: () => void;
  hotelId?: string | null;
  onRequestInspection?: () => void;
}

export type RedistributionMethod = 'random' | 'floor' | 'cleaning-type';

interface SavedConfig {
  method: RedistributionMethod;
  gov: GovStepConfig;
}

const configKey = (hotelId?: string | null) => `redistrib_config_${hotelId || 'default'}`;

export function RedistributionDialog({
  isOpen,
  onClose,
  onRedistribute,
  housekeeperCount,
  roomCount,
  housekeeperNames,
  onAddHousekeeper,
  hotelId,
}: RedistributionDialogProps) {
  const [step, setStep] = useState<1 | 2>(1);
  const [selectedMethod, setSelectedMethod] = useState<RedistributionMethod>('floor');
  const [selectedHousekeepers, setSelectedHousekeepers] = useState<string[]>([]);
  const [saveRegularly, setSaveRegularly] = useState(false);
  const [initialGovConfig, setInitialGovConfig] = useState<GovStepConfig | null>(null);
  const govConfigRef = useRef<GovStepConfig | null>(null);
  const govStepRef = useRef<GovStepHandle>(null);
  const [submitting, setSubmitting] = useState(false);

  // Initialiser à l'ouverture + recharger une éventuelle configuration enregistrée
  useEffect(() => {
    if (!isOpen) return;
    setStep(1);
    // Laisser désélectionné : l'utilisateur choisit les femmes de chambre.
    setSelectedHousekeepers([]);
    try {
      const raw = localStorage.getItem(configKey(hotelId));
      if (raw) {
        const saved = JSON.parse(raw) as SavedConfig;
        setSelectedMethod(saved.method || 'floor');
        setInitialGovConfig(saved.gov || null);
        setSaveRegularly(true);
      } else {
        setSelectedMethod('floor');
        setInitialGovConfig(null);
        setSaveRegularly(false);
      }
    } catch {
      setInitialGovConfig(null);
    }
  }, [isOpen, housekeeperNames, hotelId]);

  const methods = [
    { id: 'floor' as RedistributionMethod, title: "Par ordre d'étage", description: 'Attribution par étage pour minimiser les déplacements et optimiser l\'efficacité', icon: Layers, color: 'text-green-600' },
    { id: 'random' as RedistributionMethod, title: 'Distribution aléatoire', description: 'Répartition équitable et aléatoire des chambres entre les femmes de chambre sélectionnées', icon: Shuffle, color: 'text-blue-600' },
    { id: 'cleaning-type' as RedistributionMethod, title: 'Par type de nettoyage', description: 'Regroupement par type de nettoyage (à blanc, recouche) pour optimiser le matériel', icon: Zap, color: 'text-purple-600' },
  ];

  const handleToggleHousekeeper = (name: string) =>
    setSelectedHousekeepers((prev) => (prev.includes(name) ? prev.filter((n) => n !== name) : [...prev, name]));
  const handleSelectAll = () => setSelectedHousekeepers([...housekeeperNames]);
  const handleDeselectAll = () => setSelectedHousekeepers([]);

  const persistConfig = () => {
    const gov = govStepRef.current?.getConfig() || govConfigRef.current;
    try {
      if (saveRegularly && gov) {
        localStorage.setItem(configKey(hotelId), JSON.stringify({ method: selectedMethod, gov } as SavedConfig));
      } else {
        localStorage.removeItem(configKey(hotelId));
      }
    } catch { /* ignore */ }
  };

  const handleConfirm = async () => {
    if (selectedHousekeepers.length === 0) return;
    setSubmitting(true);
    // 1) Attribuer les gouvernantes (étape facultative)
    const ok = (await govStepRef.current?.apply()) ?? true;
    if (!ok) { setSubmitting(false); return; }
    // 2) Enregistrer la configuration si demandé
    persistConfig();
    // 3) Redistribuer les chambres aux femmes de chambre
    onRedistribute(selectedMethod, selectedHousekeepers);
    setSubmitting(false);
    onClose();
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Calendar className="h-5 w-5" />
            Redistribuer les chambres
          </DialogTitle>
          <div className="text-sm text-muted-foreground">
            <div className="flex items-center gap-4 mt-2">
              <span className="flex items-center gap-1"><Users className="h-4 w-4" />{housekeeperCount} femme{housekeeperCount > 1 ? 's' : ''} de chambre</span>
              <span className="flex items-center gap-1"><Layers className="h-4 w-4" />{roomCount} chambres à distribuer</span>
            </div>
            <div className="mt-3 flex items-center gap-2 text-xs font-medium">
              <span className={step === 1 ? 'text-primary' : ''}>1. Femmes de chambre</span>
              <ArrowRight className="h-3 w-3" />
              <span className={step === 2 ? 'text-primary' : ''}>2. Gouvernantes</span>
            </div>
          </div>
        </DialogHeader>

        {step === 1 ? (
          <div className="space-y-6">
            {/* Sélection des femmes de chambre */}
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <h4 className="font-medium">Femmes de chambre à inclure</h4>
                <div className="flex gap-2">
                  <Button variant="ghost" size="sm" onClick={handleSelectAll}>Tout sélectionner</Button>
                  <Button variant="ghost" size="sm" onClick={handleDeselectAll}>Tout désélectionner</Button>
                </div>
              </div>
              <Card>
                <CardContent className="p-4">
                  {housekeeperNames.length === 0 ? (
                    <div className="text-center py-4 text-muted-foreground">
                      <UserPlus className="h-8 w-8 mx-auto mb-2 opacity-50" />
                      <p>Aucune femme de chambre disponible</p>
                    </div>
                  ) : (
                    <div className="grid grid-cols-2 gap-3">
                      {housekeeperNames.map((name) => (
                        <div key={name}
                          className={`flex items-center gap-3 p-3 rounded-lg border cursor-pointer transition-all ${selectedHousekeepers.includes(name) ? 'border-primary bg-primary/5' : 'border-border hover:border-muted-foreground/50'}`}
                          onClick={() => handleToggleHousekeeper(name)}>
                          <Checkbox checked={selectedHousekeepers.includes(name)} onCheckedChange={() => handleToggleHousekeeper(name)} />
                          <span className="font-medium truncate">{name}</span>
                          {isHousekeeperNew(name) && (
                            <Badge className="ml-auto shrink-0 gap-1 bg-emerald-500 text-white hover:bg-emerald-500">
                              <Sparkles className="h-3 w-3" />Nouveau
                            </Badge>
                          )}
                        </div>
                      ))}
                    </div>
                  )}
                  <Button variant="outline" className="w-full mt-4" onClick={onAddHousekeeper}>
                    <UserPlus className="h-4 w-4 mr-2" />Ajouter une femme de chambre
                  </Button>
                </CardContent>
              </Card>
              {selectedHousekeepers.length === 0 && housekeeperNames.length > 0 && (
                <Alert variant="destructive">
                  <AlertCircle className="h-4 w-4" />
                  <AlertDescription>Sélectionnez au moins une femme de chambre pour redistribuer les chambres.</AlertDescription>
                </Alert>
              )}
            </div>

            {/* Méthode de redistribution */}
            <div className="space-y-3">
              <h4 className="font-medium">Méthode de redistribution</h4>
              <RadioGroup value={selectedMethod} onValueChange={(value) => setSelectedMethod(value as RedistributionMethod)} className="space-y-3">
                {methods.map((method) => (
                  <div key={method.id} className="flex items-center space-x-2">
                    <RadioGroupItem value={method.id} id={method.id} />
                    <Label htmlFor={method.id} className="cursor-pointer flex-1">
                      <Card className="hover:bg-accent/50 transition-colors cursor-pointer">
                        <CardContent className="p-4">
                          <div className="flex items-start gap-3">
                            <method.icon className={`h-5 w-5 mt-0.5 ${method.color}`} />
                            <div className="space-y-1 flex-1">
                              <h4 className="font-medium">{method.title}</h4>
                              <CardDescription className="text-sm">{method.description}</CardDescription>
                            </div>
                          </div>
                        </CardContent>
                      </Card>
                    </Label>
                  </div>
                ))}
              </RadioGroup>
            </div>

            {/* Inventaire du linge */}
            {hotelId && (
              <div className="space-y-3">
                <h4 className="font-medium flex items-center gap-2"><ClipboardList className="h-4 w-4 text-primary" />Inventaire du linge</h4>
                <InventoryAssignmentCard hotelId={hotelId} />
              </div>
            )}
          </div>
        ) : (
          <div className="space-y-6">
            <div className="space-y-1">
              <h4 className="font-medium flex items-center gap-2"><ClipboardCheck className="h-4 w-4 text-primary" />Gouvernantes (inspection)</h4>
              <p className="text-sm text-muted-foreground">
                Attribuez les chambres à inspecter aux gouvernantes par femme de chambre, étage, type de chambre ou type de nettoyage. Étape facultative.
              </p>
            </div>

            {hotelId && (
              <GovernessRedistributionStep
                ref={govStepRef}
                hotelId={hotelId}
                initialConfig={initialGovConfig}
                onConfigChange={(c) => { govConfigRef.current = c; }}
              />
            )}

            {/* Conserver la configuration */}
            <Card className="border-primary/30 bg-primary/5">
              <CardContent className="p-4">
                <label className="flex items-start gap-3 cursor-pointer">
                  <Checkbox checked={saveRegularly} onCheckedChange={(v) => setSaveRegularly(!!v)} className="mt-0.5" />
                  <span className="space-y-1">
                    <span className="flex items-center gap-2 font-medium text-sm">
                      <Repeat className="h-4 w-4 text-primary" />Conserver cette configuration régulièrement
                    </span>
                    <span className="block text-xs text-muted-foreground">
                      La prochaine fois, les mêmes méthodes et attributions seront pré-sélectionnées automatiquement.
                    </span>
                  </span>
                </label>
              </CardContent>
            </Card>
          </div>
        )}

        <DialogFooter className="flex gap-2">
          {step === 1 ? (
            <>
              <Button variant="outline" onClick={onClose}>Annuler</Button>
              <Button onClick={() => setStep(2)} disabled={selectedHousekeepers.length === 0} className="hover-scale">
                Suivant<ArrowRight className="h-4 w-4 ml-2" />
              </Button>
            </>
          ) : (
            <>
              <Button variant="outline" onClick={() => setStep(1)}>
                <ArrowLeft className="h-4 w-4 mr-2" />Retour
              </Button>
              <Button onClick={handleConfirm} className="hover-scale" disabled={selectedHousekeepers.length === 0 || submitting}>
                <Calendar className="h-4 w-4 mr-2" />
                {submitting ? 'Redistribution…' : 'Redistribuer'}
              </Button>
            </>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
