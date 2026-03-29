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
    PostgrestVersion: "14.4"
  }
  public: {
    Tables: {
      admin_editable_programs: {
        Row: {
          program_id: string
          user_id: string
        }
        Insert: {
          program_id: string
          user_id: string
        }
        Update: {
          program_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "admin_editable_programs_program_id_fkey"
            columns: ["program_id"]
            isOneToOne: false
            referencedRelation: "programs"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "admin_editable_programs_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      admin_promotion_requests: {
        Row: {
          id: string
          candidate_user_id: string
          requested_by: string
          token_hash: string
          expires_at: string
          consumed_at: string | null
          created_at: string
        }
        Insert: {
          id?: string
          candidate_user_id: string
          requested_by: string
          token_hash: string
          expires_at: string
          consumed_at?: string | null
          created_at?: string
        }
        Update: {
          id?: string
          candidate_user_id?: string
          requested_by?: string
          token_hash?: string
          expires_at?: string
          consumed_at?: string | null
          created_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "admin_promotion_requests_candidate_user_id_fkey"
            columns: ["candidate_user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "admin_promotion_requests_requested_by_fkey"
            columns: ["requested_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      audit_logs: {
        Row: {
          action: string
          actor_id: string | null
          created_at: string
          id: string
          metadata: Json | null
          resource_id: string | null
          resource_type: string | null
        }
        Insert: {
          action: string
          actor_id?: string | null
          created_at?: string
          id?: string
          metadata?: Json | null
          resource_id?: string | null
          resource_type?: string | null
        }
        Update: {
          action?: string
          actor_id?: string | null
          created_at?: string
          id?: string
          metadata?: Json | null
          resource_id?: string | null
          resource_type?: string | null
        }
        Relationships: []
      }
      base_course_improvements: {
        Row: {
          created_at: string | null
          id: string
          new_base_course_id: string | null
          new_program_id: string | null
          reason: string | null
          revision_number: number
          source_base_course_id: string | null
          source_program_id: string | null
        }
        Insert: {
          created_at?: string | null
          id?: string
          new_base_course_id?: string | null
          new_program_id?: string | null
          reason?: string | null
          revision_number: number
          source_base_course_id?: string | null
          source_program_id?: string | null
        }
        Update: {
          created_at?: string | null
          id?: string
          new_base_course_id?: string | null
          new_program_id?: string | null
          reason?: string | null
          revision_number?: number
          source_base_course_id?: string | null
          source_program_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "base_course_improvements_new_base_course_id_fkey"
            columns: ["new_base_course_id"]
            isOneToOne: false
            referencedRelation: "base_courses"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "base_course_improvements_new_program_id_fkey"
            columns: ["new_program_id"]
            isOneToOne: false
            referencedRelation: "programs"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "base_course_improvements_source_base_course_id_fkey"
            columns: ["source_base_course_id"]
            isOneToOne: false
            referencedRelation: "base_courses"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "base_course_improvements_source_program_id_fkey"
            columns: ["source_program_id"]
            isOneToOne: false
            referencedRelation: "programs"
            referencedColumns: ["id"]
          },
        ]
      }
      base_courses: {
        Row: {
          certificate_pass_percent: number | null
          certificate_require_all_lessons_completed: boolean
          certificate_sample_url: string | null
          certificate_template_config: Json | null
          chapter_weight_json: Json | null
          code: string
          created_at: string | null
          difficulty_level: string | null
          final_exam_weight_percent: number | null
          id: string
          name: string
          objectives: string | null
          prerequisite: string | null
          program_id: string | null
          summary: string | null
          updated_at: string | null
        }
        Insert: {
          certificate_pass_percent?: number | null
          certificate_require_all_lessons_completed?: boolean
          certificate_sample_url?: string | null
          certificate_template_config?: Json | null
          chapter_weight_json?: Json | null
          code: string
          created_at?: string | null
          difficulty_level?: string | null
          final_exam_weight_percent?: number | null
          id?: string
          name: string
          objectives?: string | null
          prerequisite?: string | null
          program_id?: string | null
          summary?: string | null
          updated_at?: string | null
        }
        Update: {
          certificate_pass_percent?: number | null
          certificate_require_all_lessons_completed?: boolean
          certificate_sample_url?: string | null
          certificate_template_config?: Json | null
          chapter_weight_json?: Json | null
          code?: string
          created_at?: string | null
          difficulty_level?: string | null
          final_exam_weight_percent?: number | null
          id?: string
          name?: string
          objectives?: string | null
          prerequisite?: string | null
          program_id?: string | null
          summary?: string | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "base_courses_program_id_fkey"
            columns: ["program_id"]
            isOneToOne: false
            referencedRelation: "programs"
            referencedColumns: ["id"]
          },
        ]
      }
      certificates: {
        Row: {
          base_course_id: string
          code: string
          created_at: string | null
          enrollment_id: string
          final_exam_attempt_id: string | null
          id: string
          issued_at: string | null
          percent_score: number
          regular_course_id: string
          user_id: string
        }
        Insert: {
          base_course_id: string
          code: string
          created_at?: string | null
          enrollment_id: string
          final_exam_attempt_id?: string | null
          id?: string
          issued_at?: string | null
          percent_score: number
          regular_course_id: string
          user_id: string
        }
        Update: {
          base_course_id?: string
          code?: string
          created_at?: string | null
          enrollment_id?: string
          final_exam_attempt_id?: string | null
          id?: string
          issued_at?: string | null
          percent_score?: number
          regular_course_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "certificates_base_course_id_fkey"
            columns: ["base_course_id"]
            isOneToOne: false
            referencedRelation: "base_courses"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "certificates_enrollment_id_fkey"
            columns: ["enrollment_id"]
            isOneToOne: false
            referencedRelation: "enrollments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "certificates_final_exam_attempt_id_fkey"
            columns: ["final_exam_attempt_id"]
            isOneToOne: false
            referencedRelation: "final_exam_attempts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "certificates_regular_course_id_fkey"
            columns: ["regular_course_id"]
            isOneToOne: false
            referencedRelation: "regular_courses"
            referencedColumns: ["id"]
          },
        ]
      }
      chapters: {
        Row: {
          base_course_id: string | null
          created_at: string | null
          id: string
          name: string
          objectives: string | null
          sort_order: number
          updated_at: string | null
          weight_percent: number | null
        }
        Insert: {
          base_course_id?: string | null
          created_at?: string | null
          id?: string
          name: string
          objectives?: string | null
          sort_order?: number
          updated_at?: string | null
          weight_percent?: number | null
        }
        Update: {
          base_course_id?: string | null
          created_at?: string | null
          id?: string
          name?: string
          objectives?: string | null
          sort_order?: number
          updated_at?: string | null
          weight_percent?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "chapters_base_course_id_fkey"
            columns: ["base_course_id"]
            isOneToOne: false
            referencedRelation: "base_courses"
            referencedColumns: ["id"]
          },
        ]
      }
      course_deletion_requests: {
        Row: {
          created_at: string
          id: string
          reason: string | null
          regular_course_id: string
          requested_by: string
          reviewed_at: string | null
          reviewed_by: string | null
          status: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          id?: string
          reason?: string | null
          regular_course_id: string
          requested_by: string
          reviewed_at?: string | null
          reviewed_by?: string | null
          status?: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          id?: string
          reason?: string | null
          regular_course_id?: string
          requested_by?: string
          reviewed_at?: string | null
          reviewed_by?: string | null
          status?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "course_deletion_requests_regular_course_id_fkey"
            columns: ["regular_course_id"]
            isOneToOne: false
            referencedRelation: "regular_courses"
            referencedColumns: ["id"]
          },
        ]
      }
      edit_locks: {
        Row: {
          expires_at: string
          locked_at: string
          locked_by: string
          resource_id: string
          resource_type: string
        }
        Insert: {
          expires_at: string
          locked_at?: string
          locked_by: string
          resource_id: string
          resource_type: string
        }
        Update: {
          expires_at?: string
          locked_at?: string
          locked_by?: string
          resource_id?: string
          resource_type?: string
        }
        Relationships: []
      }
      enrollment_cancel_stats: {
        Row: {
          cancel_count: number
          regular_course_id: string
          updated_at: string | null
          user_id: string
        }
        Insert: {
          cancel_count?: number
          regular_course_id: string
          updated_at?: string | null
          user_id: string
        }
        Update: {
          cancel_count?: number
          regular_course_id?: string
          updated_at?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "enrollment_cancel_stats_regular_course_id_fkey"
            columns: ["regular_course_id"]
            isOneToOne: false
            referencedRelation: "regular_courses"
            referencedColumns: ["id"]
          },
        ]
      }
      enrollments: {
        Row: {
          created_at: string | null
          enrolled_at: string | null
          expires_at: string | null
          id: string
          payment_id: string | null
          regular_course_id: string | null
          status: string | null
          updated_at: string | null
          user_id: string | null
        }
        Insert: {
          created_at?: string | null
          enrolled_at?: string | null
          expires_at?: string | null
          id?: string
          payment_id?: string | null
          regular_course_id?: string | null
          status?: string | null
          updated_at?: string | null
          user_id?: string | null
        }
        Update: {
          created_at?: string | null
          enrolled_at?: string | null
          expires_at?: string | null
          id?: string
          payment_id?: string | null
          regular_course_id?: string | null
          status?: string | null
          updated_at?: string | null
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "enrollments_payment_id_fkey"
            columns: ["payment_id"]
            isOneToOne: false
            referencedRelation: "payments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "enrollments_regular_course_id_fkey"
            columns: ["regular_course_id"]
            isOneToOne: false
            referencedRelation: "regular_courses"
            referencedColumns: ["id"]
          },
        ]
      }
      final_exam_attempts: {
        Row: {
          enrollment_id: string
          final_exam_id: string
          id: string
          max_points: number
          passed: boolean
          percent_score: number
          started_at: string | null
          submitted_at: string | null
          total_points: number
          user_id: string
        }
        Insert: {
          enrollment_id: string
          final_exam_id: string
          id?: string
          max_points?: number
          passed?: boolean
          percent_score?: number
          started_at?: string | null
          submitted_at?: string | null
          total_points?: number
          user_id: string
        }
        Update: {
          enrollment_id?: string
          final_exam_id?: string
          id?: string
          max_points?: number
          passed?: boolean
          percent_score?: number
          started_at?: string | null
          submitted_at?: string | null
          total_points?: number
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "final_exam_attempts_enrollment_id_fkey"
            columns: ["enrollment_id"]
            isOneToOne: false
            referencedRelation: "enrollments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "final_exam_attempts_final_exam_id_fkey"
            columns: ["final_exam_id"]
            isOneToOne: false
            referencedRelation: "final_exams"
            referencedColumns: ["id"]
          },
        ]
      }
      final_exam_questions: {
        Row: {
          created_at: string | null
          final_exam_id: string
          id: string
          question_id: string
          sort_order: number
        }
        Insert: {
          created_at?: string | null
          final_exam_id: string
          id?: string
          question_id: string
          sort_order?: number
        }
        Update: {
          created_at?: string | null
          final_exam_id?: string
          id?: string
          question_id?: string
          sort_order?: number
        }
        Relationships: [
          {
            foreignKeyName: "final_exam_questions_final_exam_id_fkey"
            columns: ["final_exam_id"]
            isOneToOne: false
            referencedRelation: "final_exams"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "final_exam_questions_question_id_fkey"
            columns: ["question_id"]
            isOneToOne: false
            referencedRelation: "questions"
            referencedColumns: ["id"]
          },
        ]
      }
      final_exams: {
        Row: {
          base_course_id: string | null
          created_at: string | null
          id: string
          name: string | null
          updated_at: string | null
        }
        Insert: {
          base_course_id?: string | null
          created_at?: string | null
          id?: string
          name?: string | null
          updated_at?: string | null
        }
        Update: {
          base_course_id?: string | null
          created_at?: string | null
          id?: string
          name?: string | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "final_exams_base_course_id_fkey"
            columns: ["base_course_id"]
            isOneToOne: false
            referencedRelation: "base_courses"
            referencedColumns: ["id"]
          },
        ]
      }
      homework: {
        Row: {
          chapter_id: string | null
          created_at: string | null
          id: string
          name: string | null
          updated_at: string | null
        }
        Insert: {
          chapter_id?: string | null
          created_at?: string | null
          id?: string
          name?: string | null
          updated_at?: string | null
        }
        Update: {
          chapter_id?: string | null
          created_at?: string | null
          id?: string
          name?: string | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "homework_chapter_id_fkey"
            columns: ["chapter_id"]
            isOneToOne: false
            referencedRelation: "chapters"
            referencedColumns: ["id"]
          },
        ]
      }
      legal_pages: {
        Row: {
          body: string
          intro: string | null
          slug: string
          updated_at: string
        }
        Insert: {
          body?: string
          intro?: string | null
          slug: string
          updated_at?: string
        }
        Update: {
          body?: string
          intro?: string | null
          slug?: string
          updated_at?: string
        }
        Relationships: []
      }
      lesson_progress: {
        Row: {
          completed_at: string | null
          created_at: string | null
          enrollment_id: string | null
          id: string
          lesson_id: string | null
        }
        Insert: {
          completed_at?: string | null
          created_at?: string | null
          enrollment_id?: string | null
          id?: string
          lesson_id?: string | null
        }
        Update: {
          completed_at?: string | null
          created_at?: string | null
          enrollment_id?: string | null
          id?: string
          lesson_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "lesson_progress_enrollment_id_fkey"
            columns: ["enrollment_id"]
            isOneToOne: false
            referencedRelation: "enrollments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "lesson_progress_lesson_id_fkey"
            columns: ["lesson_id"]
            isOneToOne: false
            referencedRelation: "lessons"
            referencedColumns: ["id"]
          },
        ]
      }
      lesson_question_replies: {
        Row: {
          content: string
          created_at: string | null
          id: string
          lesson_question_id: string
          user_id: string
        }
        Insert: {
          content: string
          created_at?: string | null
          id?: string
          lesson_question_id: string
          user_id: string
        }
        Update: {
          content?: string
          created_at?: string | null
          id?: string
          lesson_question_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "lesson_question_replies_lesson_question_id_fkey"
            columns: ["lesson_question_id"]
            isOneToOne: false
            referencedRelation: "lesson_questions"
            referencedColumns: ["id"]
          },
        ]
      }
      lesson_questions: {
        Row: {
          content: string
          created_at: string | null
          id: string
          lesson_id: string
          status: string
          updated_at: string | null
          user_id: string
        }
        Insert: {
          content: string
          created_at?: string | null
          id?: string
          lesson_id: string
          status?: string
          updated_at?: string | null
          user_id: string
        }
        Update: {
          content?: string
          created_at?: string | null
          id?: string
          lesson_id?: string
          status?: string
          updated_at?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "lesson_questions_lesson_id_fkey"
            columns: ["lesson_id"]
            isOneToOne: false
            referencedRelation: "lessons"
            referencedColumns: ["id"]
          },
        ]
      }
      lessons: {
        Row: {
          chapter_id: string | null
          created_at: string | null
          description: string | null
          document_url: string | null
          id: string
          name: string
          sort_order: number
          updated_at: string | null
          video_url: string | null
        }
        Insert: {
          chapter_id?: string | null
          created_at?: string | null
          description?: string | null
          document_url?: string | null
          id?: string
          name: string
          sort_order?: number
          updated_at?: string | null
          video_url?: string | null
        }
        Update: {
          chapter_id?: string | null
          created_at?: string | null
          description?: string | null
          document_url?: string | null
          id?: string
          name?: string
          sort_order?: number
          updated_at?: string | null
          video_url?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "lessons_chapter_id_fkey"
            columns: ["chapter_id"]
            isOneToOne: false
            referencedRelation: "chapters"
            referencedColumns: ["id"]
          },
        ]
      }
      org_domain_entitlements: {
        Row: {
          created_at: string
          first_used_at: string | null
          granted_at: string
          id: string
          policy_id: string
          revoked_at: string | null
          revoked_by: string | null
          revoked_reason: string | null
          unused_expiry_deadline: string
          user_id: string
        }
        Insert: {
          created_at?: string
          first_used_at?: string | null
          granted_at?: string
          id?: string
          policy_id: string
          revoked_at?: string | null
          revoked_by?: string | null
          revoked_reason?: string | null
          unused_expiry_deadline: string
          user_id: string
        }
        Update: {
          created_at?: string
          first_used_at?: string | null
          granted_at?: string
          id?: string
          policy_id?: string
          revoked_at?: string | null
          revoked_by?: string | null
          revoked_reason?: string | null
          unused_expiry_deadline?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "org_domain_entitlements_policy_id_fkey"
            columns: ["policy_id"]
            isOneToOne: false
            referencedRelation: "org_domain_policies"
            referencedColumns: ["id"]
          },
        ]
      }
      org_domain_policies: {
        Row: {
          created_at: string
          created_by: string | null
          email_domain: string
          id: string
          max_users: number
          notes: string | null
          status: string
          unused_expiry_years: number
          updated_at: string
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          email_domain: string
          id?: string
          max_users: number
          notes?: string | null
          status?: string
          unused_expiry_years?: number
          updated_at?: string
        }
        Update: {
          created_at?: string
          created_by?: string | null
          email_domain?: string
          id?: string
          max_users?: number
          notes?: string | null
          status?: string
          unused_expiry_years?: number
          updated_at?: string
        }
        Relationships: []
      }
      org_domain_policy_base_courses: {
        Row: {
          base_course_id: string
          policy_id: string
        }
        Insert: {
          base_course_id: string
          policy_id: string
        }
        Update: {
          base_course_id?: string
          policy_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "org_domain_policy_base_courses_base_course_id_fkey"
            columns: ["base_course_id"]
            isOneToOne: false
            referencedRelation: "base_courses"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "org_domain_policy_base_courses_policy_id_fkey"
            columns: ["policy_id"]
            isOneToOne: false
            referencedRelation: "org_domain_policies"
            referencedColumns: ["id"]
          },
        ]
      }
      payments: {
        Row: {
          amount_cents: number
          checkout_course_id: string | null
          created_at: string | null
          currency: string | null
          gateway: string
          gateway_response: Json | null
          gateway_transaction_id: string | null
          id: string
          invoice_exported_at: string | null
          metadata: Json | null
          status: string | null
          updated_at: string | null
          user_id: string | null
        }
        Insert: {
          amount_cents: number
          checkout_course_id?: string | null
          created_at?: string | null
          currency?: string | null
          gateway: string
          gateway_response?: Json | null
          gateway_transaction_id?: string | null
          id?: string
          invoice_exported_at?: string | null
          metadata?: Json | null
          status?: string | null
          updated_at?: string | null
          user_id?: string | null
        }
        Update: {
          amount_cents?: number
          checkout_course_id?: string | null
          created_at?: string | null
          currency?: string | null
          gateway?: string
          gateway_response?: Json | null
          gateway_transaction_id?: string | null
          id?: string
          invoice_exported_at?: string | null
          metadata?: Json | null
          status?: string | null
          updated_at?: string | null
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "payments_checkout_course_id_fkey"
            columns: ["checkout_course_id"]
            isOneToOne: false
            referencedRelation: "regular_courses"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          abuse_locked_at: string | null
          account_abuse_locked: boolean | null
          address: string | null
          address_province: string | null
          address_street_name: string | null
          address_street_number: string | null
          address_ward: string | null
          avatar_url: string | null
          can_edit_content: boolean | null
          company: string | null
          created_at: string | null
          data_sharing_consent_at: string | null
          email: string | null
          full_name: string | null
          gender: string | null
          id: string
          id_card: string | null
          last_ip: string | null
          last_session_id: string | null
          must_change_password: boolean | null
          phone: string | null
          phone_e164: string | null
          phone_verified_at: string | null
          profile_completion_required: boolean
          role: string
          security_agreed_at: string | null
          security_signed: boolean | null
          self_temp_lock_until: string | null
          student_code: string | null
          student_hub_eligible: boolean
        }
        Insert: {
          abuse_locked_at?: string | null
          account_abuse_locked?: boolean | null
          address?: string | null
          address_province?: string | null
          address_street_name?: string | null
          address_street_number?: string | null
          address_ward?: string | null
          avatar_url?: string | null
          can_edit_content?: boolean | null
          company?: string | null
          created_at?: string | null
          data_sharing_consent_at?: string | null
          email?: string | null
          full_name?: string | null
          gender?: string | null
          id: string
          id_card?: string | null
          last_ip?: string | null
          last_session_id?: string | null
          must_change_password?: boolean | null
          phone?: string | null
          phone_e164?: string | null
          phone_verified_at?: string | null
          profile_completion_required?: boolean
          role?: string
          security_agreed_at?: string | null
          security_signed?: boolean | null
          self_temp_lock_until?: string | null
          student_code?: string | null
          student_hub_eligible?: boolean
        }
        Update: {
          abuse_locked_at?: string | null
          account_abuse_locked?: boolean | null
          address?: string | null
          address_province?: string | null
          address_street_name?: string | null
          address_street_number?: string | null
          address_ward?: string | null
          avatar_url?: string | null
          can_edit_content?: boolean | null
          company?: string | null
          created_at?: string | null
          data_sharing_consent_at?: string | null
          email?: string | null
          full_name?: string | null
          gender?: string | null
          id?: string
          id_card?: string | null
          last_ip?: string | null
          last_session_id?: string | null
          must_change_password?: boolean | null
          phone?: string | null
          phone_e164?: string | null
          phone_verified_at?: string | null
          profile_completion_required?: boolean
          role?: string
          security_agreed_at?: string | null
          security_signed?: boolean | null
          self_temp_lock_until?: string | null
          student_code?: string | null
          student_hub_eligible?: boolean
        }
        Relationships: []
      }
      programs: {
        Row: {
          approval_status: string | null
          code: string | null
          created_at: string | null
          id: string
          name: string
          note: string | null
          updated_at: string | null
        }
        Insert: {
          approval_status?: string | null
          code?: string | null
          created_at?: string | null
          id?: string
          name: string
          note?: string | null
          updated_at?: string | null
        }
        Update: {
          approval_status?: string | null
          code?: string | null
          created_at?: string | null
          id?: string
          name?: string
          note?: string | null
          updated_at?: string | null
        }
        Relationships: []
      }
      question_attempts: {
        Row: {
          created_at: string | null
          fill_blank_answer: string | null
          id: string
          is_correct: boolean | null
          points_earned: number | null
          question_id: string | null
          selected_option_ids: string[] | null
          user_id: string | null
        }
        Insert: {
          created_at?: string | null
          fill_blank_answer?: string | null
          id?: string
          is_correct?: boolean | null
          points_earned?: number | null
          question_id?: string | null
          selected_option_ids?: string[] | null
          user_id?: string | null
        }
        Update: {
          created_at?: string | null
          fill_blank_answer?: string | null
          id?: string
          is_correct?: boolean | null
          points_earned?: number | null
          question_id?: string | null
          selected_option_ids?: string[] | null
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "question_attempts_question_id_fkey"
            columns: ["question_id"]
            isOneToOne: false
            referencedRelation: "questions"
            referencedColumns: ["id"]
          },
        ]
      }
      question_options: {
        Row: {
          created_at: string | null
          id: string
          is_correct: boolean | null
          option_text: string
          question_id: string | null
          sort_order: number | null
        }
        Insert: {
          created_at?: string | null
          id?: string
          is_correct?: boolean | null
          option_text: string
          question_id?: string | null
          sort_order?: number | null
        }
        Update: {
          created_at?: string | null
          id?: string
          is_correct?: boolean | null
          option_text?: string
          question_id?: string | null
          sort_order?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "question_options_question_id_fkey"
            columns: ["question_id"]
            isOneToOne: false
            referencedRelation: "questions"
            referencedColumns: ["id"]
          },
        ]
      }
      questions: {
        Row: {
          chapter_id: string | null
          code: string | null
          content: string
          created_at: string | null
          difficulty_level: string | null
          id: string
          lesson_id: string | null
          max_attempts: number | null
          points: number | null
          program_id: string | null
          tags: string[] | null
          type: string
          updated_at: string | null
        }
        Insert: {
          chapter_id?: string | null
          code?: string | null
          content: string
          created_at?: string | null
          difficulty_level?: string | null
          id?: string
          lesson_id?: string | null
          max_attempts?: number | null
          points?: number | null
          program_id?: string | null
          tags?: string[] | null
          type: string
          updated_at?: string | null
        }
        Update: {
          chapter_id?: string | null
          code?: string | null
          content?: string
          created_at?: string | null
          difficulty_level?: string | null
          id?: string
          lesson_id?: string | null
          max_attempts?: number | null
          points?: number | null
          program_id?: string | null
          tags?: string[] | null
          type?: string
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "questions_chapter_id_fkey"
            columns: ["chapter_id"]
            isOneToOne: false
            referencedRelation: "chapters"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "questions_lesson_id_fkey"
            columns: ["lesson_id"]
            isOneToOne: false
            referencedRelation: "lessons"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "questions_program_id_fkey"
            columns: ["program_id"]
            isOneToOne: false
            referencedRelation: "programs"
            referencedColumns: ["id"]
          },
        ]
      }
      regular_courses: {
        Row: {
          active_enrollment_count: number
          approval_status: string
          base_course_id: string | null
          course_end_at: string | null
          course_start_at: string | null
          created_at: string | null
          discount_percent: number | null
          discount_percent_locked: boolean
          id: string
          name: string
          price_cents: number | null
          program_id: string | null
          promotion_tiers: Json | null
          registration_close_at: string | null
          registration_open_at: string | null
          status: string | null
          updated_at: string | null
        }
        Insert: {
          active_enrollment_count?: number
          approval_status?: string
          base_course_id?: string | null
          course_end_at?: string | null
          course_start_at?: string | null
          created_at?: string | null
          discount_percent?: number | null
          discount_percent_locked?: boolean
          id?: string
          name: string
          price_cents?: number | null
          program_id?: string | null
          promotion_tiers?: Json | null
          registration_close_at?: string | null
          registration_open_at?: string | null
          status?: string | null
          updated_at?: string | null
        }
        Update: {
          active_enrollment_count?: number
          approval_status?: string
          base_course_id?: string | null
          course_end_at?: string | null
          course_start_at?: string | null
          created_at?: string | null
          discount_percent?: number | null
          discount_percent_locked?: boolean
          id?: string
          name?: string
          price_cents?: number | null
          program_id?: string | null
          promotion_tiers?: Json | null
          registration_close_at?: string | null
          registration_open_at?: string | null
          status?: string | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "regular_courses_base_course_id_fkey"
            columns: ["base_course_id"]
            isOneToOne: false
            referencedRelation: "base_courses"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "regular_courses_program_id_fkey"
            columns: ["program_id"]
            isOneToOne: false
            referencedRelation: "programs"
            referencedColumns: ["id"]
          },
        ]
      }
      student_code_sequence: {
        Row: {
          id: number
          val: number
        }
        Insert: {
          id?: number
          val?: number
        }
        Update: {
          id?: number
          val?: number
        }
        Relationships: []
      }
      subscriptions: {
        Row: {
          created_at: string | null
          expires_at: string
          id: string
          payment_id: string | null
          plan_code: string
          starts_at: string
          status: string | null
          updated_at: string | null
          user_id: string | null
        }
        Insert: {
          created_at?: string | null
          expires_at: string
          id?: string
          payment_id?: string | null
          plan_code: string
          starts_at: string
          status?: string | null
          updated_at?: string | null
          user_id?: string | null
        }
        Update: {
          created_at?: string | null
          expires_at?: string
          id?: string
          payment_id?: string | null
          plan_code?: string
          starts_at?: string
          status?: string | null
          updated_at?: string | null
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "subscriptions_payment_id_fkey"
            columns: ["payment_id"]
            isOneToOne: false
            referencedRelation: "payments"
            referencedColumns: ["id"]
          },
        ]
      }
      whitelist_cohort_base_courses: {
        Row: {
          base_course_id: string
          cohort_id: string
        }
        Insert: {
          base_course_id: string
          cohort_id: string
        }
        Update: {
          base_course_id?: string
          cohort_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "whitelist_cohort_base_courses_base_course_id_fkey"
            columns: ["base_course_id"]
            isOneToOne: false
            referencedRelation: "base_courses"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "whitelist_cohort_base_courses_cohort_id_fkey"
            columns: ["cohort_id"]
            isOneToOne: false
            referencedRelation: "whitelist_cohorts"
            referencedColumns: ["id"]
          },
        ]
      }
      whitelist_cohorts: {
        Row: {
          created_at: string
          created_by: string | null
          id: string
          name: string
          notes: string | null
          status: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          id?: string
          name: string
          notes?: string | null
          status?: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          created_by?: string | null
          id?: string
          name?: string
          notes?: string | null
          status?: string
          updated_at?: string
        }
        Relationships: []
      }
      whitelist_free_grants: {
        Row: {
          base_course_id: string
          cohort_id: string
          created_at: string
          enrollment_id: string | null
          id: string
          payment_id: string | null
          user_id: string
        }
        Insert: {
          base_course_id: string
          cohort_id: string
          created_at?: string
          enrollment_id?: string | null
          id?: string
          payment_id?: string | null
          user_id: string
        }
        Update: {
          base_course_id?: string
          cohort_id?: string
          created_at?: string
          enrollment_id?: string | null
          id?: string
          payment_id?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "whitelist_free_grants_base_course_id_fkey"
            columns: ["base_course_id"]
            isOneToOne: false
            referencedRelation: "base_courses"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "whitelist_free_grants_cohort_id_fkey"
            columns: ["cohort_id"]
            isOneToOne: false
            referencedRelation: "whitelist_cohorts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "whitelist_free_grants_enrollment_id_fkey"
            columns: ["enrollment_id"]
            isOneToOne: false
            referencedRelation: "enrollments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "whitelist_free_grants_payment_id_fkey"
            columns: ["payment_id"]
            isOneToOne: false
            referencedRelation: "payments"
            referencedColumns: ["id"]
          },
        ]
      }
      whitelist_members: {
        Row: {
          cohort_id: string
          created_at: string
          email: string
          full_name: string | null
          id: string
          student_code: string | null
          user_id: string
        }
        Insert: {
          cohort_id: string
          created_at?: string
          email: string
          full_name?: string | null
          id?: string
          student_code?: string | null
          user_id: string
        }
        Update: {
          cohort_id?: string
          created_at?: string
          email?: string
          full_name?: string | null
          id?: string
          student_code?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "whitelist_members_cohort_id_fkey"
            columns: ["cohort_id"]
            isOneToOne: false
            referencedRelation: "whitelist_cohorts"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      approve_course_deletion_request: {
        Args: { p_request_id: string }
        Returns: string
      }
      is_owner_or_admin: { Args: never; Returns: boolean }
      next_student_code: { Args: never; Returns: string }
      normalize_phone_e164: { Args: { p_input: string }; Returns: string }
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
