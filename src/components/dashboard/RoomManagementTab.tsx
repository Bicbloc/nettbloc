/**
 * Room Management Tab Component
 * Extracted from Index.tsx for modularity
 */

import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Plus, FileText, Trash2, Link, Sparkles, ClipboardList, FileUp, Brain, ChevronDown } from "lucide-react";
import { ReportTrainingPanel } from "@/components/ReportTrainingPanel";
import { Room } from "@/services/pdfService";
import { PdfWorkflowDialog } from "@/components/PdfWorkflowDialog";
import { AddRoomDialog } from "@/components/AddRoomDialog";
import { ManualRoomEntryDialog } from "@/components/ManualRoomEntryDialog";
import { ImportModeSwitch } from "@/components/ImportModeSwitch";
import { PmsApiConfigPanel } from "@/components/pms/PmsApiConfigPanel";
import { RoomFilters } from "@/components/RoomFilters";
import { RoomCard } from "@/components/RoomCard";
import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useLanguage } from "@/contexts/LanguageContext";
import { cn } from "@/lib/utils";

interface RoomManagementTabProps {
  rooms: Room[];
  housekeeperNames: string[];
  currentHotelId: string | null;
  onPdfProcessed: (data: Room[], housekeepers?: string[], method?: 'random' | 'floor' | 'cleaning-type') => void;
  onAddRoom: (room: Room) => Promise<void>;
  onRoomUpdate: (room: Room) => void;
  onRoomUnassign: (room: Room) => void;
  onRoomReassign: (room: Room, newHousekeeper: string | null) => void;
  onOpenManualAssignment: () => void;
  onDeleteRoom: (roomNumber: string) => void;
  onLinkRooms: (roomNumber: string) => void;
}

export function RoomManagementTab({
  rooms,
  housekeeperNames,
  currentHotelId,
  onPdfProcessed,
  onAddRoom,
  onRoomUpdate,
  onRoomUnassign,
  onRoomReassign,
  onOpenManualAssignment,
  onDeleteRoom,
  onLinkRooms,
}: RoomManagementTabProps) {
  const { t } = useLanguage();
  const [filteredRooms, setFilteredRooms] = useState<Room[] | null>(null);
  const [importMode, setImportMode] = useState<'auto' | 'manual'>('auto');
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [pmsActive, setPmsActive] = useState(false);

  // Load hotel's import mode preference
  useEffect(() => {
    const loadImportMode = async () => {
      if (!currentHotelId) return;
      const { data } = await supabase
        .from('hotels')
        .select('import_mode')
        .eq('id', currentHotelId)
        .maybeSingle();
      if (data?.import_mode) {
        setImportMode(data.import_mode as 'auto' | 'manual');
      }
    };
    loadImportMode();
  }, [currentHotelId]);

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'needs-cleaning':
        return <Badge variant="outline" className="bg-yellow-100 text-yellow-800 hover:bg-yellow-100">{t.rooms.dirty}</Badge>;
      case 'clean':
        return <Badge variant="outline" className="bg-green-100 text-green-800 hover:bg-green-100">{t.rooms.clean}</Badge>;
      case 'occupied':
        return <Badge variant="outline" className="bg-blue-100 text-blue-800 hover:bg-blue-100">{t.rooms.occupied}</Badge>;
      case 'maintenance':
        return <Badge variant="outline" className="bg-red-100 text-red-800 hover:bg-red-100">{t.rooms.maintenance}</Badge>;
      default:
        return <Badge variant="outline">{status}</Badge>;
    }
  };

  const getCleaningTypeBadge = (type?: string) => {
    switch (type) {
      case 'full':
      case 'a_blanc':
        return <Badge variant="outline" className="bg-red-100 text-red-800">{t.rooms.fullClean}</Badge>;
      case 'quick':
      case 'recouche':
        return <Badge variant="outline" className="bg-blue-100 text-blue-800">{t.rooms.quickClean}</Badge>;
      case 'none':
        return <Badge variant="outline" className="bg-gray-100 text-gray-800">{t.common.none}</Badge>;
      default:
        return <Badge variant="outline">{type || 'N/A'}</Badge>;
    }
  };

  const handleManualRoomsAdded = async (newRooms: Room[]) => {
    // Process each room through the existing handler
    for (const room of newRooms) {
      await onAddRoom(room);
    }
    // Trigger a refresh with the new rooms
    onPdfProcessed([...rooms, ...newRooms]);
  };

  const existingRoomNumbers = rooms.map(r => r.number);

  return (
    <div className="space-y-6">
      {/* PMS API Config Panel (Entreprise only) */}
      <PmsApiConfigPanel onActiveChange={setPmsActive} />

      {/* Import Mode Switch — masqué lorsqu'une connexion API PMS est active */}
      {!pmsActive && (
        <ImportModeSwitch 
          hotelId={currentHotelId}
          currentMode={importMode}
          onModeChange={setImportMode}
        />
      )}

      <div className="flex justify-between items-center">
        <h2 className="text-2xl font-bold">{t.rooms.roomManagement}</h2>
        <div className="flex gap-2">
          <AddRoomDialog 
            onAddRoom={onAddRoom} 
            existingRooms={rooms} 
          />
          {importMode === 'auto' ? (
            <PdfWorkflowDialog 
              hotelId={currentHotelId}
              onWorkflowComplete={onPdfProcessed}
            />
          ) : (
            <ManualRoomEntryDialog 
              hotelId={currentHotelId}
              onRoomsAdded={handleManualRoomsAdded}
              existingRoomNumbers={existingRoomNumbers}
            />
          )}
          <Button
            onClick={onOpenManualAssignment}
            variant="outline"
            disabled={housekeeperNames.length === 0}
          >
            <Plus className="mr-2 h-4 w-4" />
            {t.rooms.manualAssignment}
          </Button>
        </div>
      </div>

      {rooms.length === 0 ? (
        <Card className="border-2 border-dashed">
          <CardContent className="flex flex-col items-center justify-center py-12">
            {importMode === 'auto' ? (
              <>
                <Sparkles className="h-12 w-12 text-primary mb-4" />
                <h3 className="text-lg font-semibold mb-2">{t.importMode.importYourRooms}</h3>
                <p className="text-muted-foreground text-center mb-6 max-w-md">
                  {t.importMode.importYourRoomsDesc}
                </p>
                <div className="flex flex-wrap gap-1 mb-4 justify-center">
                  <Badge variant="secondary" className="text-xs">Mews</Badge>
                  <Badge variant="secondary" className="text-xs">Apaleo</Badge>
                  <Badge variant="secondary" className="text-xs">Opera</Badge>
                  <Badge variant="secondary" className="text-xs">+10 PMS</Badge>
                </div>
                <PdfWorkflowDialog 
                  hotelId={currentHotelId}
                  onWorkflowComplete={onPdfProcessed}
                />
              </>
            ) : (
              <>
                <ClipboardList className="h-12 w-12 text-secondary-foreground mb-4" />
                <h3 className="text-lg font-semibold mb-2">{t.importMode.enterYourRooms}</h3>
                <p className="text-muted-foreground text-center mb-6 max-w-md">
                  {t.importMode.enterYourRoomsDesc}
                </p>
                <div className="flex flex-wrap gap-1 mb-4 justify-center">
                  <Badge variant="outline" className="text-xs">🚪 {t.rooms.fullClean}</Badge>
                  <Badge variant="outline" className="text-xs">🛏️ {t.rooms.quickClean}</Badge>
                  <Badge variant="outline" className="text-xs">✅ {t.rooms.clean}</Badge>
                </div>
                <ManualRoomEntryDialog 
                  hotelId={currentHotelId}
                  onRoomsAdded={handleManualRoomsAdded}
                  existingRoomNumbers={existingRoomNumbers}
                />
              </>
            )}

            {/* Quick add single room */}
            <div className="mt-6 pt-4 border-t w-full max-w-md">
              <p className="text-sm text-muted-foreground text-center mb-3">
                {t.common.addSingle}
              </p>
              <div className="flex justify-center">
                <AddRoomDialog 
                  onAddRoom={onAddRoom} 
                  existingRooms={rooms} 
                />
              </div>
            </div>
          </CardContent>
        </Card>
      ) : (
        <>
          <Card>
            <CardHeader>
              <CardTitle>{t.rooms.filtersAndOptions}</CardTitle>
            </CardHeader>
            <CardContent>
              <RoomFilters 
                rooms={rooms}
                onFiltersChange={(filtered) => setFilteredRooms(filtered)}
              />
            </CardContent>
          </Card>
          
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>{t.rooms.roomNumberShort}</TableHead>
                  <TableHead>{t.rooms.status}</TableHead>
                  <TableHead>{t.rooms.cleaningType}</TableHead>
                  <TableHead>{t.rooms.priority}</TableHead>
                  <TableHead>{t.rooms.assignedTo}</TableHead>
                  <TableHead>Twin</TableHead>
                  <TableHead>{t.rooms.linkedRooms}</TableHead>
                  <TableHead>{t.rooms.quickActions}</TableHead>
                  <TableHead>{t.common.management}</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {(filteredRooms || rooms).map((room) => (
                  <TableRow key={room.number}>
                    <TableCell className="font-medium">{room.number}</TableCell>
                    <TableCell>{getStatusBadge(room.status)}</TableCell>
                    <TableCell>{getCleaningTypeBadge(room.cleaningType)}</TableCell>
                    <TableCell>
                      {room.priority === 'high' ? (
                        <Badge variant="destructive">{t.common.high}</Badge>
                      ) : (
                        <Badge variant="secondary">{t.common.normal}</Badge>
                      )}
                    </TableCell>
                    <TableCell>
                      {room.assignedTo ? (
                        <Badge variant="outline">{room.assignedTo}</Badge>
                      ) : (
                        <span className="text-muted-foreground">{t.rooms.unassigned}</span>
                      )}
                    </TableCell>
                    <TableCell>
                      <Checkbox
                        checked={room.isTwin || false}
                        onCheckedChange={(checked) => {
                          onRoomUpdate({ ...room, isTwin: checked as boolean });
                        }}
                      />
                    </TableCell>
                    <TableCell>
                      {room.linkedRooms && room.linkedRooms.length > 0 ? (
                        <div className="flex flex-wrap gap-1">
                          {room.linkedRooms.map(linkedRoom => (
                            <Badge key={linkedRoom} variant="secondary" className="text-xs">
                              {linkedRoom}
                            </Badge>
                          ))}
                        </div>
                      ) : (
                        <span className="text-muted-foreground text-sm">{t.common.none}</span>
                      )}
                    </TableCell>
                    <TableCell>
                      <RoomCard
                        room={room}
                        onUpdate={onRoomUpdate}
                        onUnassign={onRoomUnassign}
                        onReassign={onRoomReassign}
                        allRooms={rooms}
                        housekeeperNames={housekeeperNames}
                        hotelId={currentHotelId || undefined}
                        compact={true}
                        showActions={true}
                      />
                    </TableCell>
                    <TableCell>
                      <div className="flex gap-1">
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => onLinkRooms(room.number)}
                          title={t.rooms.linkWithRooms}
                        >
                          <Link className="h-4 w-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => onDeleteRoom(room.number)}
                          className="text-destructive hover:text-destructive"
                          title={t.rooms.deleteRoom}
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </>
      )}

      {/* Configuration avancée — Entraînement IA */}
      {currentHotelId && (
        <Collapsible open={showAdvanced} onOpenChange={setShowAdvanced}>
          <CollapsibleTrigger asChild>
            <Button variant="outline" className="w-full justify-between gap-2">
              <span className="flex items-center gap-2">
                <Brain className="h-4 w-4" />
                Configuration avancée — Entraînement IA
              </span>
              <ChevronDown className={cn("h-4 w-4 transition-transform", showAdvanced && "rotate-180")} />
            </Button>
          </CollapsibleTrigger>
          <CollapsibleContent className="mt-4">
            <ReportTrainingPanel hotelId={currentHotelId} />
          </CollapsibleContent>
        </Collapsible>
      )}
    </div>
  );
}
