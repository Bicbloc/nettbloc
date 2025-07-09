
import { useState } from "react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Badge } from "@/components/ui/badge";
import { Room } from "@/services/pdfService";
import { getAvailableFloors } from "@/utils/roomUtils";
import { ArrowUpDown, ArrowUp, ArrowDown } from "lucide-react";

interface FilterControlsProps {
  rooms: Room[];
  searchTerm: string;
  setSearchTerm: (value: string) => void;
  filterFloor: string;
  setFilterFloor: (value: string) => void;
  filterStatus: string;
  setFilterStatus: (value: string) => void;
  filterCleaningType: string;
  setFilterCleaningType: (value: string) => void;
  excludeTwin: boolean;
  setExcludeTwin: (value: boolean) => void;
  useSmartAssignment: boolean;
  setUseSmartAssignment: (value: boolean) => void;
  selectedFloors: number[];
  setSelectedFloors: (floors: number[]) => void;
  sortOrder: 'asc' | 'desc' | 'none';
  setSortOrder: (order: 'asc' | 'desc' | 'none') => void;
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
  filterCleaningType,
  setFilterCleaningType,
  excludeTwin,
  setExcludeTwin,
  useSmartAssignment,
  setUseSmartAssignment,
  selectedFloors,
  sortOrder,
  setSortOrder,
  onSelectAll,
  onClearSelection,
  onSmartAssign,
  onDistributeRooms,
  toggleFloor
}: FilterControlsProps) {
  const availableFloors = getAvailableFloors(rooms);
  
  return (
    <div className="space-y-3">
      {/* Search and Filters - Responsive Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-2">
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
        
        <div>
          <Label htmlFor="cleaning-type-filter">Type de nettoyage</Label>
          <Select value={filterCleaningType} onValueChange={setFilterCleaningType}>
            <SelectTrigger id="cleaning-type-filter">
              <SelectValue placeholder="Tous les types" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Tous les types</SelectItem>
              <SelectItem value="full">À Blanc</SelectItem>
              <SelectItem value="quick">Recouche</SelectItem>
            </SelectContent>
          </Select>
        </div>
        
        <div>
          <Label htmlFor="sort-order">Tri par numéro</Label>
          <Button
            variant="outline"
            className="w-full justify-start"
            onClick={() => {
              if (sortOrder === 'none') setSortOrder('asc');
              else if (sortOrder === 'asc') setSortOrder('desc');
              else setSortOrder('none');
            }}
          >
            {sortOrder === 'none' && <ArrowUpDown className="h-4 w-4 mr-2" />}
            {sortOrder === 'asc' && <ArrowUp className="h-4 w-4 mr-2" />}
            {sortOrder === 'desc' && <ArrowDown className="h-4 w-4 mr-2" />}
            {sortOrder === 'none' && 'Aucun tri'}
            {sortOrder === 'asc' && 'Croissant'}
            {sortOrder === 'desc' && 'Décroissant'}
          </Button>
        </div>
        
        <div className="grid grid-cols-2 gap-1">
          <Button variant="outline" className="text-xs px-2" onClick={onSelectAll}>
            Tout
          </Button>
          <Button variant="outline" className="text-xs px-2" onClick={onClearSelection}>
            Rien
          </Button>
        </div>
      </div>
      
      {/* Options additionnelles */}
      <div className="space-y-2">
        <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
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
            className="shrink-0"
          >
            Distribuer équitablement
          </Button>
        </div>
      </div>
      
      {/* Sélection des étages */}
      <div className="space-y-2">
        <Label className="text-sm font-medium">Sélectionner des étages spécifiques (sélectionne automatiquement toutes les chambres de l'étage)</Label>
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
        <div className="text-xs text-muted-foreground">
          {selectedFloors.length > 0 ? 
            `${selectedFloors.length} étage(s) sélectionné(s)` : 
            "Aucun étage sélectionné - toutes les chambres seront affichées"}
        </div>
      </div>
    </div>
  );
}
