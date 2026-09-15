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
      audit_activity_events: {
        Row: {
          action_id: string | null
          actor_id: string | null
          created_at: string
          event_type: string
          finding_id: string | null
          id: string
          org_id: string
          payload: Json
          scan_id: string | null
          summary: string
        }
        Insert: {
          action_id?: string | null
          actor_id?: string | null
          created_at?: string
          event_type: string
          finding_id?: string | null
          id?: string
          org_id: string
          payload?: Json
          scan_id?: string | null
          summary: string
        }
        Update: {
          action_id?: string | null
          actor_id?: string | null
          created_at?: string
          event_type?: string
          finding_id?: string | null
          id?: string
          org_id?: string
          payload?: Json
          scan_id?: string | null
          summary?: string
        }
        Relationships: [
          {
            foreignKeyName: "audit_activity_events_action_id_fkey"
            columns: ["action_id"]
            isOneToOne: false
            referencedRelation: "corrective_actions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "audit_activity_events_finding_id_fkey"
            columns: ["finding_id"]
            isOneToOne: false
            referencedRelation: "findings"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "audit_activity_events_scan_id_fkey"
            columns: ["scan_id"]
            isOneToOne: false
            referencedRelation: "shelf_scans"
            referencedColumns: ["id"]
          },
        ]
      }
      audit_approvals: {
        Row: {
          action: string
          assignment_id: string | null
          comment: string | null
          created_at: string
          id: string
          org_id: string
          reject_mode: string | null
          reviewer_id: string
          scan_id: string
        }
        Insert: {
          action: string
          assignment_id?: string | null
          comment?: string | null
          created_at?: string
          id?: string
          org_id: string
          reject_mode?: string | null
          reviewer_id: string
          scan_id: string
        }
        Update: {
          action?: string
          assignment_id?: string | null
          comment?: string | null
          created_at?: string
          id?: string
          org_id?: string
          reject_mode?: string | null
          reviewer_id?: string
          scan_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "audit_approvals_assignment_id_fkey"
            columns: ["assignment_id"]
            isOneToOne: false
            referencedRelation: "scan_assignments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "audit_approvals_scan_id_fkey"
            columns: ["scan_id"]
            isOneToOne: false
            referencedRelation: "shelf_scans"
            referencedColumns: ["id"]
          },
        ]
      }
      audit_digest_settings: {
        Row: {
          cadence: string
          email_enabled: boolean
          include_exceptions: boolean
          include_pending_approvals: boolean
          include_variance_summary: boolean
          last_sent_at: string | null
          last_status: string | null
          org_id: string
          send_time_local: string
          timezone: string
          updated_at: string
          whatsapp_enabled: boolean
          whatsapp_number: string | null
        }
        Insert: {
          cadence?: string
          email_enabled?: boolean
          include_exceptions?: boolean
          include_pending_approvals?: boolean
          include_variance_summary?: boolean
          last_sent_at?: string | null
          last_status?: string | null
          org_id: string
          send_time_local?: string
          timezone?: string
          updated_at?: string
          whatsapp_enabled?: boolean
          whatsapp_number?: string | null
        }
        Update: {
          cadence?: string
          email_enabled?: boolean
          include_exceptions?: boolean
          include_pending_approvals?: boolean
          include_variance_summary?: boolean
          last_sent_at?: string | null
          last_status?: string | null
          org_id?: string
          send_time_local?: string
          timezone?: string
          updated_at?: string
          whatsapp_enabled?: boolean
          whatsapp_number?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "audit_digest_settings_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: true
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      audit_evidence: {
        Row: {
          accuracy_m: number | null
          bin_key: string
          captured_at: string
          captured_by: string
          created_at: string
          device_info: Json
          id: string
          lat: number | null
          lng: number | null
          org_id: string
          scan_id: string
          storage_path: string
        }
        Insert: {
          accuracy_m?: number | null
          bin_key: string
          captured_at?: string
          captured_by: string
          created_at?: string
          device_info?: Json
          id?: string
          lat?: number | null
          lng?: number | null
          org_id: string
          scan_id: string
          storage_path: string
        }
        Update: {
          accuracy_m?: number | null
          bin_key?: string
          captured_at?: string
          captured_by?: string
          created_at?: string
          device_info?: Json
          id?: string
          lat?: number | null
          lng?: number | null
          org_id?: string
          scan_id?: string
          storage_path?: string
        }
        Relationships: [
          {
            foreignKeyName: "audit_evidence_scan_id_fkey"
            columns: ["scan_id"]
            isOneToOne: false
            referencedRelation: "shelf_scans"
            referencedColumns: ["id"]
          },
        ]
      }
      audit_exceptions: {
        Row: {
          assignment_id: string | null
          created_at: string
          description: string | null
          due_at: string | null
          id: string
          impact_label: string | null
          lifecycle: string
          metadata: Json
          org_id: string
          owner_id: string | null
          scan_id: string | null
          severity: string
          shelf_label: string | null
          sku_label: string | null
          source_id: string
          source_type: string
          store_id: string | null
          title: string
          updated_at: string
        }
        Insert: {
          assignment_id?: string | null
          created_at?: string
          description?: string | null
          due_at?: string | null
          id?: string
          impact_label?: string | null
          lifecycle?: string
          metadata?: Json
          org_id: string
          owner_id?: string | null
          scan_id?: string | null
          severity?: string
          shelf_label?: string | null
          sku_label?: string | null
          source_id: string
          source_type: string
          store_id?: string | null
          title: string
          updated_at?: string
        }
        Update: {
          assignment_id?: string | null
          created_at?: string
          description?: string | null
          due_at?: string | null
          id?: string
          impact_label?: string | null
          lifecycle?: string
          metadata?: Json
          org_id?: string
          owner_id?: string | null
          scan_id?: string | null
          severity?: string
          shelf_label?: string | null
          sku_label?: string | null
          source_id?: string
          source_type?: string
          store_id?: string | null
          title?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "audit_exceptions_assignment_id_fkey"
            columns: ["assignment_id"]
            isOneToOne: false
            referencedRelation: "scan_assignments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "audit_exceptions_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "audit_exceptions_scan_id_fkey"
            columns: ["scan_id"]
            isOneToOne: false
            referencedRelation: "shelf_scans"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "audit_exceptions_store_id_fkey"
            columns: ["store_id"]
            isOneToOne: false
            referencedRelation: "stores"
            referencedColumns: ["id"]
          },
        ]
      }
      audit_responses: {
        Row: {
          ai_suggested: Json | null
          assignment_id: string | null
          created_at: string
          created_by: string | null
          field_config: Json
          field_key: string
          field_type: string
          human_confirmed: boolean
          id: string
          org_id: string
          record_index: number
          scan_id: string | null
          section_key: string
          template_id: string
          template_version: number
          updated_at: string
          updated_by: string | null
          value: Json | null
        }
        Insert: {
          ai_suggested?: Json | null
          assignment_id?: string | null
          created_at?: string
          created_by?: string | null
          field_config?: Json
          field_key: string
          field_type: string
          human_confirmed?: boolean
          id?: string
          org_id: string
          record_index?: number
          scan_id?: string | null
          section_key?: string
          template_id: string
          template_version?: number
          updated_at?: string
          updated_by?: string | null
          value?: Json | null
        }
        Update: {
          ai_suggested?: Json | null
          assignment_id?: string | null
          created_at?: string
          created_by?: string | null
          field_config?: Json
          field_key?: string
          field_type?: string
          human_confirmed?: boolean
          id?: string
          org_id?: string
          record_index?: number
          scan_id?: string | null
          section_key?: string
          template_id?: string
          template_version?: number
          updated_at?: string
          updated_by?: string | null
          value?: Json | null
        }
        Relationships: [
          {
            foreignKeyName: "audit_responses_assignment_id_fkey"
            columns: ["assignment_id"]
            isOneToOne: false
            referencedRelation: "scan_assignments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "audit_responses_scan_id_fkey"
            columns: ["scan_id"]
            isOneToOne: false
            referencedRelation: "shelf_scans"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "audit_responses_template_id_fkey"
            columns: ["template_id"]
            isOneToOne: false
            referencedRelation: "audit_templates"
            referencedColumns: ["id"]
          },
        ]
      }
      audit_schedules: {
        Row: {
          active: boolean
          assignee_id: string
          audit_mode: string
          cadence: string
          created_at: string
          created_by: string
          day_of_month: number | null
          day_of_week: number | null
          id: string
          instructions: string | null
          last_run_at: string | null
          name: string | null
          next_run_at: string
          org_id: string
          scope_type: string
          scope_values: Json
          status: string
          store_id: string
          store_ids: string[]
          template_id: string | null
          updated_at: string
        }
        Insert: {
          active?: boolean
          assignee_id: string
          audit_mode?: string
          cadence?: string
          created_at?: string
          created_by: string
          day_of_month?: number | null
          day_of_week?: number | null
          id?: string
          instructions?: string | null
          last_run_at?: string | null
          name?: string | null
          next_run_at?: string
          org_id: string
          scope_type?: string
          scope_values?: Json
          status?: string
          store_id: string
          store_ids?: string[]
          template_id?: string | null
          updated_at?: string
        }
        Update: {
          active?: boolean
          assignee_id?: string
          audit_mode?: string
          cadence?: string
          created_at?: string
          created_by?: string
          day_of_month?: number | null
          day_of_week?: number | null
          id?: string
          instructions?: string | null
          last_run_at?: string | null
          name?: string | null
          next_run_at?: string
          org_id?: string
          scope_type?: string
          scope_values?: Json
          status?: string
          store_id?: string
          store_ids?: string[]
          template_id?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "audit_schedules_store_id_fkey"
            columns: ["store_id"]
            isOneToOne: false
            referencedRelation: "stores"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "audit_schedules_template_id_fkey"
            columns: ["template_id"]
            isOneToOne: false
            referencedRelation: "audit_templates"
            referencedColumns: ["id"]
          },
        ]
      }
      audit_template_versions: {
        Row: {
          change_summary: string | null
          created_at: string
          created_by: string | null
          id: string
          org_id: string
          snapshot: Json
          template_id: string
          version: number
        }
        Insert: {
          change_summary?: string | null
          created_at?: string
          created_by?: string | null
          id?: string
          org_id: string
          snapshot?: Json
          template_id: string
          version: number
        }
        Update: {
          change_summary?: string | null
          created_at?: string
          created_by?: string | null
          id?: string
          org_id?: string
          snapshot?: Json
          template_id?: string
          version?: number
        }
        Relationships: [
          {
            foreignKeyName: "audit_template_versions_template_id_fkey"
            columns: ["template_id"]
            isOneToOne: false
            referencedRelation: "audit_templates"
            referencedColumns: ["id"]
          },
        ]
      }
      audit_templates: {
        Row: {
          ai_config: Json
          audit_level: string
          audit_mode: string
          audit_purpose: string | null
          calculated_fields: Json
          category: string | null
          created_at: string
          created_by: string | null
          description: string | null
          evidence_config: Json
          evidence_required: boolean
          field_definitions: Json
          hierarchy_bindings: Json
          hierarchy_profile_id: string | null
          icon: string | null
          id: string
          instructions: string | null
          is_active: boolean
          is_system_template: boolean
          name: string
          operating_model: string | null
          org_id: string
          published: boolean
          purpose_config: Json
          rules: Json
          scope_type: string
          scope_values: Json
          scoring_config: Json
          sections: Json
          short_description: string | null
          status: string
          subject_type: string | null
          template_type: string
          updated_at: string
          updated_by: string | null
          version: number
          workflow_settings: Json
        }
        Insert: {
          ai_config?: Json
          audit_level?: string
          audit_mode?: string
          audit_purpose?: string | null
          calculated_fields?: Json
          category?: string | null
          created_at?: string
          created_by?: string | null
          description?: string | null
          evidence_config?: Json
          evidence_required?: boolean
          field_definitions?: Json
          hierarchy_bindings?: Json
          hierarchy_profile_id?: string | null
          icon?: string | null
          id?: string
          instructions?: string | null
          is_active?: boolean
          is_system_template?: boolean
          name: string
          operating_model?: string | null
          org_id: string
          published?: boolean
          purpose_config?: Json
          rules?: Json
          scope_type?: string
          scope_values?: Json
          scoring_config?: Json
          sections?: Json
          short_description?: string | null
          status?: string
          subject_type?: string | null
          template_type?: string
          updated_at?: string
          updated_by?: string | null
          version?: number
          workflow_settings?: Json
        }
        Update: {
          ai_config?: Json
          audit_level?: string
          audit_mode?: string
          audit_purpose?: string | null
          calculated_fields?: Json
          category?: string | null
          created_at?: string
          created_by?: string | null
          description?: string | null
          evidence_config?: Json
          evidence_required?: boolean
          field_definitions?: Json
          hierarchy_bindings?: Json
          hierarchy_profile_id?: string | null
          icon?: string | null
          id?: string
          instructions?: string | null
          is_active?: boolean
          is_system_template?: boolean
          name?: string
          operating_model?: string | null
          org_id?: string
          published?: boolean
          purpose_config?: Json
          rules?: Json
          scope_type?: string
          scope_values?: Json
          scoring_config?: Json
          sections?: Json
          short_description?: string | null
          status?: string
          subject_type?: string | null
          template_type?: string
          updated_at?: string
          updated_by?: string | null
          version?: number
          workflow_settings?: Json
        }
        Relationships: [
          {
            foreignKeyName: "audit_templates_hierarchy_profile_id_fkey"
            columns: ["hierarchy_profile_id"]
            isOneToOne: false
            referencedRelation: "hierarchy_profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "audit_templates_org_id_fkey"
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
          closed_at: string | null
          comparison_id: string | null
          comparison_line_id: string | null
          created_at: string
          created_by: string | null
          description: string | null
          due_at: string | null
          finding_id: string | null
          id: string
          issue_type: string
          notes: string | null
          org_id: string
          priority: string | null
          rejection_reason: string | null
          resolution_notes: string | null
          resolution_qty: number | null
          resolved_at: string | null
          resolved_by: string | null
          scan_id: string | null
          sku: string | null
          sla_hours: number | null
          start_at: string | null
          status: string
          store_id: string | null
          suggestion: string
          title: string | null
          updated_at: string
          verified_at: string | null
          verified_by: string | null
        }
        Insert: {
          assigned_to?: string | null
          closed_at?: string | null
          comparison_id?: string | null
          comparison_line_id?: string | null
          created_at?: string
          created_by?: string | null
          description?: string | null
          due_at?: string | null
          finding_id?: string | null
          id?: string
          issue_type: string
          notes?: string | null
          org_id: string
          priority?: string | null
          rejection_reason?: string | null
          resolution_notes?: string | null
          resolution_qty?: number | null
          resolved_at?: string | null
          resolved_by?: string | null
          scan_id?: string | null
          sku?: string | null
          sla_hours?: number | null
          start_at?: string | null
          status?: string
          store_id?: string | null
          suggestion: string
          title?: string | null
          updated_at?: string
          verified_at?: string | null
          verified_by?: string | null
        }
        Update: {
          assigned_to?: string | null
          closed_at?: string | null
          comparison_id?: string | null
          comparison_line_id?: string | null
          created_at?: string
          created_by?: string | null
          description?: string | null
          due_at?: string | null
          finding_id?: string | null
          id?: string
          issue_type?: string
          notes?: string | null
          org_id?: string
          priority?: string | null
          rejection_reason?: string | null
          resolution_notes?: string | null
          resolution_qty?: number | null
          resolved_at?: string | null
          resolved_by?: string | null
          scan_id?: string | null
          sku?: string | null
          sla_hours?: number | null
          start_at?: string | null
          status?: string
          store_id?: string | null
          suggestion?: string
          title?: string | null
          updated_at?: string
          verified_at?: string | null
          verified_by?: string | null
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
          {
            foreignKeyName: "corrective_actions_finding_id_fkey"
            columns: ["finding_id"]
            isOneToOne: false
            referencedRelation: "findings"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "corrective_actions_scan_id_fkey"
            columns: ["scan_id"]
            isOneToOne: false
            referencedRelation: "shelf_scans"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "corrective_actions_store_id_fkey"
            columns: ["store_id"]
            isOneToOne: false
            referencedRelation: "stores"
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
      digital_audit_lines: {
        Row: {
          actual_qty: number | null
          ai_assisted_flag: boolean
          ai_suggested_qty: number | null
          assignment_id: string | null
          barcode: string | null
          bin_key: string
          brand: string | null
          category: string | null
          created_at: string
          entered_by: string | null
          expected_qty: number
          id: string
          item_code: string | null
          location: string
          match_key: string | null
          mrp_inr: number | null
          org_id: string
          planogram_item_id: string | null
          product_name: string
          rca_code: string | null
          rca_notes: string | null
          scan_id: string
          sku: string | null
          source: string
          store_id: string
          sub_category: string | null
          system_qty: number | null
          updated_at: string
          variance_pct: number | null
          variance_qty: number | null
          variance_value_inr: number | null
        }
        Insert: {
          actual_qty?: number | null
          ai_assisted_flag?: boolean
          ai_suggested_qty?: number | null
          assignment_id?: string | null
          barcode?: string | null
          bin_key?: string
          brand?: string | null
          category?: string | null
          created_at?: string
          entered_by?: string | null
          expected_qty?: number
          id?: string
          item_code?: string | null
          location?: string
          match_key?: string | null
          mrp_inr?: number | null
          org_id: string
          planogram_item_id?: string | null
          product_name: string
          rca_code?: string | null
          rca_notes?: string | null
          scan_id: string
          sku?: string | null
          source?: string
          store_id: string
          sub_category?: string | null
          system_qty?: number | null
          updated_at?: string
          variance_pct?: number | null
          variance_qty?: number | null
          variance_value_inr?: number | null
        }
        Update: {
          actual_qty?: number | null
          ai_assisted_flag?: boolean
          ai_suggested_qty?: number | null
          assignment_id?: string | null
          barcode?: string | null
          bin_key?: string
          brand?: string | null
          category?: string | null
          created_at?: string
          entered_by?: string | null
          expected_qty?: number
          id?: string
          item_code?: string | null
          location?: string
          match_key?: string | null
          mrp_inr?: number | null
          org_id?: string
          planogram_item_id?: string | null
          product_name?: string
          rca_code?: string | null
          rca_notes?: string | null
          scan_id?: string
          sku?: string | null
          source?: string
          store_id?: string
          sub_category?: string | null
          system_qty?: number | null
          updated_at?: string
          variance_pct?: number | null
          variance_qty?: number | null
          variance_value_inr?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "digital_audit_lines_assignment_id_fkey"
            columns: ["assignment_id"]
            isOneToOne: false
            referencedRelation: "scan_assignments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "digital_audit_lines_planogram_item_id_fkey"
            columns: ["planogram_item_id"]
            isOneToOne: false
            referencedRelation: "planogram_items"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "digital_audit_lines_scan_id_fkey"
            columns: ["scan_id"]
            isOneToOne: false
            referencedRelation: "shelf_scans"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "digital_audit_lines_store_id_fkey"
            columns: ["store_id"]
            isOneToOne: false
            referencedRelation: "stores"
            referencedColumns: ["id"]
          },
        ]
      }
      escalation_rules: {
        Row: {
          created_at: string
          escalate_after_hours: number
          final_role: string
          first_role: string
          id: string
          notify_in_app: boolean
          org_id: string
          second_after_hours: number
          second_role: string
          severity: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          escalate_after_hours?: number
          final_role?: string
          first_role?: string
          id?: string
          notify_in_app?: boolean
          org_id: string
          second_after_hours?: number
          second_role?: string
          severity: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          escalate_after_hours?: number
          final_role?: string
          first_role?: string
          id?: string
          notify_in_app?: boolean
          org_id?: string
          second_after_hours?: number
          second_role?: string
          severity?: string
          updated_at?: string
        }
        Relationships: []
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
      expiry_audit_events: {
        Row: {
          action: string
          actor_id: string | null
          created_at: string
          entity_id: string
          entity_type: string
          id: string
          org_id: string
          payload: Json
        }
        Insert: {
          action: string
          actor_id?: string | null
          created_at?: string
          entity_id: string
          entity_type: string
          id?: string
          org_id: string
          payload?: Json
        }
        Update: {
          action?: string
          actor_id?: string | null
          created_at?: string
          entity_id?: string
          entity_type?: string
          id?: string
          org_id?: string
          payload?: Json
        }
        Relationships: []
      }
      expiry_disposition_actions: {
        Row: {
          action_type: string
          created_at: string
          disposition_status: string
          due_at: string | null
          id: string
          notes: string | null
          org_id: string
          owner_id: string | null
          pos_integration_status: string
          transfer_id: string
          verified_at: string | null
          verified_by: string | null
        }
        Insert: {
          action_type: string
          created_at?: string
          disposition_status?: string
          due_at?: string | null
          id?: string
          notes?: string | null
          org_id: string
          owner_id?: string | null
          pos_integration_status?: string
          transfer_id: string
          verified_at?: string | null
          verified_by?: string | null
        }
        Update: {
          action_type?: string
          created_at?: string
          disposition_status?: string
          due_at?: string | null
          id?: string
          notes?: string | null
          org_id?: string
          owner_id?: string | null
          pos_integration_status?: string
          transfer_id?: string
          verified_at?: string | null
          verified_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "expiry_disposition_actions_transfer_id_fkey"
            columns: ["transfer_id"]
            isOneToOne: false
            referencedRelation: "expiry_quarantine_transfers"
            referencedColumns: ["id"]
          },
        ]
      }
      expiry_evidence_assets: {
        Row: {
          capture_source: string
          captured_at: string | null
          created_at: string
          device_metadata: Json
          evidence_status: string
          file_hash: string
          gps_accuracy_m: number | null
          gps_available: boolean
          id: string
          mime_type: string | null
          org_id: string
          perceptual_hash: string | null
          received_at: string
          retention_until: string | null
          storage_path: string
          uploaded_by: string | null
        }
        Insert: {
          capture_source?: string
          captured_at?: string | null
          created_at?: string
          device_metadata?: Json
          evidence_status?: string
          file_hash: string
          gps_accuracy_m?: number | null
          gps_available?: boolean
          id?: string
          mime_type?: string | null
          org_id: string
          perceptual_hash?: string | null
          received_at?: string
          retention_until?: string | null
          storage_path: string
          uploaded_by?: string | null
        }
        Update: {
          capture_source?: string
          captured_at?: string | null
          created_at?: string
          device_metadata?: Json
          evidence_status?: string
          file_hash?: string
          gps_accuracy_m?: number | null
          gps_available?: boolean
          id?: string
          mime_type?: string | null
          org_id?: string
          perceptual_hash?: string | null
          received_at?: string
          retention_until?: string | null
          storage_path?: string
          uploaded_by?: string | null
        }
        Relationships: []
      }
      expiry_evidence_links: {
        Row: {
          attempt_id: string | null
          created_at: string
          evidence_id: string
          id: string
          link_type: string
          observation_id: string | null
          org_id: string
          session_timestamp_ms: number | null
        }
        Insert: {
          attempt_id?: string | null
          created_at?: string
          evidence_id: string
          id?: string
          link_type: string
          observation_id?: string | null
          org_id: string
          session_timestamp_ms?: number | null
        }
        Update: {
          attempt_id?: string | null
          created_at?: string
          evidence_id?: string
          id?: string
          link_type?: string
          observation_id?: string | null
          org_id?: string
          session_timestamp_ms?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "expiry_evidence_links_attempt_id_fkey"
            columns: ["attempt_id"]
            isOneToOne: false
            referencedRelation: "expiry_inspection_attempts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "expiry_evidence_links_evidence_id_fkey"
            columns: ["evidence_id"]
            isOneToOne: false
            referencedRelation: "expiry_evidence_assets"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "expiry_evidence_links_observation_id_fkey"
            columns: ["observation_id"]
            isOneToOne: false
            referencedRelation: "expiry_packet_observations"
            referencedColumns: ["id"]
          },
        ]
      }
      expiry_exceptions: {
        Row: {
          attempt_id: string | null
          created_at: string
          due_at: string | null
          id: string
          issue_type: string
          location_id: string | null
          observation_id: string | null
          org_id: string
          owner_id: string | null
          quantity: number
          severity: string
          sku: string | null
          sort_priority: number
          status: string
          store_id: string | null
          title: string
          updated_at: string
        }
        Insert: {
          attempt_id?: string | null
          created_at?: string
          due_at?: string | null
          id?: string
          issue_type: string
          location_id?: string | null
          observation_id?: string | null
          org_id: string
          owner_id?: string | null
          quantity?: number
          severity?: string
          sku?: string | null
          sort_priority?: number
          status?: string
          store_id?: string | null
          title: string
          updated_at?: string
        }
        Update: {
          attempt_id?: string | null
          created_at?: string
          due_at?: string | null
          id?: string
          issue_type?: string
          location_id?: string | null
          observation_id?: string | null
          org_id?: string
          owner_id?: string | null
          quantity?: number
          severity?: string
          sku?: string | null
          sort_priority?: number
          status?: string
          store_id?: string | null
          title?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "expiry_exceptions_attempt_id_fkey"
            columns: ["attempt_id"]
            isOneToOne: false
            referencedRelation: "expiry_inspection_attempts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "expiry_exceptions_location_id_fkey"
            columns: ["location_id"]
            isOneToOne: false
            referencedRelation: "expiry_locations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "expiry_exceptions_observation_id_fkey"
            columns: ["observation_id"]
            isOneToOne: false
            referencedRelation: "expiry_packet_observations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "expiry_exceptions_store_id_fkey"
            columns: ["store_id"]
            isOneToOne: false
            referencedRelation: "stores"
            referencedColumns: ["id"]
          },
        ]
      }
      expiry_future_actions: {
        Row: {
          action_type: string
          created_at: string
          due_at: string | null
          id: string
          metadata: Json
          org_id: string
          sku: string | null
          status: string
          store_id: string | null
        }
        Insert: {
          action_type: string
          created_at?: string
          due_at?: string | null
          id?: string
          metadata?: Json
          org_id: string
          sku?: string | null
          status?: string
          store_id?: string | null
        }
        Update: {
          action_type?: string
          created_at?: string
          due_at?: string | null
          id?: string
          metadata?: Json
          org_id?: string
          sku?: string | null
          status?: string
          store_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "expiry_future_actions_store_id_fkey"
            columns: ["store_id"]
            isOneToOne: false
            referencedRelation: "stores"
            referencedColumns: ["id"]
          },
        ]
      }
      expiry_idempotency_keys: {
        Row: {
          created_at: string
          entity_type: string
          id: string
          idempotency_key: string
          org_id: string
          result: Json
          user_id: string
        }
        Insert: {
          created_at?: string
          entity_type: string
          id?: string
          idempotency_key: string
          org_id: string
          result?: Json
          user_id: string
        }
        Update: {
          created_at?: string
          entity_type?: string
          id?: string
          idempotency_key?: string
          org_id?: string
          result?: Json
          user_id?: string
        }
        Relationships: []
      }
      expiry_inspection_assignments: {
        Row: {
          assurance_level: string
          auditor_id: string
          category_filters: Json
          created_at: string
          created_by: string | null
          due_at: string | null
          expected_stock_snapshot_at: string | null
          expected_stock_source: string
          id: string
          instructions: string | null
          location_ids: string[]
          org_id: string
          policy_snapshot: Json
          policy_version_id: string | null
          required_location_ids: string[]
          reviewer_id: string | null
          schedule_cron: string | null
          schedule_type: string
          sku_filters: Json
          status: string
          store_id: string
          title: string
          updated_at: string
        }
        Insert: {
          assurance_level?: string
          auditor_id: string
          category_filters?: Json
          created_at?: string
          created_by?: string | null
          due_at?: string | null
          expected_stock_snapshot_at?: string | null
          expected_stock_source?: string
          id?: string
          instructions?: string | null
          location_ids?: string[]
          org_id: string
          policy_snapshot?: Json
          policy_version_id?: string | null
          required_location_ids?: string[]
          reviewer_id?: string | null
          schedule_cron?: string | null
          schedule_type?: string
          sku_filters?: Json
          status?: string
          store_id: string
          title: string
          updated_at?: string
        }
        Update: {
          assurance_level?: string
          auditor_id?: string
          category_filters?: Json
          created_at?: string
          created_by?: string | null
          due_at?: string | null
          expected_stock_snapshot_at?: string | null
          expected_stock_source?: string
          id?: string
          instructions?: string | null
          location_ids?: string[]
          org_id?: string
          policy_snapshot?: Json
          policy_version_id?: string | null
          required_location_ids?: string[]
          reviewer_id?: string | null
          schedule_cron?: string | null
          schedule_type?: string
          sku_filters?: Json
          status?: string
          store_id?: string
          title?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "expiry_inspection_assignments_policy_version_id_fkey"
            columns: ["policy_version_id"]
            isOneToOne: false
            referencedRelation: "expiry_policy_versions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "expiry_inspection_assignments_store_id_fkey"
            columns: ["store_id"]
            isOneToOne: false
            referencedRelation: "stores"
            referencedColumns: ["id"]
          },
        ]
      }
      expiry_inspection_attempts: {
        Row: {
          actual_quantity: number | null
          assignment_id: string
          assurance_fallback: string | null
          assurance_level: string
          attempt_number: number
          auditor_id: string
          barcode: string | null
          coverage_statement: string | null
          created_at: string
          disposition_status: string
          due_at: string | null
          expected_quantity: number
          id: string
          inspection_status: string
          location_coverage: Json
          location_id: string | null
          observations_count: number
          org_id: string
          parent_attempt_id: string | null
          physical_count: number | null
          policy_snapshot: Json
          product_name: string | null
          quantity_discrepancy_reason: string | null
          removal_status: string
          remove_count: number
          reviewer_id: string | null
          sellable_count: number
          sku: string
          store_fully_checked: boolean
          store_id: string
          submitted_at: string | null
          sync_status: string
          unable_to_inspect_reason: string | null
          unresolved_count: number
          updated_at: string
          verified_at: string | null
          verified_by: string | null
          version: number
          wizard_step: number
        }
        Insert: {
          actual_quantity?: number | null
          assignment_id: string
          assurance_fallback?: string | null
          assurance_level?: string
          attempt_number?: number
          auditor_id: string
          barcode?: string | null
          coverage_statement?: string | null
          created_at?: string
          disposition_status?: string
          due_at?: string | null
          expected_quantity?: number
          id?: string
          inspection_status?: string
          location_coverage?: Json
          location_id?: string | null
          observations_count?: number
          org_id: string
          parent_attempt_id?: string | null
          physical_count?: number | null
          policy_snapshot?: Json
          product_name?: string | null
          quantity_discrepancy_reason?: string | null
          removal_status?: string
          remove_count?: number
          reviewer_id?: string | null
          sellable_count?: number
          sku?: string
          store_fully_checked?: boolean
          store_id: string
          submitted_at?: string | null
          sync_status?: string
          unable_to_inspect_reason?: string | null
          unresolved_count?: number
          updated_at?: string
          verified_at?: string | null
          verified_by?: string | null
          version?: number
          wizard_step?: number
        }
        Update: {
          actual_quantity?: number | null
          assignment_id?: string
          assurance_fallback?: string | null
          assurance_level?: string
          attempt_number?: number
          auditor_id?: string
          barcode?: string | null
          coverage_statement?: string | null
          created_at?: string
          disposition_status?: string
          due_at?: string | null
          expected_quantity?: number
          id?: string
          inspection_status?: string
          location_coverage?: Json
          location_id?: string | null
          observations_count?: number
          org_id?: string
          parent_attempt_id?: string | null
          physical_count?: number | null
          policy_snapshot?: Json
          product_name?: string | null
          quantity_discrepancy_reason?: string | null
          removal_status?: string
          remove_count?: number
          reviewer_id?: string | null
          sellable_count?: number
          sku?: string
          store_fully_checked?: boolean
          store_id?: string
          submitted_at?: string | null
          sync_status?: string
          unable_to_inspect_reason?: string | null
          unresolved_count?: number
          updated_at?: string
          verified_at?: string | null
          verified_by?: string | null
          version?: number
          wizard_step?: number
        }
        Relationships: [
          {
            foreignKeyName: "expiry_inspection_attempts_assignment_id_fkey"
            columns: ["assignment_id"]
            isOneToOne: false
            referencedRelation: "expiry_inspection_assignments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "expiry_inspection_attempts_location_id_fkey"
            columns: ["location_id"]
            isOneToOne: false
            referencedRelation: "expiry_locations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "expiry_inspection_attempts_parent_attempt_id_fkey"
            columns: ["parent_attempt_id"]
            isOneToOne: false
            referencedRelation: "expiry_inspection_attempts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "expiry_inspection_attempts_store_id_fkey"
            columns: ["store_id"]
            isOneToOne: false
            referencedRelation: "stores"
            referencedColumns: ["id"]
          },
        ]
      }
      expiry_locations: {
        Row: {
          created_at: string
          id: string
          is_active: boolean
          label: string
          location_type: string
          org_id: string
          store_id: string | null
        }
        Insert: {
          created_at?: string
          id?: string
          is_active?: boolean
          label: string
          location_type: string
          org_id: string
          store_id?: string | null
        }
        Update: {
          created_at?: string
          id?: string
          is_active?: boolean
          label?: string
          location_type?: string
          org_id?: string
          store_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "expiry_locations_store_id_fkey"
            columns: ["store_id"]
            isOneToOne: false
            referencedRelation: "stores"
            referencedColumns: ["id"]
          },
        ]
      }
      expiry_packet_observations: {
        Row: {
          ai_confidence: number | null
          ai_simulated: boolean
          ai_suggested_date: string | null
          attempt_id: string
          batch_lot: string | null
          classification: string
          created_at: string
          created_by: string | null
          date_type: string | null
          duplicate_hash_flag: boolean
          human_confirmed_date: string | null
          human_correction: string | null
          id: string
          org_id: string
          packet_ordinal: number
          parsed_date: string | null
          placement: string | null
          raw_date_text: string | null
          review_status: string
          similarity_flag: boolean
          sku: string
          unreadable: boolean
          updated_at: string
          wrong_product: boolean
        }
        Insert: {
          ai_confidence?: number | null
          ai_simulated?: boolean
          ai_suggested_date?: string | null
          attempt_id: string
          batch_lot?: string | null
          classification?: string
          created_at?: string
          created_by?: string | null
          date_type?: string | null
          duplicate_hash_flag?: boolean
          human_confirmed_date?: string | null
          human_correction?: string | null
          id?: string
          org_id: string
          packet_ordinal: number
          parsed_date?: string | null
          placement?: string | null
          raw_date_text?: string | null
          review_status?: string
          similarity_flag?: boolean
          sku?: string
          unreadable?: boolean
          updated_at?: string
          wrong_product?: boolean
        }
        Update: {
          ai_confidence?: number | null
          ai_simulated?: boolean
          ai_suggested_date?: string | null
          attempt_id?: string
          batch_lot?: string | null
          classification?: string
          created_at?: string
          created_by?: string | null
          date_type?: string | null
          duplicate_hash_flag?: boolean
          human_confirmed_date?: string | null
          human_correction?: string | null
          id?: string
          org_id?: string
          packet_ordinal?: number
          parsed_date?: string | null
          placement?: string | null
          raw_date_text?: string | null
          review_status?: string
          similarity_flag?: boolean
          sku?: string
          unreadable?: boolean
          updated_at?: string
          wrong_product?: boolean
        }
        Relationships: [
          {
            foreignKeyName: "expiry_packet_observations_attempt_id_fkey"
            columns: ["attempt_id"]
            isOneToOne: false
            referencedRelation: "expiry_inspection_attempts"
            referencedColumns: ["id"]
          },
        ]
      }
      expiry_policy_versions: {
        Row: {
          assurance_levels: string[]
          created_at: string
          created_by: string | null
          date_types: string[]
          id: string
          name: string
          near_expiry_days: number
          org_id: string
          published_at: string | null
          quarantine_sla_hours: number
          required_evidence: Json
          retention_days: number
          rules: Json
          status: string
          updated_at: string
          version: number
        }
        Insert: {
          assurance_levels?: string[]
          created_at?: string
          created_by?: string | null
          date_types?: string[]
          id?: string
          name: string
          near_expiry_days?: number
          org_id: string
          published_at?: string | null
          quarantine_sla_hours?: number
          required_evidence?: Json
          retention_days?: number
          rules?: Json
          status?: string
          updated_at?: string
          version?: number
        }
        Update: {
          assurance_levels?: string[]
          created_at?: string
          created_by?: string | null
          date_types?: string[]
          id?: string
          name?: string
          near_expiry_days?: number
          org_id?: string
          published_at?: string | null
          quarantine_sla_hours?: number
          required_evidence?: Json
          retention_days?: number
          rules?: Json
          status?: string
          updated_at?: string
          version?: number
        }
        Relationships: []
      }
      expiry_quarantine_containers: {
        Row: {
          container_code: string
          created_at: string
          id: string
          org_id: string
          quarantine_location: string
          seal_id: string | null
          store_id: string
        }
        Insert: {
          container_code: string
          created_at?: string
          id?: string
          org_id: string
          quarantine_location: string
          seal_id?: string | null
          store_id: string
        }
        Update: {
          container_code?: string
          created_at?: string
          id?: string
          org_id?: string
          quarantine_location?: string
          seal_id?: string | null
          store_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "expiry_quarantine_containers_store_id_fkey"
            columns: ["store_id"]
            isOneToOne: false
            referencedRelation: "stores"
            referencedColumns: ["id"]
          },
        ]
      }
      expiry_quarantine_receipts: {
        Row: {
          created_at: string
          id: string
          mismatch_quantity: number | null
          mismatch_reason: string | null
          org_id: string
          received_at: string
          received_quantity: number
          receiver_id: string
          transfer_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          mismatch_quantity?: number | null
          mismatch_reason?: string | null
          org_id: string
          received_at?: string
          received_quantity: number
          receiver_id: string
          transfer_id: string
        }
        Update: {
          created_at?: string
          id?: string
          mismatch_quantity?: number | null
          mismatch_reason?: string | null
          org_id?: string
          received_at?: string
          received_quantity?: number
          receiver_id?: string
          transfer_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "expiry_quarantine_receipts_transfer_id_fkey"
            columns: ["transfer_id"]
            isOneToOne: false
            referencedRelation: "expiry_quarantine_transfers"
            referencedColumns: ["id"]
          },
        ]
      }
      expiry_quarantine_transfers: {
        Row: {
          attempt_id: string
          container_id: string
          created_at: string
          id: string
          org_id: string
          quantity: number
          receiver_id: string | null
          removal_reason: string
          sender_id: string
          sku: string
          transfer_status: string
          transferred_at: string
        }
        Insert: {
          attempt_id: string
          container_id: string
          created_at?: string
          id?: string
          org_id: string
          quantity: number
          receiver_id?: string | null
          removal_reason: string
          sender_id: string
          sku: string
          transfer_status?: string
          transferred_at?: string
        }
        Update: {
          attempt_id?: string
          container_id?: string
          created_at?: string
          id?: string
          org_id?: string
          quantity?: number
          receiver_id?: string | null
          removal_reason?: string
          sender_id?: string
          sku?: string
          transfer_status?: string
          transferred_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "expiry_quarantine_transfers_attempt_id_fkey"
            columns: ["attempt_id"]
            isOneToOne: false
            referencedRelation: "expiry_inspection_attempts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "expiry_quarantine_transfers_container_id_fkey"
            columns: ["container_id"]
            isOneToOne: false
            referencedRelation: "expiry_quarantine_containers"
            referencedColumns: ["id"]
          },
        ]
      }
      expiry_recheck_assignments: {
        Row: {
          assigned_to: string
          created_at: string
          created_by: string | null
          id: string
          new_attempt_id: string | null
          org_id: string
          original_attempt_id: string
          reason: string | null
        }
        Insert: {
          assigned_to: string
          created_at?: string
          created_by?: string | null
          id?: string
          new_attempt_id?: string | null
          org_id: string
          original_attempt_id: string
          reason?: string | null
        }
        Update: {
          assigned_to?: string
          created_at?: string
          created_by?: string | null
          id?: string
          new_attempt_id?: string | null
          org_id?: string
          original_attempt_id?: string
          reason?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "expiry_recheck_assignments_new_attempt_id_fkey"
            columns: ["new_attempt_id"]
            isOneToOne: false
            referencedRelation: "expiry_inspection_attempts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "expiry_recheck_assignments_original_attempt_id_fkey"
            columns: ["original_attempt_id"]
            isOneToOne: false
            referencedRelation: "expiry_inspection_attempts"
            referencedColumns: ["id"]
          },
        ]
      }
      expiry_review_decisions: {
        Row: {
          attempt_id: string
          comment: string | null
          created_at: string
          decided_by: string
          decision_type: string
          id: string
          observation_id: string | null
          org_id: string
        }
        Insert: {
          attempt_id: string
          comment?: string | null
          created_at?: string
          decided_by: string
          decision_type: string
          id?: string
          observation_id?: string | null
          org_id: string
        }
        Update: {
          attempt_id?: string
          comment?: string | null
          created_at?: string
          decided_by?: string
          decision_type?: string
          id?: string
          observation_id?: string | null
          org_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "expiry_review_decisions_attempt_id_fkey"
            columns: ["attempt_id"]
            isOneToOne: false
            referencedRelation: "expiry_inspection_attempts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "expiry_review_decisions_observation_id_fkey"
            columns: ["observation_id"]
            isOneToOne: false
            referencedRelation: "expiry_packet_observations"
            referencedColumns: ["id"]
          },
        ]
      }
      expiry_role_grants: {
        Row: {
          created_at: string
          grant_role: string
          id: string
          org_id: string
          store_id: string | null
          user_id: string
        }
        Insert: {
          created_at?: string
          grant_role: string
          id?: string
          org_id: string
          store_id?: string | null
          user_id: string
        }
        Update: {
          created_at?: string
          grant_role?: string
          id?: string
          org_id?: string
          store_id?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "expiry_role_grants_store_id_fkey"
            columns: ["store_id"]
            isOneToOne: false
            referencedRelation: "stores"
            referencedColumns: ["id"]
          },
        ]
      }
      expiry_stock_baselines: {
        Row: {
          attempt_id: string
          created_at: string
          expected_quantity: number
          id: string
          metadata: Json
          org_id: string
          snapshot_at: string
          source: string
        }
        Insert: {
          attempt_id: string
          created_at?: string
          expected_quantity?: number
          id?: string
          metadata?: Json
          org_id: string
          snapshot_at?: string
          source?: string
        }
        Update: {
          attempt_id?: string
          created_at?: string
          expected_quantity?: number
          id?: string
          metadata?: Json
          org_id?: string
          snapshot_at?: string
          source?: string
        }
        Relationships: [
          {
            foreignKeyName: "expiry_stock_baselines_attempt_id_fkey"
            columns: ["attempt_id"]
            isOneToOne: false
            referencedRelation: "expiry_inspection_attempts"
            referencedColumns: ["id"]
          },
        ]
      }
      expiry_stock_movement_adjustments: {
        Row: {
          adjustment_type: string
          attempt_id: string
          id: string
          org_id: string
          quantity_delta: number
          reason: string | null
          recorded_at: string
          recorded_by: string | null
        }
        Insert: {
          adjustment_type: string
          attempt_id: string
          id?: string
          org_id: string
          quantity_delta: number
          reason?: string | null
          recorded_at?: string
          recorded_by?: string | null
        }
        Update: {
          adjustment_type?: string
          attempt_id?: string
          id?: string
          org_id?: string
          quantity_delta?: number
          reason?: string | null
          recorded_at?: string
          recorded_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "expiry_stock_movement_adjustments_attempt_id_fkey"
            columns: ["attempt_id"]
            isOneToOne: false
            referencedRelation: "expiry_inspection_attempts"
            referencedColumns: ["id"]
          },
        ]
      }
      findings: {
        Row: {
          actual_value: number | null
          assigned_to: string | null
          assignment_id: string | null
          audit_origin: string
          category: string | null
          closed_at: string | null
          comparison_line_id: string | null
          confirmation_state: string
          created_at: string
          created_by: string | null
          description: string | null
          digital_audit_line_id: string | null
          due_at: string | null
          expected_value: number | null
          finding_type: string
          id: string
          org_id: string
          product_name: string | null
          rca_code: string | null
          rca_notes: string | null
          resolved_at: string | null
          scan_id: string | null
          severity: string
          shelf_label: string | null
          sku: string | null
          source_id: string | null
          source_type: string
          status: string
          store_id: string | null
          title: string
          updated_at: string
          variance_percentage: number | null
          variance_units: number | null
          variance_value_inr: number | null
          verified_at: string | null
        }
        Insert: {
          actual_value?: number | null
          assigned_to?: string | null
          assignment_id?: string | null
          audit_origin?: string
          category?: string | null
          closed_at?: string | null
          comparison_line_id?: string | null
          confirmation_state?: string
          created_at?: string
          created_by?: string | null
          description?: string | null
          digital_audit_line_id?: string | null
          due_at?: string | null
          expected_value?: number | null
          finding_type: string
          id?: string
          org_id: string
          product_name?: string | null
          rca_code?: string | null
          rca_notes?: string | null
          resolved_at?: string | null
          scan_id?: string | null
          severity?: string
          shelf_label?: string | null
          sku?: string | null
          source_id?: string | null
          source_type?: string
          status?: string
          store_id?: string | null
          title: string
          updated_at?: string
          variance_percentage?: number | null
          variance_units?: number | null
          variance_value_inr?: number | null
          verified_at?: string | null
        }
        Update: {
          actual_value?: number | null
          assigned_to?: string | null
          assignment_id?: string | null
          audit_origin?: string
          category?: string | null
          closed_at?: string | null
          comparison_line_id?: string | null
          confirmation_state?: string
          created_at?: string
          created_by?: string | null
          description?: string | null
          digital_audit_line_id?: string | null
          due_at?: string | null
          expected_value?: number | null
          finding_type?: string
          id?: string
          org_id?: string
          product_name?: string | null
          rca_code?: string | null
          rca_notes?: string | null
          resolved_at?: string | null
          scan_id?: string | null
          severity?: string
          shelf_label?: string | null
          sku?: string | null
          source_id?: string | null
          source_type?: string
          status?: string
          store_id?: string | null
          title?: string
          updated_at?: string
          variance_percentage?: number | null
          variance_units?: number | null
          variance_value_inr?: number | null
          verified_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "findings_assignment_id_fkey"
            columns: ["assignment_id"]
            isOneToOne: false
            referencedRelation: "scan_assignments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "findings_comparison_line_id_fkey"
            columns: ["comparison_line_id"]
            isOneToOne: false
            referencedRelation: "planogram_comparison_lines"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "findings_digital_audit_line_id_fkey"
            columns: ["digital_audit_line_id"]
            isOneToOne: false
            referencedRelation: "digital_audit_lines"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "findings_scan_id_fkey"
            columns: ["scan_id"]
            isOneToOne: false
            referencedRelation: "shelf_scans"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "findings_store_id_fkey"
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
      hierarchy_nodes: {
        Row: {
          active: boolean
          address: string | null
          city: string | null
          code: string | null
          country: string | null
          created_at: string
          created_by: string | null
          external_id: string | null
          external_type: string | null
          id: string
          latitude: number | null
          level_key: string
          longitude: number | null
          metadata: Json
          name: string
          org_id: string
          parent_id: string | null
          postal_code: string | null
          profile_id: string
          state: string | null
          updated_at: string
        }
        Insert: {
          active?: boolean
          address?: string | null
          city?: string | null
          code?: string | null
          country?: string | null
          created_at?: string
          created_by?: string | null
          external_id?: string | null
          external_type?: string | null
          id?: string
          latitude?: number | null
          level_key: string
          longitude?: number | null
          metadata?: Json
          name: string
          org_id: string
          parent_id?: string | null
          postal_code?: string | null
          profile_id: string
          state?: string | null
          updated_at?: string
        }
        Update: {
          active?: boolean
          address?: string | null
          city?: string | null
          code?: string | null
          country?: string | null
          created_at?: string
          created_by?: string | null
          external_id?: string | null
          external_type?: string | null
          id?: string
          latitude?: number | null
          level_key?: string
          longitude?: number | null
          metadata?: Json
          name?: string
          org_id?: string
          parent_id?: string | null
          postal_code?: string | null
          profile_id?: string
          state?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "hierarchy_nodes_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "hierarchy_nodes_parent_id_fkey"
            columns: ["parent_id"]
            isOneToOne: false
            referencedRelation: "hierarchy_nodes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "hierarchy_nodes_profile_id_fkey"
            columns: ["profile_id"]
            isOneToOne: false
            referencedRelation: "hierarchy_profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      hierarchy_profiles: {
        Row: {
          created_at: string
          created_by: string | null
          description: string | null
          id: string
          is_default: boolean
          is_system: boolean
          levels: Json
          name: string
          operating_model: string
          org_id: string
          updated_at: string
          updated_by: string | null
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          description?: string | null
          id?: string
          is_default?: boolean
          is_system?: boolean
          levels?: Json
          name: string
          operating_model: string
          org_id: string
          updated_at?: string
          updated_by?: string | null
        }
        Update: {
          created_at?: string
          created_by?: string | null
          description?: string | null
          id?: string
          is_default?: boolean
          is_system?: boolean
          levels?: Json
          name?: string
          operating_model?: string
          org_id?: string
          updated_at?: string
          updated_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "hierarchy_profiles_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
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
      org_sla_defaults: {
        Row: {
          critical_hours: number
          high_hours: number
          low_hours: number
          medium_hours: number
          org_id: string
          updated_at: string
        }
        Insert: {
          critical_hours?: number
          high_hours?: number
          low_hours?: number
          medium_hours?: number
          org_id: string
          updated_at?: string
        }
        Update: {
          critical_hours?: number
          high_hours?: number
          low_hours?: number
          medium_hours?: number
          org_id?: string
          updated_at?: string
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
          barcode: string | null
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
          item_code: string | null
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
          system_qty: number | null
          updated_at: string
          variant: string | null
          version_id: string
        }
        Insert: {
          aisle?: string | null
          approved_substitutes?: Json
          authorized_shelf_price?: number | null
          avg_daily_sales?: number | null
          barcode?: string | null
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
          item_code?: string | null
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
          system_qty?: number | null
          updated_at?: string
          variant?: string | null
          version_id: string
        }
        Update: {
          aisle?: string | null
          approved_substitutes?: Json
          authorized_shelf_price?: number | null
          avg_daily_sales?: number | null
          barcode?: string | null
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
          item_code?: string | null
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
          system_qty?: number | null
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
      resolution_evidence: {
        Row: {
          action_id: string | null
          captured_by: string | null
          created_at: string
          finding_id: string | null
          id: string
          notes: string | null
          org_id: string
          resolution_qty: number | null
          storage_path: string | null
        }
        Insert: {
          action_id?: string | null
          captured_by?: string | null
          created_at?: string
          finding_id?: string | null
          id?: string
          notes?: string | null
          org_id: string
          resolution_qty?: number | null
          storage_path?: string | null
        }
        Update: {
          action_id?: string | null
          captured_by?: string | null
          created_at?: string
          finding_id?: string | null
          id?: string
          notes?: string | null
          org_id?: string
          resolution_qty?: number | null
          storage_path?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "resolution_evidence_action_id_fkey"
            columns: ["action_id"]
            isOneToOne: false
            referencedRelation: "corrective_actions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "resolution_evidence_finding_id_fkey"
            columns: ["finding_id"]
            isOneToOne: false
            referencedRelation: "findings"
            referencedColumns: ["id"]
          },
        ]
      }
      scan_assignments: {
        Row: {
          approval_status: string
          assignee_id: string
          assigner_id: string
          audit_mode: string
          completed_at: string | null
          created_at: string
          creation_source: string
          due_at: string | null
          evidence_policy: Json
          id: string
          input_source: string | null
          instructions: string | null
          last_compliance_percent: number | null
          org_id: string
          planogram_version_id: string | null
          require_rca: boolean
          reviewer_id: string | null
          scan_attempts: number
          scan_id: string | null
          scope_type: string
          scope_values: Json
          status: string
          store_id: string
          template_id: string | null
          template_snapshot: Json | null
          template_version: number | null
          updated_at: string
          verified_at: string | null
          verified_by: string | null
        }
        Insert: {
          approval_status?: string
          assignee_id: string
          assigner_id: string
          audit_mode?: string
          completed_at?: string | null
          created_at?: string
          creation_source?: string
          due_at?: string | null
          evidence_policy?: Json
          id?: string
          input_source?: string | null
          instructions?: string | null
          last_compliance_percent?: number | null
          org_id: string
          planogram_version_id?: string | null
          require_rca?: boolean
          reviewer_id?: string | null
          scan_attempts?: number
          scan_id?: string | null
          scope_type: string
          scope_values?: Json
          status?: string
          store_id: string
          template_id?: string | null
          template_snapshot?: Json | null
          template_version?: number | null
          updated_at?: string
          verified_at?: string | null
          verified_by?: string | null
        }
        Update: {
          approval_status?: string
          assignee_id?: string
          assigner_id?: string
          audit_mode?: string
          completed_at?: string | null
          created_at?: string
          creation_source?: string
          due_at?: string | null
          evidence_policy?: Json
          id?: string
          input_source?: string | null
          instructions?: string | null
          last_compliance_percent?: number | null
          org_id?: string
          planogram_version_id?: string | null
          require_rca?: boolean
          reviewer_id?: string | null
          scan_attempts?: number
          scan_id?: string | null
          scope_type?: string
          scope_values?: Json
          status?: string
          store_id?: string
          template_id?: string | null
          template_snapshot?: Json | null
          template_version?: number | null
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
          {
            foreignKeyName: "scan_assignments_template_id_fkey"
            columns: ["template_id"]
            isOneToOne: false
            referencedRelation: "audit_templates"
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
          audit_mode: string
          category: string | null
          category_selections: Json
          created_at: string
          created_by: string | null
          device_info: Json
          error_message: string | null
          finalized_at: string | null
          finalized_by: string | null
          geofence_status: string | null
          id: string
          locked_at: string | null
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
          reaudit_reason: string | null
          share_of_shelf_percent: number | null
          shelf_health_score: number | null
          shelf_label: string | null
          status: Database["public"]["Enums"]["scan_status"]
          store_id: string | null
          sub_category: string | null
          sub_category_custom: string | null
          sub_category_label: string | null
          submission_status: string | null
          submitted_at: string | null
          submitted_lat: number | null
          submitted_lng: number | null
          template_id: string | null
          template_snapshot: Json | null
          template_version: number | null
          total_products: number
          updated_at: string
        }
        Insert: {
          adhoc_planogram?: Json | null
          assignment_id?: string | null
          audit_mode?: string
          category?: string | null
          category_selections?: Json
          created_at?: string
          created_by?: string | null
          device_info?: Json
          error_message?: string | null
          finalized_at?: string | null
          finalized_by?: string | null
          geofence_status?: string | null
          id?: string
          locked_at?: string | null
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
          reaudit_reason?: string | null
          share_of_shelf_percent?: number | null
          shelf_health_score?: number | null
          shelf_label?: string | null
          status?: Database["public"]["Enums"]["scan_status"]
          store_id?: string | null
          sub_category?: string | null
          sub_category_custom?: string | null
          sub_category_label?: string | null
          submission_status?: string | null
          submitted_at?: string | null
          submitted_lat?: number | null
          submitted_lng?: number | null
          template_id?: string | null
          template_snapshot?: Json | null
          template_version?: number | null
          total_products?: number
          updated_at?: string
        }
        Update: {
          adhoc_planogram?: Json | null
          assignment_id?: string | null
          audit_mode?: string
          category?: string | null
          category_selections?: Json
          created_at?: string
          created_by?: string | null
          device_info?: Json
          error_message?: string | null
          finalized_at?: string | null
          finalized_by?: string | null
          geofence_status?: string | null
          id?: string
          locked_at?: string | null
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
          reaudit_reason?: string | null
          share_of_shelf_percent?: number | null
          shelf_health_score?: number | null
          shelf_label?: string | null
          status?: Database["public"]["Enums"]["scan_status"]
          store_id?: string | null
          sub_category?: string | null
          sub_category_custom?: string | null
          sub_category_label?: string | null
          submission_status?: string | null
          submitted_at?: string | null
          submitted_lat?: number | null
          submitted_lng?: number | null
          template_id?: string | null
          template_snapshot?: Json | null
          template_version?: number | null
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
          {
            foreignKeyName: "shelf_scans_template_id_fkey"
            columns: ["template_id"]
            isOneToOne: false
            referencedRelation: "audit_templates"
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
          geofence_radius_m: number
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
          geofence_radius_m?: number
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
      expiry_demo_clock: { Args: never; Returns: string }
      expiry_is_reviewer: {
        Args: { p_org_id: string; p_user_id: string }
        Returns: boolean
      }
      expiry_is_supervisor: {
        Args: { p_org_id: string; p_store_id?: string; p_user_id: string }
        Returns: boolean
      }
      expiry_overview_metrics: {
        Args: { p_org_id: string; p_store_id?: string }
        Returns: Json
      }
      expiry_reconciliation_ok: {
        Args: { p_attempt_id: string }
        Returns: boolean
      }
      expiry_transition: {
        Args: {
          p_action: string
          p_entity_id: string
          p_entity_type: string
          p_idempotency_key?: string
          p_payload?: Json
        }
        Returns: Json
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
      log_audit_activity: {
        Args: {
          p_action_id?: string
          p_event_type: string
          p_finding_id?: string
          p_org_id: string
          p_payload?: Json
          p_scan_id: string
          p_summary: string
        }
        Returns: string
      }
      mark_overdue_corrective_actions: { Args: never; Returns: number }
      notify_org_role: {
        Args: {
          p_body: string
          p_org_id: string
          p_payload: Json
          p_roles: string[]
          p_title: string
          p_type: string
        }
        Returns: undefined
      }
      org_has_plan_feature: {
        Args: { _feature: string; _org_id: string }
        Returns: boolean
      }
      org_has_platform_bypass: { Args: { p_org_id: string }; Returns: boolean }
      org_has_platform_store_bypass: {
        Args: { p_org_id: string }
        Returns: boolean
      }
      publish_audit_template: {
        Args: { p_template_id: string }
        Returns: number
      }
      reset_subscription_period_if_due: {
        Args: { _org_id: string }
        Returns: undefined
      }
      search_hierarchy_nodes: {
        Args: {
          p_active_only?: boolean
          p_level_key?: string
          p_limit?: number
          p_parent_id?: string
          p_profile_id: string
          p_query?: string
        }
        Returns: {
          active: boolean
          address: string | null
          city: string | null
          code: string | null
          country: string | null
          created_at: string
          created_by: string | null
          external_id: string | null
          external_type: string | null
          id: string
          latitude: number | null
          level_key: string
          longitude: number | null
          metadata: Json
          name: string
          org_id: string
          parent_id: string | null
          postal_code: string | null
          profile_id: string
          state: string | null
          updated_at: string
        }[]
        SetofOptions: {
          from: "*"
          to: "hierarchy_nodes"
          isOneToOne: false
          isSetofReturn: true
        }
      }
      seed_expiry_demo_scenario: {
        Args: { p_org_id: string; p_user_id: string }
        Returns: Json
      }
      seed_fnv_qc_template: { Args: { p_org_id: string }; Returns: string }
      seed_hierarchy_profiles: { Args: { p_org_id: string }; Returns: Json }
      should_show_onboarding: { Args: { p_user_id?: string }; Returns: boolean }
      sla_hours_for_severity: {
        Args: { p_org_id: string; p_severity: string }
        Returns: number
      }
      sync_expiry_findings: {
        Args: { p_attempt_id: string }
        Returns: undefined
      }
      sync_findings_for_scan: { Args: { p_scan_id: string }; Returns: number }
      sync_stores_to_hierarchy: {
        Args: { p_org_id: string; p_profile_id: string }
        Returns: number
      }
      user_email_has_platform_bypass: {
        Args: { _email: string }
        Returns: boolean
      }
      validate_assignment_rca: {
        Args: { p_assignment_id: string }
        Returns: Json
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
