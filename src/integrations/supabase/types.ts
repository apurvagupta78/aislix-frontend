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
    PostgrestVersion: "14.15"
  }
  public: {
    Tables: {
      api_keys: {
        Row: {
          created_at: string
          id: string
          key_hash: string
          key_prefix: string
          last_used_at: string | null
          name: string | null
          org_id: string
          revoked_at: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          key_hash: string
          key_prefix: string
          last_used_at?: string | null
          name?: string | null
          org_id: string
          revoked_at?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          key_hash?: string
          key_prefix?: string
          last_used_at?: string | null
          name?: string | null
          org_id?: string
          revoked_at?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "api_keys_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      contact_submissions: {
        Row: {
          company: string | null
          created_at: string
          email: string
          id: string
          message: string
          name: string
          phone: string | null
          status: string
          store_count: string | null
          topic: string | null
          updated_at: string
          user_id: string | null
        }
        Insert: {
          company?: string | null
          created_at?: string
          email: string
          id?: string
          message: string
          name: string
          phone?: string | null
          status?: string
          store_count?: string | null
          topic?: string | null
          updated_at?: string
          user_id?: string | null
        }
        Update: {
          company?: string | null
          created_at?: string
          email?: string
          id?: string
          message?: string
          name?: string
          phone?: string | null
          status?: string
          store_count?: string | null
          topic?: string | null
          updated_at?: string
          user_id?: string | null
        }
        Relationships: []
      }
      detected_products: {
        Row: {
          barcode: string | null
          bounding_box: Json | null
          brand: string | null
          category: string | null
          confidence: number | null
          created_at: string
          expected_facings: number | null
          facings: number
          id: string
          name: string
          position_index: number | null
          price_inr: number | null
          scan_id: string
          shelf_row: number | null
          sku: string | null
          stock_status: Database["public"]["Enums"]["stock_status"]
        }
        Insert: {
          barcode?: string | null
          bounding_box?: Json | null
          brand?: string | null
          category?: string | null
          confidence?: number | null
          created_at?: string
          expected_facings?: number | null
          facings?: number
          id?: string
          name: string
          position_index?: number | null
          price_inr?: number | null
          scan_id: string
          shelf_row?: number | null
          sku?: string | null
          stock_status?: Database["public"]["Enums"]["stock_status"]
        }
        Update: {
          barcode?: string | null
          bounding_box?: Json | null
          brand?: string | null
          category?: string | null
          confidence?: number | null
          created_at?: string
          expected_facings?: number | null
          facings?: number
          id?: string
          name?: string
          position_index?: number | null
          price_inr?: number | null
          scan_id?: string
          shelf_row?: number | null
          sku?: string | null
          stock_status?: Database["public"]["Enums"]["stock_status"]
        }
        Relationships: [
          {
            foreignKeyName: "detected_products_scan_id_fkey"
            columns: ["scan_id"]
            isOneToOne: false
            referencedRelation: "shelf_scans"
            referencedColumns: ["id"]
          },
        ]
      }
      learned_skus: {
        Row: {
          avg_price_inr: number | null
          barcode: string | null
          brand: string | null
          category: string | null
          confidence: number | null
          created_at: string
          embedding: Json | null
          expected_facings: number | null
          features_path: string | null
          first_seen_at: string
          id: string
          last_seen_at: string
          name: string
          org_id: string
          sku: string | null
          source_scan_id: string | null
          times_seen: number
          updated_at: string
          variant: string | null
        }
        Insert: {
          avg_price_inr?: number | null
          barcode?: string | null
          brand?: string | null
          category?: string | null
          confidence?: number | null
          created_at?: string
          embedding?: Json | null
          expected_facings?: number | null
          features_path?: string | null
          first_seen_at?: string
          id?: string
          last_seen_at?: string
          name: string
          org_id: string
          sku?: string | null
          source_scan_id?: string | null
          times_seen?: number
          updated_at?: string
          variant?: string | null
        }
        Update: {
          avg_price_inr?: number | null
          barcode?: string | null
          brand?: string | null
          category?: string | null
          confidence?: number | null
          created_at?: string
          embedding?: Json | null
          expected_facings?: number | null
          features_path?: string | null
          first_seen_at?: string
          id?: string
          last_seen_at?: string
          name?: string
          org_id?: string
          sku?: string | null
          source_scan_id?: string | null
          times_seen?: number
          updated_at?: string
          variant?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "learned_skus_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "learned_skus_source_scan_id_fkey"
            columns: ["source_scan_id"]
            isOneToOne: false
            referencedRelation: "shelf_scans"
            referencedColumns: ["id"]
          },
        ]
      }
      organization_members: {
        Row: {
          created_at: string
          id: string
          invited_by: string | null
          invited_email: string | null
          last_active_at: string | null
          org_id: string
          role: Database["public"]["Enums"]["app_role"]
          status: Database["public"]["Enums"]["member_status"]
          store_ids: string[]
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          invited_by?: string | null
          invited_email?: string | null
          last_active_at?: string | null
          org_id: string
          role?: Database["public"]["Enums"]["app_role"]
          status?: Database["public"]["Enums"]["member_status"]
          store_ids?: string[]
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          invited_by?: string | null
          invited_email?: string | null
          last_active_at?: string | null
          org_id?: string
          role?: Database["public"]["Enums"]["app_role"]
          status?: Database["public"]["Enums"]["member_status"]
          store_ids?: string[]
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "organization_members_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "organization_members_user_profile_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      organizations: {
        Row: {
          address: Json
          billing_email: string | null
          country: string | null
          created_at: string
          gstin: string | null
          id: string
          industry: string | null
          logo_url: string | null
          name: string
          owner_id: string
          slug: string | null
          updated_at: string
          website: string | null
        }
        Insert: {
          address?: Json
          billing_email?: string | null
          country?: string | null
          created_at?: string
          gstin?: string | null
          id?: string
          industry?: string | null
          logo_url?: string | null
          name: string
          owner_id: string
          slug?: string | null
          updated_at?: string
          website?: string | null
        }
        Update: {
          address?: Json
          billing_email?: string | null
          country?: string | null
          created_at?: string
          gstin?: string | null
          id?: string
          industry?: string | null
          logo_url?: string | null
          name?: string
          owner_id?: string
          slug?: string | null
          updated_at?: string
          website?: string | null
        }
        Relationships: []
      }
      profiles: {
        Row: {
          avatar_url: string | null
          created_at: string
          email: string | null
          full_name: string | null
          id: string
          job_title: string | null
          locale: string | null
          notification_prefs: Json
          phone: string | null
          timezone: string | null
          updated_at: string
        }
        Insert: {
          avatar_url?: string | null
          created_at?: string
          email?: string | null
          full_name?: string | null
          id: string
          job_title?: string | null
          locale?: string | null
          notification_prefs?: Json
          phone?: string | null
          timezone?: string | null
          updated_at?: string
        }
        Update: {
          avatar_url?: string | null
          created_at?: string
          email?: string | null
          full_name?: string | null
          id?: string
          job_title?: string | null
          locale?: string | null
          notification_prefs?: Json
          phone?: string | null
          timezone?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      scan_images: {
        Row: {
          captured_at: string | null
          created_at: string
          file_size_bytes: number | null
          height: number | null
          id: string
          kind: string
          mime_type: string | null
          scan_id: string
          storage_bucket: string
          storage_path: string
          width: number | null
        }
        Insert: {
          captured_at?: string | null
          created_at?: string
          file_size_bytes?: number | null
          height?: number | null
          id?: string
          kind?: string
          mime_type?: string | null
          scan_id: string
          storage_bucket?: string
          storage_path: string
          width?: number | null
        }
        Update: {
          captured_at?: string | null
          created_at?: string
          file_size_bytes?: number | null
          height?: number | null
          id?: string
          kind?: string
          mime_type?: string | null
          scan_id?: string
          storage_bucket?: string
          storage_path?: string
          width?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "scan_images_scan_id_fkey"
            columns: ["scan_id"]
            isOneToOne: false
            referencedRelation: "shelf_scans"
            referencedColumns: ["id"]
          },
        ]
      }
      scan_results: {
        Row: {
          alerts: Json
          brand_share: Json
          category_breakdown: Json
          confidence_avg: number | null
          created_at: string
          executive_summary: string | null
          id: string
          metrics: Json
          model_version: string | null
          raw_payload: Json | null
          recommendations: Json
          scan_id: string
          shelf_rows: Json
          updated_at: string
        }
        Insert: {
          alerts?: Json
          brand_share?: Json
          category_breakdown?: Json
          confidence_avg?: number | null
          created_at?: string
          executive_summary?: string | null
          id?: string
          metrics?: Json
          model_version?: string | null
          raw_payload?: Json | null
          recommendations?: Json
          scan_id: string
          shelf_rows?: Json
          updated_at?: string
        }
        Update: {
          alerts?: Json
          brand_share?: Json
          category_breakdown?: Json
          confidence_avg?: number | null
          created_at?: string
          executive_summary?: string | null
          id?: string
          metrics?: Json
          model_version?: string | null
          raw_payload?: Json | null
          recommendations?: Json
          scan_id?: string
          shelf_rows?: Json
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "scan_results_scan_id_fkey"
            columns: ["scan_id"]
            isOneToOne: true
            referencedRelation: "shelf_scans"
            referencedColumns: ["id"]
          },
        ]
      }
      shelf_analytics: {
        Row: {
          avg_osa_percent: number | null
          avg_share_of_shelf: number | null
          avg_shelf_health: number | null
          category_mix: Json
          created_at: string
          id: string
          low_stock_count: number
          misplaced_count: number
          org_id: string
          out_of_stock_count: number
          period_date: string
          scans_count: number
          store_id: string | null
          top_brands: Json
          updated_at: string
        }
        Insert: {
          avg_osa_percent?: number | null
          avg_share_of_shelf?: number | null
          avg_shelf_health?: number | null
          category_mix?: Json
          created_at?: string
          id?: string
          low_stock_count?: number
          misplaced_count?: number
          org_id: string
          out_of_stock_count?: number
          period_date: string
          scans_count?: number
          store_id?: string | null
          top_brands?: Json
          updated_at?: string
        }
        Update: {
          avg_osa_percent?: number | null
          avg_share_of_shelf?: number | null
          avg_shelf_health?: number | null
          category_mix?: Json
          created_at?: string
          id?: string
          low_stock_count?: number
          misplaced_count?: number
          org_id?: string
          out_of_stock_count?: number
          period_date?: string
          scans_count?: number
          store_id?: string | null
          top_brands?: Json
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "shelf_analytics_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "shelf_analytics_store_id_fkey"
            columns: ["store_id"]
            isOneToOne: false
            referencedRelation: "stores"
            referencedColumns: ["id"]
          },
        ]
      }
      shelf_scans: {
        Row: {
          category: string | null
          created_at: string
          created_by: string | null
          error_message: string | null
          id: string
          low_stock_count: number
          misplaced_count: number
          notes: string | null
          org_id: string
          osa_percent: number | null
          out_of_stock_count: number
          planogram_compliance_percent: number | null
          processing_completed_at: string | null
          processing_started_at: string | null
          share_of_shelf_percent: number | null
          shelf_health_score: number | null
          shelf_label: string | null
          status: Database["public"]["Enums"]["scan_status"]
          store_id: string | null
          total_products: number
          updated_at: string
        }
        Insert: {
          category?: string | null
          created_at?: string
          created_by?: string | null
          error_message?: string | null
          id?: string
          low_stock_count?: number
          misplaced_count?: number
          notes?: string | null
          org_id: string
          osa_percent?: number | null
          out_of_stock_count?: number
          planogram_compliance_percent?: number | null
          processing_completed_at?: string | null
          processing_started_at?: string | null
          share_of_shelf_percent?: number | null
          shelf_health_score?: number | null
          shelf_label?: string | null
          status?: Database["public"]["Enums"]["scan_status"]
          store_id?: string | null
          total_products?: number
          updated_at?: string
        }
        Update: {
          category?: string | null
          created_at?: string
          created_by?: string | null
          error_message?: string | null
          id?: string
          low_stock_count?: number
          misplaced_count?: number
          notes?: string | null
          org_id?: string
          osa_percent?: number | null
          out_of_stock_count?: number
          planogram_compliance_percent?: number | null
          processing_completed_at?: string | null
          processing_started_at?: string | null
          share_of_shelf_percent?: number | null
          shelf_health_score?: number | null
          shelf_label?: string | null
          status?: Database["public"]["Enums"]["scan_status"]
          store_id?: string | null
          total_products?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "shelf_scans_created_by_profile_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "shelf_scans_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "shelf_scans_store_id_fkey"
            columns: ["store_id"]
            isOneToOne: false
            referencedRelation: "stores"
            referencedColumns: ["id"]
          },
        ]
      }
      stores: {
        Row: {
          address_line1: string | null
          address_line2: string | null
          city: string | null
          code: string | null
          contact_email: string | null
          contact_name: string | null
          contact_phone: string | null
          country: string | null
          created_at: string
          id: string
          latitude: number | null
          longitude: number | null
          manager_id: string | null
          name: string
          notes: string | null
          org_id: string
          pincode: string | null
          shelf_count: number
          state: string | null
          status: Database["public"]["Enums"]["store_status"]
          store_type: string | null
          updated_at: string
        }
        Insert: {
          address_line1?: string | null
          address_line2?: string | null
          city?: string | null
          code?: string | null
          contact_email?: string | null
          contact_name?: string | null
          contact_phone?: string | null
          country?: string | null
          created_at?: string
          id?: string
          latitude?: number | null
          longitude?: number | null
          manager_id?: string | null
          name: string
          notes?: string | null
          org_id: string
          pincode?: string | null
          shelf_count?: number
          state?: string | null
          status?: Database["public"]["Enums"]["store_status"]
          store_type?: string | null
          updated_at?: string
        }
        Update: {
          address_line1?: string | null
          address_line2?: string | null
          city?: string | null
          code?: string | null
          contact_email?: string | null
          contact_name?: string | null
          contact_phone?: string | null
          country?: string | null
          created_at?: string
          id?: string
          latitude?: number | null
          longitude?: number | null
          manager_id?: string | null
          name?: string
          notes?: string | null
          org_id?: string
          pincode?: string | null
          shelf_count?: number
          state?: string | null
          status?: Database["public"]["Enums"]["store_status"]
          store_type?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "stores_manager_profile_fkey"
            columns: ["manager_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "stores_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      subscription_plans: {
        Row: {
          code: string
          created_at: string
          features: Json
          id: string
          is_active: boolean
          is_contact_sales: boolean
          name: string
          price_annual_inr: number
          price_monthly_inr: number
          scan_quota: number | null
          seat_limit: number | null
          sort_order: number
          store_limit: number | null
          tagline: string | null
          updated_at: string
        }
        Insert: {
          code: string
          created_at?: string
          features?: Json
          id?: string
          is_active?: boolean
          is_contact_sales?: boolean
          name: string
          price_annual_inr?: number
          price_monthly_inr?: number
          scan_quota?: number | null
          seat_limit?: number | null
          sort_order?: number
          store_limit?: number | null
          tagline?: string | null
          updated_at?: string
        }
        Update: {
          code?: string
          created_at?: string
          features?: Json
          id?: string
          is_active?: boolean
          is_contact_sales?: boolean
          name?: string
          price_annual_inr?: number
          price_monthly_inr?: number
          scan_quota?: number | null
          seat_limit?: number | null
          sort_order?: number
          store_limit?: number | null
          tagline?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      subscriptions: {
        Row: {
          cancel_at_period_end: boolean
          created_at: string
          current_period_end: string | null
          current_period_start: string
          cycle: Database["public"]["Enums"]["billing_cycle"]
          id: string
          org_id: string
          plan_id: string
          provider: string | null
          provider_subscription_id: string | null
          scans_used: number
          status: Database["public"]["Enums"]["subscription_status"]
          updated_at: string
        }
        Insert: {
          cancel_at_period_end?: boolean
          created_at?: string
          current_period_end?: string | null
          current_period_start?: string
          cycle?: Database["public"]["Enums"]["billing_cycle"]
          id?: string
          org_id: string
          plan_id: string
          provider?: string | null
          provider_subscription_id?: string | null
          scans_used?: number
          status?: Database["public"]["Enums"]["subscription_status"]
          updated_at?: string
        }
        Update: {
          cancel_at_period_end?: boolean
          created_at?: string
          current_period_end?: string | null
          current_period_start?: string
          cycle?: Database["public"]["Enums"]["billing_cycle"]
          id?: string
          org_id?: string
          plan_id?: string
          provider?: string | null
          provider_subscription_id?: string | null
          scans_used?: number
          status?: Database["public"]["Enums"]["subscription_status"]
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "subscriptions_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: true
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "subscriptions_plan_id_fkey"
            columns: ["plan_id"]
            isOneToOne: false
            referencedRelation: "subscription_plans"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      [_ in never]: never
    }
    Enums: {
      alert_severity: "critical" | "high" | "medium" | "low"
      app_role: "owner" | "admin" | "store_manager" | "viewer"
      billing_cycle: "monthly" | "annual"
      member_status: "active" | "invited" | "suspended"
      scan_status: "queued" | "processing" | "completed" | "failed"
      stock_status: "in_stock" | "low_stock" | "out_of_stock" | "misplaced"
      store_status: "active" | "inactive" | "onboarding"
      subscription_status: "active" | "trialing" | "past_due" | "canceled"
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
      alert_severity: ["critical", "high", "medium", "low"],
      app_role: ["owner", "admin", "store_manager", "viewer"],
      billing_cycle: ["monthly", "annual"],
      member_status: ["active", "invited", "suspended"],
      scan_status: ["queued", "processing", "completed", "failed"],
      stock_status: ["in_stock", "low_stock", "out_of_stock", "misplaced"],
      store_status: ["active", "inactive", "onboarding"],
      subscription_status: ["active", "trialing", "past_due", "canceled"],
    },
  },
} as const
