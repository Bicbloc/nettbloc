import { useState, useEffect } from "react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Room } from "@/services/pdfService";
import { getAvailableFloors } from "@/utils/roomUtils";
import { ArrowUpDown, ArrowUp, ArrowDown } from "lucide-react";

interface RoomFiltersProps {
  rooms: Room[];
  onFiltersChange: (filteredRooms: Room[]) => void;
}

export function RoomFilters({ rooms, onFiltersChange }: RoomFiltersProps) {
  const [searchTerm, setSearchTerm] = useState('');
  const [filterFloor, setFilterFloor] = useState('all');
  const [filterStatus, setFilterStatus] = useState('all');
  const [filterCleaningType, setFilterCleaningType] = useState('all');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc' | 'none'>('none');

  const availableFloors = getAvailableFloors(rooms);

  // Appliquer les filtres
  useEffect(() => {
    let filtered = [...rooms];

    // Filtre par recherche
    if (searchTerm) {
      filtered = filtered.filter(room => 
        room.number.toLowerCase().includes(searchTerm.toLowerCase())
      );
    }

    // Filtre par étage
    if (filterFloor !== 'all') {
      const floor = parseInt(filterFloor);
      filtered = filtered.filter(room => Math.floor(parseInt(room.number) / 100) === floor);
    }

    // Filtre par statut
    if (filterStatus !== 'all') {
      filtered = filtered.filter(room => room.status === filterStatus);
    }

    // Filtre par type de nettoyage
    if (filterCleaningType !== 'all') {
      filtered = filtered.filter(room => room.cleaningType === filterCleaningType);
    }

    // Tri
    if (sortOrder !== 'none') {
      filtered.sort((a, b) => {
        const comparison = parseInt(a.number) - parseInt(b.number);
        return sortOrder === 'asc' ? comparison : -comparison;
      });
    }

    onFiltersChange(filtered);
  }, [rooms, searchTerm, filterFloor, filterStatus, filterCleaningType, sortOrder, onFiltersChange]);

  const handleSortToggle = () => {
    if (sortOrder === 'none') setSortOrder('asc');
    else if (sortOrder === 'asc') setSortOrder('desc');
    else setSortOrder('none');
  };

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4">
      <div>
        <Label htmlFor="search">Recherche</Label>
        <Input
          id="search"
          placeholder="N° de chambre..."
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
        <Label htmlFor="sort-order">Tri par n°</Label>
        <Button
          variant="outline"
          className="w-full justify-start"
          onClick={handleSortToggle}
        >
          {sortOrder === 'none' && <ArrowUpDown className="h-4 w-4 mr-2" />}
          {sortOrder === 'asc' && <ArrowUp className="h-4 w-4 mr-2" />}
          {sortOrder === 'desc' && <ArrowDown className="h-4 w-4 mr-2" />}
          {sortOrder === 'none' && 'Aucun tri'}
          {sortOrder === 'asc' && 'Croissant'}
          {sortOrder === 'desc' && 'Décroissant'}
        </Button>
      </div>
    </div>
  );
}