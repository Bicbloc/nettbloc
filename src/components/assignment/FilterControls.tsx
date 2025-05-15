
import { useState } from "react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Badge } from "@/components/ui/badge";
import { Room } from "@/services/pdfService";
import { getAvailableFloors } from "@/utils/roomUtils";

interface FilterControlsProps {
  rooms: Room[];
  searchTerm: string;
  setSearchTerm: (value: string) => void;
  filterFloor: string;
  setFilterFloor: (value: string) => void;
  filterStatus: string;
  setFilterStatus: (value: string) => void;
  excludeTwin: boolean;
  setExcludeTwin: (value: boolean) => void;
  useSmartAssignment: boolean;
  setUseSmartAssignment: (value: boolean) => void;
  selectedFloors: number[];
  setSelectedFloors: (floors: number[]) => void;
  onSelectAll: () => void;
  onClearSelection: () => void;
  onSmartAssign: () => void;
  onDistributeRooms: () => void;
  toggleFloor: (floor: number) => void;
}

export function FilterControls({
  rooms,
  searchTerm,
  setSearchTerm,
  filterFloor,
  setFilterFloor,
  filterStatus,
  setFilterStatus,
  excludeTwin,
  setExcludeTwin,
  useSmartAssignment,
  setUseSmartAssignment,
  selectedFloors,
  onSelectAll,
  onClearSelection,
  onSmartAssign,
  onDistributeRooms,
  toggleFloor
}: FilterControlsProps) {
  const availableFloors = getAvailableFloors(rooms);
  
  return (
    <>
      {/* Search and Filters */}
      <div className="col-span-12 grid grid-cols-4 gap-2 mb-2">
        <div>
          <Label htmlFor="search">Recherche</Label>
          <Input
            id="search"
            placeholder="Numéro de chambre..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
        </div>
        
        <div>
          <Label htmlFor="floor-filter">Étage</Label>
          <Select value={filterFloor} onValueChange={setFilterFloor}>
            <SelectTrigger id="floor-filter">
              <SelectValue placeholder="Tous les étages" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Tous les étages</SelectItem>
              {availableFloors.map(floor => (
                <SelectItem key={floor} value={floor.toString()}>
                  {floor === 0 ? "RDC" : `Étage ${floor}`}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        
        <div>
          <Label htmlFor="status-filter">Statut</Label>
          <Select value={filterStatus} onValueChange={setFilterStatus}>
            <SelectTrigger id="status-filter">
              <SelectValue placeholder="Tous les statuts" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Tous les statuts</SelectItem>
              <SelectItem value="needs-cleaning">À nettoyer</SelectItem>
              <SelectItem value="clean">Propre</SelectItem>
              <SelectItem value="occupied">Occupé</SelectItem>
              <SelectItem value="maintenance">Maintenance</SelectItem>
            </SelectContent>
          </Select>
        </div>
        
        <div className="flex gap-2 items-end">
          <Button variant="outline" className="flex-1" onClick={onSelectAll}>
            Tout sélectionner
          </Button>
          <Button variant="outline" className="flex-1" onClick={onClearSelection}>
            Effacer
          </Button>
        </div>
      </div>
      
      {/* Options additionnelles */}
      <div className="col-span-12 mb-2">
        <div className="flex flex-wrap items-center gap-x-8 gap-y-2">
          <div className="flex items-center gap-2">
            <Checkbox 
              id="exclude-twin" 
              checked={excludeTwin}
              onCheckedChange={(checked) => setExcludeTwin(!!checked)}
            />
            <Label 
              htmlFor="exclude-twin"
              className="text-sm cursor-pointer"
            >
              Exclure chambres twin
            </Label>
          </div>
          
          <div className="flex items-center gap-2">
            <Checkbox 
              id="smart-assignment" 
              checked={useSmartAssignment}
              onCheckedChange={(checked) => setUseSmartAssignment(!!checked)}
            />
            <Label 
              htmlFor="smart-assignment"
              className="text-sm cursor-pointer"
            >
              Assignation intelligente par étage
            </Label>
          </div>

          {useSmartAssignment && (
            <Button 
              variant="secondary" 
              size="sm" 
              onClick={onSmartAssign}
            >
              Sélection intelligente
            </Button>
          )}
          
          {/* Bouton de distribution équitable */}
          <Button 
            variant="secondary" 
            size="sm" 
            onClick={onDistributeRooms}
          >
            Distribuer équitablement
          </Button>
        </div>
      </div>
      
      {/* Sélection des étages */}
      <div className="col-span-12 mb-2">
        <Label className="mb-2 block">Sélectionner des étages spécifiques (sélectionne automatiquement toutes les chambres de l'étage)</Label>
        <div className="flex flex-wrap gap-2">
          {availableFloors.map(floor => (
            <Badge
              key={floor}
              className={`cursor-pointer ${selectedFloors.includes(floor) ? 'bg-blue-500 hover:bg-blue-600' : 'bg-gray-100 hover:bg-gray-200 text-gray-700'}`}
              onClick={() => toggleFloor(floor)}
            >
              {floor === 0 ? "RDC" : `Étage ${floor}`}
            </Badge>
          ))}
        </div>
        <div className="text-xs text-gray-500 mt-1">
          {selectedFloors.length > 0 ? 
            `${selectedFloors.length} étage(s) sélectionné(s)` : 
            "Aucun étage sélectionné - toutes les chambres seront affichées"}
        </div>
      </div>
    </>
  );
}
