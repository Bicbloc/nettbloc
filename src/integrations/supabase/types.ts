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
          sub_account_id: string | null
          sub_account_name: string | null
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
          sub_account_id?: string | null
          sub_account_name?: string | null
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
          sub_account_id?: string | null
          sub_account_name?: string | null
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
          {
            foreignKeyName: "activities_hotel_id_fkey"
            columns: ["hotel_id"]
            isOneToOne: false
            referencedRelation: "hotels_stats_view"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "activities_sub_account_id_fkey"
            columns: ["sub_account_id"]
            isOneToOne: false
            referencedRelation: "sub_accounts"
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
      admin_banner_dismissals: {
        Row: {
          banner_id: string
          dismissed_at: string
          id: string
          user_id: string
        }
        Insert: {
          banner_id: string
          dismissed_at?: string
          id?: string
          user_id: string
        }
        Update: {
          banner_id?: string
          dismissed_at?: string
          id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "admin_banner_dismissals_banner_id_fkey"
            columns: ["banner_id"]
            isOneToOne: false
            referencedRelation: "admin_banners"
            referencedColumns: ["id"]
          },
        ]
      }
      admin_banners: {
        Row: {
          action_label: string | null
          action_label_en: string | null
          action_url: string | null
          banner_type: string
          created_at: string
          created_by: string | null
          ends_at: string | null
          id: string
          is_active: boolean
          is_dismissible: boolean
          message: string
          message_en: string | null
          starts_at: string
          target_countries: string[] | null
          target_hotel_ids: string[] | null
          target_plans: string[] | null
          target_scope: string
          title: string
          updated_at: string
        }
        Insert: {
          action_label?: string | null
          action_label_en?: string | null
          action_url?: string | null
          banner_type?: string
          created_at?: string
          created_by?: string | null
          ends_at?: string | null
          id?: string
          is_active?: boolean
          is_dismissible?: boolean
          message: string
          message_en?: string | null
          starts_at?: string
          target_countries?: string[] | null
          target_hotel_ids?: string[] | null
          target_plans?: string[] | null
          target_scope?: string
          title: string
          updated_at?: string
        }
        Update: {
          action_label?: string | null
          action_label_en?: string | null
          action_url?: string | null
          banner_type?: string
          created_at?: string
          created_by?: string | null
          ends_at?: string | null
          id?: string
          is_active?: boolean
          is_dismissible?: boolean
          message?: string
          message_en?: string | null
          starts_at?: string
          target_countries?: string[] | null
          target_hotel_ids?: string[] | null
          target_plans?: string[] | null
          target_scope?: string
          title?: string
          updated_at?: string
        }
        Relationships: []
      }
      ai_usage_logs: {
        Row: {
          completion_tokens: number
          created_at: string
          function_name: string
          hotel_id: string | null
          id: string
          model: string | null
          prompt_tokens: number
          status: string
          total_tokens: number
          user_id: string | null
        }
        Insert: {
          completion_tokens?: number
          created_at?: string
          function_name: string
          hotel_id?: string | null
          id?: string
          model?: string | null
          prompt_tokens?: number
          status?: string
          total_tokens?: number
          user_id?: string | null
        }
        Update: {
          completion_tokens?: number
          created_at?: string
          function_name?: string
          hotel_id?: string | null
          id?: string
          model?: string | null
          prompt_tokens?: number
          status?: string
          total_tokens?: number
          user_id?: string | null
        }
        Relationships: []
      }
      app_settings: {
        Row: {
          key: string
          updated_at: string
          updated_by: string | null
          value: Json
        }
        Insert: {
          key: string
          updated_at?: string
          updated_by?: string | null
          value?: Json
        }
        Update: {
          key?: string
          updated_at?: string
          updated_by?: string | null
          value?: Json
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
          {
            foreignKeyName: "archived_daily_logs_hotel_id_fkey"
            columns: ["hotel_id"]
            isOneToOne: false
            referencedRelation: "hotels_stats_view"
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
            foreignKeyName: "assignments_hotel_id_fkey"
            columns: ["hotel_id"]
            isOneToOne: false
            referencedRelation: "hotels_stats_view"
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
      breakfast_logs: {
        Row: {
          breakfast_type: string | null
          created_at: string
          hotel_id: string
          id: string
          included: boolean
          log_date: string
          logged_by: string | null
          people_count: number
          pms_status: string
          room_number: string
          source: string
          total_amount: number
          unit_price: number
          updated_at: string
        }
        Insert: {
          breakfast_type?: string | null
          created_at?: string
          hotel_id: string
          id?: string
          included?: boolean
          log_date?: string
          logged_by?: string | null
          people_count?: number
          pms_status?: string
          room_number: string
          source?: string
          total_amount?: number
          unit_price?: number
          updated_at?: string
        }
        Update: {
          breakfast_type?: string | null
          created_at?: string
          hotel_id?: string
          id?: string
          included?: boolean
          log_date?: string
          logged_by?: string | null
          people_count?: number
          pms_status?: string
          room_number?: string
          source?: string
          total_amount?: number
          unit_price?: number
          updated_at?: string
        }
        Relationships: []
      }
      buildings: {
        Row: {
          created_at: string
          description: string | null
          display_order: number
          hotel_id: string
          id: string
          name: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          description?: string | null
          display_order?: number
          hotel_id: string
          id?: string
          name: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          description?: string | null
          display_order?: number
          hotel_id?: string
          id?: string
          name?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "buildings_hotel_id_fkey"
            columns: ["hotel_id"]
            isOneToOne: false
            referencedRelation: "hotels"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "buildings_hotel_id_fkey"
            columns: ["hotel_id"]
            isOneToOne: false
            referencedRelation: "hotels_stats_view"
            referencedColumns: ["id"]
          },
        ]
      }
      common_spaces: {
        Row: {
          area_sqm: number | null
          building_id: string | null
          created_at: string
          description: string | null
          display_order: number
          floor: number | null
          hotel_id: string
          id: string
          is_active: boolean
          name: string
          photo_url: string | null
          space_type: string
          updated_at: string
        }
        Insert: {
          area_sqm?: number | null
          building_id?: string | null
          created_at?: string
          description?: string | null
          display_order?: number
          floor?: number | null
          hotel_id: string
          id?: string
          is_active?: boolean
          name: string
          photo_url?: string | null
          space_type?: string
          updated_at?: string
        }
        Update: {
          area_sqm?: number | null
          building_id?: string | null
          created_at?: string
          description?: string | null
          display_order?: number
          floor?: number | null
          hotel_id?: string
          id?: string
          is_active?: boolean
          name?: string
          photo_url?: string | null
          space_type?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "common_spaces_building_id_fkey"
            columns: ["building_id"]
            isOneToOne: false
            referencedRelation: "buildings"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "common_spaces_hotel_id_fkey"
            columns: ["hotel_id"]
            isOneToOne: false
            referencedRelation: "hotels"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "common_spaces_hotel_id_fkey"
            columns: ["hotel_id"]
            isOneToOne: false
            referencedRelation: "hotels_stats_view"
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
          {
            foreignKeyName: "connected_room_rules_hotel_id_fkey"
            columns: ["hotel_id"]
            isOneToOne: false
            referencedRelation: "hotels_stats_view"
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
          sub_account_id: string | null
          sub_account_name: string | null
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
          sub_account_id?: string | null
          sub_account_name?: string | null
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
          sub_account_id?: string | null
          sub_account_name?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "daily_action_logs_hotel_id_fkey"
            columns: ["hotel_id"]
            isOneToOne: false
            referencedRelation: "hotels"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "daily_action_logs_hotel_id_fkey"
            columns: ["hotel_id"]
            isOneToOne: false
            referencedRelation: "hotels_stats_view"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "daily_action_logs_sub_account_id_fkey"
            columns: ["sub_account_id"]
            isOneToOne: false
            referencedRelation: "sub_accounts"
            referencedColumns: ["id"]
          },
        ]
      }
      daily_governess_assignments: {
        Row: {
          assigned_floors: number[] | null
          assigned_housekeepers: string[] | null
          assignment_date: string
          assignment_type: string
          created_at: string
          created_by: string | null
          governess_name: string
          governess_profile_id: string | null
          hotel_id: string
          id: string
          notes: string | null
        }
        Insert: {
          assigned_floors?: number[] | null
          assigned_housekeepers?: string[] | null
          assignment_date?: string
          assignment_type?: string
          created_at?: string
          created_by?: string | null
          governess_name: string
          governess_profile_id?: string | null
          hotel_id: string
          id?: string
          notes?: string | null
        }
        Update: {
          assigned_floors?: number[] | null
          assigned_housekeepers?: string[] | null
          assignment_date?: string
          assignment_type?: string
          created_at?: string
          created_by?: string | null
          governess_name?: string
          governess_profile_id?: string | null
          hotel_id?: string
          id?: string
          notes?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "daily_governess_assignments_governess_profile_id_fkey"
            columns: ["governess_profile_id"]
            isOneToOne: false
            referencedRelation: "governess_profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "daily_governess_assignments_hotel_id_fkey"
            columns: ["hotel_id"]
            isOneToOne: false
            referencedRelation: "hotels"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "daily_governess_assignments_hotel_id_fkey"
            columns: ["hotel_id"]
            isOneToOne: false
            referencedRelation: "hotels_stats_view"
            referencedColumns: ["id"]
          },
        ]
      }
      daily_instructions: {
        Row: {
          created_at: string
          created_by: string | null
          hotel_id: string
          id: string
          instruction_date: string
          instructions: string | null
          to_know: string | null
          todo_list: string | null
          updated_at: string
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          hotel_id: string
          id?: string
          instruction_date?: string
          instructions?: string | null
          to_know?: string | null
          todo_list?: string | null
          updated_at?: string
        }
        Update: {
          created_at?: string
          created_by?: string | null
          hotel_id?: string
          id?: string
          instruction_date?: string
          instructions?: string | null
          to_know?: string | null
          todo_list?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "daily_instructions_hotel_id_fkey"
            columns: ["hotel_id"]
            isOneToOne: false
            referencedRelation: "hotels"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "daily_instructions_hotel_id_fkey"
            columns: ["hotel_id"]
            isOneToOne: false
            referencedRelation: "hotels_stats_view"
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
          pdf_url: string | null
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
          pdf_url?: string | null
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
          pdf_url?: string | null
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
          {
            foreignKeyName: "daily_reports_hotel_id_fkey"
            columns: ["hotel_id"]
            isOneToOne: false
            referencedRelation: "hotels_stats_view"
            referencedColumns: ["id"]
          },
        ]
      }
      email_logs: {
        Row: {
          created_at: string
          email_type: string
          error_message: string | null
          id: string
          metadata: Json
          provider_message_id: string | null
          recipient_email: string
          related_entity_id: string | null
          related_entity_type: string | null
          status: string
          subject: string | null
        }
        Insert: {
          created_at?: string
          email_type: string
          error_message?: string | null
          id?: string
          metadata?: Json
          provider_message_id?: string | null
          recipient_email: string
          related_entity_id?: string | null
          related_entity_type?: string | null
          status?: string
          subject?: string | null
        }
        Update: {
          created_at?: string
          email_type?: string
          error_message?: string | null
          id?: string
          metadata?: Json
          provider_message_id?: string | null
          recipient_email?: string
          related_entity_id?: string | null
          related_entity_type?: string | null
          status?: string
          subject?: string | null
        }
        Relationships: []
      }
      equipment_categories: {
        Row: {
          created_at: string
          display_order: number
          hotel_id: string
          icon: string | null
          id: string
          is_active: boolean
          name: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          display_order?: number
          hotel_id: string
          icon?: string | null
          id?: string
          is_active?: boolean
          name: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          display_order?: number
          hotel_id?: string
          icon?: string | null
          id?: string
          is_active?: boolean
          name?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "equipment_categories_hotel_id_fkey"
            columns: ["hotel_id"]
            isOneToOne: false
            referencedRelation: "hotels"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "equipment_categories_hotel_id_fkey"
            columns: ["hotel_id"]
            isOneToOne: false
            referencedRelation: "hotels_stats_view"
            referencedColumns: ["id"]
          },
        ]
      }
      equipment_issues: {
        Row: {
          common_space_id: string | null
          created_at: string
          description: string | null
          equipment_id: string | null
          hotel_id: string
          id: string
          incident_id: string | null
          issue_type: string
          reported_at: string
          reported_by_name: string | null
          resolution_notes: string | null
          resolved_at: string | null
          resolved_by: string | null
          room_registry_id: string | null
          status: string
          title: string
          updated_at: string
        }
        Insert: {
          common_space_id?: string | null
          created_at?: string
          description?: string | null
          equipment_id?: string | null
          hotel_id: string
          id?: string
          incident_id?: string | null
          issue_type?: string
          reported_at?: string
          reported_by_name?: string | null
          resolution_notes?: string | null
          resolved_at?: string | null
          resolved_by?: string | null
          room_registry_id?: string | null
          status?: string
          title: string
          updated_at?: string
        }
        Update: {
          common_space_id?: string | null
          created_at?: string
          description?: string | null
          equipment_id?: string | null
          hotel_id?: string
          id?: string
          incident_id?: string | null
          issue_type?: string
          reported_at?: string
          reported_by_name?: string | null
          resolution_notes?: string | null
          resolved_at?: string | null
          resolved_by?: string | null
          room_registry_id?: string | null
          status?: string
          title?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "equipment_issues_common_space_id_fkey"
            columns: ["common_space_id"]
            isOneToOne: false
            referencedRelation: "common_spaces"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "equipment_issues_equipment_id_fkey"
            columns: ["equipment_id"]
            isOneToOne: false
            referencedRelation: "equipments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "equipment_issues_hotel_id_fkey"
            columns: ["hotel_id"]
            isOneToOne: false
            referencedRelation: "hotels"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "equipment_issues_hotel_id_fkey"
            columns: ["hotel_id"]
            isOneToOne: false
            referencedRelation: "hotels_stats_view"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "equipment_issues_room_registry_id_fkey"
            columns: ["room_registry_id"]
            isOneToOne: false
            referencedRelation: "hotel_rooms_registry"
            referencedColumns: ["id"]
          },
        ]
      }
      equipments: {
        Row: {
          brand: string | null
          category_id: string | null
          common_space_id: string | null
          condition: string
          created_at: string
          hotel_id: string
          id: string
          model: string | null
          name: string
          notes: string | null
          photo_url: string | null
          purchase_date: string | null
          purchase_price: number | null
          quantity: number
          reference: string | null
          room_registry_id: string | null
          serial_number: string | null
          supplier: string | null
          updated_at: string
          warranty_end_date: string | null
        }
        Insert: {
          brand?: string | null
          category_id?: string | null
          common_space_id?: string | null
          condition?: string
          created_at?: string
          hotel_id: string
          id?: string
          model?: string | null
          name: string
          notes?: string | null
          photo_url?: string | null
          purchase_date?: string | null
          purchase_price?: number | null
          quantity?: number
          reference?: string | null
          room_registry_id?: string | null
          serial_number?: string | null
          supplier?: string | null
          updated_at?: string
          warranty_end_date?: string | null
        }
        Update: {
          brand?: string | null
          category_id?: string | null
          common_space_id?: string | null
          condition?: string
          created_at?: string
          hotel_id?: string
          id?: string
          model?: string | null
          name?: string
          notes?: string | null
          photo_url?: string | null
          purchase_date?: string | null
          purchase_price?: number | null
          quantity?: number
          reference?: string | null
          room_registry_id?: string | null
          serial_number?: string | null
          supplier?: string | null
          updated_at?: string
          warranty_end_date?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "equipments_category_id_fkey"
            columns: ["category_id"]
            isOneToOne: false
            referencedRelation: "equipment_categories"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "equipments_common_space_id_fkey"
            columns: ["common_space_id"]
            isOneToOne: false
            referencedRelation: "common_spaces"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "equipments_hotel_id_fkey"
            columns: ["hotel_id"]
            isOneToOne: false
            referencedRelation: "hotels"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "equipments_hotel_id_fkey"
            columns: ["hotel_id"]
            isOneToOne: false
            referencedRelation: "hotels_stats_view"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "equipments_room_registry_id_fkey"
            columns: ["room_registry_id"]
            isOneToOne: false
            referencedRelation: "hotel_rooms_registry"
            referencedColumns: ["id"]
          },
        ]
      }
      floor_plan_layouts: {
        Row: {
          cells: Json
          floor_key: string
          grid_cols: number
          hotel_id: string
          id: string
          updated_at: string
          updated_by: string | null
        }
        Insert: {
          cells?: Json
          floor_key: string
          grid_cols?: number
          hotel_id: string
          id?: string
          updated_at?: string
          updated_by?: string | null
        }
        Update: {
          cells?: Json
          floor_key?: string
          grid_cols?: number
          hotel_id?: string
          id?: string
          updated_at?: string
          updated_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "floor_plan_layouts_hotel_id_fkey"
            columns: ["hotel_id"]
            isOneToOne: false
            referencedRelation: "hotels"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "floor_plan_layouts_hotel_id_fkey"
            columns: ["hotel_id"]
            isOneToOne: false
            referencedRelation: "hotels_stats_view"
            referencedColumns: ["id"]
          },
        ]
      }
      governess_access_requests: {
        Row: {
          created_at: string | null
          governess_profile_id: string
          hotel_code: string
          hotel_id: string
          id: string
          rejection_reason: string | null
          requested_at: string
          reviewed_at: string | null
          reviewed_by: string | null
          status: string
          updated_at: string | null
        }
        Insert: {
          created_at?: string | null
          governess_profile_id: string
          hotel_code: string
          hotel_id: string
          id?: string
          rejection_reason?: string | null
          requested_at?: string
          reviewed_at?: string | null
          reviewed_by?: string | null
          status?: string
          updated_at?: string | null
        }
        Update: {
          created_at?: string | null
          governess_profile_id?: string
          hotel_code?: string
          hotel_id?: string
          id?: string
          rejection_reason?: string | null
          requested_at?: string
          reviewed_at?: string | null
          reviewed_by?: string | null
          status?: string
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "governess_access_requests_governess_profile_id_fkey"
            columns: ["governess_profile_id"]
            isOneToOne: false
            referencedRelation: "governess_profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "governess_access_requests_hotel_id_fkey"
            columns: ["hotel_id"]
            isOneToOne: false
            referencedRelation: "hotels"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "governess_access_requests_hotel_id_fkey"
            columns: ["hotel_id"]
            isOneToOne: false
            referencedRelation: "hotels_stats_view"
            referencedColumns: ["id"]
          },
        ]
      }
      governess_hotel_sessions: {
        Row: {
          created_at: string | null
          ended_at: string | null
          governess_profile_id: string
          hotel_id: string
          hotel_name: string | null
          id: string
          is_active: boolean | null
          started_at: string | null
        }
        Insert: {
          created_at?: string | null
          ended_at?: string | null
          governess_profile_id: string
          hotel_id: string
          hotel_name?: string | null
          id?: string
          is_active?: boolean | null
          started_at?: string | null
        }
        Update: {
          created_at?: string | null
          ended_at?: string | null
          governess_profile_id?: string
          hotel_id?: string
          hotel_name?: string | null
          id?: string
          is_active?: boolean | null
          started_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "governess_hotel_sessions_governess_profile_id_fkey"
            columns: ["governess_profile_id"]
            isOneToOne: false
            referencedRelation: "governess_profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "governess_hotel_sessions_hotel_id_fkey"
            columns: ["hotel_id"]
            isOneToOne: false
            referencedRelation: "hotels"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "governess_hotel_sessions_hotel_id_fkey"
            columns: ["hotel_id"]
            isOneToOne: false
            referencedRelation: "hotels_stats_view"
            referencedColumns: ["id"]
          },
        ]
      }
      governess_profiles: {
        Row: {
          created_at: string | null
          email: string
          id: string
          is_active: boolean | null
          name: string
          phone: string | null
          updated_at: string | null
        }
        Insert: {
          created_at?: string | null
          email: string
          id?: string
          is_active?: boolean | null
          name: string
          phone?: string | null
          updated_at?: string | null
        }
        Update: {
          created_at?: string | null
          email?: string
          id?: string
          is_active?: boolean | null
          name?: string
          phone?: string | null
          updated_at?: string | null
        }
        Relationships: []
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
            foreignKeyName: "hotel_access_sessions_hotel_id_fkey"
            columns: ["hotel_id"]
            isOneToOne: false
            referencedRelation: "hotels_stats_view"
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
      hotel_breakfast_configs: {
        Row: {
          breakfast_types: Json
          created_at: string
          currency: string
          default_included: boolean
          hotel_id: string
          id: string
          is_active: boolean
          price_per_person: number
          pricing_source: string
          updated_at: string
        }
        Insert: {
          breakfast_types?: Json
          created_at?: string
          currency?: string
          default_included?: boolean
          hotel_id: string
          id?: string
          is_active?: boolean
          price_per_person?: number
          pricing_source?: string
          updated_at?: string
        }
        Update: {
          breakfast_types?: Json
          created_at?: string
          currency?: string
          default_included?: boolean
          hotel_id?: string
          id?: string
          is_active?: boolean
          price_per_person?: number
          pricing_source?: string
          updated_at?: string
        }
        Relationships: []
      }
      hotel_cleaning_rules: {
        Row: {
          condition_logic: string | null
          conditions: Json
          created_at: string
          created_by: string | null
          description: string | null
          display_name: string | null
          hotel_id: string
          id: string
          is_active: boolean
          priority: number
          result_cleaning_type: string
          result_status: string | null
          rule_name: string
          updated_at: string
        }
        Insert: {
          condition_logic?: string | null
          conditions?: Json
          created_at?: string
          created_by?: string | null
          description?: string | null
          display_name?: string | null
          hotel_id: string
          id?: string
          is_active?: boolean
          priority?: number
          result_cleaning_type: string
          result_status?: string | null
          rule_name: string
          updated_at?: string
        }
        Update: {
          condition_logic?: string | null
          conditions?: Json
          created_at?: string
          created_by?: string | null
          description?: string | null
          display_name?: string | null
          hotel_id?: string
          id?: string
          is_active?: boolean
          priority?: number
          result_cleaning_type?: string
          result_status?: string | null
          rule_name?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "hotel_cleaning_rules_hotel_id_fkey"
            columns: ["hotel_id"]
            isOneToOne: false
            referencedRelation: "hotels"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "hotel_cleaning_rules_hotel_id_fkey"
            columns: ["hotel_id"]
            isOneToOne: false
            referencedRelation: "hotels_stats_view"
            referencedColumns: ["id"]
          },
        ]
      }
      hotel_combination_rules: {
        Row: {
          arrival_date: string
          arrival_time: string
          created_at: string
          created_by: string | null
          departure_date: string
          departure_time: string
          description: string | null
          hotel_id: string
          id: string
          is_active: boolean
          night_info: string
          pms_template: string | null
          priority: number
          result_cleaning_type: string
          result_status: string | null
          rule_name: string
          status_keywords: string[] | null
          updated_at: string
        }
        Insert: {
          arrival_date?: string
          arrival_time?: string
          created_at?: string
          created_by?: string | null
          departure_date?: string
          departure_time?: string
          description?: string | null
          hotel_id: string
          id?: string
          is_active?: boolean
          night_info?: string
          pms_template?: string | null
          priority?: number
          result_cleaning_type: string
          result_status?: string | null
          rule_name: string
          status_keywords?: string[] | null
          updated_at?: string
        }
        Update: {
          arrival_date?: string
          arrival_time?: string
          created_at?: string
          created_by?: string | null
          departure_date?: string
          departure_time?: string
          description?: string | null
          hotel_id?: string
          id?: string
          is_active?: boolean
          night_info?: string
          pms_template?: string | null
          priority?: number
          result_cleaning_type?: string
          result_status?: string | null
          rule_name?: string
          status_keywords?: string[] | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "hotel_combination_rules_hotel_id_fkey"
            columns: ["hotel_id"]
            isOneToOne: false
            referencedRelation: "hotels"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "hotel_combination_rules_hotel_id_fkey"
            columns: ["hotel_id"]
            isOneToOne: false
            referencedRelation: "hotels_stats_view"
            referencedColumns: ["id"]
          },
        ]
      }
      hotel_detection_rules: {
        Row: {
          condition: Json
          created_at: string | null
          created_by: string
          description: string | null
          hotel_id: string
          id: string
          is_active: boolean | null
          priority: number | null
          result: Json
          rule_name: string
          rule_type: string
          updated_at: string | null
        }
        Insert: {
          condition: Json
          created_at?: string | null
          created_by: string
          description?: string | null
          hotel_id: string
          id?: string
          is_active?: boolean | null
          priority?: number | null
          result: Json
          rule_name: string
          rule_type: string
          updated_at?: string | null
        }
        Update: {
          condition?: Json
          created_at?: string | null
          created_by?: string
          description?: string | null
          hotel_id?: string
          id?: string
          is_active?: boolean | null
          priority?: number | null
          result?: Json
          rule_name?: string
          rule_type?: string
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "hotel_detection_rules_hotel_id_fkey"
            columns: ["hotel_id"]
            isOneToOne: false
            referencedRelation: "hotels"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "hotel_detection_rules_hotel_id_fkey"
            columns: ["hotel_id"]
            isOneToOne: false
            referencedRelation: "hotels_stats_view"
            referencedColumns: ["id"]
          },
        ]
      }
      hotel_name_history: {
        Row: {
          changed_by: string | null
          created_at: string
          hotel_id: string
          id: string
          new_name: string | null
          old_name: string | null
        }
        Insert: {
          changed_by?: string | null
          created_at?: string
          hotel_id: string
          id?: string
          new_name?: string | null
          old_name?: string | null
        }
        Update: {
          changed_by?: string | null
          created_at?: string
          hotel_id?: string
          id?: string
          new_name?: string | null
          old_name?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "hotel_name_history_hotel_id_fkey"
            columns: ["hotel_id"]
            isOneToOne: false
            referencedRelation: "hotels"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "hotel_name_history_hotel_id_fkey"
            columns: ["hotel_id"]
            isOneToOne: false
            referencedRelation: "hotels_stats_view"
            referencedColumns: ["id"]
          },
        ]
      }
      hotel_pms_configs: {
        Row: {
          auto_sync_enabled: boolean
          auto_sync_time: string
          base_url: string | null
          created_at: string
          credentials: Json
          hotel_id: string
          id: string
          is_active: boolean
          last_auto_sync_date: string | null
          last_sync_at: string | null
          last_sync_error: string | null
          last_sync_status: string | null
          pms_type: string
          property_id: string | null
          sync_frequency: number
          updated_at: string
        }
        Insert: {
          auto_sync_enabled?: boolean
          auto_sync_time?: string
          base_url?: string | null
          created_at?: string
          credentials?: Json
          hotel_id: string
          id?: string
          is_active?: boolean
          last_auto_sync_date?: string | null
          last_sync_at?: string | null
          last_sync_error?: string | null
          last_sync_status?: string | null
          pms_type: string
          property_id?: string | null
          sync_frequency?: number
          updated_at?: string
        }
        Update: {
          auto_sync_enabled?: boolean
          auto_sync_time?: string
          base_url?: string | null
          created_at?: string
          credentials?: Json
          hotel_id?: string
          id?: string
          is_active?: boolean
          last_auto_sync_date?: string | null
          last_sync_at?: string | null
          last_sync_error?: string | null
          last_sync_status?: string | null
          pms_type?: string
          property_id?: string | null
          sync_frequency?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "hotel_pms_configs_hotel_id_fkey"
            columns: ["hotel_id"]
            isOneToOne: false
            referencedRelation: "hotels"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "hotel_pms_configs_hotel_id_fkey"
            columns: ["hotel_id"]
            isOneToOne: false
            referencedRelation: "hotels_stats_view"
            referencedColumns: ["id"]
          },
        ]
      }
      hotel_report_configs: {
        Row: {
          column_mappings: Json
          config_name: string
          created_at: string | null
          created_by: string | null
          detected_format: string | null
          exclusion_patterns: string[] | null
          hotel_id: string
          id: string
          last_used_at: string | null
          manual_corrections: Json | null
          status_mappings: Json
          updated_at: string | null
          usage_count: number | null
        }
        Insert: {
          column_mappings?: Json
          config_name?: string
          created_at?: string | null
          created_by?: string | null
          detected_format?: string | null
          exclusion_patterns?: string[] | null
          hotel_id: string
          id?: string
          last_used_at?: string | null
          manual_corrections?: Json | null
          status_mappings?: Json
          updated_at?: string | null
          usage_count?: number | null
        }
        Update: {
          column_mappings?: Json
          config_name?: string
          created_at?: string | null
          created_by?: string | null
          detected_format?: string | null
          exclusion_patterns?: string[] | null
          hotel_id?: string
          id?: string
          last_used_at?: string | null
          manual_corrections?: Json | null
          status_mappings?: Json
          updated_at?: string | null
          usage_count?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "hotel_report_configs_hotel_id_fkey"
            columns: ["hotel_id"]
            isOneToOne: false
            referencedRelation: "hotels"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "hotel_report_configs_hotel_id_fkey"
            columns: ["hotel_id"]
            isOneToOne: false
            referencedRelation: "hotels_stats_view"
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
          space_category: string | null
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
          space_category?: string | null
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
          space_category?: string | null
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
          {
            foreignKeyName: "hotel_rooms_registry_hotel_id_fkey"
            columns: ["hotel_id"]
            isOneToOne: false
            referencedRelation: "hotels_stats_view"
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
          {
            foreignKeyName: "hotel_sessions_hotel_id_fkey"
            columns: ["hotel_id"]
            isOneToOne: false
            referencedRelation: "hotels_stats_view"
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
          {
            foreignKeyName: "hotel_users_hotel_id_fkey"
            columns: ["hotel_id"]
            isOneToOne: false
            referencedRelation: "hotels_stats_view"
            referencedColumns: ["id"]
          },
        ]
      }
      hotels: {
        Row: {
          address: string | null
          auto_close_days: number[]
          auto_close_enabled: boolean
          auto_close_time: string
          auto_close_timezone: string
          created_at: string
          email: string
          hotel_code: string | null
          id: string
          import_mode: string | null
          last_auto_close_date: string | null
          name: string
          phone: string | null
          settings: Json | null
          status: string | null
          supplier_email: string | null
          updated_at: string
          user_id: string | null
        }
        Insert: {
          address?: string | null
          auto_close_days?: number[]
          auto_close_enabled?: boolean
          auto_close_time?: string
          auto_close_timezone?: string
          created_at?: string
          email: string
          hotel_code?: string | null
          id?: string
          import_mode?: string | null
          last_auto_close_date?: string | null
          name: string
          phone?: string | null
          settings?: Json | null
          status?: string | null
          supplier_email?: string | null
          updated_at?: string
          user_id?: string | null
        }
        Update: {
          address?: string | null
          auto_close_days?: number[]
          auto_close_enabled?: boolean
          auto_close_time?: string
          auto_close_timezone?: string
          created_at?: string
          email?: string
          hotel_code?: string | null
          id?: string
          import_mode?: string | null
          last_auto_close_date?: string | null
          name?: string
          phone?: string | null
          settings?: Json | null
          status?: string | null
          supplier_email?: string | null
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
            foreignKeyName: "housekeeper_access_codes_hotel_id_fkey"
            columns: ["hotel_id"]
            isOneToOne: false
            referencedRelation: "hotels_stats_view"
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
            foreignKeyName: "housekeeper_access_requests_hotel_id_fkey"
            columns: ["hotel_id"]
            isOneToOne: false
            referencedRelation: "hotels_stats_view"
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
          {
            foreignKeyName: "housekeeper_achievements_hotel_id_fkey"
            columns: ["hotel_id"]
            isOneToOne: false
            referencedRelation: "hotels_stats_view"
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
            foreignKeyName: "housekeeper_hotel_history_hotel_id_fkey"
            columns: ["hotel_id"]
            isOneToOne: false
            referencedRelation: "hotels_stats_view"
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
          {
            foreignKeyName: "housekeeper_invitations_hotel_id_fkey"
            columns: ["hotel_id"]
            isOneToOne: false
            referencedRelation: "hotels_stats_view"
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
          {
            foreignKeyName: "housekeeper_levels_hotel_id_fkey"
            columns: ["hotel_id"]
            isOneToOne: false
            referencedRelation: "hotels_stats_view"
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
            foreignKeyName: "fk_housekeepers_hotel"
            columns: ["hotel_id"]
            isOneToOne: false
            referencedRelation: "hotels_stats_view"
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
          {
            foreignKeyName: "incident_categories_hotel_id_fkey"
            columns: ["hotel_id"]
            isOneToOne: false
            referencedRelation: "hotels_stats_view"
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
          {
            foreignKeyName: "incident_items_hotel_id_fkey"
            columns: ["hotel_id"]
            isOneToOne: false
            referencedRelation: "hotels_stats_view"
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
          {
            foreignKeyName: "incident_types_hotel_id_fkey"
            columns: ["hotel_id"]
            isOneToOne: false
            referencedRelation: "hotels_stats_view"
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
            foreignKeyName: "incidents_hotel_id_fkey"
            columns: ["hotel_id"]
            isOneToOne: false
            referencedRelation: "hotels_stats_view"
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
      instruction_templates: {
        Row: {
          content: string
          created_at: string
          created_by: string | null
          day_of_week: number | null
          hotel_id: string
          id: string
          is_default: boolean | null
          name: string
          template_type: string
          updated_at: string
        }
        Insert: {
          content: string
          created_at?: string
          created_by?: string | null
          day_of_week?: number | null
          hotel_id: string
          id?: string
          is_default?: boolean | null
          name: string
          template_type: string
          updated_at?: string
        }
        Update: {
          content?: string
          created_at?: string
          created_by?: string | null
          day_of_week?: number | null
          hotel_id?: string
          id?: string
          is_default?: boolean | null
          name?: string
          template_type?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "instruction_templates_hotel_id_fkey"
            columns: ["hotel_id"]
            isOneToOne: false
            referencedRelation: "hotels"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "instruction_templates_hotel_id_fkey"
            columns: ["hotel_id"]
            isOneToOne: false
            referencedRelation: "hotels_stats_view"
            referencedColumns: ["id"]
          },
        ]
      }
      invoices: {
        Row: {
          amount_ht: number
          amount_ttc: number
          created_at: string
          customer_address: string | null
          customer_billing_email: string | null
          customer_company_name: string | null
          customer_email: string
          customer_siret: string | null
          hotel_id: string | null
          id: string
          invoice_date: string
          invoice_number: string
          payment_method: string | null
          payment_reference: string | null
          pdf_url: string | null
          period_end: string | null
          period_start: string | null
          plan_name: string
          plan_type: string
          seller_address: string
          seller_email: string
          seller_name: string
          seller_siret: string
          status: string
          tva_amount: number
          tva_rate: number
          updated_at: string
          user_id: string
        }
        Insert: {
          amount_ht: number
          amount_ttc: number
          created_at?: string
          customer_address?: string | null
          customer_billing_email?: string | null
          customer_company_name?: string | null
          customer_email: string
          customer_siret?: string | null
          hotel_id?: string | null
          id?: string
          invoice_date?: string
          invoice_number: string
          payment_method?: string | null
          payment_reference?: string | null
          pdf_url?: string | null
          period_end?: string | null
          period_start?: string | null
          plan_name: string
          plan_type: string
          seller_address?: string
          seller_email?: string
          seller_name?: string
          seller_siret?: string
          status?: string
          tva_amount: number
          tva_rate?: number
          updated_at?: string
          user_id: string
        }
        Update: {
          amount_ht?: number
          amount_ttc?: number
          created_at?: string
          customer_address?: string | null
          customer_billing_email?: string | null
          customer_company_name?: string | null
          customer_email?: string
          customer_siret?: string | null
          hotel_id?: string | null
          id?: string
          invoice_date?: string
          invoice_number?: string
          payment_method?: string | null
          payment_reference?: string | null
          pdf_url?: string | null
          period_end?: string | null
          period_start?: string | null
          plan_name?: string
          plan_type?: string
          seller_address?: string
          seller_email?: string
          seller_name?: string
          seller_siret?: string
          status?: string
          tva_amount?: number
          tva_rate?: number
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "invoices_hotel_id_fkey"
            columns: ["hotel_id"]
            isOneToOne: false
            referencedRelation: "hotels"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "invoices_hotel_id_fkey"
            columns: ["hotel_id"]
            isOneToOne: false
            referencedRelation: "hotels_stats_view"
            referencedColumns: ["id"]
          },
        ]
      }
      legal_pages: {
        Row: {
          content: string
          id: string
          language: string
          slug: string
          title: string
          updated_at: string | null
          updated_by: string | null
        }
        Insert: {
          content: string
          id?: string
          language?: string
          slug: string
          title: string
          updated_at?: string | null
          updated_by?: string | null
        }
        Update: {
          content?: string
          id?: string
          language?: string
          slug?: string
          title?: string
          updated_at?: string | null
          updated_by?: string | null
        }
        Relationships: []
      }
      linen_deliveries: {
        Row: {
          created_at: string | null
          created_by: string | null
          delivery_date: string
          delivery_reference: string | null
          document_url: string | null
          hotel_id: string
          id: string
          notes: string | null
          status: string
          supplier_name: string | null
          updated_at: string | null
          validated_at: string | null
          validated_by: string | null
        }
        Insert: {
          created_at?: string | null
          created_by?: string | null
          delivery_date?: string
          delivery_reference?: string | null
          document_url?: string | null
          hotel_id: string
          id?: string
          notes?: string | null
          status?: string
          supplier_name?: string | null
          updated_at?: string | null
          validated_at?: string | null
          validated_by?: string | null
        }
        Update: {
          created_at?: string | null
          created_by?: string | null
          delivery_date?: string
          delivery_reference?: string | null
          document_url?: string | null
          hotel_id?: string
          id?: string
          notes?: string | null
          status?: string
          supplier_name?: string | null
          updated_at?: string | null
          validated_at?: string | null
          validated_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "linen_deliveries_hotel_id_fkey"
            columns: ["hotel_id"]
            isOneToOne: false
            referencedRelation: "hotels"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "linen_deliveries_hotel_id_fkey"
            columns: ["hotel_id"]
            isOneToOne: false
            referencedRelation: "hotels_stats_view"
            referencedColumns: ["id"]
          },
        ]
      }
      linen_delivery_items: {
        Row: {
          counted_at: string | null
          created_at: string | null
          delivery_id: string
          difference: number | null
          id: string
          linen_type_id: string
          notes: string | null
          quantity_counted: number | null
          quantity_delivered: number
        }
        Insert: {
          counted_at?: string | null
          created_at?: string | null
          delivery_id: string
          difference?: number | null
          id?: string
          linen_type_id: string
          notes?: string | null
          quantity_counted?: number | null
          quantity_delivered?: number
        }
        Update: {
          counted_at?: string | null
          created_at?: string | null
          delivery_id?: string
          difference?: number | null
          id?: string
          linen_type_id?: string
          notes?: string | null
          quantity_counted?: number | null
          quantity_delivered?: number
        }
        Relationships: [
          {
            foreignKeyName: "linen_delivery_items_delivery_id_fkey"
            columns: ["delivery_id"]
            isOneToOne: false
            referencedRelation: "linen_deliveries"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "linen_delivery_items_linen_type_id_fkey"
            columns: ["linen_type_id"]
            isOneToOne: false
            referencedRelation: "linen_types"
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
          {
            foreignKeyName: "linen_inventory_tasks_hotel_id_fkey"
            columns: ["hotel_id"]
            isOneToOne: false
            referencedRelation: "hotels_stats_view"
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
          lighting_conditions: string | null
          linen_type_id: string
          notes: string | null
          ruler_detected: boolean | null
          scan_method: string | null
        }
        Insert: {
          actual_count: number
          ai_predicted_count?: number | null
          created_at?: string | null
          created_by: string
          hotel_id: string
          id?: string
          image_url: string
          lighting_conditions?: string | null
          linen_type_id: string
          notes?: string | null
          ruler_detected?: boolean | null
          scan_method?: string | null
        }
        Update: {
          actual_count?: number
          ai_predicted_count?: number | null
          created_at?: string | null
          created_by?: string
          hotel_id?: string
          id?: string
          image_url?: string
          lighting_conditions?: string | null
          linen_type_id?: string
          notes?: string | null
          ruler_detected?: boolean | null
          scan_method?: string | null
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
            foreignKeyName: "linen_training_samples_hotel_id_fkey"
            columns: ["hotel_id"]
            isOneToOne: false
            referencedRelation: "hotels_stats_view"
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
          average_thickness_cm: number | null
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
          average_thickness_cm?: number | null
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
          average_thickness_cm?: number | null
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
          {
            foreignKeyName: "linen_types_hotel_id_fkey"
            columns: ["hotel_id"]
            isOneToOne: false
            referencedRelation: "hotels_stats_view"
            referencedColumns: ["id"]
          },
        ]
      }
      lost_and_found: {
        Row: {
          admin_notes: string | null
          created_at: string
          guest_check_in: string | null
          guest_check_out: string | null
          guest_email: string | null
          guest_first_name: string | null
          guest_name: string | null
          guest_phone: string | null
          hotel_id: string
          id: string
          image_url: string | null
          location_details: string | null
          location_type: string
          object_category: string | null
          object_description: string
          reported_at: string
          reported_by: string
          reported_by_type: string
          room_number: string | null
          shipping_address: string | null
          status: string
          tracking_number: string | null
          updated_at: string
        }
        Insert: {
          admin_notes?: string | null
          created_at?: string
          guest_check_in?: string | null
          guest_check_out?: string | null
          guest_email?: string | null
          guest_first_name?: string | null
          guest_name?: string | null
          guest_phone?: string | null
          hotel_id: string
          id?: string
          image_url?: string | null
          location_details?: string | null
          location_type: string
          object_category?: string | null
          object_description: string
          reported_at?: string
          reported_by: string
          reported_by_type: string
          room_number?: string | null
          shipping_address?: string | null
          status?: string
          tracking_number?: string | null
          updated_at?: string
        }
        Update: {
          admin_notes?: string | null
          created_at?: string
          guest_check_in?: string | null
          guest_check_out?: string | null
          guest_email?: string | null
          guest_first_name?: string | null
          guest_name?: string | null
          guest_phone?: string | null
          hotel_id?: string
          id?: string
          image_url?: string | null
          location_details?: string | null
          location_type?: string
          object_category?: string | null
          object_description?: string
          reported_at?: string
          reported_by?: string
          reported_by_type?: string
          room_number?: string | null
          shipping_address?: string | null
          status?: string
          tracking_number?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "lost_and_found_hotel_id_fkey"
            columns: ["hotel_id"]
            isOneToOne: false
            referencedRelation: "hotels"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "lost_and_found_hotel_id_fkey"
            columns: ["hotel_id"]
            isOneToOne: false
            referencedRelation: "hotels_stats_view"
            referencedColumns: ["id"]
          },
        ]
      }
      lost_and_found_history: {
        Row: {
          action: string
          created_at: string
          id: string
          lost_item_id: string
          new_status: string | null
          notes: string | null
          old_status: string | null
          performed_by: string
          performed_by_type: string
        }
        Insert: {
          action: string
          created_at?: string
          id?: string
          lost_item_id: string
          new_status?: string | null
          notes?: string | null
          old_status?: string | null
          performed_by: string
          performed_by_type: string
        }
        Update: {
          action?: string
          created_at?: string
          id?: string
          lost_item_id?: string
          new_status?: string | null
          notes?: string | null
          old_status?: string | null
          performed_by?: string
          performed_by_type?: string
        }
        Relationships: [
          {
            foreignKeyName: "lost_and_found_history_lost_item_id_fkey"
            columns: ["lost_item_id"]
            isOneToOne: false
            referencedRelation: "lost_and_found"
            referencedColumns: ["id"]
          },
        ]
      }
      manual_tasks: {
        Row: {
          assigned_to_id: string | null
          assigned_to_name: string | null
          assigned_to_type: string
          completed_at: string | null
          completed_by_name: string | null
          created_at: string
          created_by: string | null
          description: string | null
          hotel_id: string
          id: string
          location_reference: string | null
          location_type: string
          notes: string | null
          priority: string | null
          started_at: string | null
          status: string
          task_date: string
          title: string
          updated_at: string
          validated_at: string | null
          validated_by: string | null
        }
        Insert: {
          assigned_to_id?: string | null
          assigned_to_name?: string | null
          assigned_to_type?: string
          completed_at?: string | null
          completed_by_name?: string | null
          created_at?: string
          created_by?: string | null
          description?: string | null
          hotel_id: string
          id?: string
          location_reference?: string | null
          location_type?: string
          notes?: string | null
          priority?: string | null
          started_at?: string | null
          status?: string
          task_date?: string
          title: string
          updated_at?: string
          validated_at?: string | null
          validated_by?: string | null
        }
        Update: {
          assigned_to_id?: string | null
          assigned_to_name?: string | null
          assigned_to_type?: string
          completed_at?: string | null
          completed_by_name?: string | null
          created_at?: string
          created_by?: string | null
          description?: string | null
          hotel_id?: string
          id?: string
          location_reference?: string | null
          location_type?: string
          notes?: string | null
          priority?: string | null
          started_at?: string | null
          status?: string
          task_date?: string
          title?: string
          updated_at?: string
          validated_at?: string | null
          validated_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "manual_tasks_hotel_id_fkey"
            columns: ["hotel_id"]
            isOneToOne: false
            referencedRelation: "hotels"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "manual_tasks_hotel_id_fkey"
            columns: ["hotel_id"]
            isOneToOne: false
            referencedRelation: "hotels_stats_view"
            referencedColumns: ["id"]
          },
        ]
      }
      netto_count_item_types: {
        Row: {
          created_at: string | null
          description: string | null
          display_order: number | null
          icon: string | null
          id: string
          is_active: boolean | null
          name: string
          updated_at: string | null
          user_id: string
        }
        Insert: {
          created_at?: string | null
          description?: string | null
          display_order?: number | null
          icon?: string | null
          id?: string
          is_active?: boolean | null
          name: string
          updated_at?: string | null
          user_id: string
        }
        Update: {
          created_at?: string | null
          description?: string | null
          display_order?: number | null
          icon?: string | null
          id?: string
          is_active?: boolean | null
          name?: string
          updated_at?: string | null
          user_id?: string
        }
        Relationships: []
      }
      netto_count_profiles: {
        Row: {
          confirmation_sent_at: string | null
          confirmation_token: string | null
          created_at: string | null
          email: string
          email_confirmed: boolean | null
          full_name: string | null
          id: string
          updated_at: string | null
          user_id: string
        }
        Insert: {
          confirmation_sent_at?: string | null
          confirmation_token?: string | null
          created_at?: string | null
          email: string
          email_confirmed?: boolean | null
          full_name?: string | null
          id?: string
          updated_at?: string | null
          user_id: string
        }
        Update: {
          confirmation_sent_at?: string | null
          confirmation_token?: string | null
          created_at?: string | null
          email?: string
          email_confirmed?: boolean | null
          full_name?: string | null
          id?: string
          updated_at?: string | null
          user_id?: string
        }
        Relationships: []
      }
      netto_count_results: {
        Row: {
          confidence: number | null
          count: number | null
          created_at: string | null
          frame_number: number | null
          id: string
          item_name: string
          item_type_id: string | null
          notes: string | null
          scan_id: string
          source_file: string | null
          user_id: string
        }
        Insert: {
          confidence?: number | null
          count?: number | null
          created_at?: string | null
          frame_number?: number | null
          id?: string
          item_name: string
          item_type_id?: string | null
          notes?: string | null
          scan_id: string
          source_file?: string | null
          user_id: string
        }
        Update: {
          confidence?: number | null
          count?: number | null
          created_at?: string | null
          frame_number?: number | null
          id?: string
          item_name?: string
          item_type_id?: string | null
          notes?: string | null
          scan_id?: string
          source_file?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "netto_count_results_item_type_id_fkey"
            columns: ["item_type_id"]
            isOneToOne: false
            referencedRelation: "netto_count_item_types"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "netto_count_results_scan_id_fkey"
            columns: ["scan_id"]
            isOneToOne: false
            referencedRelation: "netto_count_scans"
            referencedColumns: ["id"]
          },
        ]
      }
      netto_count_scans: {
        Row: {
          completed_at: string | null
          created_at: string | null
          error_message: string | null
          id: string
          processing_time_ms: number | null
          scan_name: string | null
          scan_type: string | null
          selected_item_types: string[] | null
          status: string | null
          total_items_counted: number | null
          user_id: string
        }
        Insert: {
          completed_at?: string | null
          created_at?: string | null
          error_message?: string | null
          id?: string
          processing_time_ms?: number | null
          scan_name?: string | null
          scan_type?: string | null
          selected_item_types?: string[] | null
          status?: string | null
          total_items_counted?: number | null
          user_id: string
        }
        Update: {
          completed_at?: string | null
          created_at?: string | null
          error_message?: string | null
          id?: string
          processing_time_ms?: number | null
          scan_name?: string | null
          scan_type?: string | null
          selected_item_types?: string[] | null
          status?: string | null
          total_items_counted?: number | null
          user_id?: string
        }
        Relationships: []
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
      pattern_improvement_requests: {
        Row: {
          admin_notes: string | null
          created_at: string | null
          detected_keywords: string[] | null
          detected_pms_type: string | null
          expected_pms_type: string | null
          hotel_id: string
          id: string
          mismatch_score: number | null
          report_sample: string
          status: string | null
          submitted_by: string
          updated_at: string | null
        }
        Insert: {
          admin_notes?: string | null
          created_at?: string | null
          detected_keywords?: string[] | null
          detected_pms_type?: string | null
          expected_pms_type?: string | null
          hotel_id: string
          id?: string
          mismatch_score?: number | null
          report_sample: string
          status?: string | null
          submitted_by: string
          updated_at?: string | null
        }
        Update: {
          admin_notes?: string | null
          created_at?: string | null
          detected_keywords?: string[] | null
          detected_pms_type?: string | null
          expected_pms_type?: string | null
          hotel_id?: string
          id?: string
          mismatch_score?: number | null
          report_sample?: string
          status?: string | null
          submitted_by?: string
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "pattern_improvement_requests_hotel_id_fkey"
            columns: ["hotel_id"]
            isOneToOne: false
            referencedRelation: "hotels"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "pattern_improvement_requests_hotel_id_fkey"
            columns: ["hotel_id"]
            isOneToOne: false
            referencedRelation: "hotels_stats_view"
            referencedColumns: ["id"]
          },
        ]
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
          {
            foreignKeyName: "pattern_validation_history_hotel_id_fkey"
            columns: ["hotel_id"]
            isOneToOne: false
            referencedRelation: "hotels_stats_view"
            referencedColumns: ["id"]
          },
        ]
      }
      pending_subscriptions: {
        Row: {
          amount: number
          billing_request_id: string
          created_at: string
          id: string
          plan_type: string
          status: string
          updated_at: string
          user_id: string
        }
        Insert: {
          amount: number
          billing_request_id: string
          created_at?: string
          id?: string
          plan_type?: string
          status?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          amount?: number
          billing_request_id?: string
          created_at?: string
          id?: string
          plan_type?: string
          status?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      permission_role_templates: {
        Row: {
          created_at: string | null
          default_permissions: Json | null
          description: string | null
          display_name: string
          id: string
          is_system: boolean | null
          role_name: string
        }
        Insert: {
          created_at?: string | null
          default_permissions?: Json | null
          description?: string | null
          display_name: string
          id?: string
          is_system?: boolean | null
          role_name: string
        }
        Update: {
          created_at?: string | null
          default_permissions?: Json | null
          description?: string | null
          display_name?: string
          id?: string
          is_system?: boolean | null
          role_name?: string
        }
        Relationships: []
      }
      phone_orders: {
        Row: {
          created_at: string
          daily_housekeepers: number
          hotel_id: string
          id: string
          notes: string | null
          phone_count: number
          shipping_address: string | null
          status: string
          total_price: number
          tracking_number: string | null
          unit_price: number
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          daily_housekeepers?: number
          hotel_id: string
          id?: string
          notes?: string | null
          phone_count?: number
          shipping_address?: string | null
          status?: string
          total_price?: number
          tracking_number?: string | null
          unit_price?: number
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          daily_housekeepers?: number
          hotel_id?: string
          id?: string
          notes?: string | null
          phone_count?: number
          shipping_address?: string | null
          status?: string
          total_price?: number
          tracking_number?: string | null
          unit_price?: number
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "phone_orders_hotel_id_fkey"
            columns: ["hotel_id"]
            isOneToOne: false
            referencedRelation: "hotels"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "phone_orders_hotel_id_fkey"
            columns: ["hotel_id"]
            isOneToOne: false
            referencedRelation: "hotels_stats_view"
            referencedColumns: ["id"]
          },
        ]
      }
      pms_pending_rooms: {
        Row: {
          created_at: string
          detected_at: string
          floor: number | null
          hotel_id: string
          id: string
          pms_type: string | null
          resolved_at: string | null
          room_number: string
          room_type: string | null
          status: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          detected_at?: string
          floor?: number | null
          hotel_id: string
          id?: string
          pms_type?: string | null
          resolved_at?: string | null
          room_number: string
          room_type?: string | null
          status?: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          detected_at?: string
          floor?: number | null
          hotel_id?: string
          id?: string
          pms_type?: string | null
          resolved_at?: string | null
          room_number?: string
          room_type?: string | null
          status?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "pms_pending_rooms_hotel_id_fkey"
            columns: ["hotel_id"]
            isOneToOne: false
            referencedRelation: "hotels"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "pms_pending_rooms_hotel_id_fkey"
            columns: ["hotel_id"]
            isOneToOne: false
            referencedRelation: "hotels_stats_view"
            referencedColumns: ["id"]
          },
        ]
      }
      pms_rules: {
        Row: {
          combination_rules: Json | null
          created_at: string | null
          created_by: string | null
          date_formats: string[] | null
          hotel_id: string | null
          id: string
          is_active: boolean | null
          is_default: boolean | null
          keywords: string[] | null
          pms_type: string
          priority: number | null
          room_number_regex: string | null
          rule_name: string
          source: string | null
          status_mappings: Json | null
          updated_at: string | null
        }
        Insert: {
          combination_rules?: Json | null
          created_at?: string | null
          created_by?: string | null
          date_formats?: string[] | null
          hotel_id?: string | null
          id?: string
          is_active?: boolean | null
          is_default?: boolean | null
          keywords?: string[] | null
          pms_type: string
          priority?: number | null
          room_number_regex?: string | null
          rule_name: string
          source?: string | null
          status_mappings?: Json | null
          updated_at?: string | null
        }
        Update: {
          combination_rules?: Json | null
          created_at?: string | null
          created_by?: string | null
          date_formats?: string[] | null
          hotel_id?: string | null
          id?: string
          is_active?: boolean | null
          is_default?: boolean | null
          keywords?: string[] | null
          pms_type?: string
          priority?: number | null
          room_number_regex?: string | null
          rule_name?: string
          source?: string | null
          status_mappings?: Json | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "pms_rules_hotel_id_fkey"
            columns: ["hotel_id"]
            isOneToOne: false
            referencedRelation: "hotels"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "pms_rules_hotel_id_fkey"
            columns: ["hotel_id"]
            isOneToOne: false
            referencedRelation: "hotels_stats_view"
            referencedColumns: ["id"]
          },
        ]
      }
      pms_sync_logs: {
        Row: {
          details: Json | null
          error_message: string | null
          hotel_id: string
          id: string
          pms_type: string
          rooms_synced: number | null
          status: string
          sync_ended_at: string | null
          sync_started_at: string
        }
        Insert: {
          details?: Json | null
          error_message?: string | null
          hotel_id: string
          id?: string
          pms_type: string
          rooms_synced?: number | null
          status?: string
          sync_ended_at?: string | null
          sync_started_at?: string
        }
        Update: {
          details?: Json | null
          error_message?: string | null
          hotel_id?: string
          id?: string
          pms_type?: string
          rooms_synced?: number | null
          status?: string
          sync_ended_at?: string | null
          sync_started_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "pms_sync_logs_hotel_id_fkey"
            columns: ["hotel_id"]
            isOneToOne: false
            referencedRelation: "hotels"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "pms_sync_logs_hotel_id_fkey"
            columns: ["hotel_id"]
            isOneToOne: false
            referencedRelation: "hotels_stats_view"
            referencedColumns: ["id"]
          },
        ]
      }
      pms_sync_queue: {
        Row: {
          attempts: number
          created_at: string
          hotel_id: string
          id: string
          last_error: string | null
          max_attempts: number
          next_attempt_at: string
          room_number: string
          state: string
          status: string
          updated_at: string
        }
        Insert: {
          attempts?: number
          created_at?: string
          hotel_id: string
          id?: string
          last_error?: string | null
          max_attempts?: number
          next_attempt_at?: string
          room_number: string
          state?: string
          status: string
          updated_at?: string
        }
        Update: {
          attempts?: number
          created_at?: string
          hotel_id?: string
          id?: string
          last_error?: string | null
          max_attempts?: number
          next_attempt_at?: string
          room_number?: string
          state?: string
          status?: string
          updated_at?: string
        }
        Relationships: []
      }
      pricing_config: {
        Row: {
          created_at: string | null
          features: Json
          id: string
          is_active: boolean | null
          max_rooms: number | null
          plan_name: string
          price_monthly: number
          price_yearly: number | null
          trial_days: number
          updated_at: string | null
        }
        Insert: {
          created_at?: string | null
          features?: Json
          id?: string
          is_active?: boolean | null
          max_rooms?: number | null
          plan_name: string
          price_monthly?: number
          price_yearly?: number | null
          trial_days?: number
          updated_at?: string | null
        }
        Update: {
          created_at?: string | null
          features?: Json
          id?: string
          is_active?: boolean | null
          max_rooms?: number | null
          plan_name?: string
          price_monthly?: number
          price_yearly?: number | null
          trial_days?: number
          updated_at?: string | null
        }
        Relationships: []
      }
      profiles: {
        Row: {
          ai_features_enabled: boolean
          billing_address: string | null
          billing_city: string | null
          billing_company_name: string | null
          billing_contact_email: string | null
          billing_contact_name: string | null
          billing_country: string | null
          billing_email: string | null
          billing_phone: string | null
          billing_postal_code: string | null
          billing_siret: string | null
          billing_tva_number: string | null
          company_name: string | null
          country_code: string | null
          created_at: string
          current_hotel_id: string | null
          email: string
          features_enabled: Json | null
          gocardless_customer_id: string | null
          gocardless_mandate_id: string | null
          id: string
          is_b2b_reverse_charge: boolean | null
          is_suspended: boolean
          max_rooms: number | null
          onboarding_completed_at: string | null
          plan: string | null
          preferred_language: string | null
          subscription_started_at: string | null
          subscription_status: string | null
          subscription_type: string | null
          suspension_reason: string | null
          trial_duration_months: number | null
          trial_end_date: string | null
          trial_extension_days: number | null
          trial_extension_granted_at: string | null
          trial_extension_granted_by: string | null
          trial_extension_reason: string | null
          trial_reminder_sent_at: string | null
          trial_start_date: string | null
          trial_warning_level: number | null
          updated_at: string
          vat_number: string | null
        }
        Insert: {
          ai_features_enabled?: boolean
          billing_address?: string | null
          billing_city?: string | null
          billing_company_name?: string | null
          billing_contact_email?: string | null
          billing_contact_name?: string | null
          billing_country?: string | null
          billing_email?: string | null
          billing_phone?: string | null
          billing_postal_code?: string | null
          billing_siret?: string | null
          billing_tva_number?: string | null
          company_name?: string | null
          country_code?: string | null
          created_at?: string
          current_hotel_id?: string | null
          email: string
          features_enabled?: Json | null
          gocardless_customer_id?: string | null
          gocardless_mandate_id?: string | null
          id: string
          is_b2b_reverse_charge?: boolean | null
          is_suspended?: boolean
          max_rooms?: number | null
          onboarding_completed_at?: string | null
          plan?: string | null
          preferred_language?: string | null
          subscription_started_at?: string | null
          subscription_status?: string | null
          subscription_type?: string | null
          suspension_reason?: string | null
          trial_duration_months?: number | null
          trial_end_date?: string | null
          trial_extension_days?: number | null
          trial_extension_granted_at?: string | null
          trial_extension_granted_by?: string | null
          trial_extension_reason?: string | null
          trial_reminder_sent_at?: string | null
          trial_start_date?: string | null
          trial_warning_level?: number | null
          updated_at?: string
          vat_number?: string | null
        }
        Update: {
          ai_features_enabled?: boolean
          billing_address?: string | null
          billing_city?: string | null
          billing_company_name?: string | null
          billing_contact_email?: string | null
          billing_contact_name?: string | null
          billing_country?: string | null
          billing_email?: string | null
          billing_phone?: string | null
          billing_postal_code?: string | null
          billing_siret?: string | null
          billing_tva_number?: string | null
          company_name?: string | null
          country_code?: string | null
          created_at?: string
          current_hotel_id?: string | null
          email?: string
          features_enabled?: Json | null
          gocardless_customer_id?: string | null
          gocardless_mandate_id?: string | null
          id?: string
          is_b2b_reverse_charge?: boolean | null
          is_suspended?: boolean
          max_rooms?: number | null
          onboarding_completed_at?: string | null
          plan?: string | null
          preferred_language?: string | null
          subscription_started_at?: string | null
          subscription_status?: string | null
          subscription_type?: string | null
          suspension_reason?: string | null
          trial_duration_months?: number | null
          trial_end_date?: string | null
          trial_extension_days?: number | null
          trial_extension_granted_at?: string | null
          trial_extension_granted_by?: string | null
          trial_extension_reason?: string | null
          trial_reminder_sent_at?: string | null
          trial_start_date?: string | null
          trial_warning_level?: number | null
          updated_at?: string
          vat_number?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "profiles_current_hotel_id_fkey"
            columns: ["current_hotel_id"]
            isOneToOne: false
            referencedRelation: "hotels"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "profiles_current_hotel_id_fkey"
            columns: ["current_hotel_id"]
            isOneToOne: false
            referencedRelation: "hotels_stats_view"
            referencedColumns: ["id"]
          },
        ]
      }
      promo_code_uses: {
        Row: {
          discount_applied: number | null
          id: string
          promo_code_id: string
          subscription_id: string | null
          used_at: string | null
          user_id: string
        }
        Insert: {
          discount_applied?: number | null
          id?: string
          promo_code_id: string
          subscription_id?: string | null
          used_at?: string | null
          user_id: string
        }
        Update: {
          discount_applied?: number | null
          id?: string
          promo_code_id?: string
          subscription_id?: string | null
          used_at?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "promo_code_uses_promo_code_id_fkey"
            columns: ["promo_code_id"]
            isOneToOne: false
            referencedRelation: "promo_codes"
            referencedColumns: ["id"]
          },
        ]
      }
      promo_codes: {
        Row: {
          applicable_plans: string[] | null
          code: string
          created_at: string | null
          created_by: string
          current_uses: number | null
          description: string | null
          discount_type: string
          discount_value: number
          id: string
          is_active: boolean | null
          max_uses: number | null
          updated_at: string | null
          valid_from: string | null
          valid_until: string | null
        }
        Insert: {
          applicable_plans?: string[] | null
          code: string
          created_at?: string | null
          created_by: string
          current_uses?: number | null
          description?: string | null
          discount_type: string
          discount_value: number
          id?: string
          is_active?: boolean | null
          max_uses?: number | null
          updated_at?: string | null
          valid_from?: string | null
          valid_until?: string | null
        }
        Update: {
          applicable_plans?: string[] | null
          code?: string
          created_at?: string | null
          created_by?: string
          current_uses?: number | null
          description?: string | null
          discount_type?: string
          discount_value?: number
          id?: string
          is_active?: boolean | null
          max_uses?: number | null
          updated_at?: string | null
          valid_from?: string | null
          valid_until?: string | null
        }
        Relationships: []
      }
      report_templates: {
        Row: {
          content: Json
          created_at: string
          created_by: string | null
          hotel_id: string
          id: string
          is_default: boolean | null
          name: string
          template_type: string
          updated_at: string
        }
        Insert: {
          content?: Json
          created_at?: string
          created_by?: string | null
          hotel_id: string
          id?: string
          is_default?: boolean | null
          name: string
          template_type: string
          updated_at?: string
        }
        Update: {
          content?: Json
          created_at?: string
          created_by?: string | null
          hotel_id?: string
          id?: string
          is_default?: boolean | null
          name?: string
          template_type?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "report_templates_hotel_id_fkey"
            columns: ["hotel_id"]
            isOneToOne: false
            referencedRelation: "hotels"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "report_templates_hotel_id_fkey"
            columns: ["hotel_id"]
            isOneToOne: false
            referencedRelation: "hotels_stats_view"
            referencedColumns: ["id"]
          },
        ]
      }
      report_training_patterns: {
        Row: {
          accuracy_score: number | null
          assigned_to_hotel_id: string | null
          attribution_reason: string | null
          created_at: string
          created_by: string
          detection_rules: Json | null
          extracted_data: Json
          hotel_id: string
          id: string
          is_default: boolean | null
          pattern_name: string | null
          pms_type: string | null
          raw_text: string
          report_name: string
          updated_at: string
          validated: boolean
          validation_notes: string | null
        }
        Insert: {
          accuracy_score?: number | null
          assigned_to_hotel_id?: string | null
          attribution_reason?: string | null
          created_at?: string
          created_by: string
          detection_rules?: Json | null
          extracted_data?: Json
          hotel_id: string
          id?: string
          is_default?: boolean | null
          pattern_name?: string | null
          pms_type?: string | null
          raw_text: string
          report_name: string
          updated_at?: string
          validated?: boolean
          validation_notes?: string | null
        }
        Update: {
          accuracy_score?: number | null
          assigned_to_hotel_id?: string | null
          attribution_reason?: string | null
          created_at?: string
          created_by?: string
          detection_rules?: Json | null
          extracted_data?: Json
          hotel_id?: string
          id?: string
          is_default?: boolean | null
          pattern_name?: string | null
          pms_type?: string | null
          raw_text?: string
          report_name?: string
          updated_at?: string
          validated?: boolean
          validation_notes?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "report_training_patterns_assigned_to_hotel_id_fkey"
            columns: ["assigned_to_hotel_id"]
            isOneToOne: false
            referencedRelation: "hotels"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "report_training_patterns_assigned_to_hotel_id_fkey"
            columns: ["assigned_to_hotel_id"]
            isOneToOne: false
            referencedRelation: "hotels_stats_view"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "report_training_patterns_hotel_id_fkey"
            columns: ["hotel_id"]
            isOneToOne: false
            referencedRelation: "hotels"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "report_training_patterns_hotel_id_fkey"
            columns: ["hotel_id"]
            isOneToOne: false
            referencedRelation: "hotels_stats_view"
            referencedColumns: ["id"]
          },
        ]
      }
      room_characteristics: {
        Row: {
          amenities: Json
          bathroom_type: string | null
          bed_count: number | null
          bed_dimensions: string | null
          bed_type: string | null
          created_at: string
          custom_fields: Json
          desk_dimensions: string | null
          has_bathtub: boolean | null
          has_shower: boolean | null
          hotel_id: string
          id: string
          notes: string | null
          room_area_sqm: number | null
          room_registry_id: string
          template_id: string | null
          updated_at: string
          view_type: string | null
        }
        Insert: {
          amenities?: Json
          bathroom_type?: string | null
          bed_count?: number | null
          bed_dimensions?: string | null
          bed_type?: string | null
          created_at?: string
          custom_fields?: Json
          desk_dimensions?: string | null
          has_bathtub?: boolean | null
          has_shower?: boolean | null
          hotel_id: string
          id?: string
          notes?: string | null
          room_area_sqm?: number | null
          room_registry_id: string
          template_id?: string | null
          updated_at?: string
          view_type?: string | null
        }
        Update: {
          amenities?: Json
          bathroom_type?: string | null
          bed_count?: number | null
          bed_dimensions?: string | null
          bed_type?: string | null
          created_at?: string
          custom_fields?: Json
          desk_dimensions?: string | null
          has_bathtub?: boolean | null
          has_shower?: boolean | null
          hotel_id?: string
          id?: string
          notes?: string | null
          room_area_sqm?: number | null
          room_registry_id?: string
          template_id?: string | null
          updated_at?: string
          view_type?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "room_characteristics_hotel_id_fkey"
            columns: ["hotel_id"]
            isOneToOne: false
            referencedRelation: "hotels"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "room_characteristics_hotel_id_fkey"
            columns: ["hotel_id"]
            isOneToOne: false
            referencedRelation: "hotels_stats_view"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "room_characteristics_room_registry_id_fkey"
            columns: ["room_registry_id"]
            isOneToOne: true
            referencedRelation: "hotel_rooms_registry"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "room_characteristics_template_id_fkey"
            columns: ["template_id"]
            isOneToOne: false
            referencedRelation: "room_type_templates"
            referencedColumns: ["id"]
          },
        ]
      }
      room_inspections: {
        Row: {
          cleanliness_score: number | null
          created_at: string | null
          governess_id: string | null
          governess_name: string
          hotel_id: string
          id: string
          inspected_at: string | null
          inspection_date: string | null
          issues: string[] | null
          notes: string | null
          photos: string[] | null
          room_id: string
          status: string | null
          updated_at: string | null
        }
        Insert: {
          cleanliness_score?: number | null
          created_at?: string | null
          governess_id?: string | null
          governess_name: string
          hotel_id: string
          id?: string
          inspected_at?: string | null
          inspection_date?: string | null
          issues?: string[] | null
          notes?: string | null
          photos?: string[] | null
          room_id: string
          status?: string | null
          updated_at?: string | null
        }
        Update: {
          cleanliness_score?: number | null
          created_at?: string | null
          governess_id?: string | null
          governess_name?: string
          hotel_id?: string
          id?: string
          inspected_at?: string | null
          inspection_date?: string | null
          issues?: string[] | null
          notes?: string | null
          photos?: string[] | null
          room_id?: string
          status?: string | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "room_inspections_governess_id_fkey"
            columns: ["governess_id"]
            isOneToOne: false
            referencedRelation: "governess_profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "room_inspections_hotel_id_fkey"
            columns: ["hotel_id"]
            isOneToOne: false
            referencedRelation: "hotels"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "room_inspections_hotel_id_fkey"
            columns: ["hotel_id"]
            isOneToOne: false
            referencedRelation: "hotels_stats_view"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "room_inspections_room_id_fkey"
            columns: ["room_id"]
            isOneToOne: false
            referencedRelation: "rooms"
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
          {
            foreignKeyName: "room_status_updates_hotel_id_fkey"
            columns: ["hotel_id"]
            isOneToOne: false
            referencedRelation: "hotels_stats_view"
            referencedColumns: ["id"]
          },
        ]
      }
      room_type_templates: {
        Row: {
          created_at: string
          default_amenities: Json
          default_characteristics: Json
          default_equipments: Json
          description: string | null
          hotel_id: string
          id: string
          name: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          default_amenities?: Json
          default_characteristics?: Json
          default_equipments?: Json
          description?: string | null
          hotel_id: string
          id?: string
          name: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          default_amenities?: Json
          default_characteristics?: Json
          default_equipments?: Json
          description?: string | null
          hotel_id?: string
          id?: string
          name?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "room_type_templates_hotel_id_fkey"
            columns: ["hotel_id"]
            isOneToOne: false
            referencedRelation: "hotels"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "room_type_templates_hotel_id_fkey"
            columns: ["hotel_id"]
            isOneToOne: false
            referencedRelation: "hotels_stats_view"
            referencedColumns: ["id"]
          },
        ]
      }
      rooms: {
        Row: {
          breakfast_included: boolean
          cleaning_priority: number | null
          cleaning_type: string | null
          created_at: string
          do_not_disturb: boolean
          estimated_time: number | null
          floor: number | null
          hotel_id: string
          id: string
          inspected_at: string | null
          inspected_by: string | null
          inspection_requested_at: string | null
          inspection_requested_by: string | null
          is_twin: boolean | null
          last_cleaned_at: string | null
          needs_inspection: boolean | null
          notes: string | null
          room_number: string
          room_type: string | null
          status: string
          updated_at: string
        }
        Insert: {
          breakfast_included?: boolean
          cleaning_priority?: number | null
          cleaning_type?: string | null
          created_at?: string
          do_not_disturb?: boolean
          estimated_time?: number | null
          floor?: number | null
          hotel_id: string
          id?: string
          inspected_at?: string | null
          inspected_by?: string | null
          inspection_requested_at?: string | null
          inspection_requested_by?: string | null
          is_twin?: boolean | null
          last_cleaned_at?: string | null
          needs_inspection?: boolean | null
          notes?: string | null
          room_number: string
          room_type?: string | null
          status?: string
          updated_at?: string
        }
        Update: {
          breakfast_included?: boolean
          cleaning_priority?: number | null
          cleaning_type?: string | null
          created_at?: string
          do_not_disturb?: boolean
          estimated_time?: number | null
          floor?: number | null
          hotel_id?: string
          id?: string
          inspected_at?: string | null
          inspected_by?: string | null
          inspection_requested_at?: string | null
          inspection_requested_by?: string | null
          is_twin?: boolean | null
          last_cleaned_at?: string | null
          needs_inspection?: boolean | null
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
          {
            foreignKeyName: "rooms_hotel_id_fkey"
            columns: ["hotel_id"]
            isOneToOne: false
            referencedRelation: "hotels_stats_view"
            referencedColumns: ["id"]
          },
        ]
      }
      space_characteristics: {
        Row: {
          amenities: Json
          common_space_id: string
          created_at: string
          custom_fields: Json
          hotel_id: string
          id: string
          notes: string | null
          updated_at: string
        }
        Insert: {
          amenities?: Json
          common_space_id: string
          created_at?: string
          custom_fields?: Json
          hotel_id: string
          id?: string
          notes?: string | null
          updated_at?: string
        }
        Update: {
          amenities?: Json
          common_space_id?: string
          created_at?: string
          custom_fields?: Json
          hotel_id?: string
          id?: string
          notes?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "space_characteristics_common_space_id_fkey"
            columns: ["common_space_id"]
            isOneToOne: true
            referencedRelation: "common_spaces"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "space_characteristics_hotel_id_fkey"
            columns: ["hotel_id"]
            isOneToOne: false
            referencedRelation: "hotels"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "space_characteristics_hotel_id_fkey"
            columns: ["hotel_id"]
            isOneToOne: false
            referencedRelation: "hotels_stats_view"
            referencedColumns: ["id"]
          },
        ]
      }
      staff_invitations: {
        Row: {
          accepted_at: string | null
          created_at: string | null
          email: string
          expires_at: string | null
          hotel_id: string
          id: string
          invitation_code: string
          invited_by: string | null
          name: string
          role: string
          sent_at: string | null
          status: string | null
          updated_at: string | null
        }
        Insert: {
          accepted_at?: string | null
          created_at?: string | null
          email: string
          expires_at?: string | null
          hotel_id: string
          id?: string
          invitation_code: string
          invited_by?: string | null
          name: string
          role: string
          sent_at?: string | null
          status?: string | null
          updated_at?: string | null
        }
        Update: {
          accepted_at?: string | null
          created_at?: string | null
          email?: string
          expires_at?: string | null
          hotel_id?: string
          id?: string
          invitation_code?: string
          invited_by?: string | null
          name?: string
          role?: string
          sent_at?: string | null
          status?: string | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "staff_invitations_hotel_id_fkey"
            columns: ["hotel_id"]
            isOneToOne: false
            referencedRelation: "hotels"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "staff_invitations_hotel_id_fkey"
            columns: ["hotel_id"]
            isOneToOne: false
            referencedRelation: "hotels_stats_view"
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
            foreignKeyName: "staff_role_permissions_hotel_id_fkey"
            columns: ["hotel_id"]
            isOneToOne: false
            referencedRelation: "hotels_stats_view"
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
          {
            foreignKeyName: "staff_roles_hotel_id_fkey"
            columns: ["hotel_id"]
            isOneToOne: false
            referencedRelation: "hotels_stats_view"
            referencedColumns: ["id"]
          },
        ]
      }
      staff_timesheets: {
        Row: {
          break_minutes: number | null
          created_at: string
          end_time: string | null
          hotel_id: string
          housekeeper_profile_id: string | null
          id: string
          incidents_reported: number | null
          modified_at: string | null
          modified_by: string | null
          modified_by_name: string | null
          notes: string | null
          original_end_time: string | null
          original_start_time: string | null
          rooms_cleaned: number | null
          rooms_depart: number | null
          rooms_inspected: number | null
          rooms_recouche: number | null
          staff_id: string | null
          staff_name: string
          staff_type: string
          start_time: string | null
          status: string
          updated_at: string
          validated_at: string | null
          validated_by: string | null
          validated_by_name: string | null
          work_date: string
        }
        Insert: {
          break_minutes?: number | null
          created_at?: string
          end_time?: string | null
          hotel_id: string
          housekeeper_profile_id?: string | null
          id?: string
          incidents_reported?: number | null
          modified_at?: string | null
          modified_by?: string | null
          modified_by_name?: string | null
          notes?: string | null
          original_end_time?: string | null
          original_start_time?: string | null
          rooms_cleaned?: number | null
          rooms_depart?: number | null
          rooms_inspected?: number | null
          rooms_recouche?: number | null
          staff_id?: string | null
          staff_name: string
          staff_type: string
          start_time?: string | null
          status?: string
          updated_at?: string
          validated_at?: string | null
          validated_by?: string | null
          validated_by_name?: string | null
          work_date?: string
        }
        Update: {
          break_minutes?: number | null
          created_at?: string
          end_time?: string | null
          hotel_id?: string
          housekeeper_profile_id?: string | null
          id?: string
          incidents_reported?: number | null
          modified_at?: string | null
          modified_by?: string | null
          modified_by_name?: string | null
          notes?: string | null
          original_end_time?: string | null
          original_start_time?: string | null
          rooms_cleaned?: number | null
          rooms_depart?: number | null
          rooms_inspected?: number | null
          rooms_recouche?: number | null
          staff_id?: string | null
          staff_name?: string
          staff_type?: string
          start_time?: string | null
          status?: string
          updated_at?: string
          validated_at?: string | null
          validated_by?: string | null
          validated_by_name?: string | null
          work_date?: string
        }
        Relationships: [
          {
            foreignKeyName: "staff_timesheets_hotel_id_fkey"
            columns: ["hotel_id"]
            isOneToOne: false
            referencedRelation: "hotels"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "staff_timesheets_hotel_id_fkey"
            columns: ["hotel_id"]
            isOneToOne: false
            referencedRelation: "hotels_stats_view"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "staff_timesheets_housekeeper_profile_id_fkey"
            columns: ["housekeeper_profile_id"]
            isOneToOne: false
            referencedRelation: "housekeeper_profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      sub_account_invitations: {
        Row: {
          accepted_at: string | null
          created_at: string | null
          expires_at: string
          id: string
          invitation_code: string
          sent_at: string | null
          status: string
          sub_account_id: string
          updated_at: string | null
        }
        Insert: {
          accepted_at?: string | null
          created_at?: string | null
          expires_at?: string
          id?: string
          invitation_code: string
          sent_at?: string | null
          status?: string
          sub_account_id: string
          updated_at?: string | null
        }
        Update: {
          accepted_at?: string | null
          created_at?: string | null
          expires_at?: string
          id?: string
          invitation_code?: string
          sent_at?: string | null
          status?: string
          sub_account_id?: string
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "sub_account_invitations_sub_account_id_fkey"
            columns: ["sub_account_id"]
            isOneToOne: false
            referencedRelation: "sub_accounts"
            referencedColumns: ["id"]
          },
        ]
      }
      sub_account_permissions: {
        Row: {
          created_at: string | null
          id: string
          is_allowed: boolean | null
          permission_key: string
          sub_account_id: string
        }
        Insert: {
          created_at?: string | null
          id?: string
          is_allowed?: boolean | null
          permission_key: string
          sub_account_id: string
        }
        Update: {
          created_at?: string | null
          id?: string
          is_allowed?: boolean | null
          permission_key?: string
          sub_account_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "sub_account_permissions_sub_account_id_fkey"
            columns: ["sub_account_id"]
            isOneToOne: false
            referencedRelation: "sub_accounts"
            referencedColumns: ["id"]
          },
        ]
      }
      sub_accounts: {
        Row: {
          created_at: string | null
          created_by: string | null
          email: string
          first_name: string
          hotel_id: string | null
          id: string
          invitation_code: string | null
          invitation_status: string | null
          is_active: boolean | null
          last_login_at: string | null
          last_name: string
          parent_user_id: string
          role_name: string | null
          updated_at: string | null
          user_id: string | null
        }
        Insert: {
          created_at?: string | null
          created_by?: string | null
          email: string
          first_name: string
          hotel_id?: string | null
          id?: string
          invitation_code?: string | null
          invitation_status?: string | null
          is_active?: boolean | null
          last_login_at?: string | null
          last_name: string
          parent_user_id: string
          role_name?: string | null
          updated_at?: string | null
          user_id?: string | null
        }
        Update: {
          created_at?: string | null
          created_by?: string | null
          email?: string
          first_name?: string
          hotel_id?: string | null
          id?: string
          invitation_code?: string | null
          invitation_status?: string | null
          is_active?: boolean | null
          last_login_at?: string | null
          last_name?: string
          parent_user_id?: string
          role_name?: string | null
          updated_at?: string | null
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "sub_accounts_hotel_id_fkey"
            columns: ["hotel_id"]
            isOneToOne: false
            referencedRelation: "hotels"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "sub_accounts_hotel_id_fkey"
            columns: ["hotel_id"]
            isOneToOne: false
            referencedRelation: "hotels_stats_view"
            referencedColumns: ["id"]
          },
        ]
      }
      subscriptions: {
        Row: {
          created_at: string | null
          current_period_end: string | null
          current_period_start: string | null
          gocardless_customer_id: string | null
          gocardless_mandate_id: string | null
          gocardless_subscription_id: string | null
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
          gocardless_customer_id?: string | null
          gocardless_mandate_id?: string | null
          gocardless_subscription_id?: string | null
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
          gocardless_customer_id?: string | null
          gocardless_mandate_id?: string | null
          gocardless_subscription_id?: string | null
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
      support_tickets: {
        Row: {
          admin_notes: string | null
          created_at: string | null
          hotel_id: string | null
          id: string
          message: string
          priority: string | null
          resolved_at: string | null
          resolved_by: string | null
          status: string | null
          subject: string
          updated_at: string | null
          user_id: string
        }
        Insert: {
          admin_notes?: string | null
          created_at?: string | null
          hotel_id?: string | null
          id?: string
          message: string
          priority?: string | null
          resolved_at?: string | null
          resolved_by?: string | null
          status?: string | null
          subject: string
          updated_at?: string | null
          user_id: string
        }
        Update: {
          admin_notes?: string | null
          created_at?: string | null
          hotel_id?: string | null
          id?: string
          message?: string
          priority?: string | null
          resolved_at?: string | null
          resolved_by?: string | null
          status?: string | null
          subject?: string
          updated_at?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "support_tickets_hotel_id_fkey"
            columns: ["hotel_id"]
            isOneToOne: false
            referencedRelation: "hotels"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "support_tickets_hotel_id_fkey"
            columns: ["hotel_id"]
            isOneToOne: false
            referencedRelation: "hotels_stats_view"
            referencedColumns: ["id"]
          },
        ]
      }
      task_comments: {
        Row: {
          author_name: string
          author_type: string
          comment: string
          created_at: string
          hotel_id: string
          id: string
          task_id: string
        }
        Insert: {
          author_name: string
          author_type?: string
          comment: string
          created_at?: string
          hotel_id: string
          id?: string
          task_id: string
        }
        Update: {
          author_name?: string
          author_type?: string
          comment?: string
          created_at?: string
          hotel_id?: string
          id?: string
          task_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "task_comments_hotel_id_fkey"
            columns: ["hotel_id"]
            isOneToOne: false
            referencedRelation: "hotels"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "task_comments_hotel_id_fkey"
            columns: ["hotel_id"]
            isOneToOne: false
            referencedRelation: "hotels_stats_view"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "task_comments_task_id_fkey"
            columns: ["task_id"]
            isOneToOne: false
            referencedRelation: "manual_tasks"
            referencedColumns: ["id"]
          },
        ]
      }
      task_completions: {
        Row: {
          completed_at: string
          completed_by_id: string
          completed_by_name: string
          completed_by_type: string | null
          completion_date: string
          created_at: string
          hotel_id: string
          id: string
          notes: string | null
          task_template_id: string
        }
        Insert: {
          completed_at?: string
          completed_by_id: string
          completed_by_name: string
          completed_by_type?: string | null
          completion_date?: string
          created_at?: string
          hotel_id: string
          id?: string
          notes?: string | null
          task_template_id: string
        }
        Update: {
          completed_at?: string
          completed_by_id?: string
          completed_by_name?: string
          completed_by_type?: string | null
          completion_date?: string
          created_at?: string
          hotel_id?: string
          id?: string
          notes?: string | null
          task_template_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "task_completions_hotel_id_fkey"
            columns: ["hotel_id"]
            isOneToOne: false
            referencedRelation: "hotels"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "task_completions_hotel_id_fkey"
            columns: ["hotel_id"]
            isOneToOne: false
            referencedRelation: "hotels_stats_view"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "task_completions_task_template_id_fkey"
            columns: ["task_template_id"]
            isOneToOne: false
            referencedRelation: "task_templates"
            referencedColumns: ["id"]
          },
        ]
      }
      task_templates: {
        Row: {
          assigned_to_all: boolean | null
          assigned_to_type: string
          assigned_to_user_id: string | null
          assigned_user_name: string | null
          created_at: string
          created_by: string | null
          days_of_week: number[]
          description: string | null
          hotel_id: string
          id: string
          is_active: boolean
          is_one_time: boolean
          location_reference: string | null
          location_type: string
          one_time_date: string | null
          priority: string
          title: string
          updated_at: string
        }
        Insert: {
          assigned_to_all?: boolean | null
          assigned_to_type?: string
          assigned_to_user_id?: string | null
          assigned_user_name?: string | null
          created_at?: string
          created_by?: string | null
          days_of_week?: number[]
          description?: string | null
          hotel_id: string
          id?: string
          is_active?: boolean
          is_one_time?: boolean
          location_reference?: string | null
          location_type?: string
          one_time_date?: string | null
          priority?: string
          title: string
          updated_at?: string
        }
        Update: {
          assigned_to_all?: boolean | null
          assigned_to_type?: string
          assigned_to_user_id?: string | null
          assigned_user_name?: string | null
          created_at?: string
          created_by?: string | null
          days_of_week?: number[]
          description?: string | null
          hotel_id?: string
          id?: string
          is_active?: boolean
          is_one_time?: boolean
          location_reference?: string | null
          location_type?: string
          one_time_date?: string | null
          priority?: string
          title?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "task_templates_hotel_id_fkey"
            columns: ["hotel_id"]
            isOneToOne: false
            referencedRelation: "hotels"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "task_templates_hotel_id_fkey"
            columns: ["hotel_id"]
            isOneToOne: false
            referencedRelation: "hotels_stats_view"
            referencedColumns: ["id"]
          },
        ]
      }
      technician_access_requests: {
        Row: {
          created_at: string | null
          hotel_code: string
          hotel_id: string | null
          id: string
          requested_at: string | null
          reviewed_at: string | null
          reviewed_by: string | null
          status: string | null
          technician_profile_id: string
          updated_at: string | null
        }
        Insert: {
          created_at?: string | null
          hotel_code: string
          hotel_id?: string | null
          id?: string
          requested_at?: string | null
          reviewed_at?: string | null
          reviewed_by?: string | null
          status?: string | null
          technician_profile_id: string
          updated_at?: string | null
        }
        Update: {
          created_at?: string | null
          hotel_code?: string
          hotel_id?: string | null
          id?: string
          requested_at?: string | null
          reviewed_at?: string | null
          reviewed_by?: string | null
          status?: string | null
          technician_profile_id?: string
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "technician_access_requests_hotel_id_fkey"
            columns: ["hotel_id"]
            isOneToOne: false
            referencedRelation: "hotels"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "technician_access_requests_hotel_id_fkey"
            columns: ["hotel_id"]
            isOneToOne: false
            referencedRelation: "hotels_stats_view"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "technician_access_requests_technician_profile_id_fkey"
            columns: ["technician_profile_id"]
            isOneToOne: false
            referencedRelation: "technician_profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      technician_profiles: {
        Row: {
          certifications: Json | null
          created_at: string
          email: string
          id: string
          is_active: boolean
          name: string
          phone: string | null
          specialties: string[] | null
          total_hotels_worked: number
          updated_at: string
        }
        Insert: {
          certifications?: Json | null
          created_at?: string
          email: string
          id?: string
          is_active?: boolean
          name: string
          phone?: string | null
          specialties?: string[] | null
          total_hotels_worked?: number
          updated_at?: string
        }
        Update: {
          certifications?: Json | null
          created_at?: string
          email?: string
          id?: string
          is_active?: boolean
          name?: string
          phone?: string | null
          specialties?: string[] | null
          total_hotels_worked?: number
          updated_at?: string
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
          {
            foreignKeyName: "user_sessions_hotel_id_fkey"
            columns: ["hotel_id"]
            isOneToOne: false
            referencedRelation: "hotels_stats_view"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      access_codes_enriched: {
        Row: {
          access_code: string | null
          created_at: string | null
          expires_at: string | null
          hotel_code: string | null
          hotel_id: string | null
          hotel_name: string | null
          housekeeper_id: string | null
          housekeeper_name: string | null
          id: string | null
          invited_name: string | null
          is_active: boolean | null
          used_at: string | null
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
            foreignKeyName: "housekeeper_access_codes_hotel_id_fkey"
            columns: ["hotel_id"]
            isOneToOne: false
            referencedRelation: "hotels_stats_view"
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
      activities_enriched: {
        Row: {
          activity_type: string | null
          actor_name: string | null
          actor_type: string | null
          created_at: string | null
          details: Json | null
          entity_id: string | null
          entity_type: string | null
          hotel_code: string | null
          hotel_id: string | null
          hotel_name: string | null
          id: string | null
          timestamp: string | null
        }
        Relationships: [
          {
            foreignKeyName: "activities_hotel_id_fkey"
            columns: ["hotel_id"]
            isOneToOne: false
            referencedRelation: "hotels"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "activities_hotel_id_fkey"
            columns: ["hotel_id"]
            isOneToOne: false
            referencedRelation: "hotels_stats_view"
            referencedColumns: ["id"]
          },
        ]
      }
      all_users_view: {
        Row: {
          created_at: string | null
          email: string | null
          id: string | null
          is_suspended: boolean | null
          linked_hotel_id: string | null
          linked_hotel_name: string | null
          name: string | null
          role: string | null
          subscription_type: string | null
          trial_end_date: string | null
          user_type: string | null
        }
        Relationships: []
      }
      audit_logs_enriched: {
        Row: {
          action: string | null
          admin_company: string | null
          admin_email: string | null
          admin_user_id: string | null
          created_at: string | null
          details: Json | null
          id: string | null
          target_company: string | null
          target_email: string | null
          target_user_id: string | null
        }
        Relationships: []
      }
      daily_logs_enriched: {
        Row: {
          action_type: string | null
          actor_name: string | null
          actor_type: string | null
          created_at: string | null
          description: string | null
          details: Json | null
          hotel_code: string | null
          hotel_id: string | null
          hotel_name: string | null
          id: string | null
          log_date: string | null
          room_number: string | null
        }
        Relationships: [
          {
            foreignKeyName: "daily_action_logs_hotel_id_fkey"
            columns: ["hotel_id"]
            isOneToOne: false
            referencedRelation: "hotels"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "daily_action_logs_hotel_id_fkey"
            columns: ["hotel_id"]
            isOneToOne: false
            referencedRelation: "hotels_stats_view"
            referencedColumns: ["id"]
          },
        ]
      }
      hotels_stats_view: {
        Row: {
          active_sessions_count: number | null
          created_at: string | null
          hotel_code: string | null
          housekeepers_count: number | null
          id: string | null
          name: string | null
          owner_company: string | null
          owner_email: string | null
          rooms_count: number | null
          user_id: string | null
        }
        Relationships: []
      }
      sessions_enriched: {
        Row: {
          hotel_code: string | null
          hotel_id: string | null
          hotel_name: string | null
          housekeeper_id: string | null
          id: string | null
          is_active: boolean | null
          last_activity: string | null
          login_time: string | null
          session_token: string | null
          user_email: string | null
          user_id: string | null
          user_name: string | null
          user_type: string | null
        }
        Relationships: []
      }
    }
    Functions: {
      activate_sub_account: {
        Args: { p_code: string; p_user_id: string }
        Returns: boolean
      }
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
      admin_get_ai_usage_by_function: {
        Args: { p_days?: number }
        Returns: {
          calls: number
          function_name: string
          last_at: string
          tokens: number
        }[]
      }
      admin_get_ai_usage_daily: {
        Args: { p_days?: number }
        Returns: {
          calls: number
          day: string
          tokens: number
        }[]
      }
      admin_get_api_clients: {
        Args: { p_days?: number }
        Returns: {
          ai_calls: number
          ai_last_at: string
          ai_tokens: number
          hotel_code: string
          hotel_id: string
          hotel_name: string
          pms_active: boolean
          pms_last_status: string
          pms_last_sync: string
          pms_syncs: number
          pms_type: string
        }[]
      }
      admin_get_connections_daily: {
        Args: { p_days?: number }
        Returns: {
          connections: number
          day: string
          user_type: string
        }[]
      }
      admin_get_establishment_connections: {
        Args: never
        Returns: {
          active_sessions: number
          governesses_count: number
          hotel_code: string
          hotel_id: string
          hotel_name: string
          housekeepers_count: number
          last_login: string
          owner_email: string
          subaccounts_count: number
          technicians_count: number
        }[]
      }
      admin_set_ai_features_enabled: {
        Args: { p_enabled: boolean; p_user_id: string }
        Returns: boolean
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
      can_access_hotel: { Args: { p_hotel_id: string }; Returns: boolean }
      can_manage_hotel_data: {
        Args: { target_hotel_id: string }
        Returns: boolean
      }
      can_view_hotel_access_session: {
        Args: { _hotel_id: string; _housekeeper_profile_id: string }
        Returns: boolean
      }
      change_subscription_status: {
        Args: { p_new_status: string; p_reason?: string; p_user_id: string }
        Returns: boolean
      }
      check_email_exists_for_role: {
        Args: { p_email: string }
        Returns: {
          found_in: string
        }[]
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
      complete_onboarding_simple: {
        Args: {
          p_company_name: string
          p_contact_name: string
          p_phone: string
          p_user_id: string
        }
        Returns: boolean
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
      get_active_banners_for_user: {
        Args: never
        Returns: {
          action_label: string
          action_label_en: string
          action_url: string
          banner_type: string
          ends_at: string
          id: string
          is_dismissible: boolean
          message: string
          message_en: string
          starts_at: string
          title: string
        }[]
      }
      get_approved_hotels_for_housekeeper: {
        Args: { p_housekeeper_profile_id: string }
        Returns: {
          approved_at: string
          hotel_code: string
          hotel_id: string
          hotel_name: string
        }[]
      }
      get_approved_hotels_for_technician: {
        Args: { p_technician_profile_id: string }
        Returns: {
          approved_at: string
          hotel_code: string
          hotel_id: string
          hotel_name: string
        }[]
      }
      get_current_governess_profile_id: { Args: never; Returns: string }
      get_governess_profile_id: { Args: never; Returns: string }
      get_hotel_for_housekeeper: {
        Args: { p_hotel_id: string; p_housekeeper_profile_id: string }
        Returns: {
          address: string
          email: string
          hotel_code: string
          id: string
          name: string
          settings: Json
        }[]
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
      get_invitation_by_code: { Args: { p_code: string }; Returns: Json }
      get_sub_account_info: {
        Args: { p_user_id: string }
        Returns: {
          first_name: string
          hotel_id: string
          is_sub_account: boolean
          last_name: string
          parent_user_id: string
          role_name: string
          sub_account_id: string
        }[]
      }
      get_technician_profile_id: { Args: never; Returns: string }
      get_trial_warning_level: { Args: { p_user_id: string }; Returns: number }
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
      hotel_owner_can_see_governess: {
        Args: { _governess_profile_id: string }
        Returns: boolean
      }
      is_hotel_owner: { Args: { _hotel_id: string }; Returns: boolean }
      is_housekeeper_for_hotel: {
        Args: { _hotel_id: string }
        Returns: boolean
      }
      is_technician_for_hotel: { Args: { _hotel_id: string }; Returns: boolean }
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
      search_hotel_by_code: {
        Args: { p_code: string }
        Returns: {
          hotel_code: string
          id: string
          name: string
        }[]
      }
      set_default_trial_days: { Args: { p_days: number }; Returns: boolean }
      start_trial_period: { Args: { p_user_id: string }; Returns: string }
      sub_account_has_permission: {
        Args: { p_permission_key: string; p_sub_account_id: string }
        Returns: boolean
      }
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
      validate_promo_code: {
        Args: { p_code: string; p_plan: string }
        Returns: {
          discount_type: string
          discount_value: number
          error_message: string
          is_valid: boolean
        }[]
      }
      validate_sub_account_invitation: {
        Args: { p_code: string }
        Returns: {
          email: string
          error_message: string
          first_name: string
          hotel_id: string
          hotel_name: string
          is_valid: boolean
          last_name: string
          role_name: string
          sub_account_id: string
        }[]
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
