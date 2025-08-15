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
      hotels: {
        Row: {
          address: string | null
          created_at: string
          email: string
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
          id?: string
          name?: string
          settings?: Json | null
          status?: string | null
          updated_at?: string
          user_id?: string | null
        }
        Relationships: []
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
          request_ip: unknown | null
          requested_at: string | null
          status: string | null
          user_agent: string | null
          user_id: string | null
        }
        Insert: {
          completed_at?: string | null
          email: string
          id?: string
          request_ip?: unknown | null
          requested_at?: string | null
          status?: string | null
          user_agent?: string | null
          user_id?: string | null
        }
        Update: {
          completed_at?: string | null
          email?: string
          id?: string
          request_ip?: unknown | null
          requested_at?: string | null
          status?: string | null
          user_agent?: string | null
          user_id?: string | null
        }
        Relationships: []
      }
      profiles: {
        Row: {
          company_name: string | null
          created_at: string
          email: string
          id: string
          is_suspended: boolean
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
          email: string
          id: string
          is_suspended?: boolean
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
          email?: string
          id?: string
          is_suspended?: boolean
          subscription_type?: string | null
          suspension_reason?: string | null
          trial_end_date?: string | null
          trial_extension_days?: number | null
          trial_extension_granted_at?: string | null
          trial_extension_granted_by?: string | null
          trial_extension_reason?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      rooms: {
        Row: {
          cleaning_priority: number | null
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
      cleanup_expired_hotel_sessions: {
        Args: Record<PropertyKey, never>
        Returns: undefined
      }
      cleanup_inactive_sessions: {
        Args: Record<PropertyKey, never>
        Returns: undefined
      }
      extend_trial_period: {
        Args: { p_extension_days: number; p_reason?: string; p_user_id: string }
        Returns: boolean
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
      generate_short_hotel_id: {
        Args: Record<PropertyKey, never>
        Returns: string
      }
      generate_temporary_hotel_access_code: {
        Args: {
          p_duration_hours?: number
          p_hotel_id: string
          p_housekeeper_profile_id: string
        }
        Returns: string
      }
      get_housekeeper_profile_id: {
        Args: Record<PropertyKey, never>
        Returns: string
      }
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
      request_password_reset: {
        Args: { user_email: string }
        Returns: boolean
      }
      validate_access_code_for_hotel: {
        Args: { access_code: string; hotel_uuid: string }
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
