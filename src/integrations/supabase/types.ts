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
    PostgrestVersion: "14.1"
  }
  public: {
    Tables: {
      interactions: {
        Row: {
          content: string | null
          created_at: string
          direction: string
          id: string
          lead_id: string
          media_type: string | null
          media_url: string | null
          metadata: Json | null
          type: string
          user_id: string | null
        }
        Insert: {
          content?: string | null
          created_at?: string
          direction?: string
          id?: string
          lead_id: string
          media_type?: string | null
          media_url?: string | null
          metadata?: Json | null
          type: string
          user_id?: string | null
        }
        Update: {
          content?: string | null
          created_at?: string
          direction?: string
          id?: string
          lead_id?: string
          media_type?: string | null
          media_url?: string | null
          metadata?: Json | null
          type?: string
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "interactions_lead_id_fkey"
            columns: ["lead_id"]
            isOneToOne: false
            referencedRelation: "leads"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "interactions_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      lead_id_map: {
        Row: {
          created_at: string
          new_lead_id: string
          old_lead_id: string
        }
        Insert: {
          created_at?: string
          new_lead_id: string
          old_lead_id: string
        }
        Update: {
          created_at?: string
          new_lead_id?: string
          old_lead_id?: string
        }
        Relationships: []
      }
      leads: {
        Row: {
          avatar_url: string | null
          broker_id: string | null
          created_at: string
          email: string | null
          id: string
          interested_properties: string[] | null
          max_budget: number | null
          min_bedrooms: number | null
          min_budget: number | null
          name: string
          notes: string | null
          phone: string
          preferred_neighborhoods: string[] | null
          preferred_property_type:
            | Database["public"]["Enums"]["property_type"]
            | null
          preferred_transaction:
            | Database["public"]["Enums"]["transaction_type"]
            | null
          priority: Database["public"]["Enums"]["lead_priority"]
          source: Database["public"]["Enums"]["lead_source"]
          status: Database["public"]["Enums"]["lead_status"]
          updated_at: string
          whatsapp_id: string | null
        }
        Insert: {
          avatar_url?: string | null
          broker_id?: string | null
          created_at?: string
          email?: string | null
          id?: string
          interested_properties?: string[] | null
          max_budget?: number | null
          min_bedrooms?: number | null
          min_budget?: number | null
          name: string
          notes?: string | null
          phone: string
          preferred_neighborhoods?: string[] | null
          preferred_property_type?:
            | Database["public"]["Enums"]["property_type"]
            | null
          preferred_transaction?:
            | Database["public"]["Enums"]["transaction_type"]
            | null
          priority?: Database["public"]["Enums"]["lead_priority"]
          source?: Database["public"]["Enums"]["lead_source"]
          status?: Database["public"]["Enums"]["lead_status"]
          updated_at?: string
          whatsapp_id?: string | null
        }
        Update: {
          avatar_url?: string | null
          broker_id?: string | null
          created_at?: string
          email?: string | null
          id?: string
          interested_properties?: string[] | null
          max_budget?: number | null
          min_bedrooms?: number | null
          min_budget?: number | null
          name?: string
          notes?: string | null
          phone?: string
          preferred_neighborhoods?: string[] | null
          preferred_property_type?:
            | Database["public"]["Enums"]["property_type"]
            | null
          preferred_transaction?:
            | Database["public"]["Enums"]["transaction_type"]
            | null
          priority?: Database["public"]["Enums"]["lead_priority"]
          source?: Database["public"]["Enums"]["lead_source"]
          status?: Database["public"]["Enums"]["lead_status"]
          updated_at?: string
          whatsapp_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "leads_broker_id_fkey"
            columns: ["broker_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      migration_audit_log: {
        Row: {
          action: string
          admin_user_id: string
          created_at: string
          entity: string | null
          errors: Json
          id: string
          record_count: number | null
          success: boolean
        }
        Insert: {
          action: string
          admin_user_id: string
          created_at?: string
          entity?: string | null
          errors?: Json
          id?: string
          record_count?: number | null
          success: boolean
        }
        Update: {
          action?: string
          admin_user_id?: string
          created_at?: string
          entity?: string | null
          errors?: Json
          id?: string
          record_count?: number | null
          success?: boolean
        }
        Relationships: []
      }
      migration_runs: {
        Row: {
          created_at: string
          errors: Json
          id: string
          started_by: string | null
          status: string
          summary: Json
        }
        Insert: {
          created_at?: string
          errors?: Json
          id?: string
          started_by?: string | null
          status?: string
          summary?: Json
        }
        Update: {
          created_at?: string
          errors?: Json
          id?: string
          started_by?: string | null
          status?: string
          summary?: Json
        }
        Relationships: []
      }
      profile_id_map: {
        Row: {
          created_at: string
          email: string
          new_profile_id: string
          new_user_id: string
          old_profile_id: string
        }
        Insert: {
          created_at?: string
          email: string
          new_profile_id: string
          new_user_id: string
          old_profile_id: string
        }
        Update: {
          created_at?: string
          email?: string
          new_profile_id?: string
          new_user_id?: string
          old_profile_id?: string
        }
        Relationships: []
      }
      profiles: {
        Row: {
          avatar_url: string | null
          created_at: string
          creci: string | null
          email: string
          full_name: string
          id: string
          is_active: boolean
          phone: string | null
          role: Database["public"]["Enums"]["user_role"]
          updated_at: string
          user_id: string
        }
        Insert: {
          avatar_url?: string | null
          created_at?: string
          creci?: string | null
          email: string
          full_name: string
          id?: string
          is_active?: boolean
          phone?: string | null
          role?: Database["public"]["Enums"]["user_role"]
          updated_at?: string
          user_id: string
        }
        Update: {
          avatar_url?: string | null
          created_at?: string
          creci?: string | null
          email?: string
          full_name?: string
          id?: string
          is_active?: boolean
          phone?: string | null
          role?: Database["public"]["Enums"]["user_role"]
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      properties: {
        Row: {
          address_city: string
          address_complement: string | null
          address_neighborhood: string
          address_number: string | null
          address_state: string
          address_street: string | null
          address_zipcode: string | null
          amenities: Json | null
          area_built: number | null
          area_total: number | null
          bathrooms: number | null
          bedrooms: number | null
          broker_id: string | null
          code: string
          condominium_fee: number | null
          cover_image_url: string | null
          created_at: string
          description: string | null
          id: string
          images: Json | null
          iptu: number | null
          is_featured: boolean
          latitude: number | null
          longitude: number | null
          parking_spots: number | null
          property_type: Database["public"]["Enums"]["property_type"]
          rent_price: number | null
          sale_price: number | null
          status: Database["public"]["Enums"]["property_status"]
          suites: number | null
          title: string
          transaction_type: Database["public"]["Enums"]["transaction_type"]
          updated_at: string
        }
        Insert: {
          address_city: string
          address_complement?: string | null
          address_neighborhood: string
          address_number?: string | null
          address_state?: string
          address_street?: string | null
          address_zipcode?: string | null
          amenities?: Json | null
          area_built?: number | null
          area_total?: number | null
          bathrooms?: number | null
          bedrooms?: number | null
          broker_id?: string | null
          code: string
          condominium_fee?: number | null
          cover_image_url?: string | null
          created_at?: string
          description?: string | null
          id?: string
          images?: Json | null
          iptu?: number | null
          is_featured?: boolean
          latitude?: number | null
          longitude?: number | null
          parking_spots?: number | null
          property_type?: Database["public"]["Enums"]["property_type"]
          rent_price?: number | null
          sale_price?: number | null
          status?: Database["public"]["Enums"]["property_status"]
          suites?: number | null
          title: string
          transaction_type?: Database["public"]["Enums"]["transaction_type"]
          updated_at?: string
        }
        Update: {
          address_city?: string
          address_complement?: string | null
          address_neighborhood?: string
          address_number?: string | null
          address_state?: string
          address_street?: string | null
          address_zipcode?: string | null
          amenities?: Json | null
          area_built?: number | null
          area_total?: number | null
          bathrooms?: number | null
          bedrooms?: number | null
          broker_id?: string | null
          code?: string
          condominium_fee?: number | null
          cover_image_url?: string | null
          created_at?: string
          description?: string | null
          id?: string
          images?: Json | null
          iptu?: number | null
          is_featured?: boolean
          latitude?: number | null
          longitude?: number | null
          parking_spots?: number | null
          property_type?: Database["public"]["Enums"]["property_type"]
          rent_price?: number | null
          sale_price?: number | null
          status?: Database["public"]["Enums"]["property_status"]
          suites?: number | null
          title?: string
          transaction_type?: Database["public"]["Enums"]["transaction_type"]
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "properties_broker_id_fkey"
            columns: ["broker_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      property_id_map: {
        Row: {
          created_at: string
          new_property_id: string
          old_property_id: string
        }
        Insert: {
          created_at?: string
          new_property_id: string
          old_property_id: string
        }
        Update: {
          created_at?: string
          new_property_id?: string
          old_property_id?: string
        }
        Relationships: []
      }
      staging_leads: {
        Row: {
          created_at: string
          id: string
          old_lead_id: string | null
          raw: Json
        }
        Insert: {
          created_at?: string
          id?: string
          old_lead_id?: string | null
          raw?: Json
        }
        Update: {
          created_at?: string
          id?: string
          old_lead_id?: string | null
          raw?: Json
        }
        Relationships: []
      }
      staging_profiles: {
        Row: {
          created_at: string
          creci: string | null
          email: string
          full_name: string | null
          id: string
          old_profile_id: string | null
          phone: string | null
          raw: Json
          role: Database["public"]["Enums"]["user_role"] | null
        }
        Insert: {
          created_at?: string
          creci?: string | null
          email: string
          full_name?: string | null
          id?: string
          old_profile_id?: string | null
          phone?: string | null
          raw?: Json
          role?: Database["public"]["Enums"]["user_role"] | null
        }
        Update: {
          created_at?: string
          creci?: string | null
          email?: string
          full_name?: string | null
          id?: string
          old_profile_id?: string | null
          phone?: string | null
          raw?: Json
          role?: Database["public"]["Enums"]["user_role"] | null
        }
        Relationships: []
      }
      staging_properties: {
        Row: {
          created_at: string
          id: string
          old_property_id: string | null
          raw: Json
        }
        Insert: {
          created_at?: string
          id?: string
          old_property_id?: string | null
          raw?: Json
        }
        Update: {
          created_at?: string
          id?: string
          old_property_id?: string | null
          raw?: Json
        }
        Relationships: []
      }
      staging_tasks: {
        Row: {
          created_at: string
          id: string
          old_task_id: string | null
          raw: Json
        }
        Insert: {
          created_at?: string
          id?: string
          old_task_id?: string | null
          raw?: Json
        }
        Update: {
          created_at?: string
          id?: string
          old_task_id?: string | null
          raw?: Json
        }
        Relationships: []
      }
      staging_visits: {
        Row: {
          created_at: string
          id: string
          old_visit_id: string | null
          raw: Json
        }
        Insert: {
          created_at?: string
          id?: string
          old_visit_id?: string | null
          raw?: Json
        }
        Update: {
          created_at?: string
          id?: string
          old_visit_id?: string | null
          raw?: Json
        }
        Relationships: []
      }
      task_id_map: {
        Row: {
          created_at: string
          new_task_id: string
          old_task_id: string
        }
        Insert: {
          created_at?: string
          new_task_id: string
          old_task_id: string
        }
        Update: {
          created_at?: string
          new_task_id?: string
          old_task_id?: string
        }
        Relationships: []
      }
      tasks: {
        Row: {
          completed_at: string | null
          created_at: string
          description: string | null
          due_date: string | null
          id: string
          lead_id: string | null
          priority: Database["public"]["Enums"]["lead_priority"]
          property_id: string | null
          title: string
          updated_at: string
          user_id: string
        }
        Insert: {
          completed_at?: string | null
          created_at?: string
          description?: string | null
          due_date?: string | null
          id?: string
          lead_id?: string | null
          priority?: Database["public"]["Enums"]["lead_priority"]
          property_id?: string | null
          title: string
          updated_at?: string
          user_id: string
        }
        Update: {
          completed_at?: string | null
          created_at?: string
          description?: string | null
          due_date?: string | null
          id?: string
          lead_id?: string | null
          priority?: Database["public"]["Enums"]["lead_priority"]
          property_id?: string | null
          title?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "tasks_lead_id_fkey"
            columns: ["lead_id"]
            isOneToOne: false
            referencedRelation: "leads"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tasks_property_id_fkey"
            columns: ["property_id"]
            isOneToOne: false
            referencedRelation: "properties"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tasks_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      user_roles: {
        Row: {
          created_at: string | null
          id: string
          role: Database["public"]["Enums"]["user_role"]
          user_id: string
        }
        Insert: {
          created_at?: string | null
          id?: string
          role?: Database["public"]["Enums"]["user_role"]
          user_id: string
        }
        Update: {
          created_at?: string | null
          id?: string
          role?: Database["public"]["Enums"]["user_role"]
          user_id?: string
        }
        Relationships: []
      }
      visit_id_map: {
        Row: {
          created_at: string
          new_visit_id: string
          old_visit_id: string
        }
        Insert: {
          created_at?: string
          new_visit_id: string
          old_visit_id: string
        }
        Update: {
          created_at?: string
          new_visit_id?: string
          old_visit_id?: string
        }
        Relationships: []
      }
      visits: {
        Row: {
          broker_id: string
          confirmation_sent: boolean
          created_at: string
          feedback: string | null
          id: string
          lead_id: string
          notes: string | null
          property_id: string
          rating: number | null
          reminder_sent: boolean
          scheduled_at: string
          status: Database["public"]["Enums"]["visit_status"]
          updated_at: string
        }
        Insert: {
          broker_id: string
          confirmation_sent?: boolean
          created_at?: string
          feedback?: string | null
          id?: string
          lead_id: string
          notes?: string | null
          property_id: string
          rating?: number | null
          reminder_sent?: boolean
          scheduled_at: string
          status?: Database["public"]["Enums"]["visit_status"]
          updated_at?: string
        }
        Update: {
          broker_id?: string
          confirmation_sent?: boolean
          created_at?: string
          feedback?: string | null
          id?: string
          lead_id?: string
          notes?: string | null
          property_id?: string
          rating?: number | null
          reminder_sent?: boolean
          scheduled_at?: string
          status?: Database["public"]["Enums"]["visit_status"]
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "visits_broker_id_fkey"
            columns: ["broker_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "visits_lead_id_fkey"
            columns: ["lead_id"]
            isOneToOne: false
            referencedRelation: "leads"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "visits_property_id_fkey"
            columns: ["property_id"]
            isOneToOne: false
            referencedRelation: "properties"
            referencedColumns: ["id"]
          },
        ]
      }
      whatsapp_conversation_reads: {
        Row: {
          conversation_id: string
          created_at: string
          last_read_at: string
          updated_at: string
          user_id: string
        }
        Insert: {
          conversation_id: string
          created_at?: string
          last_read_at?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          conversation_id?: string
          created_at?: string
          last_read_at?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "whatsapp_conversation_reads_conversation_id_fkey"
            columns: ["conversation_id"]
            isOneToOne: false
            referencedRelation: "whatsapp_conversations"
            referencedColumns: ["id"]
          },
        ]
      }
      whatsapp_conversations: {
        Row: {
          ai_context: Json | null
          automation_enabled: boolean
          created_at: string
          human_takeover_at: string | null
          id: string
          is_active: boolean
          last_message_at: string | null
          lead_id: string | null
          pending_visit_candidates: Json | null
          pending_visit_id: string | null
          pending_visit_property_id: string | null
          pending_visit_scheduled_at: string | null
          pending_visit_step: string | null
          phone: string
          updated_at: string
          whatsapp_id: string
        }
        Insert: {
          ai_context?: Json | null
          automation_enabled?: boolean
          created_at?: string
          human_takeover_at?: string | null
          id?: string
          is_active?: boolean
          last_message_at?: string | null
          lead_id?: string | null
          pending_visit_candidates?: Json | null
          pending_visit_id?: string | null
          pending_visit_property_id?: string | null
          pending_visit_scheduled_at?: string | null
          pending_visit_step?: string | null
          phone: string
          updated_at?: string
          whatsapp_id: string
        }
        Update: {
          ai_context?: Json | null
          automation_enabled?: boolean
          created_at?: string
          human_takeover_at?: string | null
          id?: string
          is_active?: boolean
          last_message_at?: string | null
          lead_id?: string | null
          pending_visit_candidates?: Json | null
          pending_visit_id?: string | null
          pending_visit_property_id?: string | null
          pending_visit_scheduled_at?: string | null
          pending_visit_step?: string | null
          phone?: string
          updated_at?: string
          whatsapp_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "whatsapp_conversations_lead_id_fkey"
            columns: ["lead_id"]
            isOneToOne: false
            referencedRelation: "leads"
            referencedColumns: ["id"]
          },
        ]
      }
      whatsapp_messages: {
        Row: {
          ai_processed: boolean
          ai_response: Json | null
          content: string | null
          conversation_id: string
          created_at: string
          direction: string
          id: string
          media_type: string | null
          media_url: string | null
          message_id: string | null
          status: string | null
        }
        Insert: {
          ai_processed?: boolean
          ai_response?: Json | null
          content?: string | null
          conversation_id: string
          created_at?: string
          direction: string
          id?: string
          media_type?: string | null
          media_url?: string | null
          message_id?: string | null
          status?: string | null
        }
        Update: {
          ai_processed?: boolean
          ai_response?: Json | null
          content?: string | null
          conversation_id?: string
          created_at?: string
          direction?: string
          id?: string
          media_type?: string | null
          media_url?: string | null
          message_id?: string | null
          status?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "whatsapp_messages_conversation_id_fkey"
            columns: ["conversation_id"]
            isOneToOne: false
            referencedRelation: "whatsapp_conversations"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      can_manage_users: { Args: { _user_id: string }; Returns: boolean }
      get_unread_counts: {
        Args: { conversation_ids: string[] }
        Returns: {
          conversation_id: string
          unread_count: number
        }[]
      }
      get_user_profile_id: { Args: { _user_id: string }; Returns: string }
      get_user_role: {
        Args: { _user_id: string }
        Returns: Database["public"]["Enums"]["user_role"]
      }
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["user_role"]
          _user_id: string
        }
        Returns: boolean
      }
      is_admin: { Args: { _user_id: string }; Returns: boolean }
      is_admin_or_moderator: { Args: { _user_id: string }; Returns: boolean }
      mark_conversation_read: {
        Args: { _conversation_id: string }
        Returns: undefined
      }
    }
    Enums: {
      lead_priority: "low" | "medium" | "high" | "urgent"
      lead_source:
        | "whatsapp"
        | "website"
        | "referral"
        | "portal"
        | "walk_in"
        | "social_media"
        | "other"
      lead_status:
        | "new"
        | "contacted"
        | "qualified"
        | "visit_scheduled"
        | "visited"
        | "proposal"
        | "negotiation"
        | "closed_won"
        | "closed_lost"
      property_status: "available" | "reserved" | "sold" | "rented" | "inactive"
      property_type:
        | "house"
        | "apartment"
        | "commercial"
        | "land"
        | "rural"
        | "other"
      transaction_type: "sale" | "rent" | "both"
      user_role: "admin" | "broker" | "attendant"
      visit_status:
        | "scheduled"
        | "confirmed"
        | "completed"
        | "cancelled"
        | "rescheduled"
        | "no_show"
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
      lead_priority: ["low", "medium", "high", "urgent"],
      lead_source: [
        "whatsapp",
        "website",
        "referral",
        "portal",
        "walk_in",
        "social_media",
        "other",
      ],
      lead_status: [
        "new",
        "contacted",
        "qualified",
        "visit_scheduled",
        "visited",
        "proposal",
        "negotiation",
        "closed_won",
        "closed_lost",
      ],
      property_status: ["available", "reserved", "sold", "rented", "inactive"],
      property_type: [
        "house",
        "apartment",
        "commercial",
        "land",
        "rural",
        "other",
      ],
      transaction_type: ["sale", "rent", "both"],
      user_role: ["admin", "broker", "attendant"],
      visit_status: [
        "scheduled",
        "confirmed",
        "completed",
        "cancelled",
        "rescheduled",
        "no_show",
      ],
    },
  },
} as const
