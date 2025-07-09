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
      hotels: {
        Row: {
          created_at: string
          email: string
          hotel_code: string | null
          id: string
          name: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          email: string
          hotel_code?: string | null
          id?: string
          name: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          email?: string
          hotel_code?: string | null
          id?: string
          name?: string
          updated_at?: string
        }
        Relationships: []
      }
      housekeepers: {
        Row: {
          access_code: string
          created_at: string
          hotel_id: string | null
          id: string
          is_active: boolean
          name: string
          updated_at: string
        }
        Insert: {
          access_code: string
          created_at?: string
          hotel_id?: string | null
          id?: string
          is_active?: boolean
          name: string
          updated_at?: string
        }
        Update: {
          access_code?: string
          created_at?: string
          hotel_id?: string | null
          id?: string
          is_active?: boolean
          name?: string
          updated_at?: string
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
      room_status_updates: {
        Row: {
          created_at: string
          hotel_id: string | null
          housekeeper_id: string | null
          id: string
          message: string | null
          room_number: string
          status: string
        }
        Insert: {
          created_at?: string
          hotel_id?: string | null
          housekeeper_id?: string | null
          id?: string
          message?: string | null
          room_number: string
          status: string
        }
        Update: {
          created_at?: string
          hotel_id?: string | null
          housekeeper_id?: string | null
          id?: string
          message?: string | null
          room_number?: string
          status?: string
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
      cleanup_expired_hotel_sessions: {
        Args: Record<PropertyKey, never>
        Returns: undefined
      }
      cleanup_inactive_sessions: {
        Args: Record<PropertyKey, never>
        Returns: undefined
      }
    }
    Enums: {
      [_ in never]: never
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
    Enums: {},
  },
} as const
