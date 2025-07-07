import { Badge } from "@/components/ui/badge";
import { Room } from "@/services/pdfService";
import { Checkbox } from "@/components/ui/checkbox";
import { Bed, AlertCircle, Clock, Layers, Check } from "lucide-react";
import { useState, useRef, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Label } from "@/components/ui/label";
import { toast } from "@/hooks/use-toast";

interface RoomCardProps {
  room: Room;
  onUpdate: (room: Room) => void;
  onAssign?: (room: Room, housekeeperName: string) => void;
  onUnassign?: (room: Room) => void;
  draggable?: boolean;
  compact?: boolean;
  selectable?: boolean;
  isSelected?: boolean;
  onSelect?: (room: Room) => void;
  showActions?: boolean;
}

export function RoomCard({ 
  room, 
  onUpdate, 
  onAssign, 
  onUnassign,
  draggable = false, 
  compact = false, 
  selectable = false,
  isSelected = false,
  onSelect,
  showActions = false
}: RoomCardProps) {
  const [dragging, setDragging] = useState(false);
  const cardRef = useRef<HTMLDivElement>(null);

  // Add animation effect when dragging
  useEffect(() => {
    if (!cardRef.current) return;
    
    if (dragging) {
      cardRef.current.classList.add('scale-105', 'shadow-lg');
    } else {
      cardRef.current.classList.remove('scale-105', 'shadow-lg');
    }
  }, [dragging]);

  const handleDragStart = (e: React.DragEvent) => {
    e.dataTransfer.setData('application/json', JSON.stringify(room));
    e.dataTransfer.effectAllowed = 'move';
    
    // Create a custom drag image
    if (cardRef.current) {
      const rect = cardRef.current.getBoundingClientRect();
      e.dataTransfer.setDragImage(cardRef.current, rect.width / 2, rect.height / 2);
    }
    
    setDragging(true);
  };

  const handleDragEnd = () => {
    setDragging(false);
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'needs-cleaning':
        return <Badge variant="outline" className="bg-yellow-100 text-yellow-800 hover:bg-yellow-100">À Nettoyer</Badge>;
      case 'clean':
        return <Badge variant="outline" className="bg-green-100 text-green-800 hover:bg-green-100">Propre</Badge>;
      case 'occupied':
        return <Badge variant="outline" className="bg-blue-100 text-blue-800 hover:bg-blue-100">Occupé</Badge>;
      case 'maintenance':
        return <Badge variant="outline" className="bg-red-100 text-red-800 hover:bg-red-100">Maintenance</Badge>;
      default:
        return <Badge variant="outline">{status}</Badge>;
    }
  };
  
  const getCleaningTypeBadge = (type: string) => {
    switch (type) {
      case 'full':
        return <Badge variant="outline" className="bg-purple-100 text-purple-800">À Blanc</Badge>;
      case 'quick':
        return <Badge variant="outline" className="bg-blue-100 text-blue-800">Recouche</Badge>;
      case 'none':
        return null;
      default:
        return <Badge variant="outline">{type}</Badge>;
    }
  };

  const toggleTwin = () => {
    onUpdate({
      ...room,
      isTwin: !room.isTwin
    });
  };

  const toggleUrgent = () => {
    onUpdate({
      ...room,
      isUrgent: !room.isUrgent,
      notUrgent: false,
      priority: !room.isUrgent ? 'high' : 'medium'
    });
  };

  const toggleNotUrgent = () => {
    onUpdate({
      ...room,
      notUrgent: !room.notUrgent,
      isUrgent: false,
      priority: !room.notUrgent ? 'low' : 'medium'
    });
  };

  const handleClick = () => {
    if (selectable && onSelect) {
      onSelect(room);
    }
  };

  const setCleaningType = (type: 'full' | 'quick' | 'none') => {
    onUpdate({
      ...room,
      cleaningType: type,
      status: type === 'none' ? 'clean' : 'needs-cleaning'
    });
    
    toast({
      description: `Chambre ${room.number} : nettoyage ${type === 'full' ? 'à blanc' : type === 'quick' ? 'recouche' : 'aucun'}`
    });
  };

  // Détermine l'étage à partir du numéro de chambre
  const floor = room.floor !== undefined ? room.floor : (room.number ? parseInt(room.number[0]) : 0);
  const floorDisplay = floor === 0 ? "RDC" : `${floor}`;

  if (compact) {
    return (
      <div 
        ref={cardRef}
        className={`px-3 py-2 text-xs border rounded-xl bg-card shadow-modern flex items-center gap-2 transition-all duration-300 ${
          dragging ? 'opacity-50' : ''
        } ${
          isSelected ? 'bg-gradient-primary text-primary-foreground border-2' :
          room.isUrgent ? 'border-destructive border-2 bg-destructive/5' : 
          room.notUrgent ? 'border-green-500 bg-green-50' : 'border-border hover:shadow-modern-md'
        } ${
          selectable ? 'cursor-pointer hover:scale-[1.02]' : ''
        } animate-fade-in`}
        draggable={draggable}
        onDragStart={handleDragStart}
        onDragEnd={handleDragEnd}
        onClick={handleClick}
      >
        <span className="font-semibold text-sm">{room.number}</span>
        {room.cleaningType !== 'none' && (
          <span className={`text-xs font-bold px-2 py-1 rounded-full ${
            room.cleaningType === 'full' 
              ? 'bg-purple-100 text-purple-700' 
              : 'bg-blue-100 text-blue-700'
          }`}>
            {room.cleaningType === 'full' ? 'B' : 'R'}
          </span>
        )}
        {room.isTwin && <Bed className="h-3 w-3 text-muted-foreground" />}
        <span className="text-xs text-muted-foreground ml-auto font-medium">{floorDisplay}</span>
        
        {/* Boutons de changement rapide */}
        {showActions && (
          <div className="ml-2 flex items-center gap-1">
            <button 
              className="h-6 w-6 flex items-center justify-center rounded-lg hover:bg-purple-100 text-purple-700 transition-colors font-semibold text-xs"
              onClick={(e) => {
                e.stopPropagation();
                setCleaningType('full');
              }}
              title="À Blanc"
            >
              B
            </button>
            <button 
              className="h-6 w-6 flex items-center justify-center rounded-lg hover:bg-blue-100 text-blue-700 transition-colors font-semibold text-xs"
              onClick={(e) => {
                e.stopPropagation();
                setCleaningType('quick');
              }}
              title="Recouche"
            >
              R
            </button>
            <button
              className="h-6 w-6 flex items-center justify-center rounded-lg hover:bg-green-100 text-green-700 transition-colors"
              onClick={(e) => {
                e.stopPropagation();
                setCleaningType('none');
              }}
              title="Marquer comme propre"
            >
              <Check className="h-3 w-3" />
            </button>
          </div>
        )}
      </div>
    );
  }

  return (
    <div 
      ref={cardRef}
      className={`p-4 border rounded-lg transition-all duration-200 ${
        dragging ? 'opacity-50' : ''
      } ${
        isSelected ? 'bg-blue-100 border-blue-500 border-2' :
        room.isUrgent ? 'border-red-500 border-2 shadow-md' : 
        room.notUrgent ? 'border-green-500 border-2' : 'border-gray-200 shadow-sm'
      } ${
        selectable ? 'cursor-pointer' : ''
      }`}
      draggable={draggable}
      onDragStart={handleDragStart}
      onDragEnd={handleDragEnd}
      onClick={handleClick}
    >
      <div className="flex justify-between items-start mb-2">
        <div className="flex gap-2 items-center">
          <h3 className="text-lg font-bold">{room.number}</h3>
          <Badge variant="outline" className="bg-gray-100 text-gray-700">
            <Layers className="h-3 w-3 mr-1" /> {floorDisplay}
          </Badge>
        </div>
        <div className="flex gap-1">
          {getStatusBadge(room.status)}
          {getCleaningTypeBadge(room.cleaningType)}
        </div>
      </div>
      
      {/* New Cleaning Type Selection */}
      <div className="mb-3 mt-2 p-2 border border-gray-200 rounded-md bg-gray-50">
        <p className="text-xs font-medium mb-2 text-gray-700">Type de nettoyage:</p>
        <RadioGroup 
          value={room.cleaningType} 
          className="flex gap-2"
          onValueChange={(value) => setCleaningType(value as 'full' | 'quick' | 'none')}
        >
          <div className="flex items-center space-x-1">
            <RadioGroupItem value="full" id={`full-${room.number}`} />
            <Label 
              htmlFor={`full-${room.number}`}
              className="flex items-center text-xs gap-1 cursor-pointer text-purple-800"
            >
              <Check className="h-3 w-3" /> À Blanc
            </Label>
          </div>
          <div className="flex items-center space-x-1">
            <RadioGroupItem value="quick" id={`quick-${room.number}`} />
            <Label 
              htmlFor={`quick-${room.number}`}
              className="flex items-center text-xs gap-1 cursor-pointer text-blue-800"
            >
              <Bed className="h-3 w-3" /> Recouche
            </Label>
          </div>
          <div className="flex items-center space-x-1">
            <RadioGroupItem value="none" id={`none-${room.number}`} />
            <Label 
              htmlFor={`none-${room.number}`}
              className="text-xs cursor-pointer text-gray-800"
            >
              Aucun
            </Label>
          </div>
        </RadioGroup>
      </div>
      
      <div className="flex flex-col gap-2 mt-3">
        <div className="flex items-center gap-2">
          <Checkbox 
            id={`twin-${room.number}`} 
            checked={room.isTwin || false}
            onCheckedChange={toggleTwin}
          />
          <label 
            htmlFor={`twin-${room.number}`}
            className="text-sm font-medium flex items-center gap-1 cursor-pointer"
          >
            Twin <Bed className="h-4 w-4" />
          </label>
        </div>
        
        <div className="flex items-center gap-2">
          <Checkbox 
            id={`urgent-${room.number}`} 
            checked={room.isUrgent || false}
            onCheckedChange={toggleUrgent}
          />
          <label 
            htmlFor={`urgent-${room.number}`}
            className="text-sm font-medium flex items-center gap-1 cursor-pointer text-red-500"
          >
            Prioritaire <AlertCircle className="h-4 w-4" />
          </label>
        </div>
        
        <div className="flex items-center gap-2">
          <Checkbox 
            id={`noturgent-${room.number}`} 
            checked={room.notUrgent || false}
            onCheckedChange={toggleNotUrgent}
          />
          <label 
            htmlFor={`noturgent-${room.number}`}
            className="text-sm font-medium flex items-center gap-1 cursor-pointer text-green-500"
          >
            Pas urgent <Clock className="h-4 w-4" />
          </label>
        </div>
      </div>
    </div>
  );
}
