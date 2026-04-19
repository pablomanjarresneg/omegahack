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
      attachments: {
        Row: {
          created_at: string
          filename: string
          id: string
          mime_type: string | null
          pqr_id: string
          size_bytes: number | null
          storage_path: string
          tenant_id: string
        }
        Insert: {
          created_at?: string
          filename: string
          id?: string
          mime_type?: string | null
          pqr_id: string
          size_bytes?: number | null
          storage_path: string
          tenant_id: string
        }
        Update: {
          created_at?: string
          filename?: string
          id?: string
          mime_type?: string | null
          pqr_id?: string
          size_bytes?: number | null
          storage_path?: string
          tenant_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "attachments_pqr_id_fkey"
            columns: ["pqr_id"]
            isOneToOne: false
            referencedRelation: "pqr"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "attachments_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      citizens: {
        Row: {
          auth_user_id: string | null
          cedula: string | null
          created_at: string
          direccion: string | null
          email: string | null
          email_verified: boolean
          id: string
          nombre: string | null
          telefono: string | null
          tenant_id: string
          updated_at: string
          vulnerability_flags: Json
        }
        Insert: {
          auth_user_id?: string | null
          cedula?: string | null
          created_at?: string
          direccion?: string | null
          email?: string | null
          email_verified?: boolean
          id?: string
          nombre?: string | null
          telefono?: string | null
          tenant_id: string
          updated_at?: string
          vulnerability_flags?: Json
        }
        Update: {
          auth_user_id?: string | null
          cedula?: string | null
          created_at?: string
          direccion?: string | null
          email?: string | null
          email_verified?: boolean
          id?: string
          nombre?: string | null
          telefono?: string | null
          tenant_id?: string
          updated_at?: string
          vulnerability_flags?: Json
        }
        Relationships: [
          {
            foreignKeyName: "citizens_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      comunas: {
        Row: {
          barrios: string[]
          created_at: string
          id: string
          nombre: string
          numero: number
          tenant_id: string
          tipo: Database["public"]["Enums"]["territorial_kind"]
        }
        Insert: {
          barrios?: string[]
          created_at?: string
          id?: string
          nombre: string
          numero: number
          tenant_id: string
          tipo: Database["public"]["Enums"]["territorial_kind"]
        }
        Update: {
          barrios?: string[]
          created_at?: string
          id?: string
          nombre?: string
          numero?: number
          tenant_id?: string
          tipo?: Database["public"]["Enums"]["territorial_kind"]
        }
        Relationships: [
          {
            foreignKeyName: "comunas_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      functionaries: {
        Row: {
          active: boolean
          auth_user_id: string | null
          created_at: string
          email: string
          id: string
          nombre: string
          role: string
          secretaria_id: string | null
          tenant_id: string
        }
        Insert: {
          active?: boolean
          auth_user_id?: string | null
          created_at?: string
          email: string
          id?: string
          nombre: string
          role: string
          secretaria_id?: string | null
          tenant_id: string
        }
        Update: {
          active?: boolean
          auth_user_id?: string | null
          created_at?: string
          email?: string
          id?: string
          nombre?: string
          role?: string
          secretaria_id?: string | null
          tenant_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "functionaries_secretaria_id_fkey"
            columns: ["secretaria_id"]
            isOneToOne: false
            referencedRelation: "secretarias"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "functionaries_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      holidays: {
        Row: {
          created_at: string
          fecha: string
          id: string
          nombre: string | null
          pais: string
        }
        Insert: {
          created_at?: string
          fecha: string
          id?: string
          nombre?: string | null
          pais?: string
        }
        Update: {
          created_at?: string
          fecha?: string
          id?: string
          nombre?: string | null
          pais?: string
        }
        Relationships: []
      }
      pqr: {
        Row: {
          anonimato: boolean | null
          captured_by: string | null
          channel: Database["public"]["Enums"]["pqr_channel"]
          citizen_id: string | null
          classification_status: string
          comuna_id: string | null
          created_at: string
          discriminacion_tematica: Json
          display_text: string | null
          estructura_minima: Json | null
          hechos: string | null
          id: string
          issued_at: string
          lead: string | null
          legal_deadline: string | null
          llm_text: string | null
          peticion: string | null
          priority_level: Database["public"]["Enums"]["priority_level"] | null
          priority_locked_at: string | null
          priority_locked_by: string | null
          priority_reason: Json | null
          priority_score: number | null
          radicado: string | null
          raw_text: string | null
          respeto_ok: boolean | null
          search_vector: unknown
          secretaria_id: string | null
          source_hash: string | null
          source_url: string | null
          status: Database["public"]["Enums"]["pqr_status"]
          tenant_id: string
          tipo: Database["public"]["Enums"]["pqr_tipo"] | null
          tutela_risk_score: number | null
          updated_at: string
        }
        Insert: {
          anonimato?: boolean | null
          captured_by?: string | null
          channel: Database["public"]["Enums"]["pqr_channel"]
          citizen_id?: string | null
          classification_status?: string
          comuna_id?: string | null
          created_at?: string
          discriminacion_tematica?: Json
          display_text?: string | null
          estructura_minima?: Json | null
          hechos?: string | null
          id?: string
          issued_at?: string
          lead?: string | null
          legal_deadline?: string | null
          llm_text?: string | null
          peticion?: string | null
          priority_level?: Database["public"]["Enums"]["priority_level"] | null
          priority_locked_at?: string | null
          priority_locked_by?: string | null
          priority_reason?: Json | null
          priority_score?: number | null
          radicado?: string | null
          raw_text?: string | null
          respeto_ok?: boolean | null
          search_vector?: unknown
          secretaria_id?: string | null
          source_hash?: string | null
          source_url?: string | null
          status?: Database["public"]["Enums"]["pqr_status"]
          tenant_id: string
          tipo?: Database["public"]["Enums"]["pqr_tipo"] | null
          tutela_risk_score?: number | null
          updated_at?: string
        }
        Update: {
          anonimato?: boolean | null
          captured_by?: string | null
          channel?: Database["public"]["Enums"]["pqr_channel"]
          citizen_id?: string | null
          classification_status?: string
          comuna_id?: string | null
          created_at?: string
          discriminacion_tematica?: Json
          display_text?: string | null
          estructura_minima?: Json | null
          hechos?: string | null
          id?: string
          issued_at?: string
          lead?: string | null
          legal_deadline?: string | null
          llm_text?: string | null
          peticion?: string | null
          priority_level?: Database["public"]["Enums"]["priority_level"] | null
          priority_locked_at?: string | null
          priority_locked_by?: string | null
          priority_reason?: Json | null
          priority_score?: number | null
          radicado?: string | null
          raw_text?: string | null
          respeto_ok?: boolean | null
          search_vector?: unknown
          secretaria_id?: string | null
          source_hash?: string | null
          source_url?: string | null
          status?: Database["public"]["Enums"]["pqr_status"]
          tenant_id?: string
          tipo?: Database["public"]["Enums"]["pqr_tipo"] | null
          tutela_risk_score?: number | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "pqr_captured_by_fkey"
            columns: ["captured_by"]
            isOneToOne: false
            referencedRelation: "functionaries"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "pqr_citizen_id_fkey"
            columns: ["citizen_id"]
            isOneToOne: false
            referencedRelation: "citizens"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "pqr_comuna_id_fkey"
            columns: ["comuna_id"]
            isOneToOne: false
            referencedRelation: "comunas"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "pqr_priority_locked_by_fkey"
            columns: ["priority_locked_by"]
            isOneToOne: false
            referencedRelation: "functionaries"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "pqr_secretaria_id_fkey"
            columns: ["secretaria_id"]
            isOneToOne: false
            referencedRelation: "secretarias"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "pqr_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      pqr_audit: {
        Row: {
          actor_id: string | null
          after: Json | null
          before: Json | null
          created_at: string
          id: string
          operation: string
          row_id: string
          table_name: string
          tenant_id: string
        }
        Insert: {
          actor_id?: string | null
          after?: Json | null
          before?: Json | null
          created_at?: string
          id?: string
          operation: string
          row_id: string
          table_name: string
          tenant_id: string
        }
        Update: {
          actor_id?: string | null
          after?: Json | null
          before?: Json | null
          created_at?: string
          id?: string
          operation?: string
          row_id?: string
          table_name?: string
          tenant_id?: string
        }
        Relationships: []
      }
      pqr_clusters: {
        Row: {
          canonical_title: string | null
          created_at: string
          id: string
          status: string
          tenant_id: string
        }
        Insert: {
          canonical_title?: string | null
          created_at?: string
          id?: string
          status?: string
          tenant_id: string
        }
        Update: {
          canonical_title?: string | null
          created_at?: string
          id?: string
          status?: string
          tenant_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "pqr_clusters_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      pqr_embedding_jobs: {
        Row: {
          attempt_count: number
          created_at: string
          id: string
          last_error: string | null
          pqr_id: string
          reason: string
          status: string
          tenant_id: string
          updated_at: string
        }
        Insert: {
          attempt_count?: number
          created_at?: string
          id?: string
          last_error?: string | null
          pqr_id: string
          reason: string
          status?: string
          tenant_id: string
          updated_at?: string
        }
        Update: {
          attempt_count?: number
          created_at?: string
          id?: string
          last_error?: string | null
          pqr_id?: string
          reason?: string
          status?: string
          tenant_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "pqr_embedding_jobs_pqr_id_fkey"
            columns: ["pqr_id"]
            isOneToOne: false
            referencedRelation: "pqr"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "pqr_embedding_jobs_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      pqr_embeddings: {
        Row: {
          created_at: string
          embedding: string
          id: string
          kind: Database["public"]["Enums"]["pqr_embedding_kind"]
          model_version: string
          pqr_id: string
          tenant_id: string
        }
        Insert: {
          created_at?: string
          embedding: string
          id?: string
          kind: Database["public"]["Enums"]["pqr_embedding_kind"]
          model_version: string
          pqr_id: string
          tenant_id: string
        }
        Update: {
          created_at?: string
          embedding?: string
          id?: string
          kind?: Database["public"]["Enums"]["pqr_embedding_kind"]
          model_version?: string
          pqr_id?: string
          tenant_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "pqr_embeddings_pqr_id_fkey"
            columns: ["pqr_id"]
            isOneToOne: false
            referencedRelation: "pqr"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "pqr_embeddings_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      pqr_events: {
        Row: {
          actor_id: string | null
          created_at: string
          id: string
          kind: string
          payload: Json
          pqr_id: string
          tenant_id: string
        }
        Insert: {
          actor_id?: string | null
          created_at?: string
          id?: string
          kind: string
          payload?: Json
          pqr_id: string
          tenant_id: string
        }
        Update: {
          actor_id?: string | null
          created_at?: string
          id?: string
          kind?: string
          payload?: Json
          pqr_id?: string
          tenant_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "pqr_events_actor_id_fkey"
            columns: ["actor_id"]
            isOneToOne: false
            referencedRelation: "functionaries"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "pqr_events_pqr_id_fkey"
            columns: ["pqr_id"]
            isOneToOne: false
            referencedRelation: "pqr"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "pqr_events_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      pqr_problem_group_members: {
        Row: {
          group_id: string
          joined_at: string
          pqr_id: string
          similarity_score: number | null
        }
        Insert: {
          group_id: string
          joined_at?: string
          pqr_id: string
          similarity_score?: number | null
        }
        Update: {
          group_id?: string
          joined_at?: string
          pqr_id?: string
          similarity_score?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "pqr_problem_group_members_group_id_fkey"
            columns: ["group_id"]
            isOneToOne: false
            referencedRelation: "problem_groups"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "pqr_problem_group_members_pqr_id_fkey"
            columns: ["pqr_id"]
            isOneToOne: true
            referencedRelation: "pqr"
            referencedColumns: ["id"]
          },
        ]
      }
      pqr_tags: {
        Row: {
          confidence: number | null
          created_at: string
          pqr_id: string
          source: string
          tag_id: string
        }
        Insert: {
          confidence?: number | null
          created_at?: string
          pqr_id: string
          source: string
          tag_id: string
        }
        Update: {
          confidence?: number | null
          created_at?: string
          pqr_id?: string
          source?: string
          tag_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "pqr_tags_pqr_id_fkey"
            columns: ["pqr_id"]
            isOneToOne: false
            referencedRelation: "pqr"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "pqr_tags_tag_id_fkey"
            columns: ["tag_id"]
            isOneToOne: false
            referencedRelation: "tags"
            referencedColumns: ["id"]
          },
        ]
      }
      problem_groups: {
        Row: {
          canonical_title: string | null
          centroid_embedding: string | null
          created_at: string
          hot: boolean
          id: string
          location: Json | null
          member_count: number
          resumen: string | null
          status: string
          tag_ids: string[]
          tenant_id: string
          updated_at: string
        }
        Insert: {
          canonical_title?: string | null
          centroid_embedding?: string | null
          created_at?: string
          hot?: boolean
          id?: string
          location?: Json | null
          member_count?: number
          resumen?: string | null
          status?: string
          tag_ids?: string[]
          tenant_id: string
          updated_at?: string
        }
        Update: {
          canonical_title?: string | null
          centroid_embedding?: string | null
          created_at?: string
          hot?: boolean
          id?: string
          location?: Json | null
          member_count?: number
          resumen?: string | null
          status?: string
          tag_ids?: string[]
          tenant_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "problem_groups_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      responses: {
        Row: {
          approved_at: string | null
          approved_by: string | null
          body: string
          citations: Json
          created_at: string
          created_by: string | null
          id: string
          kind: Database["public"]["Enums"]["response_kind"]
          pqr_id: string
          sent_at: string | null
          tenant_id: string
          updated_at: string
        }
        Insert: {
          approved_at?: string | null
          approved_by?: string | null
          body: string
          citations?: Json
          created_at?: string
          created_by?: string | null
          id?: string
          kind: Database["public"]["Enums"]["response_kind"]
          pqr_id: string
          sent_at?: string | null
          tenant_id: string
          updated_at?: string
        }
        Update: {
          approved_at?: string | null
          approved_by?: string | null
          body?: string
          citations?: Json
          created_at?: string
          created_by?: string | null
          id?: string
          kind?: Database["public"]["Enums"]["response_kind"]
          pqr_id?: string
          sent_at?: string | null
          tenant_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "responses_approved_by_fkey"
            columns: ["approved_by"]
            isOneToOne: false
            referencedRelation: "functionaries"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "responses_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "functionaries"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "responses_pqr_id_fkey"
            columns: ["pqr_id"]
            isOneToOne: false
            referencedRelation: "pqr"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "responses_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      secretarias: {
        Row: {
          codigo: string
          competencias_legales: Json
          created_at: string
          funciones: Json
          id: string
          interfaz_mercurio: boolean
          nombre: string
          temas_clave: string[]
          tenant_id: string
          tipo: string
        }
        Insert: {
          codigo: string
          competencias_legales?: Json
          created_at?: string
          funciones?: Json
          id?: string
          interfaz_mercurio?: boolean
          nombre: string
          temas_clave?: string[]
          tenant_id: string
          tipo: string
        }
        Update: {
          codigo?: string
          competencias_legales?: Json
          created_at?: string
          funciones?: Json
          id?: string
          interfaz_mercurio?: boolean
          nombre?: string
          temas_clave?: string[]
          tenant_id?: string
          tipo?: string
        }
        Relationships: [
          {
            foreignKeyName: "secretarias_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      simple_memory: {
        Row: {
          citizen_id: string
          last_10_pqrs: Json
          open_tutelas: number
          tenant_id: string
          updated_at: string
          vulnerability_flags: Json
        }
        Insert: {
          citizen_id: string
          last_10_pqrs?: Json
          open_tutelas?: number
          tenant_id: string
          updated_at?: string
          vulnerability_flags?: Json
        }
        Update: {
          citizen_id?: string
          last_10_pqrs?: Json
          open_tutelas?: number
          tenant_id?: string
          updated_at?: string
          vulnerability_flags?: Json
        }
        Relationships: [
          {
            foreignKeyName: "simple_memory_citizen_id_fkey"
            columns: ["citizen_id"]
            isOneToOne: false
            referencedRelation: "citizens"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "simple_memory_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      tags: {
        Row: {
          created_at: string
          id: string
          label: string
          namespace: string
          parent_id: string | null
          slug: string
          uses_count: number
        }
        Insert: {
          created_at?: string
          id?: string
          label: string
          namespace: string
          parent_id?: string | null
          slug: string
          uses_count?: number
        }
        Update: {
          created_at?: string
          id?: string
          label?: string
          namespace?: string
          parent_id?: string | null
          slug?: string
          uses_count?: number
        }
        Relationships: [
          {
            foreignKeyName: "tags_parent_id_fkey"
            columns: ["parent_id"]
            isOneToOne: false
            referencedRelation: "tags"
            referencedColumns: ["id"]
          },
        ]
      }
      tenants: {
        Row: {
          created_at: string
          id: string
          name: string
          slug: string
        }
        Insert: {
          created_at?: string
          id?: string
          name: string
          slug: string
        }
        Update: {
          created_at?: string
          id?: string
          name?: string
          slug?: string
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      drain_reembed_batch: {
        Args: { batch_size: number }
        Returns: {
          attempt_count: number
          id: string
          pqr_id: string
          reason: string
          tenant_id: string
        }[]
      }
      requesting_tenant_id: { Args: never; Returns: string }
    }
    Enums: {
      pqr_channel: "web" | "email" | "mercurio_csv" | "verbal" | "social_manual"
      pqr_embedding_kind: "full" | "lead" | "peticion"
      pqr_status:
        | "received"
        | "accepted"
        | "bounced_incomplete"
        | "rejected_disrespectful"
        | "transferred"
        | "assigned"
        | "in_draft"
        | "in_review"
        | "approved"
        | "sent"
        | "closed"
      pqr_tipo:
        | "peticion"
        | "queja"
        | "reclamo"
        | "oposicion"
        | "sugerencia"
        | "denuncia"
      priority_level: "P0_critica" | "P1_alta" | "P2_media" | "P3_baja"
      response_kind: "draft" | "final"
      territorial_kind: "comuna" | "corregimiento"
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
  qa_bank: {
    Tables: {
      [_ in never]: never
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      [_ in never]: never
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
    Enums: {
      pqr_channel: ["web", "email", "mercurio_csv", "verbal", "social_manual"],
      pqr_embedding_kind: ["full", "lead", "peticion"],
      pqr_status: [
        "received",
        "accepted",
        "bounced_incomplete",
        "rejected_disrespectful",
        "transferred",
        "assigned",
        "in_draft",
        "in_review",
        "approved",
        "sent",
        "closed",
      ],
      pqr_tipo: [
        "peticion",
        "queja",
        "reclamo",
        "oposicion",
        "sugerencia",
        "denuncia",
      ],
      priority_level: ["P0_critica", "P1_alta", "P2_media", "P3_baja"],
      response_kind: ["draft", "final"],
      territorial_kind: ["comuna", "corregimiento"],
    },
  },
  qa_bank: {
    Enums: {},
  },
} as const
