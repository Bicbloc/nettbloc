import { supabase } from "@/integrations/supabase/client";
import { toast } from "@/hooks/use-toast";

export interface MobileRoom {
  id: string;
  room_number: string;
  status: 'assigned' | 'in_progress' | 'completed' | 'pending';
  priority: 'low' | 'medium' | 'high' | 'urgent';
  notes?: string;
  estimated_time?: number;
  started_at?: string;
  completed_at?: string;
}

export interface MobileSession {
  hotelId: string;
  hotelName: string;
  housekeeperId: string;
  housekeeperName: string;
  accessCode: string;
  rooms: MobileRoom[];
  totalRooms: number;
  completedRooms: number;
  isOnline: boolean;
  lastSync: Date;
}

class MobileOptimizerClass {
  private session: MobileSession | null = null;
  private syncQueue: any[] = [];
  private syncInterval: NodeJS.Timeout | null = null;

  // Authentifier et initialiser session mobile
  async authenticateForMobile(accessCode: string): Promise<MobileSession> {
    try {
      // Utiliser le service d'authentification amélioré
      const { data: authResult, error } = await supabase
        .rpc('authenticate_housekeeper_by_code', {
          p_access_code: accessCode.trim().toUpperCase()
        });

      if (error || !authResult?.[0]?.success) {
        throw new Error('Code d\'accès invalide');
      }

      const result = authResult[0];
      
      // Charger les chambres assignées
      const rooms = await this.loadAssignedRooms(result.hotel_id, result.housekeeper_id);

      this.session = {
        hotelId: result.hotel_id,
        hotelName: result.hotel_name,
        housekeeperId: result.housekeeper_id,
        housekeeperName: result.housekeeper_name,
        accessCode: result.resolved_access_code,
        rooms,
        totalRooms: rooms.length,
        completedRooms: rooms.filter(r => r.status === 'completed').length,
        isOnline: navigator.onLine,
        lastSync: new Date()
      };

      // Démarrer synchronisation périodique
      this.startPeriodicSync();

      // Sauvegarder en local pour mode hors ligne
      this.saveSessionLocally();

      toast({
        title: "Connexion réussie",
        description: `Bienvenue ${result.housekeeper_name}!`
      });

      return this.session;
    } catch (error) {
      console.error('Erreur auth mobile:', error);
      toast({
        variant: "destructive",
        title: "Erreur de connexion",
        description: "Code d'accès invalide"
      });
      throw error;
    }
  }

  // Charger les chambres assignées à une femme de chambre
  private async loadAssignedRooms(hotelId: string, housekeeperId: string): Promise<MobileRoom[]> {
    try {
      const { data: assignments, error } = await supabase
        .from('assignments')
        .select(`
          id, status, started_at, completed_at, notes,
          rooms!inner(id, room_number, cleaning_priority)
        `)
        .eq('hotel_id', hotelId)
        .eq('housekeeper_id', housekeeperId)
        .in('status', ['assigned', 'in_progress', 'completed'])
        .order('created_at', { ascending: false });

      if (error) throw error;

      return (assignments || []).map((a: any) => ({
        id: a.rooms.id,
        room_number: a.rooms.room_number,
        status: a.status,
        priority: this.getPriorityLevel(a.rooms.cleaning_priority),
        notes: a.notes,
        estimated_time: 30, // Par défaut
        started_at: a.started_at,
        completed_at: a.completed_at
      }));
    } catch (error) {
      console.error('Erreur chargement chambres:', error);
      return [];
    }
  }

  // Mettre à jour le statut d'une chambre
  async updateRoomStatus(roomId: string, newStatus: 'in_progress' | 'completed'): Promise<void> {
    if (!this.session) throw new Error('Session non initialisée');

    const update = {
      roomId,
      newStatus,
      timestamp: new Date().toISOString(),
      housekeeperId: this.session.housekeeperId,
      hotelId: this.session.hotelId
    };

    // Si hors ligne, ajouter à la queue
    if (!navigator.onLine) {
      this.syncQueue.push(update);
      this.saveSessionLocally();
      toast({
        title: "Hors ligne",
        description: "Changement sauvegardé localement"
      });
      return;
    }

    try {
      await this.processSingleUpdate(update);
      
      // Mettre à jour session locale
      this.session.rooms = this.session.rooms.map(room => 
        room.id === roomId 
          ? { 
              ...room, 
              status: newStatus,
              started_at: newStatus === 'in_progress' ? update.timestamp : room.started_at,
              completed_at: newStatus === 'completed' ? update.timestamp : room.completed_at
            }
          : room
      );
      
      this.session.completedRooms = this.session.rooms.filter(r => r.status === 'completed').length;
      this.session.lastSync = new Date();
      this.saveSessionLocally();

      toast({
        title: "Statut mis à jour", 
        description: `Chambre ${this.session.rooms.find(r => r.id === roomId)?.room_number} - ${newStatus}`
      });
    } catch (error) {
      console.error('Erreur mise à jour statut:', error);
      // En cas d'erreur, ajouter à la queue pour retry
      this.syncQueue.push(update);
      this.saveSessionLocally();
      
      toast({
        variant: "destructive",
        title: "Erreur synchronisation",
        description: "Changement mis en queue"
      });
    }
  }

  // Traiter une mise à jour individuelle
  private async processSingleUpdate(update: any): Promise<void> {
    const { error: assignmentError } = await supabase
      .from('assignments')
      .update({
        status: update.newStatus,
        ...(update.newStatus === 'in_progress' && { started_at: update.timestamp }),
        ...(update.newStatus === 'completed' && { completed_at: update.timestamp })
      })
      .eq('hotel_id', update.hotelId)
      .eq('room_id', update.roomId)
      .eq('housekeeper_id', update.housekeeperId);

    if (assignmentError) throw assignmentError;

    // Mettre à jour également la table rooms
    const roomStatus = update.newStatus === 'completed' ? 'clean' : 
                      update.newStatus === 'in_progress' ? 'cleaning' : 'dirty';

    const { error: roomError } = await supabase
      .from('rooms')
      .update({ 
        status: roomStatus,
        last_cleaned_at: update.newStatus === 'completed' ? update.timestamp : undefined
      })
      .eq('id', update.roomId);

    if (roomError) throw roomError;

    // Logger l'activité
    await supabase.rpc('log_housekeeper_action', {
      p_hotel_id: update.hotelId,
      p_type: update.newStatus === 'in_progress' ? 'cleaning-start' : 'cleaning-end',
      p_housekeeper_name: this.session?.housekeeperName,
      p_room_number: this.session?.rooms.find(r => r.id === update.roomId)?.room_number
    });
  }

  // Synchronisation périodique et gestion offline
  private startPeriodicSync(): void {
    this.syncInterval = setInterval(() => {
      if (navigator.onLine && this.syncQueue.length > 0) {
        this.processSyncQueue();
      }
    }, 30000); // Toutes les 30 secondes
  }

  private async processSyncQueue(): Promise<void> {
    if (this.syncQueue.length === 0) return;

    const toProcess = [...this.syncQueue];
    this.syncQueue = [];

    for (const update of toProcess) {
      try {
        await this.processSingleUpdate(update);
      } catch (error) {
        console.error('Erreur sync queue item:', error);
        // Remettre en queue en cas d'échec
        this.syncQueue.push(update);
      }
    }

    if (this.session) {
      this.session.lastSync = new Date();
      this.saveSessionLocally();
    }

    if (toProcess.length > this.syncQueue.length) {
      toast({
        title: "Synchronisé",
        description: `${toProcess.length - this.syncQueue.length} changements synchronisés`
      });
    }
  }

  // Sauvegarde locale pour mode hors ligne
  private saveSessionLocally(): void {
    if (!this.session) return;
    
    localStorage.setItem('mobileSession', JSON.stringify({
      ...this.session,
      syncQueue: this.syncQueue
    }));
  }

  // Restaurer session depuis le stockage local
  async restoreSession(): Promise<MobileSession | null> {
    try {
      const stored = localStorage.getItem('mobileSession');
      if (!stored) return null;

      const data = JSON.parse(stored);
      this.session = {
        ...data,
        lastSync: new Date(data.lastSync),
        isOnline: navigator.onLine
      };
      
      this.syncQueue = data.syncQueue || [];
      this.startPeriodicSync();

      return this.session;
    } catch (error) {
      console.error('Erreur restauration session:', error);
      return null;
    }
  }

  // Utilitaires
  private getPriorityLevel(priority: number): 'low' | 'medium' | 'high' | 'urgent' {
    if (priority <= 1) return 'low';
    if (priority === 2) return 'medium'; 
    if (priority === 3) return 'high';
    return 'urgent';
  }

  getSession(): MobileSession | null {
    return this.session;
  }

  getSyncQueueSize(): number {
    return this.syncQueue.length;
  }

  // Nettoyage
  logout(): void {
    if (this.syncInterval) {
      clearInterval(this.syncInterval);
    }
    this.session = null;
    this.syncQueue = [];
    localStorage.removeItem('mobileSession');
  }

  // Statistiques de performance
  getPerformanceStats() {
    if (!this.session) return null;

    const completed = this.session.rooms.filter(r => r.status === 'completed');
    const inProgress = this.session.rooms.filter(r => r.status === 'in_progress');
    const pending = this.session.rooms.filter(r => r.status === 'assigned');

    const averageTime = completed.reduce((acc, room) => {
      if (room.started_at && room.completed_at) {
        const duration = new Date(room.completed_at).getTime() - new Date(room.started_at).getTime();
        return acc + duration;
      }
      return acc;
    }, 0) / (completed.length || 1);

    return {
      total: this.session.totalRooms,
      completed: completed.length,
      inProgress: inProgress.length,
      pending: pending.length,
      completionRate: (completed.length / this.session.totalRooms) * 100,
      averageTimePerRoom: averageTime / (1000 * 60), // en minutes
      syncQueueSize: this.syncQueue.length,
      lastSync: this.session.lastSync,
      isOnline: navigator.onLine
    };
  }
}

export const MobileOptimizer = new MobileOptimizerClass();