import { supabase } from "@/integrations/supabase/client";
import { toast } from "@/hooks/use-toast";

export interface Room {
  id: string;
  room_number: string;
  status: 'dirty' | 'cleaning' | 'clean' | 'maintenance' | 'available';
  cleaning_priority: number;
  notes?: string;
  assignedTo?: string;
  floor?: number;
  cleaningType?: 'full' | 'quick' | 'none';
  estimated_time?: number;
}

export interface Housekeeper {
  id: string;
  name: string;
  access_code: string;
  is_active: boolean;
  hotel_id: string;
}

export interface WorkflowState {
  hotel: any;
  rooms: Room[];
  housekeepers: Housekeeper[];
  isAnalyzed: boolean;
  isDistributed: boolean;
}

class WorkflowServiceClass {
  private state: WorkflowState = {
    hotel: null,
    rooms: [],
    housekeepers: [],
    isAnalyzed: false,
    isDistributed: false
  };

  private listeners: ((state: WorkflowState) => void)[] = [];

  subscribe(callback: (state: WorkflowState) => void) {
    this.listeners.push(callback);
    return () => {
      this.listeners = this.listeners.filter(l => l !== callback);
    };
  }

  private notify() {
    this.listeners.forEach(listener => listener(this.state));
  }

  getState() {
    return this.state;
  }

  // Étape 1: Connexion client et récupération hôtel
  async connectClient(hotelCode: string) {
    try {
      const { data: hotel, error } = await supabase
        .from('hotels')
        .select('*')
        .eq('hotel_code', hotelCode.toUpperCase())
        .single();

      if (error || !hotel) {
        throw new Error('Hôtel non trouvé');
      }

      this.state.hotel = hotel;
      await this.loadExistingData();
      this.notify();

      toast({
        title: "Connexion réussie",
        description: `Connecté à ${hotel.name}`
      });

      return hotel;
    } catch (error) {
      console.error('Erreur connexion:', error);
      toast({
        variant: "destructive",
        title: "Erreur de connexion",
        description: "Code hôtel invalide"
      });
      throw error;
    }
  }

  // Étape 2: Analyse du rapport PDF
  async analyzeReport(pdfFile: File): Promise<Room[]> {
    try {
      // Simulation d'analyse PDF - ici tu peux intégrer ton service PDF existant
      const rooms = await this.mockPdfAnalysis(pdfFile);
      
      this.state.rooms = rooms;
      this.state.isAnalyzed = true;
      this.notify();

      toast({
        title: "Rapport analysé",
        description: `${rooms.length} chambres détectées`
      });

      return rooms;
    } catch (error) {
      console.error('Erreur analyse PDF:', error);
      toast({
        variant: "destructive",
        title: "Erreur d'analyse",
        description: "Impossible d'analyser le rapport"
      });
      throw error;
    }
  }

  // Étape 3: Gestion du personnel (existing + nouveau)
  async loadHousekeepers() {
    if (!this.state.hotel) return [];

    try {
      const { data: housekeepers, error } = await supabase
        .from('housekeepers')
        .select(`
          id, name, access_code, is_active, hotel_id,
          housekeeper_access_codes!inner(access_code, is_active, expires_at)
        `)
        .eq('hotel_id', this.state.hotel.id)
        .eq('is_active', true);

      if (error) throw error;

      // Filtrer ceux avec codes actifs et non expirés
      const activeHousekeepers = (housekeepers || []).filter((hk: any) => 
        hk.housekeeper_access_codes.some((code: any) => 
          code.is_active && (!code.expires_at || new Date(code.expires_at) > new Date())
        )
      );

      this.state.housekeepers = activeHousekeepers.map((hk: any) => ({
        id: hk.id,
        name: hk.name,
        access_code: hk.access_code || hk.housekeeper_access_codes[0]?.access_code,
        is_active: hk.is_active,
        hotel_id: hk.hotel_id
      }));

      this.notify();
      return this.state.housekeepers;
    } catch (error) {
      console.error('Erreur chargement femmes de chambre:', error);
      return [];
    }
  }

  async createHousekeeper(name: string): Promise<Housekeeper> {
    if (!this.state.hotel) throw new Error('Hôtel non connecté');

    try {
      // Générer code d'accès permanent
      const { data: accessCode, error: codeError } = await supabase
        .rpc('generate_permanent_access_code', {
          p_hotel_id: this.state.hotel.id,
          p_housekeeper_name: name
        });

      if (codeError) throw codeError;

      // Créer femme de chambre
      const { data: housekeeper, error: hkError } = await supabase
        .from('housekeepers')
        .insert({
          hotel_id: this.state.hotel.id,
          name: name,
          access_code: accessCode,
          user_id: this.state.hotel.user_id,
          is_active: true
        })
        .select()
        .single();

      if (hkError) throw hkError;

      const newHousekeeper: Housekeeper = {
        id: housekeeper.id,
        name: housekeeper.name,
        access_code: accessCode,
        is_active: true,
        hotel_id: housekeeper.hotel_id
      };

      this.state.housekeepers.push(newHousekeeper);
      this.notify();

      toast({
        title: "Femme de chambre ajoutée",
        description: `${name} - Code: ${accessCode}`
      });

      return newHousekeeper;
    } catch (error) {
      console.error('Erreur création femme de chambre:', error);
      toast({
        variant: "destructive",
        title: "Erreur création",
        description: "Impossible de créer la femme de chambre"
      });
      throw error;
    }
  }

  // Étape 4: Distribution des chambres
  async distributeRooms(method: 'random' | 'floor' | 'balanced' = 'balanced') {
    if (!this.state.isAnalyzed || this.state.housekeepers.length === 0) {
      throw new Error('Analyse et personnel requis');
    }

    try {
      const roomsToAssign = this.state.rooms.filter(r => r.status === 'dirty');
      const activeHousekeepers = this.state.housekeepers.filter(h => h.is_active);

      // Distribution intelligente
      const assignments = this.calculateDistribution(roomsToAssign, activeHousekeepers, method);

      // Sauvegarder les assignations
      for (const [housekeeperId, roomIds] of assignments.entries()) {
        for (const roomId of roomIds) {
          await supabase
            .from('assignments')
            .insert({
              hotel_id: this.state.hotel.id,
              room_id: roomId,
              housekeeper_id: housekeeperId,
              housekeeper_name: activeHousekeepers.find(h => h.id === housekeeperId)?.name,
              status: 'assigned'
            });
        }
      }

      // Mettre à jour l'état local
      this.state.rooms = this.state.rooms.map(room => {
        const assignment = Array.from(assignments.entries()).find(([_, roomIds]) => 
          roomIds.includes(room.id)
        );
        if (assignment) {
          const housekeeper = activeHousekeepers.find(h => h.id === assignment[0]);
          return { ...room, assignedTo: housekeeper?.name };
        }
        return room;
      });

      this.state.isDistributed = true;
      this.notify();

      toast({
        title: "Distribution terminée",
        description: `${roomsToAssign.length} chambres assignées`
      });

      return this.state;
    } catch (error) {
      console.error('Erreur distribution:', error);
      toast({
        variant: "destructive",
        title: "Erreur distribution",
        description: "Impossible de distribuer les chambres"
      });
      throw error;
    }
  }

  // Méthodes utilitaires privées
  private async loadExistingData() {
    if (!this.state.hotel) return;

    // Charger chambres existantes
    const { data: rooms } = await supabase
      .from('rooms')
      .select('*')
      .eq('hotel_id', this.state.hotel.id);

    if (rooms) {
      this.state.rooms = rooms.map(r => ({
        id: r.id,
        room_number: r.room_number,
        status: (r.status as 'dirty' | 'cleaning' | 'clean' | 'maintenance' | 'available') || 'dirty',
        cleaning_priority: r.cleaning_priority || 1,
        notes: r.notes,
        floor: r.floor
      }));
    }

    // Charger femmes de chambre
    await this.loadHousekeepers();
  }

  private async mockPdfAnalysis(file: File): Promise<Room[]> {
    // Simulation - remplace par ton vrai service PDF
    return [
      { id: '1', room_number: '101', status: 'dirty', cleaning_priority: 1, cleaningType: 'full' },
      { id: '2', room_number: '102', status: 'dirty', cleaning_priority: 2, cleaningType: 'quick' },
      { id: '3', room_number: '201', status: 'dirty', cleaning_priority: 1, cleaningType: 'full' },
    ];
  }

  private calculateDistribution(
    rooms: Room[], 
    housekeepers: Housekeeper[], 
    method: string
  ): Map<string, string[]> {
    const assignments = new Map<string, string[]>();
    
    // Initialiser
    housekeepers.forEach(h => assignments.set(h.id, []));

    switch (method) {
      case 'random':
        rooms.forEach((room, index) => {
          const hk = housekeepers[index % housekeepers.length];
          assignments.get(hk.id)?.push(room.id);
        });
        break;

      case 'floor':
        // Grouper par étage si disponible
        const roomsByFloor = new Map<number, Room[]>();
        rooms.forEach(room => {
          const floor = room.floor || 1;
          if (!roomsByFloor.has(floor)) roomsByFloor.set(floor, []);
          roomsByFloor.get(floor)?.push(room);
        });

        let hkIndex = 0;
        roomsByFloor.forEach(floorRooms => {
          const hk = housekeepers[hkIndex % housekeepers.length];
          floorRooms.forEach(room => assignments.get(hk.id)?.push(room.id));
          hkIndex++;
        });
        break;

      case 'balanced':
      default:
        // Distribution équilibrée par charge de travail
        const roomsPerHousekeeper = Math.ceil(rooms.length / housekeepers.length);
        rooms.forEach((room, index) => {
          const hkIndex = Math.floor(index / roomsPerHousekeeper);
          const hk = housekeepers[Math.min(hkIndex, housekeepers.length - 1)];
          assignments.get(hk.id)?.push(room.id);
        });
        break;
    }

    return assignments;
  }

  // Reset pour nouveau workflow
  reset() {
    this.state = {
      hotel: null,
      rooms: [],
      housekeepers: [],
      isAnalyzed: false,
      isDistributed: false
    };
    this.notify();
  }

  // Générer QR codes pour accès mobile
  generateAccessQRCode(housekeeper: Housekeeper): string {
    const baseUrl = window.location.origin;
    return `${baseUrl}/mobile?code=${housekeeper.access_code}&hotel=${this.state.hotel?.hotel_code}`;
  }
}

export const WorkflowService = new WorkflowServiceClass();