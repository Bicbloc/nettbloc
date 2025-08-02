export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  // Allows to automatically instanciate createClient with right options
  // instead of createClient<Database, { PostgrestVersion: 'XX' }>(URL, KEY)
  __InternalSupabase: {
    PostgrestVersion: "12.2.3 (519615d)"
  }
  public: {
    Tables: {
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
      daily_reports: {
        Row: {
          action_log: Json
          created_at: string
          hotel_id: string
          housekeeper_assignments: Json
          housekeeper_names: Json
          id: string
          report_date: string
          room_data: Json
          user_id: string
        }
        Insert: {
          action_log?: Json
          created_at?: string
          hotel_id: string
          housekeeper_assignments?: Json
          housekeeper_names?: Json
          id?: string
          report_date?: string
          room_data?: Json
          user_id: string
        }
        Update: {
          action_log?: Json
          created_at?: string
          hotel_id?: string
          housekeeper_assignments?: Json
          housekeeper_names?: Json
          id?: string
          report_date?: string
          room_data?: Json
          user_id?: string
        }
        Relationships: []
      }
      hotel_sessions: {
        Row: {
          created_at: string
          expires_at: string
          hotel_id: string | null
          housekeeper_assignments: Json
          housekeeper_names: Json
          id: string
          ip_address: unknown | null
          is_active: boolean
          is_distributed: boolean
          room_data: Json
          session_token: string
          updated_at: string
          user_id: string | null
        }
        Insert: {
          created_at?: string
          expires_at?: string
          hotel_id?: string | null
          housekeeper_assignments?: Json
          housekeeper_names?: Json
          id?: string
          ip_address?: unknown | null
          is_active?: boolean
          is_distributed?: boolean
          room_data?: Json
          session_token: string
          updated_at?: string
          user_id?: string | null
        }
        Update: {
          created_at?: string
          expires_at?: string
          hotel_id?: string | null
          housekeeper_assignments?: Json
          housekeeper_names?: Json
          id?: string
          ip_address?: unknown | null
          is_active?: boolean
          is_distributed?: boolean
          room_data?: Json
          session_token?: string
          updated_at?: string
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
          created_at: string
          created_by: string | null
          hotel_id: string
          id: string
          role: string
          user_id: string
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          hotel_id: string
          id?: string
          role?: string
          user_id: string
        }
        Update: {
          created_at?: string
          created_by?: string | null
          hotel_id?: string
          id?: string
          role?: string
          user_id?: string
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
          updated_at?: string
          user_id?: string | null
        }
        Relationships: []
      }
      housekeeper_access_codes: {
        Row: {
          access_code: string
          created_at: string
          created_by: string | null
          expires_at: string | null
          hotel_id: string
          housekeeper_id: string | null
          id: string
          is_active: boolean
          used_at: string | null
        }
        Insert: {
          access_code: string
          created_at?: string
          created_by?: string | null
          expires_at?: string | null
          hotel_id: string
          housekeeper_id?: string | null
          id?: string
          is_active?: boolean
          used_at?: string | null
        }
        Update: {
          access_code?: string
          created_at?: string
          created_by?: string | null
          expires_at?: string | null
          hotel_id?: string
          housekeeper_id?: string | null
          id?: string
          is_active?: boolean
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
      housekeeper_tokens: {
        Row: {
          created_at: string
          expires_at: string
          housekeeper_id: string
          id: string
          is_active: boolean
          token: string
          user_id: string
        }
        Insert: {
          created_at?: string
          expires_at?: string
          housekeeper_id: string
          id?: string
          is_active?: boolean
          token: string
          user_id: string
        }
        Update: {
          created_at?: string
          expires_at?: string
          housekeeper_id?: string
          id?: string
          is_active?: boolean
          token?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "housekeeper_tokens_housekeeper_id_fkey"
            columns: ["housekeeper_id"]
            isOneToOne: false
            referencedRelation: "housekeepers"
            referencedColumns: ["id"]
          },
        ]
      }
      housekeepers: {
        Row: {
          access_code: string
          created_at: string
          hotel_id: string
          id: string
          is_active: boolean
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
      room_status_updates: {
        Row: {
          created_at: string
          hotel_id: string
          housekeeper_id: string
          id: string
          message: string | null
          room_number: string
          status: string
          user_id: string | null
        }
        Insert: {
          created_at?: string
          hotel_id: string
          housekeeper_id: string
          id?: string
          message?: string | null
          room_number: string
          status: string
          user_id?: string | null
        }
        Update: {
          created_at?: string
          hotel_id?: string
          housekeeper_id?: string
          id?: string
          message?: string | null
          room_number?: string
          status?: string
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "room_status_updates_hotel_id_fkey"
            columns: ["hotel_id"]
            isOneToOne: false
            referencedRelation: "hotels"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "room_status_updates_housekeeper_id_fkey"
            columns: ["housekeeper_id"]
            isOneToOne: false
            referencedRelation: "housekeepers"
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
      change_subscription_status: {
        Args: { p_user_id: string; p_new_status: string; p_reason?: string }
        Returns: boolean
      }
      cleanup_all_housekeepers_for_hotel: {
        Args: { p_hotel_id: string }
        Returns: {
          deleted_housekeepers: number
          deleted_codes: number
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
        Args: { p_user_id: string; p_extension_days: number; p_reason?: string }
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
      generate_housekeeper_access_code_with_name: {
        Args: {
          p_hotel_id: string
          p_housekeeper_id?: string
          p_housekeeper_name?: string
        }
        Returns: string
      }
      generate_housekeeper_access_code_with_user: {
        Args: {
          p_hotel_id: string
          p_housekeeper_id?: string
          p_housekeeper_name?: string
          p_user_id?: string
        }
        Returns: string
      }
      generate_short_hotel_id: {
        Args: Record<PropertyKey, never>
        Returns: string
      }
      has_role: {
        Args: {
          _user_id: string
          _role: Database["public"]["Enums"]["app_role"]
        }
        Returns: boolean
      }
      log_admin_action: {
        Args: { p_action: string; p_target_user_id?: string; p_details?: Json }
        Returns: undefined
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
