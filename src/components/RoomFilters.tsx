import { useState, useEffect } from "react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Room } from "@/services/pdfService";
import { getAvailableFloors } from "@/utils/roomUtils";
import { ArrowUpDown, ArrowUp, ArrowDown } from "lucide-react";
import { useLanguage } from "@/contexts/LanguageContext";

interface RoomFiltersProps {
  rooms: Room[];
  onFiltersChange: (filteredRooms: Room[]) => void;
}

export function RoomFilters({ rooms, onFiltersChange }: RoomFiltersProps) {
  const { t } = useLanguage();
  const [searchTerm, setSearchTerm] = useState('');
  const [filterFloor, setFilterFloor] = useState('all');
  const [filterStatus, setFilterStatus] = useState('all');
  const [filterCleaningType, setFilterCleaningType] = useState('all');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc' | 'none'>('asc');

  const availableFloors = getAvailableFloors(rooms);

  // Apply filters
  useEffect(() => {
    let filtered = [...rooms];

    // Filter by search
    if (searchTerm) {
      filtered = filtered.filter(room => 
        room.number.toLowerCase().includes(searchTerm.toLowerCase())
      );
    }

    // Filter by floor
    if (filterFloor !== 'all') {
      const floor = parseInt(filterFloor);
      filtered = filtered.filter(room => Math.floor(parseInt(room.number) / 100) === floor);
    }

    // Filter by status
    if (filterStatus !== 'all') {
      filtered = filtered.filter(room => room.status === filterStatus);
    }

    // Filter by cleaning type
    if (filterCleaningType !== 'all') {
      filtered = filtered.filter(room => room.cleaningType === filterCleaningType);
    }

    // Sort by room number (ascending by default)
    filtered.sort((a, b) => {
      const comparison = parseInt(a.number) - parseInt(b.number);
      return sortOrder === 'asc' ? comparison : sortOrder === 'desc' ? -comparison : comparison;
    });

    onFiltersChange(filtered);
  }, [rooms, searchTerm, filterFloor, filterStatus, filterCleaningType, sortOrder, onFiltersChange]);

  const handleSortToggle = () => {
    if (sortOrder === 'asc') setSortOrder('desc');
    else if (sortOrder === 'desc') setSortOrder('asc');
    else setSortOrder('asc');
  };

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4">
      <div>
        <Label htmlFor="search">{t.common.search}</Label>
        <Input
          id="search"
          placeholder={`${t.rooms.roomNumberShort}...`}
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
        />
      </div>
      
      <div>
        <Label htmlFor="floor-filter">{t.rooms.floor}</Label>
        <Select value={filterFloor} onValueChange={setFilterFloor}>
          <SelectTrigger id="floor-filter">
            <SelectValue placeholder={t.rooms.allFloors} />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">{t.rooms.allFloors}</SelectItem>
            {availableFloors.map(floor => (
              <SelectItem key={floor} value={floor.toString()}>
                {floor === 0 ? t.rooms.groundFloor : `${t.rooms.floor} ${floor}`}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
      
      <div>
        <Label htmlFor="status-filter">{t.rooms.status}</Label>
        <Select value={filterStatus} onValueChange={setFilterStatus}>
          <SelectTrigger id="status-filter">
            <SelectValue placeholder={t.rooms.allStatuses} />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">{t.rooms.allStatuses}</SelectItem>
            <SelectItem value="needs-cleaning">{t.rooms.needsCleaning}</SelectItem>
            <SelectItem value="clean">{t.rooms.clean}</SelectItem>
            <SelectItem value="occupied">{t.rooms.occupied}</SelectItem>
            <SelectItem value="maintenance">{t.rooms.maintenance}</SelectItem>
          </SelectContent>
        </Select>
      </div>
      
      <div>
        <Label htmlFor="cleaning-type-filter">{t.rooms.cleaningType}</Label>
        <Select value={filterCleaningType} onValueChange={setFilterCleaningType}>
          <SelectTrigger id="cleaning-type-filter">
            <SelectValue placeholder={t.rooms.allTypes} />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">{t.rooms.allTypes}</SelectItem>
            <SelectItem value="full">{t.rooms.fullClean}</SelectItem>
            <SelectItem value="quick">{t.rooms.quickClean}</SelectItem>
          </SelectContent>
        </Select>
      </div>
      
      <div>
        <Label htmlFor="sort-order">{t.common.sortBy} #</Label>
        <Button
          variant="outline"
          className="w-full justify-start"
          onClick={handleSortToggle}
          >
            {sortOrder === 'asc' && <ArrowUp className="h-4 w-4 mr-2" />}
            {sortOrder === 'desc' && <ArrowDown className="h-4 w-4 mr-2" />}
            {sortOrder === 'asc' && t.common.sortAsc}
            {sortOrder === 'desc' && t.common.sortDesc}
          </Button>
      </div>
    </div>
  );
}
