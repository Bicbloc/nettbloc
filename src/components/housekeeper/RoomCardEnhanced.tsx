import { useState, useRef } from 'react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { CheckCircle, X, Sparkles, Send, AlertCircle } from 'lucide-react';
import { IncidentReportDialogSimple } from '@/components/incident/IncidentReportDialogSimple';
import { supabase } from '@/integrations/supabase/client';
import { toast } from '@/hooks/use-toast';

interface Room {
  id: string;
  room_number: string;
  status: string;
  notes?: string;
  cleaning_priority?: number;
  cleaning_type?: string;
}

interface RoomCardEnhancedProps {
  room: Room;
  hotelId: string;
  onUpdateStatus: (roomId: string, status: string, notes?: string) => void;
  onUnassign: (roomId: string, roomNumber: string) => void;
}

export const RoomCardEnhanced = ({ room, hotelId, onUpdateStatus, onUnassign }: RoomCardEnhancedProps) => {
  const [swipeOffset, setSwipeOffset] = useState(0);
  const [isSwiping, setIsSwiping] = useState(false);
  const [notes, setNotes] = useState('');
  const [isSendingNote, setIsSendingNote] = useState(false);
  const [swipeStartTime, setSwipeStartTime] = useState(0);
  const touchStartX = useRef(0);
  const touchCurrentX = useRef(0);

  const handleTouchStart = (e: React.TouchEvent) => {
    if (room.status === 'in_progress' || room.status === 'dirty') {
      touchStartX.current = e.touches[0].clientX;
      setSwipeStartTime(Date.now());
      setIsSwiping(true);
    }
  };

  const handleTouchMove = (e: React.TouchEvent) => {
    if (!isSwiping) return;
    
    touchCurrentX.current = e.touches[0].clientX;
    const diff = touchCurrentX.current - touchStartX.current;
    
    // Only allow swipe to the right (positive values), max 200px
    if (diff > 0) {
      setSwipeOffset(Math.min(diff, 200));
    }
  };

  const handleTouchEnd = async () => {
    if (!isSwiping) {
      setIsSwiping(false);
      setSwipeOffset(0);
      return;
    }

    setIsSwiping(false);
    const swipeDuration = Date.now() - swipeStartTime;

    // Haptic feedback on mobile
    if ('vibrate' in navigator) {
      navigator.vibrate(50);
    }

    // For in_progress rooms: swipe right to mark as clean
    if (room.status === 'in_progress' && swipeOffset > 120) {
      await onUpdateStatus(room.id, 'clean', notes || undefined);
    }
    // For dirty rooms: swipe to start, long swipe to complete
    else if (room.status === 'dirty') {
      if (swipeOffset > 130 && swipeDuration > 500) {
        // Long swipe = mark as clean directly
        await onUpdateStatus(room.id, 'clean', notes || undefined);
      } else if (swipeOffset > 80) {
        // Normal swipe = start cleaning
        await onUpdateStatus(room.id, 'in_progress');
      }
    }
    
    setSwipeOffset(0);
  };

  const handleSendNote = async () => {
    if (!notes.trim()) return;
    
    setIsSendingNote(true);
    try {
      console.log('🔄 Envoi commentaire pour chambre:', room.room_number);
      
      // Update room notes in assignments table
      const { data: assignment, error: assignmentError } = await supabase
        .from('assignments')
        .select('id')
        .eq('room_id', room.id)
        .single();

      if (assignmentError) {
        console.error('❌ Erreur récupération assignment:', assignmentError);
        throw assignmentError;
      }

      if (assignment) {
        const { error: updateError } = await supabase
          .from('assignments')
          .update({ notes: notes.trim() })
          .eq('id', assignment.id);

        if (updateError) {
          console.error('❌ Erreur mise à jour assignment:', updateError);
          throw updateError;
        }

        // Create notification for admin
        const { data: hotel, error: hotelError } = await supabase
          .from('hotels')
          .select('user_id, name')
          .eq('id', hotelId)
          .single();

        if (hotelError) {
          console.error('❌ Erreur récupération hotel:', hotelError);
          throw hotelError;
        }

        if (hotel?.user_id) {
          const { error: notifError } = await supabase.from('notifications').insert({
            user_id: hotel.user_id,
            user_type: 'admin',
            hotel_id: hotelId,
            type: 'room_note',
            title: `Commentaire - Chambre ${room.room_number}`,
            description: notes.trim(),
            room_number: room.room_number,
            is_read: false
          });

          if (notifError) {
            console.error('❌ Erreur création notification:', notifError);
            throw notifError;
          }
        }

        console.log('✅ Commentaire envoyé avec succès');
        toast({
          title: "Commentaire envoyé",
          description: `Le commentaire pour la chambre ${room.room_number} a été envoyé à l'administrateur`,
        });
        
        setNotes('');
      }
    } catch (error) {
      console.error('❌ Erreur générale envoi commentaire:', error);
      toast({
        variant: "destructive",
        title: "Erreur d'envoi",
        description: error instanceof Error ? error.message : "Impossible d'envoyer le commentaire"
      });
    } finally {
      setIsSendingNote(false);
    }
  };

  const isCompleting = swipeOffset > 120;
  const swipeProgress = Math.min((swipeOffset / 120) * 100, 100);

  return (
    <div
      className={`relative overflow-hidden transition-all duration-200 rounded-xl ${
        room.status === 'clean' 
          ? 'bg-gradient-to-br from-green-50 to-green-100 border-2 border-green-300 shadow-sm'
          : room.status === 'in_progress'
          ? 'bg-gradient-to-br from-blue-50 to-blue-100 border-2 border-blue-300 shadow-md'
          : 'bg-gradient-to-br from-gray-50 to-gray-100 border-2 border-gray-300 shadow-sm'
      }`}
      onTouchStart={handleTouchStart}
      onTouchMove={handleTouchMove}
      onTouchEnd={handleTouchEnd}
      style={{
        transform: (room.status === 'in_progress' || room.status === 'dirty') ? `translateX(${swipeOffset}px)` : 'none',
        transition: isSwiping ? 'none' : 'transform 0.3s ease-out'
      }}
    >
      {/* Swipe background indicator */}
      {(room.status === 'in_progress' || room.status === 'dirty') && swipeOffset > 0 && (
        <div 
          className="absolute inset-0 flex items-center justify-start px-8"
          style={{
            background: `linear-gradient(to right, ${
              isCompleting ? 'rgb(34 197 94)' : 'rgb(147 197 253)'
            } ${swipeProgress}%, transparent ${swipeProgress}%)`
          }}
        >
          <div className="flex flex-col items-center gap-1">
            <CheckCircle className={`h-10 w-10 transition-all duration-200 ${
              isCompleting ? 'text-white scale-110' : 'text-green-600 scale-100'
            }`} />
            {isCompleting && (
              <span className="text-xs font-bold text-white">Relâchez!</span>
            )}
          </div>
        </div>
      )}
      
      {/* Card content */}
      <div className="relative p-4 bg-inherit" style={{ zIndex: 1 }}>
        <div className="space-y-3">
          {/* Header */}
          <div className="flex items-start justify-between gap-3">
            <div className="flex-1 space-y-2">
              <div className="flex flex-wrap items-center gap-2">
                <span className="text-2xl font-bold bg-gradient-to-r from-primary to-blue-600 bg-clip-text text-transparent">
                  Chambre {room.room_number}
                </span>
                
                {/* Priority badge */}
                {room.cleaning_priority && room.cleaning_priority > 1 && (
                  <Badge className={
                    room.cleaning_priority === 3 
                      ? 'bg-red-500 hover:bg-red-600 text-white' 
                      : 'bg-orange-500 hover:bg-orange-600 text-white'
                  }>
                    <AlertCircle className="h-3 w-3 mr-1" />
                    {room.cleaning_priority === 3 ? 'Urgent' : 'Prioritaire'}
                  </Badge>
                )}
                
                {/* Cleaning type badge */}
                {room.cleaning_type && (
                  <Badge 
                    className={room.cleaning_type === 'full' 
                      ? 'bg-purple-500 hover:bg-purple-600 text-white shadow-sm' 
                      : 'bg-blue-500 hover:bg-blue-600 text-white shadow-sm'
                    }
                  >
                    <Sparkles className="h-3 w-3 mr-1" />
                    {room.cleaning_type === 'full' ? '🚪 Départ' : '🛏️ Recouche'}
                  </Badge>
                )}

                {/* Status badge */}
                <Badge 
                  variant="outline" 
                  className={
                    room.status === 'clean'
                      ? 'bg-green-100 text-green-800 border-green-300'
                      : room.status === 'in_progress'
                      ? 'bg-blue-100 text-blue-800 border-blue-300'
                      : 'bg-gray-100 text-gray-800 border-gray-300'
                  }
                >
                  {room.status === 'clean' ? '✓ Terminée' : 
                   room.status === 'in_progress' ? '⏳ En cours' : '🚪 En attente'}
                </Badge>
              </div>
              
              {/* Admin notes */}
              {room.notes && (
                <div className="bg-white/70 rounded-lg p-2 border border-primary/20">
                  <p className="text-sm text-muted-foreground">
                    <span className="font-semibold text-primary">📝 Note:</span> {room.notes}
                  </p>
                </div>
              )}
            </div>

            {/* Incident button */}
            {room.status !== 'clean' && (
              <IncidentReportDialogSimple 
                hotelId={hotelId} 
                userType="housekeeper"
                defaultLocation={room.room_number}
              />
            )}
          </div>

          {/* Housekeeper notes input */}
          {room.status !== 'clean' && (
            <div className="space-y-2">
              <div className="relative">
                <Textarea
                  placeholder="💬 Ajouter un commentaire pour l'admin..."
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  rows={2}
                  className="text-sm resize-none bg-white/80 border-primary/30 focus:border-primary pr-12"
                />
                {notes.trim() && (
                  <Button
                    size="sm"
                    onClick={handleSendNote}
                    disabled={isSendingNote}
                    className="absolute bottom-2 right-2 h-8 w-8 p-0 rounded-full bg-primary hover:bg-primary/90"
                  >
                    <Send className="h-4 w-4" />
                  </Button>
                )}
              </div>
              {notes.trim() && (
                <p className="text-xs text-muted-foreground flex items-center gap-1">
                  <AlertCircle className="h-3 w-3" />
                  Cliquez sur <Send className="h-3 w-3 inline" /> pour envoyer à l'admin
                </p>
              )}
            </div>
          )}

          {/* Action buttons */}
          <div className="flex flex-wrap items-center gap-2 pt-2">
            {room.status === 'dirty' && (
              <>
                <Button 
                  onClick={() => onUpdateStatus(room.id, 'in_progress')}
                  className="flex-1 bg-gradient-to-r from-blue-600 to-blue-700 hover:from-blue-700 hover:to-blue-800 shadow-md"
                  size="sm"
                >
                  ▶ Commencer
                </Button>
                <Button 
                  onClick={() => onUnassign(room.id, room.room_number)}
                  variant="ghost"
                  size="sm"
                  className="text-red-600 hover:text-red-700 hover:bg-red-50"
                >
                  <X className="h-4 w-4" />
                </Button>
              </>
            )}
            {room.status === 'in_progress' && (
              <>
                <Button 
                  onClick={() => onUpdateStatus(room.id, 'clean', notes || undefined)}
                  className="flex-1 bg-gradient-to-r from-green-600 to-green-700 hover:from-green-700 hover:to-green-800 shadow-md"
                  size="sm"
                >
                  <CheckCircle className="h-4 w-4 mr-2" />
                  Terminer
                </Button>
                <Button 
                  onClick={() => onUnassign(room.id, room.room_number)}
                  variant="ghost"
                  size="sm"
                  className="text-red-600 hover:text-red-700 hover:bg-red-50"
                >
                  <X className="h-4 w-4" />
                </Button>
              </>
            )}
            {room.status === 'clean' && (
              <div className="flex items-center justify-center w-full text-green-700 py-2 bg-green-50/80 rounded-lg">
                <CheckCircle className="h-5 w-5 mr-2" />
                <span className="font-semibold">Chambre terminée ✨</span>
              </div>
            )}
          </div>

          {/* Swipe hints */}
          {room.status === 'in_progress' && (
            <p className="text-xs text-center text-muted-foreground flex items-center justify-center gap-1 pt-1">
              👉 Glissez vers la droite pour terminer rapidement
            </p>
          )}
          {room.status === 'dirty' && (
            <p className="text-xs text-center text-muted-foreground flex items-center justify-center gap-1 pt-1">
              💡 Glissez court pour commencer, glissez long pour terminer
            </p>
          )}
        </div>
      </div>
    </div>
  );
};
