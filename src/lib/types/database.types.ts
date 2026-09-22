// Fichier généré par introspection RÉELLE du schéma Postgres.
//
// Provenance : `npx supabase gen types typescript --db-url <local-test-db>`
// exécuté contre une base PostgreSQL 17 locale sur laquelle les 38 migrations
// SQL du projet (supabase/migrations/0001_*.sql → 0038_*.sql) ont été
// appliquées avec succès (ON_ERROR_STOP=1), après simulation des schémas
// `auth` et `storage` de Supabase. Ce n'est donc pas un fichier inventé :
// chaque table/colonne/enum/fonction ci-dessous correspond exactement aux
// migrations réellement exécutées.
//
// Pour régénérer contre un vrai projet Supabase (recommandé avant mise en
// production, pour capter d'éventuelles dérives entre les migrations locales
// et l'état réel de la base hébergée) :
//   npx supabase login
//   npx supabase link --project-ref <ref>
//   npm run supabase:types
//
// Date de génération : 2026-09-07 (session de validation finale JediclicC).

export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  public: {
    Tables: {
      ai_recommendations: {
        Row: {
          accepted: boolean | null
          based_on: Json
          class_id: string | null
          created_at: string
          curriculum_unit_id: string | null
          id: string
          kind: string
          organization_id: string
          student_id: string | null
          summary: string
        }
        Insert: {
          accepted?: boolean | null
          based_on?: Json
          class_id?: string | null
          created_at?: string
          curriculum_unit_id?: string | null
          id?: string
          kind: string
          organization_id: string
          student_id?: string | null
          summary: string
        }
        Update: {
          accepted?: boolean | null
          based_on?: Json
          class_id?: string | null
          created_at?: string
          curriculum_unit_id?: string | null
          id?: string
          kind?: string
          organization_id?: string
          student_id?: string | null
          summary?: string
        }
        Relationships: [
          {
            foreignKeyName: "ai_recommendations_class_id_fkey"
            columns: ["class_id"]
            isOneToOne: false
            referencedRelation: "classes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ai_recommendations_curriculum_unit_id_fkey"
            columns: ["curriculum_unit_id"]
            isOneToOne: false
            referencedRelation: "curriculum_units"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ai_recommendations_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ai_recommendations_student_id_fkey"
            columns: ["student_id"]
            isOneToOne: false
            referencedRelation: "students"
            referencedColumns: ["id"]
          },
        ]
      }
      assessment_questions: {
        Row: {
          assessment_id: string
          competency_id: string | null
          exercise_id: string | null
          id: string
          max_points: number
          ordering: number
          statement: string
        }
        Insert: {
          assessment_id: string
          competency_id?: string | null
          exercise_id?: string | null
          id?: string
          max_points?: number
          ordering?: number
          statement: string
        }
        Update: {
          assessment_id?: string
          competency_id?: string | null
          exercise_id?: string | null
          id?: string
          max_points?: number
          ordering?: number
          statement?: string
        }
        Relationships: [
          {
            foreignKeyName: "assessment_questions_assessment_id_fkey"
            columns: ["assessment_id"]
            isOneToOne: false
            referencedRelation: "assessments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "assessment_questions_competency_id_fkey"
            columns: ["competency_id"]
            isOneToOne: false
            referencedRelation: "competencies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "assessment_questions_exercise_id_fkey"
            columns: ["exercise_id"]
            isOneToOne: false
            referencedRelation: "exercises"
            referencedColumns: ["id"]
          },
        ]
      }
      assessment_units: {
        Row: {
          assessment_id: string
          curriculum_unit_id: string
        }
        Insert: {
          assessment_id: string
          curriculum_unit_id: string
        }
        Update: {
          assessment_id?: string
          curriculum_unit_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "assessment_units_assessment_id_fkey"
            columns: ["assessment_id"]
            isOneToOne: false
            referencedRelation: "assessments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "assessment_units_curriculum_unit_id_fkey"
            columns: ["curriculum_unit_id"]
            isOneToOne: false
            referencedRelation: "curriculum_units"
            referencedColumns: ["id"]
          },
        ]
      }
      assessments: {
        Row: {
          assessment_date: string
          assessment_type: Database["public"]["Enums"]["assessment_type"]
          class_id: string
          coefficient: number
          created_at: string
          duration_minutes: number | null
          id: string
          max_score: number
          organization_id: string
          origin: Database["public"]["Enums"]["content_origin"]
          published: boolean
          subject_id: string | null
          teacher_id: string
          title: string
        }
        Insert: {
          assessment_date?: string
          assessment_type?: Database["public"]["Enums"]["assessment_type"]
          class_id: string
          coefficient?: number
          created_at?: string
          duration_minutes?: number | null
          id?: string
          max_score?: number
          organization_id: string
          origin?: Database["public"]["Enums"]["content_origin"]
          published?: boolean
          subject_id?: string | null
          teacher_id: string
          title: string
        }
        Update: {
          assessment_date?: string
          assessment_type?: Database["public"]["Enums"]["assessment_type"]
          class_id?: string
          coefficient?: number
          created_at?: string
          duration_minutes?: number | null
          id?: string
          max_score?: number
          organization_id?: string
          origin?: Database["public"]["Enums"]["content_origin"]
          published?: boolean
          subject_id?: string | null
          teacher_id?: string
          title?: string
        }
        Relationships: [
          {
            foreignKeyName: "assessments_class_id_fkey"
            columns: ["class_id"]
            isOneToOne: false
            referencedRelation: "classes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "assessments_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "assessments_subject_id_fkey"
            columns: ["subject_id"]
            isOneToOne: false
            referencedRelation: "subjects"
            referencedColumns: ["id"]
          },
        ]
      }
      assistant_messages: {
        Row: {
          content: string
          created_at: string
          id: string
          metadata: Json
          organization_id: string
          role: string
          user_id: string
        }
        Insert: {
          content: string
          created_at?: string
          id?: string
          metadata?: Json
          organization_id: string
          role: string
          user_id: string
        }
        Update: {
          content?: string
          created_at?: string
          id?: string
          metadata?: Json
          organization_id?: string
          role?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "assistant_messages_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      audit_logs: {
        Row: {
          action: string
          actor_id: string | null
          after_data: Json | null
          before_data: Json | null
          created_at: string
          entity_id: string | null
          entity_table: string
          id: string
          organization_id: string | null
        }
        Insert: {
          action: string
          actor_id?: string | null
          after_data?: Json | null
          before_data?: Json | null
          created_at?: string
          entity_id?: string | null
          entity_table: string
          id?: string
          organization_id?: string | null
        }
        Update: {
          action?: string
          actor_id?: string | null
          after_data?: Json | null
          before_data?: Json | null
          created_at?: string
          entity_id?: string | null
          entity_table?: string
          id?: string
          organization_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "audit_logs_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      classes: {
        Row: {
          archived_at: string | null
          created_at: string
          education_level_id: string
          establishment_id: string | null
          id: string
          name: string
          organization_id: string
          school_year_id: string
          teacher_id: string | null
        }
        Insert: {
          archived_at?: string | null
          created_at?: string
          education_level_id: string
          establishment_id?: string | null
          id?: string
          name: string
          organization_id: string
          school_year_id: string
          teacher_id?: string | null
        }
        Update: {
          archived_at?: string | null
          created_at?: string
          education_level_id?: string
          establishment_id?: string | null
          id?: string
          name?: string
          organization_id?: string
          school_year_id?: string
          teacher_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "classes_education_level_id_fkey"
            columns: ["education_level_id"]
            isOneToOne: false
            referencedRelation: "education_levels"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "classes_establishment_id_fkey"
            columns: ["establishment_id"]
            isOneToOne: false
            referencedRelation: "establishments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "classes_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "classes_school_year_id_fkey"
            columns: ["school_year_id"]
            isOneToOne: false
            referencedRelation: "school_years"
            referencedColumns: ["id"]
          },
        ]
      }
      competencies: {
        Row: {
          curriculum_unit_id: string
          description: string | null
          id: string
          title: string
        }
        Insert: {
          curriculum_unit_id: string
          description?: string | null
          id?: string
          title: string
        }
        Update: {
          curriculum_unit_id?: string
          description?: string | null
          id?: string
          title?: string
        }
        Relationships: [
          {
            foreignKeyName: "competencies_curriculum_unit_id_fkey"
            columns: ["curriculum_unit_id"]
            isOneToOne: false
            referencedRelation: "curriculum_units"
            referencedColumns: ["id"]
          },
        ]
      }
      countries: {
        Row: {
          created_at: string
          default_locale: string
          id: string
          iso_code: string
          name: string
        }
        Insert: {
          created_at?: string
          default_locale?: string
          id?: string
          iso_code: string
          name: string
        }
        Update: {
          created_at?: string
          default_locale?: string
          id?: string
          iso_code?: string
          name?: string
        }
        Relationships: []
      }
      curricula: {
        Row: {
          created_at: string
          education_level_id: string
          id: string
          is_active: boolean
          school_year_id: string
          source_document_url: string | null
          subject_id: string
          version_label: string
        }
        Insert: {
          created_at?: string
          education_level_id: string
          id?: string
          is_active?: boolean
          school_year_id: string
          source_document_url?: string | null
          subject_id: string
          version_label: string
        }
        Update: {
          created_at?: string
          education_level_id?: string
          id?: string
          is_active?: boolean
          school_year_id?: string
          source_document_url?: string | null
          subject_id?: string
          version_label?: string
        }
        Relationships: [
          {
            foreignKeyName: "curricula_education_level_id_fkey"
            columns: ["education_level_id"]
            isOneToOne: false
            referencedRelation: "education_levels"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "curricula_school_year_id_fkey"
            columns: ["school_year_id"]
            isOneToOne: false
            referencedRelation: "school_years"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "curricula_subject_id_fkey"
            columns: ["subject_id"]
            isOneToOne: false
            referencedRelation: "subjects"
            referencedColumns: ["id"]
          },
        ]
      }
      curriculum_units: {
        Row: {
          created_at: string
          curriculum_id: string
          id: string
          ordering: number
          parent_unit_id: string | null
          recommended_hours: number | null
          title: string
        }
        Insert: {
          created_at?: string
          curriculum_id: string
          id?: string
          ordering?: number
          parent_unit_id?: string | null
          recommended_hours?: number | null
          title: string
        }
        Update: {
          created_at?: string
          curriculum_id?: string
          id?: string
          ordering?: number
          parent_unit_id?: string | null
          recommended_hours?: number | null
          title?: string
        }
        Relationships: [
          {
            foreignKeyName: "curriculum_units_curriculum_id_fkey"
            columns: ["curriculum_id"]
            isOneToOne: false
            referencedRelation: "curricula"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "curriculum_units_parent_unit_id_fkey"
            columns: ["parent_unit_id"]
            isOneToOne: false
            referencedRelation: "curriculum_units"
            referencedColumns: ["id"]
          },
        ]
      }
      documents: {
        Row: {
          confidence: number | null
          created_at: string
          extracted_data: Json | null
          id: string
          kind: Database["public"]["Enums"]["document_kind"]
          organization_id: string
          reviewed_at: string | null
          reviewed_by: string | null
          status: Database["public"]["Enums"]["import_status"]
          storage_path: string | null
          uploaded_by: string
        }
        Insert: {
          confidence?: number | null
          created_at?: string
          extracted_data?: Json | null
          id?: string
          kind: Database["public"]["Enums"]["document_kind"]
          organization_id: string
          reviewed_at?: string | null
          reviewed_by?: string | null
          status?: Database["public"]["Enums"]["import_status"]
          storage_path?: string | null
          uploaded_by: string
        }
        Update: {
          confidence?: number | null
          created_at?: string
          extracted_data?: Json | null
          id?: string
          kind?: Database["public"]["Enums"]["document_kind"]
          organization_id?: string
          reviewed_at?: string | null
          reviewed_by?: string | null
          status?: Database["public"]["Enums"]["import_status"]
          storage_path?: string | null
          uploaded_by?: string
        }
        Relationships: [
          {
            foreignKeyName: "documents_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      education_cycles: {
        Row: {
          education_system_id: string
          id: string
          name: string
          ordering: number
        }
        Insert: {
          education_system_id: string
          id?: string
          name: string
          ordering?: number
        }
        Update: {
          education_system_id?: string
          id?: string
          name?: string
          ordering?: number
        }
        Relationships: [
          {
            foreignKeyName: "education_cycles_education_system_id_fkey"
            columns: ["education_system_id"]
            isOneToOne: false
            referencedRelation: "education_systems"
            referencedColumns: ["id"]
          },
        ]
      }
      education_levels: {
        Row: {
          cycle_id: string
          id: string
          name: string
          ordering: number
        }
        Insert: {
          cycle_id: string
          id?: string
          name: string
          ordering?: number
        }
        Update: {
          cycle_id?: string
          id?: string
          name?: string
          ordering?: number
        }
        Relationships: [
          {
            foreignKeyName: "education_levels_cycle_id_fkey"
            columns: ["cycle_id"]
            isOneToOne: false
            referencedRelation: "education_cycles"
            referencedColumns: ["id"]
          },
        ]
      }
      education_systems: {
        Row: {
          authority_name: string | null
          country_id: string
          created_at: string
          id: string
          name: string
        }
        Insert: {
          authority_name?: string | null
          country_id: string
          created_at?: string
          id?: string
          name: string
        }
        Update: {
          authority_name?: string | null
          country_id?: string
          created_at?: string
          id?: string
          name?: string
        }
        Relationships: [
          {
            foreignKeyName: "education_systems_country_id_fkey"
            columns: ["country_id"]
            isOneToOne: false
            referencedRelation: "countries"
            referencedColumns: ["id"]
          },
        ]
      }
      establishments: {
        Row: {
          city: string | null
          created_at: string
          id: string
          name: string
          organization_id: string
        }
        Insert: {
          city?: string | null
          created_at?: string
          id?: string
          name: string
          organization_id: string
        }
        Update: {
          city?: string | null
          created_at?: string
          id?: string
          name?: string
          organization_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "establishments_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      exercises: {
        Row: {
          answer: string | null
          competency_id: string | null
          correction: string | null
          created_at: string
          curriculum_unit_id: string | null
          difficulty: number | null
          id: string
          organization_id: string
          origin: Database["public"]["Enums"]["content_origin"]
          statement: string
          teacher_id: string
        }
        Insert: {
          answer?: string | null
          competency_id?: string | null
          correction?: string | null
          created_at?: string
          curriculum_unit_id?: string | null
          difficulty?: number | null
          id?: string
          organization_id: string
          origin?: Database["public"]["Enums"]["content_origin"]
          statement: string
          teacher_id: string
        }
        Update: {
          answer?: string | null
          competency_id?: string | null
          correction?: string | null
          created_at?: string
          curriculum_unit_id?: string | null
          difficulty?: number | null
          id?: string
          organization_id?: string
          origin?: Database["public"]["Enums"]["content_origin"]
          statement?: string
          teacher_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "exercises_competency_id_fkey"
            columns: ["competency_id"]
            isOneToOne: false
            referencedRelation: "competencies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "exercises_curriculum_unit_id_fkey"
            columns: ["curriculum_unit_id"]
            isOneToOne: false
            referencedRelation: "curriculum_units"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "exercises_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      invitations: {
        Row: {
          accepted_at: string | null
          class_id: string | null
          created_at: string
          email: string
          id: string
          invited_by: string
          needs_seat_payment: boolean
          organization_id: string
          role: Database["public"]["Enums"]["user_role"]
          seat_payment_submission_id: string | null
          status: string
        }
        Insert: {
          accepted_at?: string | null
          class_id?: string | null
          created_at?: string
          email: string
          id?: string
          invited_by: string
          needs_seat_payment?: boolean
          organization_id: string
          role?: Database["public"]["Enums"]["user_role"]
          seat_payment_submission_id?: string | null
          status?: string
        }
        Update: {
          accepted_at?: string | null
          class_id?: string | null
          created_at?: string
          email?: string
          id?: string
          invited_by?: string
          needs_seat_payment?: boolean
          organization_id?: string
          role?: Database["public"]["Enums"]["user_role"]
          seat_payment_submission_id?: string | null
          status?: string
        }
        Relationships: [
          {
            foreignKeyName: "invitations_class_id_fkey"
            columns: ["class_id"]
            isOneToOne: false
            referencedRelation: "classes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "invitations_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "invitations_seat_payment_submission_id_fkey"
            columns: ["seat_payment_submission_id"]
            isOneToOne: false
            referencedRelation: "payment_submissions"
            referencedColumns: ["id"]
          },
        ]
      }
      lesson_sessions: {
        Row: {
          class_id: string
          content_summary: string | null
          created_at: string
          homework: string | null
          id: string
          lesson_id: string | null
          observations: string | null
          organization_id: string
          schedule_slot_id: string | null
          session_date: string
        }
        Insert: {
          class_id: string
          content_summary?: string | null
          created_at?: string
          homework?: string | null
          id?: string
          lesson_id?: string | null
          observations?: string | null
          organization_id: string
          schedule_slot_id?: string | null
          session_date: string
        }
        Update: {
          class_id?: string
          content_summary?: string | null
          created_at?: string
          homework?: string | null
          id?: string
          lesson_id?: string | null
          observations?: string | null
          organization_id?: string
          schedule_slot_id?: string | null
          session_date?: string
        }
        Relationships: [
          {
            foreignKeyName: "lesson_sessions_class_id_fkey"
            columns: ["class_id"]
            isOneToOne: false
            referencedRelation: "classes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "lesson_sessions_lesson_id_fkey"
            columns: ["lesson_id"]
            isOneToOne: false
            referencedRelation: "lessons"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "lesson_sessions_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "lesson_sessions_schedule_slot_id_fkey"
            columns: ["schedule_slot_id"]
            isOneToOne: false
            referencedRelation: "schedule_slots"
            referencedColumns: ["id"]
          },
        ]
      }
      lessons: {
        Row: {
          class_id: string | null
          content: Json
          created_at: string
          curriculum_unit_id: string | null
          duration_minutes: number | null
          id: string
          kind: Database["public"]["Enums"]["lesson_kind"]
          organization_id: string
          origin: Database["public"]["Enums"]["content_origin"]
          teacher_id: string
          title: string
          updated_at: string
          version: number
        }
        Insert: {
          class_id?: string | null
          content?: Json
          created_at?: string
          curriculum_unit_id?: string | null
          duration_minutes?: number | null
          id?: string
          kind?: Database["public"]["Enums"]["lesson_kind"]
          organization_id: string
          origin?: Database["public"]["Enums"]["content_origin"]
          teacher_id: string
          title: string
          updated_at?: string
          version?: number
        }
        Update: {
          class_id?: string | null
          content?: Json
          created_at?: string
          curriculum_unit_id?: string | null
          duration_minutes?: number | null
          id?: string
          kind?: Database["public"]["Enums"]["lesson_kind"]
          organization_id?: string
          origin?: Database["public"]["Enums"]["content_origin"]
          teacher_id?: string
          title?: string
          updated_at?: string
          version?: number
        }
        Relationships: [
          {
            foreignKeyName: "lessons_class_id_fkey"
            columns: ["class_id"]
            isOneToOne: false
            referencedRelation: "classes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "lessons_curriculum_unit_id_fkey"
            columns: ["curriculum_unit_id"]
            isOneToOne: false
            referencedRelation: "curriculum_units"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "lessons_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      official_progression_steps: {
        Row: {
          curriculum_id: string
          curriculum_unit_id: string
          expected_end_date: string | null
          expected_start_date: string | null
          expected_week: number | null
          id: string
          ordering: number
        }
        Insert: {
          curriculum_id: string
          curriculum_unit_id: string
          expected_end_date?: string | null
          expected_start_date?: string | null
          expected_week?: number | null
          id?: string
          ordering?: number
        }
        Update: {
          curriculum_id?: string
          curriculum_unit_id?: string
          expected_end_date?: string | null
          expected_start_date?: string | null
          expected_week?: number | null
          id?: string
          ordering?: number
        }
        Relationships: [
          {
            foreignKeyName: "official_progression_steps_curriculum_id_fkey"
            columns: ["curriculum_id"]
            isOneToOne: false
            referencedRelation: "curricula"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "official_progression_steps_curriculum_unit_id_fkey"
            columns: ["curriculum_unit_id"]
            isOneToOne: false
            referencedRelation: "curriculum_units"
            referencedColumns: ["id"]
          },
        ]
      }
      organization_members: {
        Row: {
          accepted_at: string | null
          id: string
          invitation_id: string | null
          invited_at: string
          organization_id: string
          role: Database["public"]["Enums"]["user_role"]
          seat_payment_status: string
          suspended_at: string | null
          user_id: string
        }
        Insert: {
          accepted_at?: string | null
          id?: string
          invitation_id?: string | null
          invited_at?: string
          organization_id: string
          role?: Database["public"]["Enums"]["user_role"]
          seat_payment_status?: string
          suspended_at?: string | null
          user_id: string
        }
        Update: {
          accepted_at?: string | null
          id?: string
          invitation_id?: string | null
          invited_at?: string
          organization_id?: string
          role?: Database["public"]["Enums"]["user_role"]
          seat_payment_status?: string
          suspended_at?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "organization_members_invitation_id_fkey"
            columns: ["invitation_id"]
            isOneToOne: false
            referencedRelation: "invitations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "organization_members_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      organizations: {
        Row: {
          country_id: string
          created_at: string
          default_locale: string
          id: string
          kind: Database["public"]["Enums"]["account_kind"]
          name: string
        }
        Insert: {
          country_id: string
          created_at?: string
          default_locale?: string
          id?: string
          kind: Database["public"]["Enums"]["account_kind"]
          name: string
        }
        Update: {
          country_id?: string
          created_at?: string
          default_locale?: string
          id?: string
          kind?: Database["public"]["Enums"]["account_kind"]
          name?: string
        }
        Relationships: [
          {
            foreignKeyName: "organizations_country_id_fkey"
            columns: ["country_id"]
            isOneToOne: false
            referencedRelation: "countries"
            referencedColumns: ["id"]
          },
        ]
      }
      payment_submissions: {
        Row: {
          added_invitation_id: string | null
          amount_due_minor_units: number
          app_reference: string
          billing_period: string
          created_at: string
          currency: string
          discipline_subject_id: string | null
          discipline_teacher_id: string | null
          id: string
          organization_id: string
          payer_phone: string | null
          payer_reference: string | null
          payment_method: string
          plan_id: string
          pricing_tier: string | null
          review_note: string | null
          reviewed_at: string | null
          reviewed_by: string | null
          seats_snapshot: number | null
          status: string
          submission_kind: string
          submitted_by: string
          subscription_id: string | null
        }
        Insert: {
          added_invitation_id?: string | null
          amount_due_minor_units: number
          app_reference?: string
          billing_period: string
          created_at?: string
          currency?: string
          discipline_subject_id?: string | null
          discipline_teacher_id?: string | null
          id?: string
          organization_id: string
          payer_phone?: string | null
          payer_reference?: string | null
          payment_method?: string
          plan_id: string
          pricing_tier?: string | null
          review_note?: string | null
          reviewed_at?: string | null
          reviewed_by?: string | null
          seats_snapshot?: number | null
          status?: string
          submission_kind?: string
          submitted_by: string
          subscription_id?: string | null
        }
        Update: {
          added_invitation_id?: string | null
          amount_due_minor_units?: number
          app_reference?: string
          billing_period?: string
          created_at?: string
          currency?: string
          discipline_subject_id?: string | null
          discipline_teacher_id?: string | null
          id?: string
          organization_id?: string
          payer_phone?: string | null
          payer_reference?: string | null
          payment_method?: string
          plan_id?: string
          pricing_tier?: string | null
          review_note?: string | null
          reviewed_at?: string | null
          reviewed_by?: string | null
          seats_snapshot?: number | null
          status?: string
          submission_kind?: string
          submitted_by?: string
          subscription_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "payment_submissions_added_invitation_id_fkey"
            columns: ["added_invitation_id"]
            isOneToOne: false
            referencedRelation: "invitations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "payment_submissions_discipline_subject_id_fkey"
            columns: ["discipline_subject_id"]
            isOneToOne: false
            referencedRelation: "subjects"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "payment_submissions_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "payment_submissions_plan_id_fkey"
            columns: ["plan_id"]
            isOneToOne: false
            referencedRelation: "plans"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "payment_submissions_subscription_id_fkey"
            columns: ["subscription_id"]
            isOneToOne: false
            referencedRelation: "subscriptions"
            referencedColumns: ["id"]
          },
        ]
      }
      plans: {
        Row: {
          audience: string
          billing_period: string
          code: string
          currency: string
          id: string
          is_active: boolean
          is_per_seat: boolean
          name: string
          price_minor_units: number
          seats: number | null
        }
        Insert: {
          audience?: string
          billing_period?: string
          code: string
          currency?: string
          id?: string
          is_active?: boolean
          is_per_seat?: boolean
          name: string
          price_minor_units: number
          seats?: number | null
        }
        Update: {
          audience?: string
          billing_period?: string
          code?: string
          currency?: string
          id?: string
          is_active?: boolean
          is_per_seat?: boolean
          name?: string
          price_minor_units?: number
          seats?: number | null
        }
        Relationships: []
      }
      profiles: {
        Row: {
          avatar_url: string | null
          created_at: string
          full_name: string | null
          id: string
          preferred_locale: string
          updated_at: string
        }
        Insert: {
          avatar_url?: string | null
          created_at?: string
          full_name?: string | null
          id: string
          preferred_locale?: string
          updated_at?: string
        }
        Update: {
          avatar_url?: string | null
          created_at?: string
          full_name?: string | null
          id?: string
          preferred_locale?: string
          updated_at?: string
        }
        Relationships: []
      }
      remediation_students: {
        Row: {
          remediation_id: string
          student_id: string
        }
        Insert: {
          remediation_id: string
          student_id: string
        }
        Update: {
          remediation_id?: string
          student_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "remediation_students_remediation_id_fkey"
            columns: ["remediation_id"]
            isOneToOne: false
            referencedRelation: "remediations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "remediation_students_student_id_fkey"
            columns: ["student_id"]
            isOneToOne: false
            referencedRelation: "students"
            referencedColumns: ["id"]
          },
        ]
      }
      remediations: {
        Row: {
          class_id: string
          content: Json
          created_at: string
          curriculum_unit_id: string | null
          id: string
          organization_id: string
          origin: Database["public"]["Enums"]["content_origin"]
          scope: string
        }
        Insert: {
          class_id: string
          content?: Json
          created_at?: string
          curriculum_unit_id?: string | null
          id?: string
          organization_id: string
          origin?: Database["public"]["Enums"]["content_origin"]
          scope?: string
        }
        Update: {
          class_id?: string
          content?: Json
          created_at?: string
          curriculum_unit_id?: string | null
          id?: string
          organization_id?: string
          origin?: Database["public"]["Enums"]["content_origin"]
          scope?: string
        }
        Relationships: [
          {
            foreignKeyName: "remediations_class_id_fkey"
            columns: ["class_id"]
            isOneToOne: false
            referencedRelation: "classes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "remediations_curriculum_unit_id_fkey"
            columns: ["curriculum_unit_id"]
            isOneToOne: false
            referencedRelation: "curriculum_units"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "remediations_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      report_cards: {
        Row: {
          appreciation: string | null
          class_id: string
          created_at: string
          id: string
          observations: string | null
          organization_id: string
          origin: Database["public"]["Enums"]["content_origin"]
          school_period_id: string
          student_id: string
          subject_id: string | null
          updated_at: string
          version: number
        }
        Insert: {
          appreciation?: string | null
          class_id: string
          created_at?: string
          id?: string
          observations?: string | null
          organization_id: string
          origin?: Database["public"]["Enums"]["content_origin"]
          school_period_id: string
          student_id: string
          subject_id?: string | null
          updated_at?: string
          version?: number
        }
        Update: {
          appreciation?: string | null
          class_id?: string
          created_at?: string
          id?: string
          observations?: string | null
          organization_id?: string
          origin?: Database["public"]["Enums"]["content_origin"]
          school_period_id?: string
          student_id?: string
          subject_id?: string | null
          updated_at?: string
          version?: number
        }
        Relationships: [
          {
            foreignKeyName: "report_cards_class_id_fkey"
            columns: ["class_id"]
            isOneToOne: false
            referencedRelation: "classes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "report_cards_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "report_cards_school_period_id_fkey"
            columns: ["school_period_id"]
            isOneToOne: false
            referencedRelation: "school_periods"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "report_cards_student_id_fkey"
            columns: ["student_id"]
            isOneToOne: false
            referencedRelation: "students"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "report_cards_subject_id_fkey"
            columns: ["subject_id"]
            isOneToOne: false
            referencedRelation: "subjects"
            referencedColumns: ["id"]
          },
        ]
      }
      results: {
        Row: {
          assessment_id: string
          created_at: string
          id: string
          is_absent: boolean
          organization_id: string
          score: number | null
          student_id: string
          updated_at: string
        }
        Insert: {
          assessment_id: string
          created_at?: string
          id?: string
          is_absent?: boolean
          organization_id: string
          score?: number | null
          student_id: string
          updated_at?: string
        }
        Update: {
          assessment_id?: string
          created_at?: string
          id?: string
          is_absent?: boolean
          organization_id?: string
          score?: number | null
          student_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "results_assessment_id_fkey"
            columns: ["assessment_id"]
            isOneToOne: false
            referencedRelation: "assessments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "results_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "results_student_id_fkey"
            columns: ["student_id"]
            isOneToOne: false
            referencedRelation: "students"
            referencedColumns: ["id"]
          },
        ]
      }
      schedule_slots: {
        Row: {
          class_id: string
          created_at: string
          end_time: string
          id: string
          organization_id: string
          recurring: boolean
          room: string | null
          start_time: string
          subject_id: string
          teacher_id: string
          weekday: number
        }
        Insert: {
          class_id: string
          created_at?: string
          end_time: string
          id?: string
          organization_id: string
          recurring?: boolean
          room?: string | null
          start_time: string
          subject_id: string
          teacher_id: string
          weekday: number
        }
        Update: {
          class_id?: string
          created_at?: string
          end_time?: string
          id?: string
          organization_id?: string
          recurring?: boolean
          room?: string | null
          start_time?: string
          subject_id?: string
          teacher_id?: string
          weekday?: number
        }
        Relationships: [
          {
            foreignKeyName: "schedule_slots_class_id_fkey"
            columns: ["class_id"]
            isOneToOne: false
            referencedRelation: "classes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "schedule_slots_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "schedule_slots_subject_id_fkey"
            columns: ["subject_id"]
            isOneToOne: false
            referencedRelation: "subjects"
            referencedColumns: ["id"]
          },
        ]
      }
      school_calendar_events: {
        Row: {
          category: Database["public"]["Enums"]["school_calendar_event_category"]
          created_at: string
          ends_on: string
          id: string
          label: string
          school_year_id: string
          starts_on: string
        }
        Insert: {
          category: Database["public"]["Enums"]["school_calendar_event_category"]
          created_at?: string
          ends_on: string
          id?: string
          label: string
          school_year_id: string
          starts_on: string
        }
        Update: {
          category?: Database["public"]["Enums"]["school_calendar_event_category"]
          created_at?: string
          ends_on?: string
          id?: string
          label?: string
          school_year_id?: string
          starts_on?: string
        }
        Relationships: [
          {
            foreignKeyName: "school_calendar_events_school_year_id_fkey"
            columns: ["school_year_id"]
            isOneToOne: false
            referencedRelation: "school_years"
            referencedColumns: ["id"]
          },
        ]
      }
      school_periods: {
        Row: {
          created_at: string
          ends_on: string
          id: string
          label: string
          ordering: number
          school_year_id: string
          starts_on: string
        }
        Insert: {
          created_at?: string
          ends_on: string
          id?: string
          label: string
          ordering?: number
          school_year_id: string
          starts_on: string
        }
        Update: {
          created_at?: string
          ends_on?: string
          id?: string
          label?: string
          ordering?: number
          school_year_id?: string
          starts_on?: string
        }
        Relationships: [
          {
            foreignKeyName: "school_periods_school_year_id_fkey"
            columns: ["school_year_id"]
            isOneToOne: false
            referencedRelation: "school_years"
            referencedColumns: ["id"]
          },
        ]
      }
      school_years: {
        Row: {
          country_id: string
          created_at: string
          ends_on: string
          id: string
          is_current: boolean
          label: string
          starts_on: string
        }
        Insert: {
          country_id: string
          created_at?: string
          ends_on: string
          id?: string
          is_current?: boolean
          label: string
          starts_on: string
        }
        Update: {
          country_id?: string
          created_at?: string
          ends_on?: string
          id?: string
          is_current?: boolean
          label?: string
          starts_on?: string
        }
        Relationships: [
          {
            foreignKeyName: "school_years_country_id_fkey"
            columns: ["country_id"]
            isOneToOne: false
            referencedRelation: "countries"
            referencedColumns: ["id"]
          },
        ]
      }
      student_profiles: {
        Row: {
          created_at: string
          full_name: string
          id: string
          organization_id: string
          student_number: string | null
        }
        Insert: {
          created_at?: string
          full_name: string
          id?: string
          organization_id: string
          student_number?: string | null
        }
        Update: {
          created_at?: string
          full_name?: string
          id?: string
          organization_id?: string
          student_number?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "student_profiles_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      students: {
        Row: {
          archived_at: string | null
          class_id: string
          created_at: string
          full_name: string
          id: string
          organization_id: string
          student_number: string | null
          student_profile_id: string | null
        }
        Insert: {
          archived_at?: string | null
          class_id: string
          created_at?: string
          full_name: string
          id?: string
          organization_id: string
          student_number?: string | null
          student_profile_id?: string | null
        }
        Update: {
          archived_at?: string | null
          class_id?: string
          created_at?: string
          full_name?: string
          id?: string
          organization_id?: string
          student_number?: string | null
          student_profile_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "students_class_id_fkey"
            columns: ["class_id"]
            isOneToOne: false
            referencedRelation: "classes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "students_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "students_student_profile_id_fkey"
            columns: ["student_profile_id"]
            isOneToOne: false
            referencedRelation: "student_profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      subjects: {
        Row: {
          code: string | null
          created_at: string
          education_system_id: string
          id: string
          name: string
        }
        Insert: {
          code?: string | null
          created_at?: string
          education_system_id: string
          id?: string
          name: string
        }
        Update: {
          code?: string | null
          created_at?: string
          education_system_id?: string
          id?: string
          name?: string
        }
        Relationships: [
          {
            foreignKeyName: "subjects_education_system_id_fkey"
            columns: ["education_system_id"]
            isOneToOne: false
            referencedRelation: "education_systems"
            referencedColumns: ["id"]
          },
        ]
      }
      subscriptions: {
        Row: {
          access_blocked_at: string | null
          access_blocked_by: string | null
          access_blocked_reason: string | null
          created_at: string
          current_period_end: string | null
          current_period_start: string
          id: string
          organization_id: string
          plan_id: string
          provider: string | null
          provider_reference: string | null
          seats_used: number
          status: Database["public"]["Enums"]["subscription_status"]
        }
        Insert: {
          access_blocked_at?: string | null
          access_blocked_by?: string | null
          access_blocked_reason?: string | null
          created_at?: string
          current_period_end?: string | null
          current_period_start?: string
          id?: string
          organization_id: string
          plan_id: string
          provider?: string | null
          provider_reference?: string | null
          seats_used?: number
          status?: Database["public"]["Enums"]["subscription_status"]
        }
        Update: {
          access_blocked_at?: string | null
          access_blocked_by?: string | null
          access_blocked_reason?: string | null
          created_at?: string
          current_period_end?: string | null
          current_period_start?: string
          id?: string
          organization_id?: string
          plan_id?: string
          provider?: string | null
          provider_reference?: string | null
          seats_used?: number
          status?: Database["public"]["Enums"]["subscription_status"]
        }
        Relationships: [
          {
            foreignKeyName: "subscriptions_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "subscriptions_plan_id_fkey"
            columns: ["plan_id"]
            isOneToOne: false
            referencedRelation: "plans"
            referencedColumns: ["id"]
          },
        ]
      }
      teacher_discipline_grants: {
        Row: {
          granted_at: string
          id: string
          organization_id: string
          payment_submission_id: string | null
          source: string
          subject_id: string
          teacher_id: string
        }
        Insert: {
          granted_at?: string
          id?: string
          organization_id: string
          payment_submission_id?: string | null
          source?: string
          subject_id: string
          teacher_id: string
        }
        Update: {
          granted_at?: string
          id?: string
          organization_id?: string
          payment_submission_id?: string | null
          source?: string
          subject_id?: string
          teacher_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "teacher_discipline_grants_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "teacher_discipline_grants_payment_submission_id_fkey"
            columns: ["payment_submission_id"]
            isOneToOne: false
            referencedRelation: "payment_submissions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "teacher_discipline_grants_subject_id_fkey"
            columns: ["subject_id"]
            isOneToOne: false
            referencedRelation: "subjects"
            referencedColumns: ["id"]
          },
        ]
      }
      teacher_progressions: {
        Row: {
          class_id: string
          completed_at: string | null
          curriculum_unit_id: string
          id: string
          organization_id: string
          planned_end_date: string | null
          planned_start_date: string | null
          status: Database["public"]["Enums"]["progression_status"]
          updated_at: string
        }
        Insert: {
          class_id: string
          completed_at?: string | null
          curriculum_unit_id: string
          id?: string
          organization_id: string
          planned_end_date?: string | null
          planned_start_date?: string | null
          status?: Database["public"]["Enums"]["progression_status"]
          updated_at?: string
        }
        Update: {
          class_id?: string
          completed_at?: string | null
          curriculum_unit_id?: string
          id?: string
          organization_id?: string
          planned_end_date?: string | null
          planned_start_date?: string | null
          status?: Database["public"]["Enums"]["progression_status"]
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "teacher_progressions_class_id_fkey"
            columns: ["class_id"]
            isOneToOne: false
            referencedRelation: "classes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "teacher_progressions_curriculum_unit_id_fkey"
            columns: ["curriculum_unit_id"]
            isOneToOne: false
            referencedRelation: "curriculum_units"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "teacher_progressions_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      accept_organization_invitation: {
        Args: { p_invitation_id: string }
        Returns: {
          accepted_at: string | null
          id: string
          invitation_id: string | null
          invited_at: string
          organization_id: string
          role: Database["public"]["Enums"]["user_role"]
          seat_payment_status: string
          suspended_at: string | null
          user_id: string
        }
        SetofOptions: {
          from: "*"
          to: "organization_members"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      class_belongs_to_org: {
        Args: { p_class_id: string; p_org_id: string }
        Returns: boolean
      }
      complete_onboarding: {
        Args: {
          p_account_kind: Database["public"]["Enums"]["account_kind"]
          p_country_id: string
          p_establishment_city?: string
          p_full_name: string
          p_organization_name: string
        }
        Returns: {
          country_id: string
          created_at: string
          default_locale: string
          id: string
          kind: Database["public"]["Enums"]["account_kind"]
          name: string
        }
        SetofOptions: {
          from: "*"
          to: "organizations"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      create_organization_invitation: {
        Args: {
          p_class_id?: string
          p_email: string
          p_organization_id: string
          p_role: Database["public"]["Enums"]["user_role"]
        }
        Returns: {
          accepted_at: string | null
          class_id: string | null
          created_at: string
          email: string
          id: string
          invited_by: string
          needs_seat_payment: boolean
          organization_id: string
          role: Database["public"]["Enums"]["user_role"]
          seat_payment_submission_id: string | null
          status: string
        }
        SetofOptions: {
          from: "*"
          to: "invitations"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      dearmor: { Args: { "": string }; Returns: string }
      decline_organization_invitation: {
        Args: { p_invitation_id: string }
        Returns: {
          accepted_at: string | null
          class_id: string | null
          created_at: string
          email: string
          id: string
          invited_by: string
          needs_seat_payment: boolean
          organization_id: string
          role: Database["public"]["Enums"]["user_role"]
          seat_payment_submission_id: string | null
          status: string
        }
        SetofOptions: {
          from: "*"
          to: "invitations"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      expire_overdue_subscriptions: { Args: never; Returns: undefined }
      gen_random_uuid: { Args: never; Returns: string }
      gen_salt: { Args: { "": string }; Returns: string }
      generate_payment_reference: { Args: never; Returns: string }
      grant_free_teacher_discipline: {
        Args: { p_organization_id: string; p_subject_id: string }
        Returns: {
          granted_at: string
          id: string
          organization_id: string
          payment_submission_id: string | null
          source: string
          subject_id: string
          teacher_id: string
        }
        SetofOptions: {
          from: "*"
          to: "teacher_discipline_grants"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      has_org_role: {
        Args: {
          allowed_roles: Database["public"]["Enums"]["user_role"][]
          target_org_id: string
        }
        Returns: boolean
      }
      is_class_teacher: { Args: { target_class_id: string }; Returns: boolean }
      is_document_object_accessible: {
        Args: { object_name: string }
        Returns: boolean
      }
      is_org_member: { Args: { target_org_id: string }; Returns: boolean }
      pgp_armor_headers: {
        Args: { "": string }
        Returns: Record<string, unknown>[]
      }
      remove_organization_member: {
        Args: { p_member_id: string }
        Returns: {
          accepted_at: string | null
          id: string
          invitation_id: string | null
          invited_at: string
          organization_id: string
          role: Database["public"]["Enums"]["user_role"]
          seat_payment_status: string
          suspended_at: string | null
          user_id: string
        }
        SetofOptions: {
          from: "*"
          to: "organization_members"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      revoke_organization_invitation: {
        Args: { p_invitation_id: string }
        Returns: {
          accepted_at: string | null
          class_id: string | null
          created_at: string
          email: string
          id: string
          invited_by: string
          needs_seat_payment: boolean
          organization_id: string
          role: Database["public"]["Enums"]["user_role"]
          seat_payment_submission_id: string | null
          status: string
        }
        SetofOptions: {
          from: "*"
          to: "invitations"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      set_organization_member_role: {
        Args: {
          p_member_id: string
          p_new_role: Database["public"]["Enums"]["user_role"]
        }
        Returns: {
          accepted_at: string | null
          id: string
          invitation_id: string | null
          invited_at: string
          organization_id: string
          role: Database["public"]["Enums"]["user_role"]
          seat_payment_status: string
          suspended_at: string | null
          user_id: string
        }
        SetofOptions: {
          from: "*"
          to: "organization_members"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      student_belongs_to_class: {
        Args: { p_class_id: string; p_student_id: string }
        Returns: boolean
      }
      update_organization_invitation: {
        Args: {
          p_class_id: string
          p_invitation_id: string
          p_role: Database["public"]["Enums"]["user_role"]
        }
        Returns: {
          accepted_at: string | null
          class_id: string | null
          created_at: string
          email: string
          id: string
          invited_by: string
          needs_seat_payment: boolean
          organization_id: string
          role: Database["public"]["Enums"]["user_role"]
          seat_payment_submission_id: string | null
          status: string
        }
        SetofOptions: {
          from: "*"
          to: "invitations"
          isOneToOne: true
          isSetofReturn: false
        }
      }
    }
    Enums: {
      account_kind: "individual_teacher" | "establishment"
      assessment_type:
        | "interrogation"
        | "controle"
        | "diagnostic"
        | "formative"
        | "sommative"
        | "composition"
      content_origin: "official" | "teacher" | "ai_generated"
      document_kind:
        | "schedule_photo"
        | "grade_sheet"
        | "student_list"
        | "lesson_sheet"
        | "admin_document"
        | "other"
      import_status: "pending_review" | "validated" | "rejected"
      lesson_kind: "cours" | "devoir" | "fiche_corrige"
      progression_status: "planned" | "in_progress" | "done" | "late" | "ahead"
      school_calendar_event_category:
        | "ferie"
        | "conge"
        | "examen"
        | "pedagogique"
      subscription_status:
        | "trialing"
        | "active"
        | "past_due"
        | "canceled"
        | "expired"
      user_role: "owner" | "admin" | "manager" | "teacher" | "reader"
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
      account_kind: ["individual_teacher", "establishment"],
      assessment_type: [
        "interrogation",
        "controle",
        "diagnostic",
        "formative",
        "sommative",
        "composition",
      ],
      content_origin: ["official", "teacher", "ai_generated"],
      document_kind: [
        "schedule_photo",
        "grade_sheet",
        "student_list",
        "lesson_sheet",
        "admin_document",
        "other",
      ],
      import_status: ["pending_review", "validated", "rejected"],
      lesson_kind: ["cours", "devoir", "fiche_corrige"],
      progression_status: ["planned", "in_progress", "done", "late", "ahead"],
      school_calendar_event_category: [
        "ferie",
        "conge",
        "examen",
        "pedagogique",
      ],
      subscription_status: [
        "trialing",
        "active",
        "past_due",
        "canceled",
        "expired",
      ],
      user_role: ["owner", "admin", "manager", "teacher", "reader"],
    },
  },
} as const

