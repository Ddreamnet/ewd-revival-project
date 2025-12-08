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
    PostgrestVersion: "13.0.4"
  }
  public: {
    Tables: {
      admin_notifications: {
        Row: {
          created_at: string
          id: string
          is_read: boolean
          message: string
          notification_type: string
          student_id: string
          teacher_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          is_read?: boolean
          message: string
          notification_type?: string
          student_id: string
          teacher_id: string
        }
        Update: {
          created_at?: string
          id?: string
          is_read?: boolean
          message?: string
          notification_type?: string
          student_id?: string
          teacher_id?: string
        }
        Relationships: []
      }
      global_topic_resources: {
        Row: {
          completed_at: string | null
          created_at: string
          description: string | null
          global_topic_id: string
          id: string
          is_completed: boolean | null
          order_index: number
          resource_type: string
          resource_url: string
          title: string
          updated_at: string
        }
        Insert: {
          completed_at?: string | null
          created_at?: string
          description?: string | null
          global_topic_id: string
          id?: string
          is_completed?: boolean | null
          order_index?: number
          resource_type: string
          resource_url: string
          title: string
          updated_at?: string
        }
        Update: {
          completed_at?: string | null
          created_at?: string
          description?: string | null
          global_topic_id?: string
          id?: string
          is_completed?: boolean | null
          order_index?: number
          resource_type?: string
          resource_url?: string
          title?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "global_topic_resources_global_topic_id_fkey"
            columns: ["global_topic_id"]
            isOneToOne: false
            referencedRelation: "global_topics"
            referencedColumns: ["id"]
          },
        ]
      }
      global_topics: {
        Row: {
          created_at: string
          description: string | null
          id: string
          order_index: number
          teacher_id: string
          title: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          description?: string | null
          id?: string
          order_index?: number
          teacher_id?: string
          title: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          description?: string | null
          id?: string
          order_index?: number
          teacher_id?: string
          title?: string
          updated_at?: string
        }
        Relationships: []
      }
      homework_submissions: {
        Row: {
          batch_id: string
          created_at: string
          description: string | null
          file_name: string
          file_type: string
          file_url: string
          id: string
          student_id: string
          teacher_id: string
          title: string
          updated_at: string
          uploaded_by_user_id: string
        }
        Insert: {
          batch_id: string
          created_at?: string
          description?: string | null
          file_name: string
          file_type: string
          file_url: string
          id?: string
          student_id: string
          teacher_id: string
          title: string
          updated_at?: string
          uploaded_by_user_id?: string
        }
        Update: {
          batch_id?: string
          created_at?: string
          description?: string | null
          file_name?: string
          file_type?: string
          file_url?: string
          id?: string
          student_id?: string
          teacher_id?: string
          title?: string
          updated_at?: string
          uploaded_by_user_id?: string
        }
        Relationships: []
      }
      lesson_overrides: {
        Row: {
          created_at: string
          id: string
          is_cancelled: boolean
          new_date: string | null
          new_end_time: string | null
          new_start_time: string | null
          original_date: string
          original_day_of_week: number
          original_end_time: string
          original_start_time: string
          student_id: string
          teacher_id: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          id?: string
          is_cancelled?: boolean
          new_date?: string | null
          new_end_time?: string | null
          new_start_time?: string | null
          original_date: string
          original_day_of_week: number
          original_end_time: string
          original_start_time: string
          student_id: string
          teacher_id: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          id?: string
          is_cancelled?: boolean
          new_date?: string | null
          new_end_time?: string | null
          new_start_time?: string | null
          original_date?: string
          original_day_of_week?: number
          original_end_time?: string
          original_start_time?: string
          student_id?: string
          teacher_id?: string
          updated_at?: string
        }
        Relationships: []
      }
      notifications: {
        Row: {
          created_at: string
          homework_id: string
          id: string
          is_read: boolean
          recipient_id: string
          student_id: string
          teacher_id: string
        }
        Insert: {
          created_at?: string
          homework_id: string
          id?: string
          is_read?: boolean
          recipient_id: string
          student_id: string
          teacher_id: string
        }
        Update: {
          created_at?: string
          homework_id?: string
          id?: string
          is_read?: boolean
          recipient_id?: string
          student_id?: string
          teacher_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "notifications_homework_id_fkey"
            columns: ["homework_id"]
            isOneToOne: false
            referencedRelation: "homework_submissions"
            referencedColumns: ["id"]
          },
        ]
      }
      payment_history: {
        Row: {
          amount_minutes: number
          completed_regular_lessons: number
          completed_trial_lessons: number
          created_at: string
          id: string
          notes: string | null
          payment_date: string
          teacher_id: string
        }
        Insert: {
          amount_minutes: number
          completed_regular_lessons?: number
          completed_trial_lessons?: number
          created_at?: string
          id?: string
          notes?: string | null
          payment_date?: string
          teacher_id: string
        }
        Update: {
          amount_minutes?: number
          completed_regular_lessons?: number
          completed_trial_lessons?: number
          created_at?: string
          id?: string
          notes?: string | null
          payment_date?: string
          teacher_id?: string
        }
        Relationships: []
      }
      profiles: {
        Row: {
          created_at: string
          email: string
          full_name: string
          id: string
          role: Database["public"]["Enums"]["user_role"]
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          email: string
          full_name: string
          id?: string
          role?: Database["public"]["Enums"]["user_role"]
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          email?: string
          full_name?: string
          id?: string
          role?: Database["public"]["Enums"]["user_role"]
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      resources: {
        Row: {
          completed_at: string | null
          created_at: string
          description: string | null
          id: string
          is_completed: boolean | null
          order_index: number
          resource_type: string
          resource_url: string
          title: string
          topic_id: string
          updated_at: string
        }
        Insert: {
          completed_at?: string | null
          created_at?: string
          description?: string | null
          id?: string
          is_completed?: boolean | null
          order_index?: number
          resource_type: string
          resource_url: string
          title: string
          topic_id: string
          updated_at?: string
        }
        Update: {
          completed_at?: string | null
          created_at?: string
          description?: string | null
          id?: string
          is_completed?: boolean | null
          order_index?: number
          resource_type?: string
          resource_url?: string
          title?: string
          topic_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "resources_topic_id_fkey"
            columns: ["topic_id"]
            isOneToOne: false
            referencedRelation: "topics"
            referencedColumns: ["id"]
          },
        ]
      }
      student_lesson_tracking: {
        Row: {
          completed_lessons: number[] | null
          created_at: string | null
          id: string
          lesson_dates: Json | null
          lessons_per_week: number
          month_start_date: string
          student_id: string
          teacher_id: string
          updated_at: string | null
        }
        Insert: {
          completed_lessons?: number[] | null
          created_at?: string | null
          id?: string
          lesson_dates?: Json | null
          lessons_per_week: number
          month_start_date?: string
          student_id: string
          teacher_id: string
          updated_at?: string | null
        }
        Update: {
          completed_lessons?: number[] | null
          created_at?: string | null
          id?: string
          lesson_dates?: Json | null
          lessons_per_week?: number
          month_start_date?: string
          student_id?: string
          teacher_id?: string
          updated_at?: string | null
        }
        Relationships: []
      }
      student_lessons: {
        Row: {
          completed_at: string | null
          created_at: string
          day_of_week: number
          end_time: string
          id: string
          is_completed: boolean
          note: string | null
          start_time: string
          student_id: string
          teacher_id: string
          updated_at: string
          week_start_date: string
        }
        Insert: {
          completed_at?: string | null
          created_at?: string
          day_of_week: number
          end_time: string
          id?: string
          is_completed?: boolean
          note?: string | null
          start_time: string
          student_id: string
          teacher_id: string
          updated_at?: string
          week_start_date?: string
        }
        Update: {
          completed_at?: string | null
          created_at?: string
          day_of_week?: number
          end_time?: string
          id?: string
          is_completed?: boolean
          note?: string | null
          start_time?: string
          student_id?: string
          teacher_id?: string
          updated_at?: string
          week_start_date?: string
        }
        Relationships: []
      }
      student_resource_completion: {
        Row: {
          completed_at: string | null
          created_at: string
          id: string
          is_completed: boolean
          resource_id: string
          student_id: string
          updated_at: string
        }
        Insert: {
          completed_at?: string | null
          created_at?: string
          id?: string
          is_completed?: boolean
          resource_id: string
          student_id: string
          updated_at?: string
        }
        Update: {
          completed_at?: string | null
          created_at?: string
          id?: string
          is_completed?: boolean
          resource_id?: string
          student_id?: string
          updated_at?: string
        }
        Relationships: []
      }
      students: {
        Row: {
          about_text: string | null
          archived_at: string | null
          created_at: string
          id: string
          is_archived: boolean
          student_id: string
          teacher_id: string
        }
        Insert: {
          about_text?: string | null
          archived_at?: string | null
          created_at?: string
          id?: string
          is_archived?: boolean
          student_id: string
          teacher_id: string
        }
        Update: {
          about_text?: string | null
          archived_at?: string | null
          created_at?: string
          id?: string
          is_archived?: boolean
          student_id?: string
          teacher_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "students_student_id_fkey"
            columns: ["student_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["user_id"]
          },
          {
            foreignKeyName: "students_teacher_id_fkey"
            columns: ["teacher_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["user_id"]
          },
        ]
      }
      teacher_balance: {
        Row: {
          completed_regular_lessons: number
          completed_trial_lessons: number
          created_at: string
          id: string
          regular_lessons_minutes: number
          teacher_id: string
          total_minutes: number
          trial_lessons_minutes: number
          updated_at: string
        }
        Insert: {
          completed_regular_lessons?: number
          completed_trial_lessons?: number
          created_at?: string
          id?: string
          regular_lessons_minutes?: number
          teacher_id: string
          total_minutes?: number
          trial_lessons_minutes?: number
          updated_at?: string
        }
        Update: {
          completed_regular_lessons?: number
          completed_trial_lessons?: number
          created_at?: string
          id?: string
          regular_lessons_minutes?: number
          teacher_id?: string
          total_minutes?: number
          trial_lessons_minutes?: number
          updated_at?: string
        }
        Relationships: []
      }
      topics: {
        Row: {
          completed_at: string | null
          created_at: string
          description: string | null
          id: string
          is_completed: boolean
          order_index: number
          student_id: string
          teacher_id: string
          title: string
          updated_at: string
        }
        Insert: {
          completed_at?: string | null
          created_at?: string
          description?: string | null
          id?: string
          is_completed?: boolean
          order_index?: number
          student_id: string
          teacher_id: string
          title: string
          updated_at?: string
        }
        Update: {
          completed_at?: string | null
          created_at?: string
          description?: string | null
          id?: string
          is_completed?: boolean
          order_index?: number
          student_id?: string
          teacher_id?: string
          title?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "topics_student_id_fkey"
            columns: ["student_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["user_id"]
          },
          {
            foreignKeyName: "topics_teacher_id_fkey"
            columns: ["teacher_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["user_id"]
          },
        ]
      }
      trial_lessons: {
        Row: {
          created_at: string
          day_of_week: number
          end_time: string
          id: string
          is_completed: boolean
          lesson_date: string
          start_time: string
          teacher_id: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          day_of_week: number
          end_time: string
          id?: string
          is_completed?: boolean
          lesson_date?: string
          start_time: string
          teacher_id: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          day_of_week?: number
          end_time?: string
          id?: string
          is_completed?: boolean
          lesson_date?: string
          start_time?: string
          teacher_id?: string
          updated_at?: string
        }
        Relationships: []
      }
      user_roles: {
        Row: {
          created_at: string | null
          id: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Insert: {
          created_at?: string | null
          id?: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Update: {
          created_at?: string | null
          id?: string
          role?: Database["public"]["Enums"]["app_role"]
          user_id?: string
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      create_student_relationship: {
        Args: { student_user_id: string; teacher_user_id: string }
        Returns: Json
      }
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
      is_teacher: { Args: { _user_id: string }; Returns: boolean }
      sync_missing_profiles: { Args: never; Returns: Json }
      teacher_owns_student: {
        Args: { _student_id: string; _teacher_id: string }
        Returns: boolean
      }
      update_global_resources_order: {
        Args: { resource_orders: Json }
        Returns: undefined
      }
      update_global_topics_order: {
        Args: { topic_orders: Json }
        Returns: undefined
      }
    }
    Enums: {
      app_role: "admin" | "teacher" | "student"
      user_role: "teacher" | "student"
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
      app_role: ["admin", "teacher", "student"],
      user_role: ["teacher", "student"],
    },
  },
} as const
