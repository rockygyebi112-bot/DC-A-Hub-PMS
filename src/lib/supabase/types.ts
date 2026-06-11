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
  graphql_public: {
    Tables: {
      [_ in never]: never
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      graphql: {
        Args: {
          extensions?: Json
          operationName?: string
          query?: string
          variables?: Json
        }
        Returns: Json
      }
    }
    Enums: {
      [_ in never]: never
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
  public: {
    Tables: {
      activities: {
        Row: {
          completed_date: string | null
          created_at: string
          created_by: string | null
          deliverable: string | null
          description: string | null
          id: string
          location: string | null
          name: string
          narrative_note: string | null
          order_index: number
          participants_count: number | null
          phase_id: string
          planned_date: string | null
          responsible: string | null
          status: string
          updated_at: string
          visibility: string
        }
        Insert: {
          completed_date?: string | null
          created_at?: string
          created_by?: string | null
          deliverable?: string | null
          description?: string | null
          id?: string
          location?: string | null
          name: string
          narrative_note?: string | null
          order_index?: number
          participants_count?: number | null
          phase_id: string
          planned_date?: string | null
          responsible?: string | null
          status?: string
          updated_at?: string
          visibility?: string
        }
        Update: {
          completed_date?: string | null
          created_at?: string
          created_by?: string | null
          deliverable?: string | null
          description?: string | null
          id?: string
          location?: string | null
          name?: string
          narrative_note?: string | null
          order_index?: number
          participants_count?: number | null
          phase_id?: string
          planned_date?: string | null
          responsible?: string | null
          status?: string
          updated_at?: string
          visibility?: string
        }
        Relationships: [
          {
            foreignKeyName: "activities_phase_id_fkey"
            columns: ["phase_id"]
            isOneToOne: false
            referencedRelation: "phases"
            referencedColumns: ["id"]
          },
        ]
      }
      activity_log: {
        Row: {
          action: string
          activity_id: string | null
          actor_user_id: string | null
          created_at: string
          id: string
          meta: Json
          project_id: string
          target_user_id: string | null
        }
        Insert: {
          action: string
          activity_id?: string | null
          actor_user_id?: string | null
          created_at?: string
          id?: string
          meta?: Json
          project_id: string
          target_user_id?: string | null
        }
        Update: {
          action?: string
          activity_id?: string | null
          actor_user_id?: string | null
          created_at?: string
          id?: string
          meta?: Json
          project_id?: string
          target_user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "activity_log_activity_id_fkey"
            columns: ["activity_id"]
            isOneToOne: false
            referencedRelation: "activities"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "activity_log_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "project_activity_counts"
            referencedColumns: ["project_id"]
          },
          {
            foreignKeyName: "activity_log_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
        ]
      }
      activity_proofs: {
        Row: {
          activity_id: string
          caption: string | null
          created_at: string
          file_name: string
          file_path: string | null
          id: string
          kind: string
          mime_type: string | null
          size_bytes: number | null
          uploaded_by: string | null
          url: string | null
        }
        Insert: {
          activity_id: string
          caption?: string | null
          created_at?: string
          file_name: string
          file_path?: string | null
          id?: string
          kind?: string
          mime_type?: string | null
          size_bytes?: number | null
          uploaded_by?: string | null
          url?: string | null
        }
        Update: {
          activity_id?: string
          caption?: string | null
          created_at?: string
          file_name?: string
          file_path?: string | null
          id?: string
          kind?: string
          mime_type?: string | null
          size_bytes?: number | null
          uploaded_by?: string | null
          url?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "activity_proofs_activity_id_fkey"
            columns: ["activity_id"]
            isOneToOne: false
            referencedRelation: "activities"
            referencedColumns: ["id"]
          },
        ]
      }
      budget_categories: {
        Row: {
          allocated_amount: number
          created_at: string
          id: string
          name: string
          order_index: number
          project_id: string
          updated_at: string
        }
        Insert: {
          allocated_amount?: number
          created_at?: string
          id?: string
          name: string
          order_index?: number
          project_id: string
          updated_at?: string
        }
        Update: {
          allocated_amount?: number
          created_at?: string
          id?: string
          name?: string
          order_index?: number
          project_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "budget_categories_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "project_activity_counts"
            referencedColumns: ["project_id"]
          },
          {
            foreignKeyName: "budget_categories_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
        ]
      }
      clients: {
        Row: {
          archived_at: string | null
          contact_email: string | null
          created_at: string
          id: string
          logo_url: string | null
          name: string
          updated_at: string
        }
        Insert: {
          archived_at?: string | null
          contact_email?: string | null
          created_at?: string
          id?: string
          logo_url?: string | null
          name: string
          updated_at?: string
        }
        Update: {
          archived_at?: string | null
          contact_email?: string | null
          created_at?: string
          id?: string
          logo_url?: string | null
          name?: string
          updated_at?: string
        }
        Relationships: []
      }
      evaluation_dashboard_configs: {
        Row: {
          created_at: string
          evaluation_id: string
          id: string
          is_active: boolean
          spec: Json
          version: number
        }
        Insert: {
          created_at?: string
          evaluation_id: string
          id?: string
          is_active?: boolean
          spec: Json
          version?: number
        }
        Update: {
          created_at?: string
          evaluation_id?: string
          id?: string
          is_active?: boolean
          spec?: Json
          version?: number
        }
        Relationships: [
          {
            foreignKeyName: "evaluation_dashboard_configs_evaluation_id_fkey"
            columns: ["evaluation_id"]
            isOneToOne: false
            referencedRelation: "evaluations"
            referencedColumns: ["id"]
          },
        ]
      }
      evaluation_ingestion_issues: {
        Row: {
          created_at: string
          details: Json
          id: string
          instrument_id: string
          kind: string
          kobo_submission_uuid: string | null
          resolved_at: string | null
          resolved_by: string | null
          run_id: string | null
        }
        Insert: {
          created_at?: string
          details?: Json
          id?: string
          instrument_id: string
          kind: string
          kobo_submission_uuid?: string | null
          resolved_at?: string | null
          resolved_by?: string | null
          run_id?: string | null
        }
        Update: {
          created_at?: string
          details?: Json
          id?: string
          instrument_id?: string
          kind?: string
          kobo_submission_uuid?: string | null
          resolved_at?: string | null
          resolved_by?: string | null
          run_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "evaluation_ingestion_issues_instrument_id_fkey"
            columns: ["instrument_id"]
            isOneToOne: false
            referencedRelation: "evaluation_instruments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "evaluation_ingestion_issues_run_id_fkey"
            columns: ["run_id"]
            isOneToOne: false
            referencedRelation: "evaluation_ingestion_runs"
            referencedColumns: ["id"]
          },
        ]
      }
      evaluation_ingestion_runs: {
        Row: {
          error_message: string | null
          fetched_count: number | null
          finished_at: string | null
          id: string
          inserted_count: number | null
          instrument_id: string
          started_at: string
          status: string
          trigger: string
          unmatched_investment_count: number | null
          updated_count: number | null
        }
        Insert: {
          error_message?: string | null
          fetched_count?: number | null
          finished_at?: string | null
          id?: string
          inserted_count?: number | null
          instrument_id: string
          started_at?: string
          status: string
          trigger: string
          unmatched_investment_count?: number | null
          updated_count?: number | null
        }
        Update: {
          error_message?: string | null
          fetched_count?: number | null
          finished_at?: string | null
          id?: string
          inserted_count?: number | null
          instrument_id?: string
          started_at?: string
          status?: string
          trigger?: string
          unmatched_investment_count?: number | null
          updated_count?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "evaluation_ingestion_runs_instrument_id_fkey"
            columns: ["instrument_id"]
            isOneToOne: false
            referencedRelation: "evaluation_instruments"
            referencedColumns: ["id"]
          },
        ]
      }
      evaluation_instruments: {
        Row: {
          created_at: string
          evaluation_id: string
          id: string
          kind: string
          kobo_api_token_encrypted: string | null
          kobo_form_id: string
          last_sync_error: string | null
          last_sync_status: string | null
          last_synced_at: string | null
          name: string
          schema_config: Json
          updated_at: string
        }
        Insert: {
          created_at?: string
          evaluation_id: string
          id?: string
          kind: string
          kobo_api_token_encrypted?: string | null
          kobo_form_id: string
          last_sync_error?: string | null
          last_sync_status?: string | null
          last_synced_at?: string | null
          name: string
          schema_config?: Json
          updated_at?: string
        }
        Update: {
          created_at?: string
          evaluation_id?: string
          id?: string
          kind?: string
          kobo_api_token_encrypted?: string | null
          kobo_form_id?: string
          last_sync_error?: string | null
          last_sync_status?: string | null
          last_synced_at?: string | null
          name?: string
          schema_config?: Json
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "evaluation_instruments_evaluation_id_fkey"
            columns: ["evaluation_id"]
            isOneToOne: false
            referencedRelation: "evaluations"
            referencedColumns: ["id"]
          },
        ]
      }
      evaluation_response_investments: {
        Row: {
          answers: Json
          id: string
          investment_id: string | null
          match_status: string
          raw_investment_name: string
          response_id: string
        }
        Insert: {
          answers: Json
          id?: string
          investment_id?: string | null
          match_status?: string
          raw_investment_name: string
          response_id: string
        }
        Update: {
          answers?: Json
          id?: string
          investment_id?: string | null
          match_status?: string
          raw_investment_name?: string
          response_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "evaluation_response_investments_investment_id_fkey"
            columns: ["investment_id"]
            isOneToOne: false
            referencedRelation: "mis_investments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "evaluation_response_investments_response_id_fkey"
            columns: ["response_id"]
            isOneToOne: false
            referencedRelation: "evaluation_responses"
            referencedColumns: ["id"]
          },
        ]
      }
      evaluation_responses: {
        Row: {
          age: number | null
          cluster: string | null
          community: string | null
          district: string | null
          gender: string | null
          id: string
          ingested_at: string
          instrument_id: string
          kobo_submission_id: number | null
          kobo_submission_uuid: string
          qc_checked_at: string | null
          qc_checked_by: string | null
          qc_status: string
          raw: Json
          region: string | null
          submitted_at: string
        }
        Insert: {
          age?: number | null
          cluster?: string | null
          community?: string | null
          district?: string | null
          gender?: string | null
          id?: string
          ingested_at?: string
          instrument_id: string
          kobo_submission_id?: number | null
          kobo_submission_uuid: string
          qc_checked_at?: string | null
          qc_checked_by?: string | null
          qc_status?: string
          raw: Json
          region?: string | null
          submitted_at: string
        }
        Update: {
          age?: number | null
          cluster?: string | null
          community?: string | null
          district?: string | null
          gender?: string | null
          id?: string
          ingested_at?: string
          instrument_id?: string
          kobo_submission_id?: number | null
          kobo_submission_uuid?: string
          qc_checked_at?: string | null
          qc_checked_by?: string | null
          qc_status?: string
          raw?: Json
          region?: string | null
          submitted_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "evaluation_responses_instrument_id_fkey"
            columns: ["instrument_id"]
            isOneToOne: false
            referencedRelation: "evaluation_instruments"
            referencedColumns: ["id"]
          },
        ]
      }
      evaluations: {
        Row: {
          collection_started_at: string | null
          collection_target_n: number | null
          created_at: string
          dashboard_default_mode: string
          description: string | null
          id: string
          name: string
          project_id: string
          slug: string
          status: string
          updated_at: string
        }
        Insert: {
          collection_started_at?: string | null
          collection_target_n?: number | null
          created_at?: string
          dashboard_default_mode?: string
          description?: string | null
          id?: string
          name: string
          project_id: string
          slug: string
          status?: string
          updated_at?: string
        }
        Update: {
          collection_started_at?: string | null
          collection_target_n?: number | null
          created_at?: string
          dashboard_default_mode?: string
          description?: string | null
          id?: string
          name?: string
          project_id?: string
          slug?: string
          status?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "evaluations_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "project_activity_counts"
            referencedColumns: ["project_id"]
          },
          {
            foreignKeyName: "evaluations_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
        ]
      }
      expenses: {
        Row: {
          amount: number
          category_id: string | null
          created_at: string
          created_by: string | null
          currency: string
          description: string | null
          expense_date: string
          id: string
          project_id: string
          receipt_name: string | null
          receipt_path: string | null
          status: string
          updated_at: string
          vendor: string | null
        }
        Insert: {
          amount: number
          category_id?: string | null
          created_at?: string
          created_by?: string | null
          currency?: string
          description?: string | null
          expense_date?: string
          id?: string
          project_id: string
          receipt_name?: string | null
          receipt_path?: string | null
          status?: string
          updated_at?: string
          vendor?: string | null
        }
        Update: {
          amount?: number
          category_id?: string | null
          created_at?: string
          created_by?: string | null
          currency?: string
          description?: string | null
          expense_date?: string
          id?: string
          project_id?: string
          receipt_name?: string | null
          receipt_path?: string | null
          status?: string
          updated_at?: string
          vendor?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "expenses_category_id_fkey"
            columns: ["category_id"]
            isOneToOne: false
            referencedRelation: "budget_categories"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "expenses_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "project_activity_counts"
            referencedColumns: ["project_id"]
          },
          {
            foreignKeyName: "expenses_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
        ]
      }
      internal_areas: {
        Row: {
          archived_at: string | null
          color: string | null
          created_at: string
          description: string | null
          id: string
          name: string
          position: number | null
          updated_at: string
        }
        Insert: {
          archived_at?: string | null
          color?: string | null
          created_at?: string
          description?: string | null
          id?: string
          name: string
          position?: number | null
          updated_at?: string
        }
        Update: {
          archived_at?: string | null
          color?: string | null
          created_at?: string
          description?: string | null
          id?: string
          name?: string
          position?: number | null
          updated_at?: string
        }
        Relationships: []
      }
      internal_task_assignees: {
        Row: {
          added_at: string
          task_id: string
          user_id: string
        }
        Insert: {
          added_at?: string
          task_id: string
          user_id: string
        }
        Update: {
          added_at?: string
          task_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "internal_task_assignees_task_id_fkey"
            columns: ["task_id"]
            isOneToOne: false
            referencedRelation: "internal_tasks"
            referencedColumns: ["id"]
          },
        ]
      }
      internal_task_comments: {
        Row: {
          author_user_id: string
          body: string
          created_at: string
          id: string
          task_id: string
          updated_at: string
        }
        Insert: {
          author_user_id: string
          body: string
          created_at?: string
          id?: string
          task_id: string
          updated_at?: string
        }
        Update: {
          author_user_id?: string
          body?: string
          created_at?: string
          id?: string
          task_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "internal_task_comments_task_id_fkey"
            columns: ["task_id"]
            isOneToOne: false
            referencedRelation: "internal_tasks"
            referencedColumns: ["id"]
          },
        ]
      }
      internal_task_proof_comments: {
        Row: {
          author_user_id: string
          body: string
          created_at: string
          id: string
          proof_id: string
          updated_at: string
        }
        Insert: {
          author_user_id: string
          body: string
          created_at?: string
          id?: string
          proof_id: string
          updated_at?: string
        }
        Update: {
          author_user_id?: string
          body?: string
          created_at?: string
          id?: string
          proof_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "internal_task_proof_comments_proof_id_fkey"
            columns: ["proof_id"]
            isOneToOne: false
            referencedRelation: "internal_task_proofs"
            referencedColumns: ["id"]
          },
        ]
      }
      internal_task_proofs: {
        Row: {
          caption: string | null
          created_at: string
          file_name: string
          file_path: string
          id: string
          mime_type: string | null
          size_bytes: number | null
          task_id: string
          uploaded_by: string | null
        }
        Insert: {
          caption?: string | null
          created_at?: string
          file_name: string
          file_path: string
          id?: string
          mime_type?: string | null
          size_bytes?: number | null
          task_id: string
          uploaded_by?: string | null
        }
        Update: {
          caption?: string | null
          created_at?: string
          file_name?: string
          file_path?: string
          id?: string
          mime_type?: string | null
          size_bytes?: number | null
          task_id?: string
          uploaded_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "internal_task_proofs_task_id_fkey"
            columns: ["task_id"]
            isOneToOne: false
            referencedRelation: "internal_tasks"
            referencedColumns: ["id"]
          },
        ]
      }
      internal_tasks: {
        Row: {
          archived_at: string | null
          area_id: string
          created_at: string
          created_by: string | null
          description: string | null
          due_date: string | null
          id: string
          parent_task_id: string | null
          priority: string | null
          project_id: string | null
          status: string
          title: string
          updated_at: string
        }
        Insert: {
          archived_at?: string | null
          area_id: string
          created_at?: string
          created_by?: string | null
          description?: string | null
          due_date?: string | null
          id?: string
          parent_task_id?: string | null
          priority?: string | null
          project_id?: string | null
          status?: string
          title: string
          updated_at?: string
        }
        Update: {
          archived_at?: string | null
          area_id?: string
          created_at?: string
          created_by?: string | null
          description?: string | null
          due_date?: string | null
          id?: string
          parent_task_id?: string | null
          priority?: string | null
          project_id?: string | null
          status?: string
          title?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "internal_tasks_area_id_fkey"
            columns: ["area_id"]
            isOneToOne: false
            referencedRelation: "internal_areas"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "internal_tasks_parent_task_id_fkey"
            columns: ["parent_task_id"]
            isOneToOne: false
            referencedRelation: "internal_tasks"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "internal_tasks_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "project_activity_counts"
            referencedColumns: ["project_id"]
          },
          {
            foreignKeyName: "internal_tasks_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
        ]
      }
      mis_investments: {
        Row: {
          community: string
          completion_date: string | null
          created_at: string
          district: string
          evaluation_id: string
          id: string
          investment_name: string
          investment_type: string
        }
        Insert: {
          community: string
          completion_date?: string | null
          created_at?: string
          district: string
          evaluation_id: string
          id?: string
          investment_name: string
          investment_type: string
        }
        Update: {
          community?: string
          completion_date?: string | null
          created_at?: string
          district?: string
          evaluation_id?: string
          id?: string
          investment_name?: string
          investment_type?: string
        }
        Relationships: [
          {
            foreignKeyName: "mis_investments_evaluation_id_fkey"
            columns: ["evaluation_id"]
            isOneToOne: false
            referencedRelation: "evaluations"
            referencedColumns: ["id"]
          },
        ]
      }
      password_verify_attempts: {
        Row: {
          context: string | null
          created_at: string
          email: string | null
          id: number
          ip_address: string | null
          success: boolean
          user_agent: string | null
          user_id: string | null
        }
        Insert: {
          context?: string | null
          created_at?: string
          email?: string | null
          id?: number
          ip_address?: string | null
          success: boolean
          user_agent?: string | null
          user_id?: string | null
        }
        Update: {
          context?: string | null
          created_at?: string
          email?: string | null
          id?: number
          ip_address?: string | null
          success?: boolean
          user_agent?: string | null
          user_id?: string | null
        }
        Relationships: []
      }
      phases: {
        Row: {
          created_at: string
          description: string | null
          end_date: string | null
          id: string
          name: string
          order_index: number
          project_id: string
          start_date: string | null
          updated_at: string
        }
        Insert: {
          created_at?: string
          description?: string | null
          end_date?: string | null
          id?: string
          name: string
          order_index?: number
          project_id: string
          start_date?: string | null
          updated_at?: string
        }
        Update: {
          created_at?: string
          description?: string | null
          end_date?: string | null
          id?: string
          name?: string
          order_index?: number
          project_id?: string
          start_date?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "phases_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "project_activity_counts"
            referencedColumns: ["project_id"]
          },
          {
            foreignKeyName: "phases_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          avatar_url: string | null
          created_at: string
          email: string
          full_name: string
          id: string
          is_active: boolean
          role: string
          updated_at: string
          user_id: string
        }
        Insert: {
          avatar_url?: string | null
          created_at?: string
          email: string
          full_name: string
          id?: string
          is_active?: boolean
          role: string
          updated_at?: string
          user_id: string
        }
        Update: {
          avatar_url?: string | null
          created_at?: string
          email?: string
          full_name?: string
          id?: string
          is_active?: boolean
          role?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      project_budgets: {
        Row: {
          created_at: string
          currency: string
          id: string
          notes: string | null
          project_id: string
          total_amount: number
          updated_at: string
        }
        Insert: {
          created_at?: string
          currency?: string
          id?: string
          notes?: string | null
          project_id: string
          total_amount?: number
          updated_at?: string
        }
        Update: {
          created_at?: string
          currency?: string
          id?: string
          notes?: string | null
          project_id?: string
          total_amount?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "project_budgets_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: true
            referencedRelation: "project_activity_counts"
            referencedColumns: ["project_id"]
          },
          {
            foreignKeyName: "project_budgets_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: true
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
        ]
      }
      project_members: {
        Row: {
          created_at: string
          id: string
          project_id: string
          project_role: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          project_id: string
          project_role: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          project_id?: string
          project_role?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "project_members_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "project_activity_counts"
            referencedColumns: ["project_id"]
          },
          {
            foreignKeyName: "project_members_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
        ]
      }
      projects: {
        Row: {
          archived_at: string | null
          client_id: string
          code: string
          cover_image_url: string | null
          created_at: string
          description: string | null
          end_date: string | null
          id: string
          name: string
          start_date: string | null
          status: string
          updated_at: string
        }
        Insert: {
          archived_at?: string | null
          client_id: string
          code: string
          cover_image_url?: string | null
          created_at?: string
          description?: string | null
          end_date?: string | null
          id?: string
          name: string
          start_date?: string | null
          status?: string
          updated_at?: string
        }
        Update: {
          archived_at?: string | null
          client_id?: string
          code?: string
          cover_image_url?: string | null
          created_at?: string
          description?: string | null
          end_date?: string | null
          id?: string
          name?: string
          start_date?: string | null
          status?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "projects_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
        ]
      }
      proof_access_log: {
        Row: {
          accessed_at: string
          id: string
          ip_address: unknown
          project_id: string
          proof_id: string
          purpose: string | null
          user_agent: string | null
          user_id: string
        }
        Insert: {
          accessed_at?: string
          id?: string
          ip_address?: unknown
          project_id: string
          proof_id: string
          purpose?: string | null
          user_agent?: string | null
          user_id: string
        }
        Update: {
          accessed_at?: string
          id?: string
          ip_address?: unknown
          project_id?: string
          proof_id?: string
          purpose?: string | null
          user_agent?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "proof_access_log_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "project_activity_counts"
            referencedColumns: ["project_id"]
          },
          {
            foreignKeyName: "proof_access_log_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "proof_access_log_proof_id_fkey"
            columns: ["proof_id"]
            isOneToOne: false
            referencedRelation: "activity_proofs"
            referencedColumns: ["id"]
          },
        ]
      }
      proof_comments: {
        Row: {
          author_user_id: string
          body: string
          created_at: string
          id: string
          proof_id: string
          updated_at: string
        }
        Insert: {
          author_user_id: string
          body: string
          created_at?: string
          id?: string
          proof_id: string
          updated_at?: string
        }
        Update: {
          author_user_id?: string
          body?: string
          created_at?: string
          id?: string
          proof_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "proof_comments_proof_id_fkey"
            columns: ["proof_id"]
            isOneToOne: false
            referencedRelation: "activity_proofs"
            referencedColumns: ["id"]
          },
        ]
      }
      rate_limit_events: {
        Row: {
          bucket: string
          created_at: string
          id: number
          key: string
        }
        Insert: {
          bucket: string
          created_at?: string
          id?: number
          key: string
        }
        Update: {
          bucket?: string
          created_at?: string
          id?: number
          key?: string
        }
        Relationships: []
      }
      user_notification_reads: {
        Row: {
          last_read_at: string
          updated_at: string
          user_id: string
        }
        Insert: {
          last_read_at?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          last_read_at?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
    }
    Views: {
      project_activity_counts: {
        Row: {
          client_done_count: number | null
          client_in_progress_count: number | null
          client_not_started_count: number | null
          client_total_count: number | null
          done_count: number | null
          in_progress_count: number | null
          not_started_count: number | null
          project_id: string | null
          total_count: number | null
        }
        Relationships: []
      }
    }
    Functions: {
      add_project_member_as_manager: {
        Args: { p_project_id: string; p_user_id: string }
        Returns: {
          created_at: string
          id: string
          project_id: string
          project_role: string
          user_id: string
        }
        SetofOptions: {
          from: "*"
          to: "project_members"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      admin_counts: {
        Args: never
        Returns: {
          active_clients: number
          active_projects: number
          active_projects_current: number
          active_projects_prev: number
          completed_projects_current: number
          completed_projects_prev: number
          paused_projects_current: number
          paused_projects_prev: number
          pending_invites: number
          total_projects_current: number
          total_projects_prev: number
          total_users: number
          total_users_current: number
          total_users_prev: number
        }[]
      }
      can_access_project: { Args: { p_project_id: string }; Returns: boolean }
      can_write_project: { Args: { p_project_id: string }; Returns: boolean }
      insert_activity_ordered: {
        Args: {
          p_completed_date?: string
          p_created_by?: string
          p_deliverable?: string
          p_description?: string
          p_name: string
          p_phase_id: string
          p_planned_date?: string
          p_responsible?: string
          p_status?: string
        }
        Returns: {
          completed_date: string | null
          created_at: string
          created_by: string | null
          deliverable: string | null
          description: string | null
          id: string
          location: string | null
          name: string
          narrative_note: string | null
          order_index: number
          participants_count: number | null
          phase_id: string
          planned_date: string | null
          responsible: string | null
          status: string
          updated_at: string
          visibility: string
        }
        SetofOptions: {
          from: "*"
          to: "activities"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      insert_budget_category_ordered: {
        Args: {
          p_allocated_amount?: number
          p_name: string
          p_project_id: string
        }
        Returns: {
          allocated_amount: number
          created_at: string
          id: string
          name: string
          order_index: number
          project_id: string
          updated_at: string
        }
        SetofOptions: {
          from: "*"
          to: "budget_categories"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      insert_phase_ordered: {
        Args: {
          p_description?: string
          p_end_date?: string
          p_name: string
          p_project_id: string
          p_start_date?: string
        }
        Returns: {
          created_at: string
          description: string | null
          end_date: string | null
          id: string
          name: string
          order_index: number
          project_id: string
          start_date: string | null
          updated_at: string
        }
        SetofOptions: {
          from: "*"
          to: "phases"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      is_admin: { Args: never; Returns: boolean }
      is_staff_or_admin: { Args: never; Returns: boolean }
      is_task_assignee: {
        Args: { p_task_id: string; p_user_id: string }
        Returns: boolean
      }
      match_mis_investment_fuzzy: {
        Args: {
          p_community: string
          p_evaluation_id: string
          p_raw_name: string
          p_threshold: number
        }
        Returns: {
          id: string
          investment_name: string
          similarity: number
        }[]
      }
      project_id_from_path: { Args: { object_name: string }; Returns: string }
      receipt_project_id: { Args: { object_name: string }; Returns: string }
      replace_mis_investments: {
        Args: { p_evaluation_id: string; p_rows: Json }
        Returns: number
      }
      set_dashboard_spec: {
        Args: { p_evaluation_id: string; p_spec: Json }
        Returns: number
      }
      shares_project_with: {
        Args: { target_user_id: string }
        Returns: boolean
      }
      show_limit: { Args: never; Returns: number }
      show_trgm: { Args: { "": string }; Returns: string[] }
      transfer_project_manager: {
        Args: { p_member_id: string; p_project_id: string }
        Returns: undefined
      }
      try_consume: {
        Args: {
          p_bucket: string
          p_key: string
          p_limit: number
          p_window_seconds: number
        }
        Returns: {
          ok: boolean
          retry_after_seconds: number
        }[]
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
  graphql_public: {
    Enums: {},
  },
  public: {
    Enums: {},
  },
} as const
