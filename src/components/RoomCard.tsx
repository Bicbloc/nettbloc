
import { Badge } from "@/components/ui/badge";
import { Room } from "@/services/pdfService";
import { Checkbox } from "@/components/ui/checkbox";
import { Bed, AlertCircle, Clock } from "lucide-react";
import { useState, useRef, useEffect } from "react";

interface RoomCardProps {
  room: Room;
  onUpdate: (room: Room) => void;
  onAssign?: (room: Room, housekeeperName: string) => void;
  draggable?: boolean;
  compact?: boolean;
}

export function RoomCard({ room, onUpdate, onAssign, draggable = false, compact = false }: RoomCardProps) {
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

  if (compact) {
    return (
      <div 
        ref={cardRef}
        className={`px-2 py-1 text-xs border rounded flex items-center gap-1 transition-all duration-200 ${
          dragging ? 'opacity-50' : ''
        } ${
          room.isUrgent ? 'border-red-500 border-2' : 
          room.notUrgent ? 'border-green-500' : 'border-gray-200'
        }`}
        draggable={draggable}
        onDragStart={handleDragStart}
        onDragEnd={handleDragEnd}
      >
        <span className="font-medium">{room.number}</span>
        {room.cleaningType !== 'none' && (
          <span className={`text-xs font-bold ${room.cleaningType === 'full' ? 'text-purple-600' : 'text-blue-600'}`}>
            {room.cleaningType === 'full' ? '(B)' : '(R)'}
          </span>
        )}
        {room.isTwin && <Bed className="h-3 w-3 text-gray-500" />}
      </div>
    );
  }

  return (
    <div 
      ref={cardRef}
      className={`p-4 border rounded-lg transition-all duration-200 ${
        dragging ? 'opacity-50' : ''
      } ${
        room.isUrgent ? 'border-red-500 border-2 shadow-md' : 
        room.notUrgent ? 'border-green-500 border-2' : 'border-gray-200 shadow-sm'
      }`}
      draggable={draggable}
      onDragStart={handleDragStart}
      onDragEnd={handleDragEnd}
    >
      <div className="flex justify-between items-start mb-2">
        <h3 className="text-lg font-bold">{room.number}</h3>
        <div className="flex gap-1">
          {getStatusBadge(room.status)}
          {getCleaningTypeBadge(room.cleaningType)}
        </div>
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
