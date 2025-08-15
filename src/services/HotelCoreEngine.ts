import { supabase } from '@/integrations/supabase/client';

export interface Room {
  id: string;
  hotel_id: string;
  room_number: string;
  floor?: number;
  room_type: string;
  status: 'available' | 'occupied' | 'cleaning' | 'maintenance' | 'out_of_order';
  cleaning_priority: 1 | 2 | 3 | 4;
  estimated_time: number;
  notes?: string;
  last_cleaned_at?: string;
  created_at: string;
  updated_at: string;
}

export interface Assignment {
  id: string;
  hotel_id: string;
  room_id: string;
  housekeeper_name: string;
  housekeeper_id?: string;
  assigned_at: string;
  started_at?: string;
  completed_at?: string;
  status: string;
  estimated_duration: number;
  actual_duration?: number;
  notes?: string;
  assigned_by?: string;
  room?: Room;
}

export interface Activity {
  id: string;
  hotel_id: string;
  activity_type: string;
  entity_type: string;
  entity_id: string;
  actor_name?: string;
  actor_type: string;
  details: any;
  timestamp: string;
}

export interface Hotel {
  id: string;
  name: string;
  email: string;
  address?: string;
  status: string;
  settings: {
    auto_assign: boolean;
    notification_enabled: boolean;
  };
  user_id: string;
  created_at: string;
  updated_at: string;
}

export interface HotelState {
  hotel: Hotel | null;
  rooms: Room[];
  assignments: Assignment[];
  activities: Activity[];
  housekeepers: string[];
  loading: boolean;
  error: string | null;
}

type StateListener = (state: HotelState) => void;

class HotelCoreEngine {
  private static instance: HotelCoreEngine;
  private state: HotelState = {
    hotel: null,
    rooms: [],
    assignments: [],
    activities: [],
    housekeepers: [],
    loading: false,
    error: null,
  };
  private listeners: StateListener[] = [];

  private constructor() {}

  static getInstance(): HotelCoreEngine {
    if (!HotelCoreEngine.instance) {
      HotelCoreEngine.instance = new HotelCoreEngine();
    }
    return HotelCoreEngine.instance;
  }

  // State management
  getState(): HotelState {
    return { ...this.state };
  }

  subscribe(listener: StateListener): () => void {
    this.listeners.push(listener);
    return () => {
      this.listeners = this.listeners.filter(l => l !== listener);
    };
  }

  private setState(partial: Partial<HotelState>) {
    this.state = { ...this.state, ...partial };
    this.listeners.forEach(listener => listener(this.state));
  }

  private async logActivity(
    activityType: string,
    entityType: string,
    entityId: string,
    actorName?: string,
    details: Record<string, any> = {}
  ) {
    if (!this.state.hotel) return;

    try {
      await supabase.rpc('log_activity', {
        p_hotel_id: this.state.hotel.id,
        p_activity_type: activityType,
        p_entity_type: entityType,
        p_entity_id: entityId,
        p_actor_name: actorName,
        p_actor_type: actorName ? 'housekeeper' : 'admin',
        p_details: details
      });
    } catch (error) {
      console.error('Failed to log activity:', error);
    }
  }

  // Hotel initialization
  async initializeHotel(userId: string): Promise<void> {
    this.setState({ loading: true, error: null });

    try {
      // Get or create hotel
      const { data: hotels, error: hotelError } = await supabase
        .from('hotels')
        .select('*')
        .eq('user_id', userId)
        .limit(1);

      if (hotelError) throw hotelError;

      let hotel = hotels?.[0];
      if (!hotel) {
        // Create default hotel
        const { data: newHotel, error: createError } = await supabase
          .from('hotels')
          .insert({
            name: 'Mon Hôtel',
            email: '', // Will be updated
            user_id: userId,
            status: 'active',
            settings: { auto_assign: true, notification_enabled: true }
          })
          .select()
          .single();

        if (createError) throw createError;
        hotel = newHotel;
      }

      this.setState({ hotel: hotel as any });
      await this.loadHotelData();
    } catch (error) {
      console.error('Failed to initialize hotel:', error);
      this.setState({ error: 'Failed to initialize hotel', loading: false });
    }
  }

  private async loadHotelData() {
    if (!this.state.hotel) return;

    try {
      // Load rooms, assignments, and recent activities in parallel
      const [roomsResponse, assignmentsResponse, activitiesResponse] = await Promise.all([
        supabase
          .from('rooms')
          .select('*')
          .eq('hotel_id', this.state.hotel.id)
          .order('room_number'),
        
        supabase
          .from('assignments')
          .select(`*, room:rooms(*)`)
          .eq('hotel_id', this.state.hotel.id)
          .order('created_at', { ascending: false }),
        
        supabase
          .from('activities')
          .select('*')
          .eq('hotel_id', this.state.hotel.id)
          .order('timestamp', { ascending: false })
          .limit(100)
      ]);

      const rooms = roomsResponse.data || [];
      const assignments = assignmentsResponse.data || [];
      const activities = activitiesResponse.data || [];

      // Extract unique housekeeper names
      const housekeepers = [...new Set(assignments.map(a => a.housekeeper_name))];

      this.setState({
        rooms: rooms as any,
        assignments: assignments as any,
        activities: activities as any,
        housekeepers,
        loading: false
      });
    } catch (error) {
      console.error('Failed to load hotel data:', error);
      this.setState({ error: 'Failed to load data', loading: false });
    }
  }

  // Room management
  async createRooms(roomNumbers: string[]): Promise<void> {
    if (!this.state.hotel) return;

    try {
      const roomsToCreate = roomNumbers.map(roomNumber => ({
        hotel_id: this.state.hotel!.id,
        room_number: roomNumber,
        status: 'available' as const,
        room_type: 'standard',
        cleaning_priority: 1,
        estimated_time: 30
      }));

      const { data, error } = await supabase
        .from('rooms')
        .insert(roomsToCreate)
        .select();

      if (error) throw error;

      this.setState({
        rooms: [...this.state.rooms, ...data as any]
      });

      await this.logActivity('rooms_created', 'hotel', this.state.hotel.id, undefined, {
        room_count: roomNumbers.length,
        room_numbers: roomNumbers
      });
    } catch (error) {
      console.error('Failed to create rooms:', error);
      throw error;
    }
  }

  async updateRoomStatus(roomId: string, status: Room['status'], actorName?: string): Promise<void> {
    if (!this.state.hotel) return;

    try {
      const { error } = await supabase
        .from('rooms')
        .update({ 
          status,
          ...(status === 'available' ? { last_cleaned_at: new Date().toISOString() } : {})
        })
        .eq('id', roomId);

      if (error) throw error;

      this.setState({
        rooms: this.state.rooms.map(room =>
          room.id === roomId 
            ? { ...room, status, ...(status === 'available' ? { last_cleaned_at: new Date().toISOString() } : {}) }
            : room
        )
      });

      await this.logActivity('room_status_changed', 'room', roomId, actorName, { status });
    } catch (error) {
      console.error('Failed to update room status:', error);
      throw error;
    }
  }

  // Assignment management
  async assignRooms(assignments: { roomId: string; housekeeperName: string }[]): Promise<void> {
    if (!this.state.hotel) return;

    try {
      const assignmentsToCreate = assignments.map(assignment => ({
        hotel_id: this.state.hotel!.id,
        room_id: assignment.roomId,
        housekeeper_name: assignment.housekeeperName,
        housekeeper_id: assignment.housekeeperName.toLowerCase().replace(/\s+/g, '_'),
        status: 'assigned' as const,
        estimated_duration: 30,
        assigned_by: null // Will be set by RLS
      }));

      const { data, error } = await supabase
        .from('assignments')
        .insert(assignmentsToCreate)
        .select(`*, room:rooms(*)`);

      if (error) throw error;

      // Update room statuses
      const roomIds = assignments.map(a => a.roomId);
      await supabase
        .from('rooms')
        .update({ status: 'cleaning' })
        .in('id', roomIds);

      this.setState({
        assignments: [...data as any, ...this.state.assignments],
        rooms: this.state.rooms.map(room =>
          roomIds.includes(room.id) ? { ...room, status: 'cleaning' as any } : room
        ),
        housekeepers: [...new Set([...this.state.housekeepers, ...assignments.map(a => a.housekeeperName)])]
      });

      for (const assignment of assignments) {
        await this.logActivity('room_assigned', 'assignment', data.find(d => d.room_id === assignment.roomId)?.id || '', undefined, {
          room_id: assignment.roomId,
          housekeeper_name: assignment.housekeeperName
        });
      }
    } catch (error) {
      console.error('Failed to assign rooms:', error);
      throw error;
    }
  }

  async updateAssignmentStatus(
    assignmentId: string, 
    status: Assignment['status'], 
    actorName?: string,
    notes?: string
  ): Promise<void> {
    try {
      const now = new Date().toISOString();
      const updateData: any = { status };

      if (status === 'in_progress') {
        updateData.started_at = now;
      } else if (status === 'completed') {
        updateData.completed_at = now;
        
        // Calculate actual duration if started
        const assignment = this.state.assignments.find(a => a.id === assignmentId);
        if (assignment?.started_at) {
          const startTime = new Date(assignment.started_at).getTime();
          const endTime = new Date(now).getTime();
          updateData.actual_duration = Math.round((endTime - startTime) / (1000 * 60)); // minutes
        }
      }

      if (notes) {
        updateData.notes = notes;
      }

      const { error } = await supabase
        .from('assignments')
        .update(updateData)
        .eq('id', assignmentId);

      if (error) throw error;

      // Update room status if completed
      const assignment = this.state.assignments.find(a => a.id === assignmentId);
      if (assignment && status === 'completed') {
        await this.updateRoomStatus(assignment.room_id, 'available', actorName);
      }

      this.setState({
        assignments: this.state.assignments.map(a =>
          a.id === assignmentId ? { ...a, ...updateData } : a
        )
      });

      await this.logActivity('assignment_status_changed', 'assignment', assignmentId, actorName, { 
        status, 
        notes,
        room_id: assignment?.room_id 
      });
    } catch (error) {
      console.error('Failed to update assignment status:', error);
      throw error;
    }
  }

  // Auto-assignment algorithm
  async autoAssignRooms(housekeeperNames: string[]): Promise<void> {
    if (!this.state.hotel || housekeeperNames.length === 0) return;

    const availableRooms = this.state.rooms.filter(room => 
      room.status === 'occupied' || room.status === 'available'
    );

    if (availableRooms.length === 0) return;

    // Sort rooms by priority and floor for efficient cleaning paths
    const sortedRooms = availableRooms.sort((a, b) => {
      if (a.cleaning_priority !== b.cleaning_priority) {
        return b.cleaning_priority - a.cleaning_priority; // Higher priority first
      }
      return (a.floor || 0) - (b.floor || 0); // Same floor together
    });

    // Distribute rooms evenly among housekeepers
    const assignments: { roomId: string; housekeeperName: string }[] = [];
    const roomsPerHousekeeper = Math.ceil(sortedRooms.length / housekeeperNames.length);

    sortedRooms.forEach((room, index) => {
      const housekeeperIndex = Math.floor(index / roomsPerHousekeeper);
      const housekeeperName = housekeeperNames[housekeeperIndex] || housekeeperNames[housekeeperNames.length - 1];
      
      assignments.push({
        roomId: room.id,
        housekeeperName
      });
    });

    await this.assignRooms(assignments);
  }

  // PDF processing for room data
  async processRoomData(roomData: any[]): Promise<void> {
    if (!this.state.hotel) return;

    try {
      // Extract room numbers and create rooms if they don't exist
      const roomNumbers = roomData.map(item => item.room_number || item.chambre || item.numero);
      const existingRoomNumbers = this.state.rooms.map(r => r.room_number);
      const newRoomNumbers = roomNumbers.filter(num => !existingRoomNumbers.includes(num));

      if (newRoomNumbers.length > 0) {
        await this.createRooms(newRoomNumbers);
      }

      // Update room statuses based on PDF data
      for (const item of roomData) {
        const roomNumber = item.room_number || item.chambre || item.numero;
        const room = this.state.rooms.find(r => r.room_number === roomNumber);
        
        if (room) {
          let status: Room['status'] = 'available';
          let priority = 1;

          // Determine status from PDF data
          if (item.status === 'occupied' || item.guest_count > 0) {
            status = 'occupied';
          } else if (item.dirty || item.checkout) {
            status = 'cleaning';
            priority = item.priority || 2;
          }

          await supabase
            .from('rooms')
            .update({ 
              status, 
              cleaning_priority: priority,
              notes: item.notes || null
            })
            .eq('id', room.id);
        }
      }

      await this.loadHotelData(); // Refresh data
      await this.logActivity('pdf_processed', 'hotel', this.state.hotel.id, undefined, {
        rooms_processed: roomData.length,
        new_rooms_created: newRoomNumbers.length
      });
    } catch (error) {
      console.error('Failed to process room data:', error);
      throw error;
    }
  }

  // Get housekeeper assignments for mobile app
  getHousekeeperAssignments(housekeeperName: string): Assignment[] {
    return this.state.assignments.filter(
      assignment => 
        assignment.housekeeper_name === housekeeperName &&
        assignment.status !== 'completed'
    );
  }

  // Reset everything (for debugging)
  reset() {
    this.state = {
      hotel: null,
      rooms: [],
      assignments: [],
      activities: [],
      housekeepers: [],
      loading: false,
      error: null,
    };
    this.listeners.forEach(listener => listener(this.state));
  }
}

export const hotelCoreEngine = HotelCoreEngine.getInstance();
