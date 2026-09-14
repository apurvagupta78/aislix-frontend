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
    PostgrestVersion: "14.5"
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
      corrective_actions: {
        Row: {
          assigned_to: string | null
          comparison_id: string
          comparison_line_id: string | null
          created_at: string
          id: string
          issue_type: string
          notes: string | null
          org_id: string
          resolved_at: string | null
          resolved_by: string | null
          status: string
          suggestion: string
          updated_at: string
        }
        Insert: {
          assigned_to?: string | null
          comparison_id: string
          comparison_line_id?: string | null
          created_at?: string
          id?: string
          issue_type: string
          notes?: string | null
          org_id: string
          resolved_at?: string | null
          resolved_by?: string | null
          status?: string
          suggestion: string
          updated_at?: string
        }
        Update: {
          assigned_to?: string | null
          comparison_id?: string
          comparison_line_id?: string | null
          created_at?: string
          id?: string
          issue_type?: string
          notes?: string | null
          org_id?: string
          resolved_at?: string | null
          resolved_by?: string | null
          status?: string
          suggestion?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "corrective_actions_comparison_id_fkey"
            columns: ["comparison_id"]
            isOneToOne: false
            referencedRelation: "planogram_comparisons"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "corrective_actions_comparison_line_id_fkey"
            columns: ["comparison_line_id"]
            isOneToOne: false
            referencedRelation: "planogram_comparison_lines"
            referencedColumns: ["id"]
          },
        ]
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
          variant: string | null
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
          variant?: string | null
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
          variant?: string | null
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
      execution_actions: {
        Row: {
          action_type: string
          actor_id: string | null
          created_at: string
          id: string
          notes: string | null
          opportunity_id: string
          org_id: string
          payload: Json
          scan_id: string | null
        }
        Insert: {
          action_type?: string
          actor_id?: string | null
          created_at?: string
          id?: string
          notes?: string | null
          opportunity_id: string
          org_id: string
          payload?: Json
          scan_id?: string | null
        }
        Update: {
          action_type?: string
          actor_id?: string | null
          created_at?: string
          id?: string
          notes?: string | null
          opportunity_id?: string
          org_id?: string
          payload?: Json
          scan_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "execution_actions_opportunity_id_fkey"
            columns: ["opportunity_id"]
            isOneToOne: false
            referencedRelation: "execution_opportunities"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "execution_actions_scan_id_fkey"
            columns: ["scan_id"]
            isOneToOne: false
            referencedRelation: "shelf_scans"
            referencedColumns: ["id"]
          },
        ]
      }
      execution_opportunities: {
        Row: {
          actual_value: string | null
          assigned_to: string | null
          brand: string | null
          commercial_impact_score: number | null
          confidence: string | null
          created_at: string
          expected_value: string | null
          gap_value: string | null
          id: string
          issue_type: string
          org_id: string
          priority: string
          product_name: string | null
          recommended_action: string | null
          resolved_at: string | null
          revenue_at_risk_inr: number | null
          scan_id: string
          severity: string
          sku: string | null
          source: string | null
          status: string
          store_id: string | null
          updated_at: string
        }
        Insert: {
          actual_value?: string | null
          assigned_to?: string | null
          brand?: string | null
          commercial_impact_score?: number | null
          confidence?: string | null
          created_at?: string
          expected_value?: string | null
          gap_value?: string | null
          id?: string
          issue_type: string
          org_id: string
          priority?: string
          product_name?: string | null
          recommended_action?: string | null
          resolved_at?: string | null
          revenue_at_risk_inr?: number | null
          scan_id: string
          severity?: string
          sku?: string | null
          source?: string | null
          status?: string
          store_id?: string | null
          updated_at?: string
        }
        Update: {
          actual_value?: string | null
          assigned_to?: string | null
          brand?: string | null
          commercial_impact_score?: number | null
          confidence?: string | null
          created_at?: string
          expected_value?: string | null
          gap_value?: string | null
          id?: string
          issue_type?: string
          org_id?: string
          priority?: string
          product_name?: string | null
          recommended_action?: string | null
          resolved_at?: string | null
          revenue_at_risk_inr?: number | null
          scan_id?: string
          severity?: string
          sku?: string | null
          source?: string | null
          status?: string
          store_id?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "execution_opportunities_scan_id_fkey"
            columns: ["scan_id"]
            isOneToOne: false
            referencedRelation: "shelf_scans"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "execution_opportunities_store_id_fkey"
            columns: ["store_id"]
            isOneToOne: false
            referencedRelation: "stores"
            referencedColumns: ["id"]
          },
        ]
      }
      global_learned_skus: {
        Row: {
          brand: string
          category: string
          created_at: string
          embedding: Json
          hit_count: number
          product_name: string
          sku: string
          source_scan_id: string | null
          updated_at: string
          variant: string
        }
        Insert: {
          brand?: string
          category?: string
          created_at?: string
          embedding: Json
          hit_count?: number
          product_name?: string
          sku: string
          source_scan_id?: string | null
          updated_at?: string
          variant?: string
        }
        Update: {
          brand?: string
          category?: string
          created_at?: string
          embedding?: Json
          hit_count?: number
          product_name?: string
          sku?: string
          source_scan_id?: string | null
          updated_at?: string
          variant?: string
        }
        Relationships: []
      }
      landing_demo_sessions: {
        Row: {
          category: string | null
          converted_user_id: string | null
          created_at: string
          id: string
          image_storage_path: string | null
          ip_hash: string | null
          lead_captured_at: string | null
          lead_company: string | null
          lead_email: string | null
          lead_name: string | null
          lead_phone: string | null
          lead_role: string | null
          onboarding_email_sent_at: string | null
          referrer: string | null
          sample_id: string | null
          scan_error: string | null
          scan_id: string | null
          scan_result: Json | null
          scan_status: string
          session_token: string
          signed_up_at: string | null
          signup_completed: boolean
          updated_at: string
          user_agent: string | null
          utm_campaign: string | null
          utm_content: string | null
          utm_medium: string | null
          utm_source: string | null
          utm_term: string | null
        }
        Insert: {
          category?: string | null
          converted_user_id?: string | null
          created_at?: string
          id?: string
          image_storage_path?: string | null
          ip_hash?: string | null
          lead_captured_at?: string | null
          lead_company?: string | null
          lead_email?: string | null
          lead_name?: string | null
          lead_phone?: string | null
          lead_role?: string | null
          onboarding_email_sent_at?: string | null
          referrer?: string | null
          sample_id?: string | null
          scan_error?: string | null
          scan_id?: string | null
          scan_result?: Json | null
          scan_status?: string
          session_token: string
          signed_up_at?: string | null
          signup_completed?: boolean
          updated_at?: string
          user_agent?: string | null
          utm_campaign?: string | null
          utm_content?: string | null
          utm_medium?: string | null
          utm_source?: string | null
          utm_term?: string | null
        }
        Update: {
          category?: string | null
          converted_user_id?: string | null
          created_at?: string
          id?: string
          image_storage_path?: string | null
          ip_hash?: string | null
          lead_captured_at?: string | null
          lead_company?: string | null
          lead_email?: string | null
          lead_name?: string | null
          lead_phone?: string | null
          lead_role?: string | null
          onboarding_email_sent_at?: string | null
          referrer?: string | null
          sample_id?: string | null
          scan_error?: string | null
          scan_id?: string | null
          scan_result?: Json | null
          scan_status?: string
          session_token?: string
          signed_up_at?: string | null
          signup_completed?: boolean
          updated_at?: string
          user_agent?: string | null
          utm_campaign?: string | null
          utm_content?: string | null
          utm_medium?: string | null
          utm_source?: string | null
          utm_term?: string | null
        }
        Relationships: []
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
      notifications: {
        Row: {
          body: string | null
          created_at: string
          id: string
          org_id: string
          payload: Json
          read_at: string | null
          title: string
          type: string
          user_id: string
        }
        Insert: {
          body?: string | null
          created_at?: string
          id?: string
          org_id: string
          payload?: Json
          read_at?: string | null
          title: string
          type: string
          user_id: string
        }
        Update: {
          body?: string | null
          created_at?: string
          id?: string
          org_id?: string
          payload?: Json
          read_at?: string | null
          title?: string
          type?: string
          user_id?: string
        }
        Relationships: []
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
          brand_config: Json
          country: string | null
          created_at: string
          customer_type: string | null
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
          brand_config?: Json
          country?: string | null
          created_at?: string
          customer_type?: string | null
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
          brand_config?: Json
          country?: string | null
          created_at?: string
          customer_type?: string | null
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
      planogram_comparison_lines: {
        Row: {
          actual_brand: string | null
          actual_product: string | null
          actual_qty: number | null
          comparison_id: string
          created_at: string
          detail: string | null
          expected_brand: string | null
          expected_product: string | null
          expected_qty: number | null
          id: string
          issue_type: string
          planogram_item_id: string | null
          severity: string
        }
        Insert: {
          actual_brand?: string | null
          actual_product?: string | null
          actual_qty?: number | null
          comparison_id: string
          created_at?: string
          detail?: string | null
          expected_brand?: string | null
          expected_product?: string | null
          expected_qty?: number | null
          id?: string
          issue_type: string
          planogram_item_id?: string | null
          severity?: string
        }
        Update: {
          actual_brand?: string | null
          actual_product?: string | null
          actual_qty?: number | null
          comparison_id?: string
          created_at?: string
          detail?: string | null
          expected_brand?: string | null
          expected_product?: string | null
          expected_qty?: number | null
          id?: string
          issue_type?: string
          planogram_item_id?: string | null
          severity?: string
        }
        Relationships: [
          {
            foreignKeyName: "planogram_comparison_lines_comparison_id_fkey"
            columns: ["comparison_id"]
            isOneToOne: false
            referencedRelation: "planogram_comparisons"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "planogram_comparison_lines_planogram_item_id_fkey"
            columns: ["planogram_item_id"]
            isOneToOne: false
            referencedRelation: "planogram_items"
            referencedColumns: ["id"]
          },
        ]
      }
      planogram_comparisons: {
        Row: {
          assignment_id: string | null
          compliance_percent: number | null
          created_at: string
          id: string
          org_id: string
          scan_id: string | null
          store_id: string | null
          summary: Json
        }
        Insert: {
          assignment_id?: string | null
          compliance_percent?: number | null
          created_at?: string
          id?: string
          org_id: string
          scan_id?: string | null
          store_id?: string | null
          summary?: Json
        }
        Update: {
          assignment_id?: string | null
          compliance_percent?: number | null
          created_at?: string
          id?: string
          org_id?: string
          scan_id?: string | null
          store_id?: string | null
          summary?: Json
        }
        Relationships: [
          {
            foreignKeyName: "planogram_comparisons_assignment_id_fkey"
            columns: ["assignment_id"]
            isOneToOne: false
            referencedRelation: "scan_assignments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "planogram_comparisons_scan_id_fkey"
            columns: ["scan_id"]
            isOneToOne: false
            referencedRelation: "shelf_scans"
            referencedColumns: ["id"]
          },
        ]
      }
      planogram_items: {
        Row: {
          aisle: string | null
          approved_substitutes: Json
          authorized_shelf_price: number | null
          avg_daily_sales: number | null
          brand: string
          category: string
          created_at: string
          expected_facings: number | null
          expected_orientation: string | null
          expected_qty: number
          expected_shelf_units: number | null
          id: string
          is_mandatory_assortment: boolean
          is_msl: boolean
          is_optional: boolean
          location: string
          match_key: string | null
          max_facings: number | null
          min_facings: number | null
          mrp_inr: number | null
          org_id: string
          price_basis: string | null
          price_valid_from: string | null
          price_valid_to: string | null
          product_height_cm: number | null
          product_name: string
          product_width_cm: number | null
          shelf_position: string | null
          sku: string | null
          slot_width_cm: number | null
          store_id: string
          sub_category: string
          updated_at: string
          variant: string | null
          version_id: string
        }
        Insert: {
          aisle?: string | null
          approved_substitutes?: Json
          authorized_shelf_price?: number | null
          avg_daily_sales?: number | null
          brand: string
          category: string
          created_at?: string
          expected_facings?: number | null
          expected_orientation?: string | null
          expected_qty?: number
          expected_shelf_units?: number | null
          id?: string
          is_mandatory_assortment?: boolean
          is_msl?: boolean
          is_optional?: boolean
          location: string
          match_key?: string | null
          max_facings?: number | null
          min_facings?: number | null
          mrp_inr?: number | null
          org_id: string
          price_basis?: string | null
          price_valid_from?: string | null
          price_valid_to?: string | null
          product_height_cm?: number | null
          product_name: string
          product_width_cm?: number | null
          shelf_position?: string | null
          sku?: string | null
          slot_width_cm?: number | null
          store_id: string
          sub_category: string
          updated_at?: string
          variant?: string | null
          version_id: string
        }
        Update: {
          aisle?: string | null
          approved_substitutes?: Json
          authorized_shelf_price?: number | null
          avg_daily_sales?: number | null
          brand?: string
          category?: string
          created_at?: string
          expected_facings?: number | null
          expected_orientation?: string | null
          expected_qty?: number
          expected_shelf_units?: number | null
          id?: string
          is_mandatory_assortment?: boolean
          is_msl?: boolean
          is_optional?: boolean
          location?: string
          match_key?: string | null
          max_facings?: number | null
          min_facings?: number | null
          mrp_inr?: number | null
          org_id?: string
          price_basis?: string | null
          price_valid_from?: string | null
          price_valid_to?: string | null
          product_height_cm?: number | null
          product_name?: string
          product_width_cm?: number | null
          shelf_position?: string | null
          sku?: string | null
          slot_width_cm?: number | null
          store_id?: string
          sub_category?: string
          updated_at?: string
          variant?: string | null
          version_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "planogram_items_store_id_fkey"
            columns: ["store_id"]
            isOneToOne: false
            referencedRelation: "stores"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "planogram_items_version_id_fkey"
            columns: ["version_id"]
            isOneToOne: false
            referencedRelation: "planogram_versions"
            referencedColumns: ["id"]
          },
        ]
      }
      planogram_promotions: {
        Row: {
          created_at: string
          ends_at: string
          expected_offer_text: string | null
          expected_promo_price: number | null
          id: string
          org_id: string
          participating_skus: Json
          promotion_id: string
          reference_signage_url: string | null
          required_facings: number | null
          required_location: string | null
          starts_at: string
          version_id: string
          visual_checks: Json
        }
        Insert: {
          created_at?: string
          ends_at: string
          expected_offer_text?: string | null
          expected_promo_price?: number | null
          id?: string
          org_id: string
          participating_skus?: Json
          promotion_id: string
          reference_signage_url?: string | null
          required_facings?: number | null
          required_location?: string | null
          starts_at: string
          version_id: string
          visual_checks?: Json
        }
        Update: {
          created_at?: string
          ends_at?: string
          expected_offer_text?: string | null
          expected_promo_price?: number | null
          id?: string
          org_id?: string
          participating_skus?: Json
          promotion_id?: string
          reference_signage_url?: string | null
          required_facings?: number | null
          required_location?: string | null
          starts_at?: string
          version_id?: string
          visual_checks?: Json
        }
        Relationships: [
          {
            foreignKeyName: "planogram_promotions_version_id_fkey"
            columns: ["version_id"]
            isOneToOne: false
            referencedRelation: "planogram_versions"
            referencedColumns: ["id"]
          },
        ]
      }
      planogram_versions: {
        Row: {
          activated_at: string | null
          audit_package: Json
          created_at: string
          effective_from: string | null
          effective_to: string | null
          fixture_id: string | null
          id: string
          name: string
          org_id: string
          row_count: number
          source_filename: string | null
          source_type: string
          status: string
          store_format: string | null
          store_id: string
          store_timezone: string | null
          updated_at: string
          uploaded_by: string | null
          valid_from: string | null
          valid_to: string | null
        }
        Insert: {
          activated_at?: string | null
          audit_package?: Json
          created_at?: string
          effective_from?: string | null
          effective_to?: string | null
          fixture_id?: string | null
          id?: string
          name?: string
          org_id: string
          row_count?: number
          source_filename?: string | null
          source_type?: string
          status?: string
          store_format?: string | null
          store_id: string
          store_timezone?: string | null
          updated_at?: string
          uploaded_by?: string | null
          valid_from?: string | null
          valid_to?: string | null
        }
        Update: {
          activated_at?: string | null
          audit_package?: Json
          created_at?: string
          effective_from?: string | null
          effective_to?: string | null
          fixture_id?: string | null
          id?: string
          name?: string
          org_id?: string
          row_count?: number
          source_filename?: string | null
          source_type?: string
          status?: string
          store_format?: string | null
          store_id?: string
          store_timezone?: string | null
          updated_at?: string
          uploaded_by?: string | null
          valid_from?: string | null
          valid_to?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "planogram_versions_store_id_fkey"
            columns: ["store_id"]
            isOneToOne: false
            referencedRelation: "stores"
            referencedColumns: ["id"]
          },
        ]
      }
      platform_access_grants: {
        Row: {
          bypass_history_limits: boolean
          bypass_scan_limits: boolean
          bypass_store_limits: boolean
          created_at: string
          email: string
          is_active: boolean
          note: string | null
          updated_at: string
        }
        Insert: {
          bypass_history_limits?: boolean
          bypass_scan_limits?: boolean
          bypass_store_limits?: boolean
          created_at?: string
          email: string
          is_active?: boolean
          note?: string | null
          updated_at?: string
        }
        Update: {
          bypass_history_limits?: boolean
          bypass_scan_limits?: boolean
          bypass_store_limits?: boolean
          created_at?: string
          email?: string
          is_active?: boolean
          note?: string | null
          updated_at?: string
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
          onboarding_completed_at: string | null
          phone: string | null
          role_family: string | null
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
          onboarding_completed_at?: string | null
          phone?: string | null
          role_family?: string | null
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
          onboarding_completed_at?: string | null
          phone?: string | null
          role_family?: string | null
          timezone?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      scan_assignments: {
        Row: {
          assignee_id: string
          assigner_id: string
          completed_at: string | null
          created_at: string
          due_at: string | null
          id: string
          instructions: string | null
          last_compliance_percent: number | null
          org_id: string
          planogram_version_id: string | null
          scan_attempts: number
          scan_id: string | null
          scope_type: string
          scope_values: Json
          status: string
          store_id: string
          updated_at: string
          verified_at: string | null
          verified_by: string | null
        }
        Insert: {
          assignee_id: string
          assigner_id: string
          completed_at?: string | null
          created_at?: string
          due_at?: string | null
          id?: string
          instructions?: string | null
          last_compliance_percent?: number | null
          org_id: string
          planogram_version_id?: string | null
          scan_attempts?: number
          scan_id?: string | null
          scope_type: string
          scope_values?: Json
          status?: string
          store_id: string
          updated_at?: string
          verified_at?: string | null
          verified_by?: string | null
        }
        Update: {
          assignee_id?: string
          assigner_id?: string
          completed_at?: string | null
          created_at?: string
          due_at?: string | null
          id?: string
          instructions?: string | null
          last_compliance_percent?: number | null
          org_id?: string
          planogram_version_id?: string | null
          scan_attempts?: number
          scan_id?: string | null
          scope_type?: string
          scope_values?: Json
          status?: string
          store_id?: string
          updated_at?: string
          verified_at?: string | null
          verified_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "scan_assignments_planogram_version_id_fkey"
            columns: ["planogram_version_id"]
            isOneToOne: false
            referencedRelation: "planogram_versions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "scan_assignments_scan_id_fkey"
            columns: ["scan_id"]
            isOneToOne: false
            referencedRelation: "shelf_scans"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "scan_assignments_store_id_fkey"
            columns: ["store_id"]
            isOneToOne: false
            referencedRelation: "stores"
            referencedColumns: ["id"]
          },
        ]
      }
      scan_corrections: {
        Row: {
          category: string | null
          corrected_brand: string | null
          corrected_ocr_label: string | null
          corrected_product: string | null
          corrected_variant: string | null
          created_at: string
          created_by: string | null
          id: string
          org_id: string
          pack_text: string | null
          predicted_brand: string | null
          predicted_product: string | null
          scan_id: string
          sub_category: string | null
          x1: number | null
          x2: number | null
          y1: number | null
          y2: number | null
        }
        Insert: {
          category?: string | null
          corrected_brand?: string | null
          corrected_ocr_label?: string | null
          corrected_product?: string | null
          corrected_variant?: string | null
          created_at?: string
          created_by?: string | null
          id?: string
          org_id: string
          pack_text?: string | null
          predicted_brand?: string | null
          predicted_product?: string | null
          scan_id: string
          sub_category?: string | null
          x1?: number | null
          x2?: number | null
          y1?: number | null
          y2?: number | null
        }
        Update: {
          category?: string | null
          corrected_brand?: string | null
          corrected_ocr_label?: string | null
          corrected_product?: string | null
          corrected_variant?: string | null
          created_at?: string
          created_by?: string | null
          id?: string
          org_id?: string
          pack_text?: string | null
          predicted_brand?: string | null
          predicted_product?: string | null
          scan_id?: string
          sub_category?: string | null
          x1?: number | null
          x2?: number | null
          y1?: number | null
          y2?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "scan_corrections_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
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
      scan_share_events: {
        Row: {
          created_at: string
          created_by: string | null
          id: string
          org_id: string
          payload: Json
          recipient_email: string | null
          recipient_user_id: string | null
          scan_id: string
          share_type: string
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          id?: string
          org_id: string
          payload?: Json
          recipient_email?: string | null
          recipient_user_id?: string | null
          scan_id: string
          share_type: string
        }
        Update: {
          created_at?: string
          created_by?: string | null
          id?: string
          org_id?: string
          payload?: Json
          recipient_email?: string | null
          recipient_user_id?: string | null
          scan_id?: string
          share_type?: string
        }
        Relationships: [
          {
            foreignKeyName: "scan_share_events_scan_id_fkey"
            columns: ["scan_id"]
            isOneToOne: false
            referencedRelation: "shelf_scans"
            referencedColumns: ["id"]
          },
        ]
      }
      scan_share_links: {
        Row: {
          created_at: string
          created_by: string | null
          expires_at: string
          id: string
          org_id: string
          revoked_at: string | null
          scan_id: string
          token: string
          view_count: number
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          expires_at?: string
          id?: string
          org_id: string
          revoked_at?: string | null
          scan_id: string
          token?: string
          view_count?: number
        }
        Update: {
          created_at?: string
          created_by?: string | null
          expires_at?: string
          id?: string
          org_id?: string
          revoked_at?: string | null
          scan_id?: string
          token?: string
          view_count?: number
        }
        Relationships: [
          {
            foreignKeyName: "scan_share_links_scan_id_fkey"
            columns: ["scan_id"]
            isOneToOne: false
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
          adhoc_planogram: Json | null
          assignment_id: string | null
          category: string | null
          category_selections: Json
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
          parent_scan_id: string | null
          photo_count: number
          planogram_compliance_percent: number | null
          processing_completed_at: string | null
          processing_started_at: string | null
          share_of_shelf_percent: number | null
          shelf_health_score: number | null
          shelf_label: string | null
          status: Database["public"]["Enums"]["scan_status"]
          store_id: string | null
          sub_category: string | null
          sub_category_custom: string | null
          sub_category_label: string | null
          total_products: number
          updated_at: string
        }
        Insert: {
          adhoc_planogram?: Json | null
          assignment_id?: string | null
          category?: string | null
          category_selections?: Json
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
          parent_scan_id?: string | null
          photo_count?: number
          planogram_compliance_percent?: number | null
          processing_completed_at?: string | null
          processing_started_at?: string | null
          share_of_shelf_percent?: number | null
          shelf_health_score?: number | null
          shelf_label?: string | null
          status?: Database["public"]["Enums"]["scan_status"]
          store_id?: string | null
          sub_category?: string | null
          sub_category_custom?: string | null
          sub_category_label?: string | null
          total_products?: number
          updated_at?: string
        }
        Update: {
          adhoc_planogram?: Json | null
          assignment_id?: string | null
          category?: string | null
          category_selections?: Json
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
          parent_scan_id?: string | null
          photo_count?: number
          planogram_compliance_percent?: number | null
          processing_completed_at?: string | null
          processing_started_at?: string | null
          share_of_shelf_percent?: number | null
          shelf_health_score?: number | null
          shelf_label?: string | null
          status?: Database["public"]["Enums"]["scan_status"]
          store_id?: string | null
          sub_category?: string | null
          sub_category_custom?: string | null
          sub_category_label?: string | null
          total_products?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "shelf_scans_assignment_id_fkey"
            columns: ["assignment_id"]
            isOneToOne: false
            referencedRelation: "scan_assignments"
            referencedColumns: ["id"]
          },
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
            foreignKeyName: "shelf_scans_parent_scan_id_fkey"
            columns: ["parent_scan_id"]
            isOneToOne: false
            referencedRelation: "shelf_scans"
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
          geofence_radius_m: number
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
          territory_id: string | null
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
          geofence_radius_m?: number
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
          territory_id?: string | null
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
          geofence_radius_m?: number
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
          territory_id?: string | null
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
          {
            foreignKeyName: "stores_territory_id_fkey"
            columns: ["territory_id"]
            isOneToOne: false
            referencedRelation: "territories"
            referencedColumns: ["id"]
          },
        ]
      }
      subscription_plans: {
        Row: {
          code: string
          created_at: string
          features: Json
          history_days: number | null
          id: string
          is_active: boolean
          is_contact_sales: boolean
          name: string
          price_annual_inr: number
          price_monthly_inr: number
          quota_period: string
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
          history_days?: number | null
          id?: string
          is_active?: boolean
          is_contact_sales?: boolean
          name: string
          price_annual_inr?: number
          price_monthly_inr?: number
          quota_period?: string
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
          history_days?: number | null
          id?: string
          is_active?: boolean
          is_contact_sales?: boolean
          name?: string
          price_annual_inr?: number
          price_monthly_inr?: number
          quota_period?: string
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
      territories: {
        Row: {
          created_at: string
          id: string
          name: string
          org_id: string
          parent_id: string | null
          updated_at: string
        }
        Insert: {
          created_at?: string
          id?: string
          name: string
          org_id: string
          parent_id?: string | null
          updated_at?: string
        }
        Update: {
          created_at?: string
          id?: string
          name?: string
          org_id?: string
          parent_id?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "territories_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "territories_parent_id_fkey"
            columns: ["parent_id"]
            isOneToOne: false
            referencedRelation: "territories"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      can_org_add_member: { Args: { p_org_id: string }; Returns: boolean }
      can_org_add_store: { Args: { p_org_id: string }; Returns: boolean }
      can_org_start_scan: { Args: { p_org_id: string }; Returns: boolean }
      complete_onboarding: { Args: { p_user_id?: string }; Returns: string }
      count_org_seats: { Args: { p_org_id: string }; Returns: number }
      ensure_org_free_subscription: {
        Args: { p_org_id: string }
        Returns: undefined
      }
      free_plan_scan_status: {
        Args: { _org_id: string }
        Returns: {
          blocked: boolean
          cooldown_until: string
          scans_allowed: number
          scans_used_in_batch: number
        }[]
      }
      get_org_billing_profile: {
        Args: { p_org_id: string }
        Returns: {
          address: Json
          billing_email: string
          gstin: string
          id: string
          logo_url: string
          name: string
        }[]
      }
      get_org_usage_summary: { Args: { p_org_id: string }; Returns: Json }
      is_org_manager: { Args: { p_org_id: string }; Returns: boolean }
      is_org_member: { Args: { p_org_id: string }; Returns: boolean }
      is_org_owner_or_admin: { Args: { p_org_id: string }; Returns: boolean }
      is_user_email_verified: { Args: { p_user_id?: string }; Returns: boolean }
      org_has_platform_bypass: { Args: { p_org_id: string }; Returns: boolean }
      org_has_platform_store_bypass: {
        Args: { p_org_id: string }
        Returns: boolean
      }
      reset_subscription_period_if_due: {
        Args: { _org_id: string }
        Returns: undefined
      }
      should_show_onboarding: { Args: { p_user_id?: string }; Returns: boolean }
      user_email_has_platform_bypass: {
        Args: { _email: string }
        Returns: boolean
      }
    }
    Enums: {
      alert_severity: "critical" | "high" | "medium" | "low"
      app_role:
        | "owner"
        | "admin"
        | "store_manager"
        | "viewer"
        | "manager"
        | "member"
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
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never) = never,
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
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
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
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
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
  EnumName extends (DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never) = never,
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
  CompositeTypeName extends (PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never) = never,
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
      app_role: [
        "owner",
        "admin",
        "store_manager",
        "viewer",
        "manager",
        "member",
      ],
      billing_cycle: ["monthly", "annual"],
      member_status: ["active", "invited", "suspended"],
      scan_status: ["queued", "processing", "completed", "failed"],
      stock_status: ["in_stock", "low_stock", "out_of_stock", "misplaced"],
      store_status: ["active", "inactive", "onboarding"],
      subscription_status: ["active", "trialing", "past_due", "canceled"],
    },
  },
} as const
