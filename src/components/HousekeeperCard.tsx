
import { useState } from "react";
import { Card, CardContent, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { RoomCard } from "./RoomCard";
import { Room, CleaningConfig } from "@/services/pdfService";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { toast } from "@/components/ui/use-toast";

export interface HousekeeperCardProps {
  name: string;
  rooms: Room[];
  onRoomUpdate: (room: Room) => void;
  onRoomUnassign: (room: Room) => void;
  onGenerateReport: (housekeeperName: string, rooms: Room[]) => Promise<void>;
  cleaningConfig: CleaningConfig;
  draggable?: boolean;
  availableFloors: number[];
  preferredFloors: number[];
  onFloorPreferenceChange: (housekeeperName: string, floors: number[]) => void;
  onManualAssign: () => void;
  email: string;
  onEmailChange: (email: string) => void;
}

export function HousekeeperCard({
  name,
  rooms,
  onRoomUpdate,
  onRoomUnassign,
  onGenerateReport,
  cleaningConfig,
  draggable = false,
  availableFloors,
  preferredFloors,
  onFloorPreferenceChange,
  onManualAssign,
  email,
  onEmailChange
}: HousekeeperCardProps) {
  const [isEmailEditing, setIsEmailEditing] = useState(false);
  const [emailValue, setEmailValue] = useState(email);
  
  // Trier les chambres par numéro
  const sortedRooms = [...rooms].sort((a, b) => 
    a.number.localeCompare(b.number, undefined, { numeric: true })
  );
  
  // Calculer la charge de travail
  const workload = sortedRooms.reduce((total, room) => {
    if (room.cleaningType === 'full') {
      return total + cleaningConfig.fullCleaningTime;
    } else if (room.cleaningType === 'quick') {
      return total + cleaningConfig.quickCleaningTime;
    }
    return total;
  }, 0);
  
  // Calculer le nombre de chambres par type
  const fullCleaningRooms = sortedRooms.filter(r => r.cleaningType === 'full').length;
  const quickCleaningRooms = sortedRooms.filter(r => r.cleaningType === 'quick').length;
  const totalRooms = sortedRooms.length;
  
  // Calculer le nombre de chambres par étage
  const roomsByFloor = sortedRooms.reduce((acc: Record<number, number>, room) => {
    const floor = room.floor !== undefined ? room.floor : parseInt(room.number[0]) || 0;
    acc[floor] = (acc[floor] || 0) + 1;
    return acc;
  }, {});
  
  // Gérer la modification des préférences d'étage
  const handleFloorToggle = (floor: number) => {
    const newPreferredFloors = preferredFloors.includes(floor)
      ? preferredFloors.filter(f => f !== floor)
      : [...preferredFloors, floor];
    
    onFloorPreferenceChange(name, newPreferredFloors);
  };
  
  // Gérer la sauvegarde de l'email
  const handleSaveEmail = () => {
    // Validation simple de format d'email
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (emailValue && !emailRegex.test(emailValue)) {
      toast({
        variant: "destructive",
        title: "Format d'email invalide",
        description: "Veuillez entrer une adresse email valide."
      });
      return;
    }
    
    onEmailChange(emailValue);
    setIsEmailEditing(false);
    
    toast({
      title: "Email enregistré",
      description: `L'adresse email de ${name} a été mise à jour.`
    });
  };
  
  return (
    <Card className="overflow-hidden">
      <CardHeader className="bg-blue-50">
        <div className="flex justify-between items-start">
          <CardTitle>{name}</CardTitle>
          <div className="flex gap-1">
            <Button size="sm" variant="outline" onClick={onManualAssign}>
              Assigner
            </Button>
            <Button 
              size="sm" 
              variant="outline"
              onClick={() => onGenerateReport(name, sortedRooms)}
              disabled={totalRooms === 0}
            >
              Rapport
            </Button>
          </div>
        </div>
      </CardHeader>
      <CardContent className="p-4 space-y-4">
        <div className="flex justify-between mb-2">
          <div className="space-y-1">
            <p className="text-sm font-medium">Charge de travail</p>
            <div className="flex space-x-2">
              <Badge variant="outline" className="bg-blue-50">
                {Math.floor(workload / 60)}h{workload % 60 > 0 ? ` ${workload % 60}min` : ''}
              </Badge>
              <Badge variant="outline" className="bg-purple-50">
                {fullCleaningRooms} à blanc
              </Badge>
              <Badge variant="outline" className="bg-blue-50">
                {quickCleaningRooms} recouche
              </Badge>
            </div>
          </div>
          <Badge variant="outline" className="flex items-center h-6">
            {totalRooms} chambres
          </Badge>
        </div>
        
        {/* Email professionnel */}
        <div className="space-y-2">
          <Label htmlFor={`email-${name}`} className="text-sm font-medium">
            Email professionnel
          </Label>
          {isEmailEditing ? (
            <div className="flex gap-2">
              <Input
                id={`email-${name}`}
                value={emailValue}
                onChange={(e) => setEmailValue(e.target.value)}
                placeholder="email@exemple.com"
                className="flex-1"
              />
              <Button onClick={handleSaveEmail} size="sm" variant="outline">
                Enregistrer
              </Button>
            </div>
          ) : (
            <div className="flex gap-2 items-center">
              <span className="text-sm flex-1 overflow-hidden text-ellipsis">
                {email || "Aucun email configuré"}
              </span>
              <Button 
                onClick={() => setIsEmailEditing(true)} 
                size="sm" 
                variant="ghost"
                className="h-8 px-2"
              >
                Modifier
              </Button>
            </div>
          )}
        </div>
        
        {/* Préférences d'étage */}
        <div className="space-y-2">
          <Label className="text-sm font-medium">Préférences d'étages</Label>
          <div className="flex flex-wrap gap-2">
            {availableFloors.map(floor => (
              <label 
                key={floor} 
                className="flex items-center space-x-2 border rounded-md px-2 py-1 cursor-pointer hover:bg-gray-50"
              >
                <Checkbox 
                  checked={preferredFloors.includes(floor)} 
                  onCheckedChange={() => handleFloorToggle(floor)}
                  className="h-4 w-4"
                />
                <span className="text-sm">
                  {floor === 0 ? 'RDC' : `Étage ${floor}`}
                  {roomsByFloor[floor] ? ` (${roomsByFloor[floor]})` : ''}
                </span>
              </label>
            ))}
            
            {availableFloors.length === 0 && (
              <span className="text-sm text-gray-500">Aucun étage disponible</span>
            )}
          </div>
        </div>
        
        {/* Liste des chambres assignées */}
        {totalRooms > 0 ? (
          <div className="space-y-2">
            <Label className="text-sm font-medium">Chambres assignées</Label>
            <ScrollArea className="h-[200px]">
              <div className="grid grid-cols-2 gap-2">
                {sortedRooms.map((room) => (
                  <RoomCard
                    key={room.number}
                    room={room}
                    compact
                    onUpdate={onRoomUpdate}
                    onUnassign={() => onRoomUnassign(room)}
                    showActions={false}
                  />
                ))}
              </div>
            </ScrollArea>
          </div>
        ) : (
          <div className="text-center py-4 text-gray-500">
            <p>Aucune chambre assignée</p>
          </div>
        )}
      </CardContent>
      <CardFooter className="bg-gray-50 px-4 py-2 flex justify-between">
        <div className="text-xs text-gray-500">
          {Object.entries(roomsByFloor).length > 0 && (
            <span>
              Étages: {Object.entries(roomsByFloor)
                .sort(([a], [b]) => parseInt(a) - parseInt(b))
                .map(([floor, count]) => `${floor}${count > 1 ? `(${count})` : ''}`)
                .join(', ')}
            </span>
          )}
        </div>
        <div className="flex space-x-2">
          {totalRooms > 0 && (
            <Select
              onValueChange={(status) => {
                const updatedRooms = sortedRooms.map(room => ({
                  ...room,
                  status: status as 'clean' | 'needs-cleaning' | 'occupied' | 'maintenance'
                }));
                
                updatedRooms.forEach(room => onRoomUpdate(room));
                
                toast({
                  title: "Statut mis à jour",
                  description: `Toutes les chambres de ${name} ont été mises à jour.`
                });
              }}
            >
              <SelectTrigger className="h-8 text-xs w-28">
                <SelectValue placeholder="Statut" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="needs-cleaning">À nettoyer</SelectItem>
                <SelectItem value="clean">Propre</SelectItem>
                <SelectItem value="occupied">Occupée</SelectItem>
                <SelectItem value="maintenance">Maintenance</SelectItem>
              </SelectContent>
            </Select>
          )}
        </div>
      </CardFooter>
    </Card>
  );
}
