export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  // Allows to automatically instantiate createClient with right options
  // instead of createClient<Database, { PostgrestVersion: 'XX' }>(URL, KEY)
  __InternalSupabase: {
    PostgrestVersion: "12.2.3 (519615d)"
  }
  public: {
    Tables: {
      achievement_badges: {
        Row: {
          category: string
          code: string
          created_at: string | null
          criteria: Json
          description: string
          icon: string
          id: string
          name: string
          points: number
          rarity: string
        }
        Insert: {
          category: string
          code: string
          created_at?: string | null
          criteria: Json
          description: string
          icon: string
          id?: string
          name: string
          points?: number
          rarity?: string
        }
        Update: {
          category?: string
          code?: string
          created_at?: string | null
          criteria?: Json
          description?: string
          icon?: string
          id?: string
          name?: string
          points?: number
          rarity?: string
        }
        Relationships: []
      }
      activities: {
        Row: {
          activity_type: string
          actor_name: string | null
          actor_type: string | null
          created_at: string
          details: Json | null
          entity_id: string
          entity_type: string
          hotel_id: string
          id: string
          metadata: Json | null
          timestamp: string
        }
        Insert: {
          activity_type: string
          actor_name?: string | null
          actor_type?: string | null
          created_at?: string
          details?: Json | null
          entity_id: string
          entity_type: string
          hotel_id: string
          id?: string
          metadata?: Json | null
          timestamp?: string
        }
        Update: {
          activity_type?: string
          actor_name?: string | null
          actor_type?: string | null
          created_at?: string
          details?: Json | null
          entity_id?: string
          entity_type?: string
          hotel_id?: string
          id?: string
          metadata?: Json | null
          timestamp?: string
        }
        Relationships: [
          {
            foreignKeyName: "activities_hotel_id_fkey"
            columns: ["hotel_id"]
            isOneToOne: false
            referencedRelation: "hotels"
            referencedColumns: ["id"]
          },
        ]
      }
      admin_audit_log: {
        Row: {
          action: string
          admin_user_id: string
          created_at: string
          details: Json | null
          id: string
          target_user_id: string | null
        }
        Insert: {
          action: string
          admin_user_id: string
          created_at?: string
          details?: Json | null
          id?: string
          target_user_id?: string | null
        }
        Update: {
          action?: string
          admin_user_id?: string
          created_at?: string
          details?: Json | null
          id?: string
          target_user_id?: string | null
        }
        Relationships: []
      }
      archived_daily_logs: {
        Row: {
          archive_date: string
          created_at: string
          hotel_id: string
          id: string
          logs_data: Json
          summary: Json | null
        }
        Insert: {
          archive_date: string
          created_at?: string
          hotel_id: string
          id?: string
          logs_data?: Json
          summary?: Json | null
        }
        Update: {
          archive_date?: string
          created_at?: string
          hotel_id?: string
          id?: string
          logs_data?: Json
          summary?: Json | null
        }
        Relationships: [
          {
            foreignKeyName: "archived_daily_logs_hotel_id_fkey"
            columns: ["hotel_id"]
            isOneToOne: false
            referencedRelation: "hotels"
            referencedColumns: ["id"]
          },
        ]
      }
      assignments: {
        Row: {
          actual_duration: number | null
          assigned_at: string
          assigned_by: string | null
          completed_at: string | null
          created_at: string
          estimated_duration: number | null
          hotel_id: string
          housekeeper_id: string | null
          housekeeper_name: string
          id: string
          notes: string | null
          room_id: string
          started_at: string | null
          status: string
          updated_at: string
        }
        Insert: {
          actual_duration?: number | null
          assigned_at?: string
          assigned_by?: string | null
          completed_at?: string | null
          created_at?: string
          estimated_duration?: number | null
          hotel_id: string
          housekeeper_id?: string | null
          housekeeper_name: string
          id?: string
          notes?: string | null
          room_id: string
          started_at?: string | null
          status?: string
          updated_at?: string
        }
        Update: {
          actual_duration?: number | null
          assigned_at?: string
          assigned_by?: string | null
          completed_at?: string | null
          created_at?: string
          estimated_duration?: number | null
          hotel_id?: string
          housekeeper_id?: string | null
          housekeeper_name?: string
          id?: string
          notes?: string | null
          room_id?: string
          started_at?: string | null
          status?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "assignments_hotel_id_fkey"
            columns: ["hotel_id"]
            isOneToOne: false
            referencedRelation: "hotels"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "assignments_room_id_fkey"
            columns: ["room_id"]
            isOneToOne: false
            referencedRelation: "rooms"
            referencedColumns: ["id"]
          },
        ]
      }
      connected_room_rules: {
        Row: {
          created_at: string | null
          created_by: string
          description: string | null
          hotel_id: string
          id: string
          is_active: boolean | null
          pattern_regex: string
          priority: number | null
          rule_name: string
          rule_type: string
          updated_at: string | null
        }
        Insert: {
          created_at?: string | null
          created_by: string
          description?: string | null
          hotel_id: string
          id?: string
          is_active?: boolean | null
          pattern_regex: string
          priority?: number | null
          rule_name: string
          rule_type: string
          updated_at?: string | null
        }
        Update: {
          created_at?: string | null
          created_by?: string
          description?: string | null
          hotel_id?: string
          id?: string
          is_active?: boolean | null
          pattern_regex?: string
          priority?: number | null
          rule_name?: string
          rule_type?: string
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "connected_room_rules_hotel_id_fkey"
            columns: ["hotel_id"]
            isOneToOne: false
            referencedRelation: "hotels"
            referencedColumns: ["id"]
          },
        ]
      }
      daily_action_logs: {
        Row: {
          action_type: string
          actor_name: string | null
          actor_type: string | null
          created_at: string
          description: string
          details: Json | null
          hotel_id: string
          id: string
          log_date: string
          room_number: string | null
        }
        Insert: {
          action_type: string
          actor_name?: string | null
          actor_type?: string | null
          created_at?: string
          description: string
          details?: Json | null
          hotel_id: string
          id?: string
          log_date?: string
          room_number?: string | null
        }
        Update: {
          action_type?: string
          actor_name?: string | null
          actor_type?: string | null
          created_at?: string
          description?: string
          details?: Json | null
          hotel_id?: string
          id?: string
          log_date?: string
          room_number?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "daily_action_logs_hotel_id_fkey"
            columns: ["hotel_id"]
            isOneToOne: false
            referencedRelation: "hotels"
            referencedColumns: ["id"]
          },
        ]
      }
      daily_reports: {
        Row: {
          created_at: string | null
          hotel_id: string | null
          housekeeper_id: string | null
          id: string
          notes: string | null
          report_date: string
          room_data: Json | null
          summary: Json | null
          total_hours_worked: number | null
          total_rooms_cleaned: number | null
          updated_at: string | null
        }
        Insert: {
          created_at?: string | null
          hotel_id?: string | null
          housekeeper_id?: string | null
          id?: string
          notes?: string | null
          report_date?: string
          room_data?: Json | null
          summary?: Json | null
          total_hours_worked?: number | null
          total_rooms_cleaned?: number | null
          updated_at?: string | null
        }
        Update: {
          created_at?: string | null
          hotel_id?: string | null
          housekeeper_id?: string | null
          id?: string
          notes?: string | null
          report_date?: string
          room_data?: Json | null
          summary?: Json | null
          total_hours_worked?: number | null
          total_rooms_cleaned?: number | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "daily_reports_hotel_id_fkey"
            columns: ["hotel_id"]
            isOneToOne: false
            referencedRelation: "hotels"
            referencedColumns: ["id"]
          },
        ]
      }
      hotel_access_sessions: {
        Row: {
          access_code: string
          access_request_id: string | null
          approved_at: string | null
          approved_by: string | null
          created_at: string | null
          ended_at: string | null
          expires_at: string
          hotel_id: string | null
          housekeeper_profile_id: string | null
          id: string
          is_active: boolean | null
          rooms_cleaned_today: number | null
          session_token: string | null
          started_at: string | null
        }
        Insert: {
          access_code: string
          access_request_id?: string | null
          approved_at?: string | null
          approved_by?: string | null
          created_at?: string | null
          ended_at?: string | null
          expires_at: string
          hotel_id?: string | null
          housekeeper_profile_id?: string | null
          id?: string
          is_active?: boolean | null
          rooms_cleaned_today?: number | null
          session_token?: string | null
          started_at?: string | null
        }
        Update: {
          access_code?: string
          access_request_id?: string | null
          approved_at?: string | null
          approved_by?: string | null
          created_at?: string | null
          ended_at?: string | null
          expires_at?: string
          hotel_id?: string | null
          housekeeper_profile_id?: string | null
          id?: string
          is_active?: boolean | null
          rooms_cleaned_today?: number | null
          session_token?: string | null
          started_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "hotel_access_sessions_hotel_id_fkey"
            columns: ["hotel_id"]
            isOneToOne: false
            referencedRelation: "hotels"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "hotel_access_sessions_housekeeper_profile_id_fkey"
            columns: ["housekeeper_profile_id"]
            isOneToOne: false
            referencedRelation: "housekeeper_profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      hotel_rooms_registry: {
        Row: {
          building: string | null
          capacity: number | null
          created_at: string | null
          floor: number | null
          hotel_id: string
          id: string
          imported_at: string | null
          imported_from: string | null
          is_active: boolean | null
          last_seen_at: string | null
          metadata: Json | null
          room_number: string
          room_type: string | null
          source: string | null
          updated_at: string | null
          zone: string | null
        }
        Insert: {
          building?: string | null
          capacity?: number | null
          created_at?: string | null
          floor?: number | null
          hotel_id: string
          id?: string
          imported_at?: string | null
          imported_from?: string | null
          is_active?: boolean | null
          last_seen_at?: string | null
          metadata?: Json | null
          room_number: string
          room_type?: string | null
          source?: string | null
          updated_at?: string | null
          zone?: string | null
        }
        Update: {
          building?: string | null
          capacity?: number | null
          created_at?: string | null
          floor?: number | null
          hotel_id?: string
          id?: string
          imported_at?: string | null
          imported_from?: string | null
          is_active?: boolean | null
          last_seen_at?: string | null
          metadata?: Json | null
          room_number?: string
          room_type?: string | null
          source?: string | null
          updated_at?: string | null
          zone?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "hotel_rooms_registry_hotel_id_fkey"
            columns: ["hotel_id"]
            isOneToOne: false
            referencedRelation: "hotels"
            referencedColumns: ["id"]
          },
        ]
      }
      hotel_sessions: {
        Row: {
          created_at: string | null
          expires_at: string | null
          hotel_id: string | null
          housekeeper_assignments: Json | null
          housekeeper_names: Json | null
          id: string
          is_active: boolean | null
          last_activity: string | null
          session_token: string | null
          updated_at: string | null
          user_id: string | null
        }
        Insert: {
          created_at?: string | null
          expires_at?: string | null
          hotel_id?: string | null
          housekeeper_assignments?: Json | null
          housekeeper_names?: Json | null
          id?: string
          is_active?: boolean | null
          last_activity?: string | null
          session_token?: string | null
          updated_at?: string | null
          user_id?: string | null
        }
        Update: {
          created_at?: string | null
          expires_at?: string | null
          hotel_id?: string | null
          housekeeper_assignments?: Json | null
          housekeeper_names?: Json | null
          id?: string
          is_active?: boolean | null
          last_activity?: string | null
          session_token?: string | null
          updated_at?: string | null
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "hotel_sessions_hotel_id_fkey"
            columns: ["hotel_id"]
            isOneToOne: false
            referencedRelation: "hotels"
            referencedColumns: ["id"]
          },
        ]
      }
      hotel_users: {
        Row: {
          created_at: string | null
          hotel_id: string | null
          id: string
          invited_by: string | null
          joined_at: string | null
          permissions: Json | null
          role: string | null
          updated_at: string | null
          user_id: string | null
        }
        Insert: {
          created_at?: string | null
          hotel_id?: string | null
          id?: string
          invited_by?: string | null
          joined_at?: string | null
          permissions?: Json | null
          role?: string | null
          updated_at?: string | null
          user_id?: string | null
        }
        Update: {
          created_at?: string | null
          hotel_id?: string | null
          id?: string
          invited_by?: string | null
          joined_at?: string | null
          permissions?: Json | null
          role?: string | null
          updated_at?: string | null
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "hotel_users_hotel_id_fkey"
            columns: ["hotel_id"]
            isOneToOne: false
            referencedRelation: "hotels"
            referencedColumns: ["id"]
          },
        ]
      }
      hotels: {
        Row: {
          address: string | null
          created_at: string
          email: string
          hotel_code: string | null
          id: string
          name: string
          settings: Json | null
          status: string | null
          updated_at: string
          user_id: string | null
        }
        Insert: {
          address?: string | null
          created_at?: string
          email: string
          hotel_code?: string | null
          id?: string
          name: string
          settings?: Json | null
          status?: string | null
          updated_at?: string
          user_id?: string | null
        }
        Update: {
          address?: string | null
          created_at?: string
          email?: string
          hotel_code?: string | null
          id?: string
          name?: string
          settings?: Json | null
          status?: string | null
          updated_at?: string
          user_id?: string | null
        }
        Relationships: []
      }
      housekeeper_access_codes: {
        Row: {
          access_code: string
          created_at: string | null
          created_by: string | null
          expires_at: string | null
          hotel_id: string | null
          housekeeper_id: string | null
          id: string
          invitation_sent_at: string | null
          invited_email: string | null
          invited_name: string | null
          is_active: boolean | null
          updated_at: string | null
          used_at: string | null
        }
        Insert: {
          access_code: string
          created_at?: string | null
          created_by?: string | null
          expires_at?: string | null
          hotel_id?: string | null
          housekeeper_id?: string | null
          id?: string
          invitation_sent_at?: string | null
          invited_email?: string | null
          invited_name?: string | null
          is_active?: boolean | null
          updated_at?: string | null
          used_at?: string | null
        }
        Update: {
          access_code?: string
          created_at?: string | null
          created_by?: string | null
          expires_at?: string | null
          hotel_id?: string | null
          housekeeper_id?: string | null
          id?: string
          invitation_sent_at?: string | null
          invited_email?: string | null
          invited_name?: string | null
          is_active?: boolean | null
          updated_at?: string | null
          used_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "housekeeper_access_codes_hotel_id_fkey"
            columns: ["hotel_id"]
            isOneToOne: false
            referencedRelation: "hotels"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "housekeeper_access_codes_housekeeper_id_fkey"
            columns: ["housekeeper_id"]
            isOneToOne: false
            referencedRelation: "housekeepers"
            referencedColumns: ["id"]
          },
        ]
      }
      housekeeper_access_requests: {
        Row: {
          created_at: string | null
          hotel_code: string
          hotel_id: string | null
          housekeeper_profile_id: string | null
          id: string
          requested_at: string | null
          reviewed_at: string | null
          reviewed_by: string | null
          status: string | null
          updated_at: string | null
        }
        Insert: {
          created_at?: string | null
          hotel_code: string
          hotel_id?: string | null
          housekeeper_profile_id?: string | null
          id?: string
          requested_at?: string | null
          reviewed_at?: string | null
          reviewed_by?: string | null
          status?: string | null
          updated_at?: string | null
        }
        Update: {
          created_at?: string | null
          hotel_code?: string
          hotel_id?: string | null
          housekeeper_profile_id?: string | null
          id?: string
          requested_at?: string | null
          reviewed_at?: string | null
          reviewed_by?: string | null
          status?: string | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "housekeeper_access_requests_hotel_id_fkey"
            columns: ["hotel_id"]
            isOneToOne: false
            referencedRelation: "hotels"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "housekeeper_access_requests_housekeeper_profile_id_fkey"
            columns: ["housekeeper_profile_id"]
            isOneToOne: false
            referencedRelation: "housekeeper_profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      housekeeper_achievements: {
        Row: {
          badge_code: string
          created_at: string | null
          hotel_id: string
          housekeeper_id: string
          id: string
          progress: Json | null
          unlocked_at: string | null
        }
        Insert: {
          badge_code: string
          created_at?: string | null
          hotel_id: string
          housekeeper_id: string
          id?: string
          progress?: Json | null
          unlocked_at?: string | null
        }
        Update: {
          badge_code?: string
          created_at?: string | null
          hotel_id?: string
          housekeeper_id?: string
          id?: string
          progress?: Json | null
          unlocked_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "housekeeper_achievements_badge_code_fkey"
            columns: ["badge_code"]
            isOneToOne: false
            referencedRelation: "achievement_badges"
            referencedColumns: ["code"]
          },
          {
            foreignKeyName: "housekeeper_achievements_hotel_id_fkey"
            columns: ["hotel_id"]
            isOneToOne: false
            referencedRelation: "hotels"
            referencedColumns: ["id"]
          },
        ]
      }
      housekeeper_hotel_history: {
        Row: {
          created_at: string
          ended_at: string | null
          hotel_id: string
          housekeeper_profile_id: string
          id: string
          is_favorite: boolean
          notes: string | null
          rating: number | null
          rooms_cleaned: number
          started_at: string
          total_work_hours: number | null
          updated_at: string
        }
        Insert: {
          created_at?: string
          ended_at?: string | null
          hotel_id: string
          housekeeper_profile_id: string
          id?: string
          is_favorite?: boolean
          notes?: string | null
          rating?: number | null
          rooms_cleaned?: number
          started_at?: string
          total_work_hours?: number | null
          updated_at?: string
        }
        Update: {
          created_at?: string
          ended_at?: string | null
          hotel_id?: string
          housekeeper_profile_id?: string
          id?: string
          is_favorite?: boolean
          notes?: string | null
          rating?: number | null
          rooms_cleaned?: number
          started_at?: string
          total_work_hours?: number | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "housekeeper_hotel_history_hotel_id_fkey"
            columns: ["hotel_id"]
            isOneToOne: false
            referencedRelation: "hotels"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "housekeeper_hotel_history_housekeeper_profile_id_fkey"
            columns: ["housekeeper_profile_id"]
            isOneToOne: false
            referencedRelation: "housekeeper_profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      housekeeper_invitations: {
        Row: {
          access_code: string
          created_at: string | null
          created_by: string | null
          expires_at: string | null
          hotel_id: string | null
          id: string
          invited_email: string
          invited_name: string
          status: string | null
          updated_at: string | null
        }
        Insert: {
          access_code: string
          created_at?: string | null
          created_by?: string | null
          expires_at?: string | null
          hotel_id?: string | null
          id?: string
          invited_email: string
          invited_name: string
          status?: string | null
          updated_at?: string | null
        }
        Update: {
          access_code?: string
          created_at?: string | null
          created_by?: string | null
          expires_at?: string | null
          hotel_id?: string | null
          id?: string
          invited_email?: string
          invited_name?: string
          status?: string | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "housekeeper_invitations_hotel_id_fkey"
            columns: ["hotel_id"]
            isOneToOne: false
            referencedRelation: "hotels"
            referencedColumns: ["id"]
          },
        ]
      }
      housekeeper_levels: {
        Row: {
          best_streak: number
          created_at: string | null
          current_level: number
          current_streak: number
          hotel_id: string
          housekeeper_id: string
          id: string
          last_activity_date: string | null
          perfect_rooms_count: number
          rooms_cleaned_count: number
          speed_bonus_count: number
          total_xp: number
          updated_at: string | null
        }
        Insert: {
          best_streak?: number
          created_at?: string | null
          current_level?: number
          current_streak?: number
          hotel_id: string
          housekeeper_id: string
          id?: string
          last_activity_date?: string | null
          perfect_rooms_count?: number
          rooms_cleaned_count?: number
          speed_bonus_count?: number
          total_xp?: number
          updated_at?: string | null
        }
        Update: {
          best_streak?: number
          created_at?: string | null
          current_level?: number
          current_streak?: number
          hotel_id?: string
          housekeeper_id?: string
          id?: string
          last_activity_date?: string | null
          perfect_rooms_count?: number
          rooms_cleaned_count?: number
          speed_bonus_count?: number
          total_xp?: number
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "housekeeper_levels_hotel_id_fkey"
            columns: ["hotel_id"]
            isOneToOne: false
            referencedRelation: "hotels"
            referencedColumns: ["id"]
          },
        ]
      }
      housekeeper_profiles: {
        Row: {
          average_rating: number | null
          created_at: string
          email: string
          id: string
          is_active: boolean
          name: string
          phone: string | null
          profile_picture_url: string | null
          total_hotels_worked: number
          total_rooms_cleaned: number
          updated_at: string
        }
        Insert: {
          average_rating?: number | null
          created_at?: string
          email: string
          id?: string
          is_active?: boolean
          name: string
          phone?: string | null
          profile_picture_url?: string | null
          total_hotels_worked?: number
          total_rooms_cleaned?: number
          updated_at?: string
        }
        Update: {
          average_rating?: number | null
          created_at?: string
          email?: string
          id?: string
          is_active?: boolean
          name?: string
          phone?: string | null
          profile_picture_url?: string | null
          total_hotels_worked?: number
          total_rooms_cleaned?: number
          updated_at?: string
        }
        Relationships: []
      }
      housekeepers: {
        Row: {
          access_code: string
          created_at: string
          hotel_id: string
          id: string
          is_active: boolean
          is_temporary: boolean
          name: string
          role_id: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          access_code: string
          created_at?: string
          hotel_id: string
          id?: string
          is_active?: boolean
          is_temporary?: boolean
          name: string
          role_id?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          access_code?: string
          created_at?: string
          hotel_id?: string
          id?: string
          is_active?: boolean
          is_temporary?: boolean
          name?: string
          role_id?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "fk_housekeepers_hotel"
            columns: ["hotel_id"]
            isOneToOne: false
            referencedRelation: "hotels"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "housekeepers_role_id_fkey"
            columns: ["role_id"]
            isOneToOne: false
            referencedRelation: "staff_roles"
            referencedColumns: ["id"]
          },
        ]
      }
      incident_categories: {
        Row: {
          created_at: string | null
          display_order: number | null
          hotel_id: string | null
          icon: string | null
          id: string
          is_active: boolean | null
          is_system: boolean | null
          name: string
          updated_at: string | null
        }
        Insert: {
          created_at?: string | null
          display_order?: number | null
          hotel_id?: string | null
          icon?: string | null
          id?: string
          is_active?: boolean | null
          is_system?: boolean | null
          name: string
          updated_at?: string | null
        }
        Update: {
          created_at?: string | null
          display_order?: number | null
          hotel_id?: string | null
          icon?: string | null
          id?: string
          is_active?: boolean | null
          is_system?: boolean | null
          name?: string
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "incident_categories_hotel_id_fkey"
            columns: ["hotel_id"]
            isOneToOne: false
            referencedRelation: "hotels"
            referencedColumns: ["id"]
          },
        ]
      }
      incident_comments: {
        Row: {
          comment: string
          created_at: string | null
          id: string
          incident_id: string
          user_id: string
          user_name: string
          user_type: string
        }
        Insert: {
          comment: string
          created_at?: string | null
          id?: string
          incident_id: string
          user_id: string
          user_name: string
          user_type: string
        }
        Update: {
          comment?: string
          created_at?: string | null
          id?: string
          incident_id?: string
          user_id?: string
          user_name?: string
          user_type?: string
        }
        Relationships: [
          {
            foreignKeyName: "incident_comments_incident_id_fkey"
            columns: ["incident_id"]
            isOneToOne: false
            referencedRelation: "incidents"
            referencedColumns: ["id"]
          },
        ]
      }
      incident_images: {
        Row: {
          id: string
          image_url: string
          incident_id: string
          uploaded_at: string | null
          uploaded_by: string
        }
        Insert: {
          id?: string
          image_url: string
          incident_id: string
          uploaded_at?: string | null
          uploaded_by: string
        }
        Update: {
          id?: string
          image_url?: string
          incident_id?: string
          uploaded_at?: string | null
          uploaded_by?: string
        }
        Relationships: [
          {
            foreignKeyName: "incident_images_incident_id_fkey"
            columns: ["incident_id"]
            isOneToOne: false
            referencedRelation: "incidents"
            referencedColumns: ["id"]
          },
        ]
      }
      incident_items: {
        Row: {
          category_id: string | null
          created_at: string | null
          description: string | null
          display_order: number | null
          hotel_id: string | null
          id: string
          is_active: boolean | null
          is_system: boolean | null
          name: string
          updated_at: string | null
        }
        Insert: {
          category_id?: string | null
          created_at?: string | null
          description?: string | null
          display_order?: number | null
          hotel_id?: string | null
          id?: string
          is_active?: boolean | null
          is_system?: boolean | null
          name: string
          updated_at?: string | null
        }
        Update: {
          category_id?: string | null
          created_at?: string | null
          description?: string | null
          display_order?: number | null
          hotel_id?: string | null
          id?: string
          is_active?: boolean | null
          is_system?: boolean | null
          name?: string
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "incident_items_category_id_fkey"
            columns: ["category_id"]
            isOneToOne: false
            referencedRelation: "incident_categories"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "incident_items_hotel_id_fkey"
            columns: ["hotel_id"]
            isOneToOne: false
            referencedRelation: "hotels"
            referencedColumns: ["id"]
          },
        ]
      }
      incident_types: {
        Row: {
          color: string | null
          created_at: string | null
          hotel_id: string | null
          id: string
          is_active: boolean | null
          is_system: boolean | null
          name: string
          severity: string | null
          updated_at: string | null
        }
        Insert: {
          color?: string | null
          created_at?: string | null
          hotel_id?: string | null
          id?: string
          is_active?: boolean | null
          is_system?: boolean | null
          name: string
          severity?: string | null
          updated_at?: string | null
        }
        Update: {
          color?: string | null
          created_at?: string | null
          hotel_id?: string | null
          id?: string
          is_active?: boolean | null
          is_system?: boolean | null
          name?: string
          severity?: string | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "incident_types_hotel_id_fkey"
            columns: ["hotel_id"]
            isOneToOne: false
            referencedRelation: "hotels"
            referencedColumns: ["id"]
          },
        ]
      }
      incidents: {
        Row: {
          assigned_to_other: string | null
          assigned_to_role_id: string | null
          assigned_to_user_id: string | null
          category_id: string | null
          created_at: string | null
          description: string | null
          due_date: string | null
          hotel_id: string
          id: string
          item_id: string | null
          location_reference: string | null
          location_type: string | null
          priority: string | null
          reported_by: string | null
          reported_by_name: string
          reported_by_type: string
          resolution_notes: string | null
          resolved_at: string | null
          resolved_by: string | null
          status: string | null
          title: string
          type_id: string | null
          updated_at: string | null
        }
        Insert: {
          assigned_to_other?: string | null
          assigned_to_role_id?: string | null
          assigned_to_user_id?: string | null
          category_id?: string | null
          created_at?: string | null
          description?: string | null
          due_date?: string | null
          hotel_id: string
          id?: string
          item_id?: string | null
          location_reference?: string | null
          location_type?: string | null
          priority?: string | null
          reported_by?: string | null
          reported_by_name: string
          reported_by_type: string
          resolution_notes?: string | null
          resolved_at?: string | null
          resolved_by?: string | null
          status?: string | null
          title: string
          type_id?: string | null
          updated_at?: string | null
        }
        Update: {
          assigned_to_other?: string | null
          assigned_to_role_id?: string | null
          assigned_to_user_id?: string | null
          category_id?: string | null
          created_at?: string | null
          description?: string | null
          due_date?: string | null
          hotel_id?: string
          id?: string
          item_id?: string | null
          location_reference?: string | null
          location_type?: string | null
          priority?: string | null
          reported_by?: string | null
          reported_by_name?: string
          reported_by_type?: string
          resolution_notes?: string | null
          resolved_at?: string | null
          resolved_by?: string | null
          status?: string | null
          title?: string
          type_id?: string | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "incidents_assigned_to_role_id_fkey"
            columns: ["assigned_to_role_id"]
            isOneToOne: false
            referencedRelation: "staff_roles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "incidents_category_id_fkey"
            columns: ["category_id"]
            isOneToOne: false
            referencedRelation: "incident_categories"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "incidents_hotel_id_fkey"
            columns: ["hotel_id"]
            isOneToOne: false
            referencedRelation: "hotels"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "incidents_item_id_fkey"
            columns: ["item_id"]
            isOneToOne: false
            referencedRelation: "incident_items"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "incidents_type_id_fkey"
            columns: ["type_id"]
            isOneToOne: false
            referencedRelation: "incident_types"
            referencedColumns: ["id"]
          },
        ]
      }
      linen_inventory_entries: {
        Row: {
          ai_confidence: number | null
          count_method: string | null
          counted_at: string | null
          created_at: string | null
          id: string
          linen_type_id: string
          notes: string | null
          photo_url: string | null
          quantity_clean: number | null
          quantity_damaged: number | null
          quantity_dirty: number | null
          task_id: string
        }
        Insert: {
          ai_confidence?: number | null
          count_method?: string | null
          counted_at?: string | null
          created_at?: string | null
          id?: string
          linen_type_id: string
          notes?: string | null
          photo_url?: string | null
          quantity_clean?: number | null
          quantity_damaged?: number | null
          quantity_dirty?: number | null
          task_id: string
        }
        Update: {
          ai_confidence?: number | null
          count_method?: string | null
          counted_at?: string | null
          created_at?: string | null
          id?: string
          linen_type_id?: string
          notes?: string | null
          photo_url?: string | null
          quantity_clean?: number | null
          quantity_damaged?: number | null
          quantity_dirty?: number | null
          task_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "linen_inventory_entries_linen_type_id_fkey"
            columns: ["linen_type_id"]
            isOneToOne: false
            referencedRelation: "linen_types"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "linen_inventory_entries_task_id_fkey"
            columns: ["task_id"]
            isOneToOne: false
            referencedRelation: "linen_inventory_tasks"
            referencedColumns: ["id"]
          },
        ]
      }
      linen_inventory_tasks: {
        Row: {
          assigned_by: string
          assigned_to: string
          completed_at: string | null
          created_at: string | null
          hotel_id: string
          id: string
          notes: string | null
          started_at: string | null
          status: string | null
          task_date: string
          updated_at: string | null
        }
        Insert: {
          assigned_by: string
          assigned_to: string
          completed_at?: string | null
          created_at?: string | null
          hotel_id: string
          id?: string
          notes?: string | null
          started_at?: string | null
          status?: string | null
          task_date?: string
          updated_at?: string | null
        }
        Update: {
          assigned_by?: string
          assigned_to?: string
          completed_at?: string | null
          created_at?: string | null
          hotel_id?: string
          id?: string
          notes?: string | null
          started_at?: string | null
          status?: string | null
          task_date?: string
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "linen_inventory_tasks_hotel_id_fkey"
            columns: ["hotel_id"]
            isOneToOne: false
            referencedRelation: "hotels"
            referencedColumns: ["id"]
          },
        ]
      }
      linen_training_samples: {
        Row: {
          actual_count: number
          ai_predicted_count: number | null
          created_at: string | null
          created_by: string
          hotel_id: string
          id: string
          image_url: string
          linen_type_id: string
          notes: string | null
        }
        Insert: {
          actual_count: number
          ai_predicted_count?: number | null
          created_at?: string | null
          created_by: string
          hotel_id: string
          id?: string
          image_url: string
          linen_type_id: string
          notes?: string | null
        }
        Update: {
          actual_count?: number
          ai_predicted_count?: number | null
          created_at?: string | null
          created_by?: string
          hotel_id?: string
          id?: string
          image_url?: string
          linen_type_id?: string
          notes?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "linen_training_samples_hotel_id_fkey"
            columns: ["hotel_id"]
            isOneToOne: false
            referencedRelation: "hotels"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "linen_training_samples_linen_type_id_fkey"
            columns: ["linen_type_id"]
            isOneToOne: false
            referencedRelation: "linen_types"
            referencedColumns: ["id"]
          },
        ]
      }
      linen_types: {
        Row: {
          category: string | null
          color: string | null
          created_at: string | null
          dimensions: string | null
          display_order: number | null
          hotel_id: string
          icon: string | null
          id: string
          is_active: boolean | null
          name: string
          updated_at: string | null
          weight_per_unit: number | null
        }
        Insert: {
          category?: string | null
          color?: string | null
          created_at?: string | null
          dimensions?: string | null
          display_order?: number | null
          hotel_id: string
          icon?: string | null
          id?: string
          is_active?: boolean | null
          name: string
          updated_at?: string | null
          weight_per_unit?: number | null
        }
        Update: {
          category?: string | null
          color?: string | null
          created_at?: string | null
          dimensions?: string | null
          display_order?: number | null
          hotel_id?: string
          icon?: string | null
          id?: string
          is_active?: boolean | null
          name?: string
          updated_at?: string | null
          weight_per_unit?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "linen_types_hotel_id_fkey"
            columns: ["hotel_id"]
            isOneToOne: false
            referencedRelation: "hotels"
            referencedColumns: ["id"]
          },
        ]
      }
      notifications: {
        Row: {
          created_at: string
          description: string
          hotel_id: string
          housekeeper_name: string | null
          id: string
          is_read: boolean
          room_number: string | null
          title: string
          type: string
          user_id: string | null
          user_type: string
        }
        Insert: {
          created_at?: string
          description: string
          hotel_id: string
          housekeeper_name?: string | null
          id?: string
          is_read?: boolean
          room_number?: string | null
          title: string
          type: string
          user_id?: string | null
          user_type: string
        }
        Update: {
          created_at?: string
          description?: string
          hotel_id?: string
          housekeeper_name?: string | null
          id?: string
          is_read?: boolean
          room_number?: string | null
          title?: string
          type?: string
          user_id?: string | null
          user_type?: string
        }
        Relationships: []
      }
      password_reset_logs: {
        Row: {
          completed_at: string | null
          email: string
          id: string
          request_ip: unknown
          requested_at: string | null
          status: string | null
          user_agent: string | null
          user_id: string | null
        }
        Insert: {
          completed_at?: string | null
          email: string
          id?: string
          request_ip?: unknown
          requested_at?: string | null
          status?: string | null
          user_agent?: string | null
          user_id?: string | null
        }
        Update: {
          completed_at?: string | null
          email?: string
          id?: string
          request_ip?: unknown
          requested_at?: string | null
          status?: string | null
          user_agent?: string | null
          user_id?: string | null
        }
        Relationships: []
      }
      pattern_validation_history: {
        Row: {
          annotations_count: number | null
          created_at: string | null
          created_by: string
          error_analysis: Json | null
          extracted_count: number | null
          hotel_id: string
          id: string
          metrics: Json
          pms_type: string | null
          report_name: string
          validation_date: string | null
        }
        Insert: {
          annotations_count?: number | null
          created_at?: string | null
          created_by: string
          error_analysis?: Json | null
          extracted_count?: number | null
          hotel_id: string
          id?: string
          metrics?: Json
          pms_type?: string | null
          report_name: string
          validation_date?: string | null
        }
        Update: {
          annotations_count?: number | null
          created_at?: string | null
          created_by?: string
          error_analysis?: Json | null
          extracted_count?: number | null
          hotel_id?: string
          id?: string
          metrics?: Json
          pms_type?: string | null
          report_name?: string
          validation_date?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "pattern_validation_history_hotel_id_fkey"
            columns: ["hotel_id"]
            isOneToOne: false
            referencedRelation: "hotels"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          company_name: string | null
          created_at: string
          current_hotel_id: string | null
          email: string
          id: string
          is_suspended: boolean
          plan: string | null
          subscription_type: string | null
          suspension_reason: string | null
          trial_end_date: string | null
          trial_extension_days: number | null
          trial_extension_granted_at: string | null
          trial_extension_granted_by: string | null
          trial_extension_reason: string | null
          updated_at: string
        }
        Insert: {
          company_name?: string | null
          created_at?: string
          current_hotel_id?: string | null
          email: string
          id: string
          is_suspended?: boolean
          plan?: string | null
          subscription_type?: string | null
          suspension_reason?: string | null
          trial_end_date?: string | null
          trial_extension_days?: number | null
          trial_extension_granted_at?: string | null
          trial_extension_granted_by?: string | null
          trial_extension_reason?: string | null
          updated_at?: string
        }
        Update: {
          company_name?: string | null
          created_at?: string
          current_hotel_id?: string | null
          email?: string
          id?: string
          is_suspended?: boolean
          plan?: string | null
          subscription_type?: string | null
          suspension_reason?: string | null
          trial_end_date?: string | null
          trial_extension_days?: number | null
          trial_extension_granted_at?: string | null
          trial_extension_granted_by?: string | null
          trial_extension_reason?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "profiles_current_hotel_id_fkey"
            columns: ["current_hotel_id"]
            isOneToOne: false
            referencedRelation: "hotels"
            referencedColumns: ["id"]
          },
        ]
      }
      report_training_patterns: {
        Row: {
          accuracy_score: number | null
          created_at: string
          created_by: string
          detection_rules: Json | null
          extracted_data: Json
          hotel_id: string
          id: string
          pms_type: string | null
          raw_text: string
          report_name: string
          updated_at: string
          validated: boolean
          validation_notes: string | null
        }
        Insert: {
          accuracy_score?: number | null
          created_at?: string
          created_by: string
          detection_rules?: Json | null
          extracted_data?: Json
          hotel_id: string
          id?: string
          pms_type?: string | null
          raw_text: string
          report_name: string
          updated_at?: string
          validated?: boolean
          validation_notes?: string | null
        }
        Update: {
          accuracy_score?: number | null
          created_at?: string
          created_by?: string
          detection_rules?: Json | null
          extracted_data?: Json
          hotel_id?: string
          id?: string
          pms_type?: string | null
          raw_text?: string
          report_name?: string
          updated_at?: string
          validated?: boolean
          validation_notes?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "report_training_patterns_hotel_id_fkey"
            columns: ["hotel_id"]
            isOneToOne: false
            referencedRelation: "hotels"
            referencedColumns: ["id"]
          },
        ]
      }
      room_status_updates: {
        Row: {
          created_at: string | null
          hotel_id: string | null
          housekeeper_id: string | null
          id: string
          message: string | null
          room_number: string
          status: string
          updated_at: string | null
        }
        Insert: {
          created_at?: string | null
          hotel_id?: string | null
          housekeeper_id?: string | null
          id?: string
          message?: string | null
          room_number: string
          status: string
          updated_at?: string | null
        }
        Update: {
          created_at?: string | null
          hotel_id?: string | null
          housekeeper_id?: string | null
          id?: string
          message?: string | null
          room_number?: string
          status?: string
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "room_status_updates_hotel_id_fkey"
            columns: ["hotel_id"]
            isOneToOne: false
            referencedRelation: "hotels"
            referencedColumns: ["id"]
          },
        ]
      }
      rooms: {
        Row: {
          cleaning_priority: number | null
          cleaning_type: string | null
          created_at: string
          estimated_time: number | null
          floor: number | null
          hotel_id: string
          id: string
          last_cleaned_at: string | null
          notes: string | null
          room_number: string
          room_type: string | null
          status: string
          updated_at: string
        }
        Insert: {
          cleaning_priority?: number | null
          cleaning_type?: string | null
          created_at?: string
          estimated_time?: number | null
          floor?: number | null
          hotel_id: string
          id?: string
          last_cleaned_at?: string | null
          notes?: string | null
          room_number: string
          room_type?: string | null
          status?: string
          updated_at?: string
        }
        Update: {
          cleaning_priority?: number | null
          cleaning_type?: string | null
          created_at?: string
          estimated_time?: number | null
          floor?: number | null
          hotel_id?: string
          id?: string
          last_cleaned_at?: string | null
          notes?: string | null
          room_number?: string
          room_type?: string | null
          status?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "rooms_hotel_id_fkey"
            columns: ["hotel_id"]
            isOneToOne: false
            referencedRelation: "hotels"
            referencedColumns: ["id"]
          },
        ]
      }
      staff_role_permissions: {
        Row: {
          can_resolve: boolean
          can_view: boolean
          created_at: string | null
          hotel_id: string
          id: string
          incident_type_id: string
          role_id: string
          updated_at: string | null
        }
        Insert: {
          can_resolve?: boolean
          can_view?: boolean
          created_at?: string | null
          hotel_id: string
          id?: string
          incident_type_id: string
          role_id: string
          updated_at?: string | null
        }
        Update: {
          can_resolve?: boolean
          can_view?: boolean
          created_at?: string | null
          hotel_id?: string
          id?: string
          incident_type_id?: string
          role_id?: string
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "staff_role_permissions_hotel_id_fkey"
            columns: ["hotel_id"]
            isOneToOne: false
            referencedRelation: "hotels"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "staff_role_permissions_incident_type_id_fkey"
            columns: ["incident_type_id"]
            isOneToOne: false
            referencedRelation: "incident_types"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "staff_role_permissions_role_id_fkey"
            columns: ["role_id"]
            isOneToOne: false
            referencedRelation: "staff_roles"
            referencedColumns: ["id"]
          },
        ]
      }
      staff_roles: {
        Row: {
          created_at: string | null
          description: string | null
          hotel_id: string | null
          id: string
          is_active: boolean | null
          is_system: boolean | null
          name: string
          updated_at: string | null
        }
        Insert: {
          created_at?: string | null
          description?: string | null
          hotel_id?: string | null
          id?: string
          is_active?: boolean | null
          is_system?: boolean | null
          name: string
          updated_at?: string | null
        }
        Update: {
          created_at?: string | null
          description?: string | null
          hotel_id?: string | null
          id?: string
          is_active?: boolean | null
          is_system?: boolean | null
          name?: string
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "staff_roles_hotel_id_fkey"
            columns: ["hotel_id"]
            isOneToOne: false
            referencedRelation: "hotels"
            referencedColumns: ["id"]
          },
        ]
      }
      subscriptions: {
        Row: {
          created_at: string | null
          current_period_end: string | null
          current_period_start: string | null
          id: string
          plan: string
          status: string | null
          stripe_customer_id: string | null
          stripe_subscription_id: string | null
          updated_at: string | null
          user_id: string | null
        }
        Insert: {
          created_at?: string | null
          current_period_end?: string | null
          current_period_start?: string | null
          id?: string
          plan?: string
          status?: string | null
          stripe_customer_id?: string | null
          stripe_subscription_id?: string | null
          updated_at?: string | null
          user_id?: string | null
        }
        Update: {
          created_at?: string | null
          current_period_end?: string | null
          current_period_start?: string | null
          id?: string
          plan?: string
          status?: string | null
          stripe_customer_id?: string | null
          stripe_subscription_id?: string | null
          updated_at?: string | null
          user_id?: string | null
        }
        Relationships: []
      }
      user_roles: {
        Row: {
          created_at: string
          id: string
          role: Database["public"]["Enums"]["app_role"]
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          role?: Database["public"]["Enums"]["app_role"]
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          role?: Database["public"]["Enums"]["app_role"]
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      user_sessions: {
        Row: {
          created_at: string
          hotel_id: string | null
          housekeeper_id: string | null
          id: string
          is_active: boolean
          last_activity: string
          login_time: string
          session_token: string | null
          user_id: string | null
          user_name: string
          user_type: string
        }
        Insert: {
          created_at?: string
          hotel_id?: string | null
          housekeeper_id?: string | null
          id?: string
          is_active?: boolean
          last_activity?: string
          login_time?: string
          session_token?: string | null
          user_id?: string | null
          user_name: string
          user_type: string
        }
        Update: {
          created_at?: string
          hotel_id?: string | null
          housekeeper_id?: string | null
          id?: string
          is_active?: boolean
          last_activity?: string
          login_time?: string
          session_token?: string | null
          user_id?: string | null
          user_name?: string
          user_type?: string
        }
        Relationships: [
          {
            foreignKeyName: "user_sessions_hotel_id_fkey"
            columns: ["hotel_id"]
            isOneToOne: false
            referencedRelation: "hotels"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      add_housekeeper_xp: {
        Args: {
          p_hotel_id: string
          p_housekeeper_id: string
          p_is_fast?: boolean
          p_is_perfect?: boolean
          p_room_cleaned?: boolean
          p_xp_amount: number
        }
        Returns: Json
      }
      analyze_error_trends: {
        Args: { p_days?: number; p_hotel_id: string }
        Returns: Json
      }
      approve_housekeeper_access_request: {
        Args: { admin_user_id: string; request_id: string }
        Returns: string
      }
      authenticate_housekeeper_by_code: {
        Args: { p_access_code: string }
        Returns: {
          code_source: string
          hotel_code: string
          hotel_id: string
          hotel_name: string
          housekeeper_id: string
          housekeeper_name: string
          resolved_access_code: string
          success: boolean
        }[]
      }
      calculate_level: { Args: { total_xp: number }; Returns: number }
      can_manage_hotel_data: {
        Args: { target_hotel_id: string }
        Returns: boolean
      }
      change_subscription_status: {
        Args: { p_new_status: string; p_reason?: string; p_user_id: string }
        Returns: boolean
      }
      cleanup_all_housekeepers_for_hotel: {
        Args: { p_hotel_id: string }
        Returns: {
          deleted_codes: number
          deleted_housekeepers: number
        }[]
      }
      cleanup_expired_hotel_sessions: { Args: never; Returns: undefined }
      cleanup_inactive_sessions: { Args: never; Returns: undefined }
      cleanup_user_old_sessions: {
        Args: { p_current_session_id?: string; p_user_id: string }
        Returns: undefined
      }
      create_hotel_incident_defaults: {
        Args: { p_hotel_id: string }
        Returns: undefined
      }
      extend_trial_period: {
        Args: { p_extension_days: number; p_reason?: string; p_user_id: string }
        Returns: boolean
      }
      fix_access_code_inconsistencies: {
        Args: never
        Returns: {
          fixed_housekeepers: number
          hotel_code: string
          hotel_name: string
        }[]
      }
      generate_and_insert_access_code: {
        Args: { p_hotel_id: string; p_housekeeper_name: string }
        Returns: string
      }
      generate_hotel_access_code: {
        Args: { hotel_uuid: string }
        Returns: string
      }
      generate_housekeeper_access_code: {
        Args: { p_hotel_id: string; p_housekeeper_id?: string }
        Returns: string
      }
      generate_housekeeper_access_code_simple: {
        Args: { p_hotel_id: string; p_housekeeper_name?: string }
        Returns: string
      }
      generate_housekeeper_access_code_with_name: {
        Args: {
          p_hotel_id: string
          p_housekeeper_id?: string
          p_housekeeper_name?: string
        }
        Returns: string
      }
      generate_missing_access_codes_for_hotel: {
        Args: { p_hotel_id: string }
        Returns: number
      }
      generate_permanent_access_code: {
        Args: { p_hotel_id: string; p_housekeeper_name?: string }
        Returns: string
      }
      generate_short_hotel_id: { Args: never; Returns: string }
      generate_temporary_hotel_access_code: {
        Args: {
          p_duration_hours?: number
          p_hotel_id: string
          p_housekeeper_profile_id: string
        }
        Returns: string
      }
      get_hotel_info_for_access_code: {
        Args: { p_hotel_code: string }
        Returns: {
          hotel_code: string
          hotel_id: string
          hotel_name: string
        }[]
      }
      get_housekeeper_profile_id: { Args: never; Returns: string }
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
      log_activity: {
        Args: {
          p_activity_type: string
          p_actor_name?: string
          p_actor_type?: string
          p_details?: Json
          p_entity_id: string
          p_entity_type: string
          p_hotel_id: string
        }
        Returns: string
      }
      log_admin_action: {
        Args: { p_action: string; p_details?: Json; p_target_user_id?: string }
        Returns: undefined
      }
      log_housekeeper_action: {
        Args: {
          p_description?: string
          p_hotel_id: string
          p_housekeeper_name?: string
          p_room_number?: string
          p_target_user_id?: string
          p_title?: string
          p_type: string
        }
        Returns: number
      }
      log_password_reset_request: {
        Args: { p_email: string; p_request_ip?: unknown; p_user_agent?: string }
        Returns: string
      }
      regenerate_housekeeper_codes: {
        Args: { p_hotel_id: string }
        Returns: {
          housekeeper_name: string
          new_code: string
        }[]
      }
      request_password_reset: { Args: { user_email: string }; Returns: boolean }
      sync_access_codes_with_housekeepers: { Args: never; Returns: number }
      upsert_rooms_from_pdf: {
        Args: { p_hotel_id: string; p_rooms: Json; p_source?: string }
        Returns: {
          inserted: number
          total: number
          updated: number
        }[]
      }
      validate_access_code_for_hotel: {
        Args: { access_code: string; hotel_uuid: string }
        Returns: boolean
      }
      validate_hotel_code_exists: {
        Args: { p_hotel_code: string }
        Returns: boolean
      }
      validate_housekeeper_access_code: {
        Args: { p_access_code: string; p_hotel_id: string }
        Returns: boolean
      }
    }
    Enums: {
      app_role: "user" | "admin" | "super_admin"
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}

type DatabaseWithoutInternals = Omit<Database, "__InternalSupabase">

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, "public">]

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] &
        DefaultSchema["Views"])
    ? (DefaultSchema["Tables"] &
        DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R
      }
      ? R
      : never
    : never

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Insert: infer I
      }
      ? I
      : never
    : never

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Update: infer U
      }
      ? U
      : never
    : never

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    | keyof DefaultSchema["Enums"]
    | { schema: keyof DatabaseWithoutInternals },
  EnumName extends DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never = never,
> = DefaultSchemaEnumNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
    ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
    : never

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema["CompositeTypes"]
    | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never

export const Constants = {
  public: {
    Enums: {
      app_role: ["user", "admin", "super_admin"],
    },
  },
} as const
