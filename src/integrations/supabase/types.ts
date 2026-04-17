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
      edpay_transactions: {
        Row: {
          amount: number | null
          created_at: string
          edpay_id: string | null
          id: string
          metadata: Json | null
          owner_id: string
          status: string
          type: string
          updated_at: string
        }
        Insert: {
          amount?: number | null
          created_at?: string
          edpay_id?: string | null
          id?: string
          metadata?: Json | null
          owner_id: string
          status?: string
          type?: string
          updated_at?: string
        }
        Update: {
          amount?: number | null
          created_at?: string
          edpay_id?: string | null
          id?: string
          metadata?: Json | null
          owner_id?: string
          status?: string
          type?: string
          updated_at?: string
        }
        Relationships: []
      }
      email_send_log: {
        Row: {
          created_at: string
          error_message: string | null
          id: string
          message_id: string | null
          metadata: Json | null
          recipient_email: string
          status: string
          template_name: string
        }
        Insert: {
          created_at?: string
          error_message?: string | null
          id?: string
          message_id?: string | null
          metadata?: Json | null
          recipient_email: string
          status: string
          template_name: string
        }
        Update: {
          created_at?: string
          error_message?: string | null
          id?: string
          message_id?: string | null
          metadata?: Json | null
          recipient_email?: string
          status?: string
          template_name?: string
        }
        Relationships: []
      }
      email_send_state: {
        Row: {
          auth_email_ttl_minutes: number
          batch_size: number
          id: number
          retry_after_until: string | null
          send_delay_ms: number
          transactional_email_ttl_minutes: number
          updated_at: string
        }
        Insert: {
          auth_email_ttl_minutes?: number
          batch_size?: number
          id?: number
          retry_after_until?: string | null
          send_delay_ms?: number
          transactional_email_ttl_minutes?: number
          updated_at?: string
        }
        Update: {
          auth_email_ttl_minutes?: number
          batch_size?: number
          id?: number
          retry_after_until?: string | null
          send_delay_ms?: number
          transactional_email_ttl_minutes?: number
          updated_at?: string
        }
        Relationships: []
      }
      email_templates: {
        Row: {
          blocks: Json
          created_at: string
          id: string
          name: string
          owner_id: string
          updated_at: string
        }
        Insert: {
          blocks?: Json
          created_at?: string
          id?: string
          name: string
          owner_id: string
          updated_at?: string
        }
        Update: {
          blocks?: Json
          created_at?: string
          id?: string
          name?: string
          owner_id?: string
          updated_at?: string
        }
        Relationships: []
      }
      email_unsubscribe_tokens: {
        Row: {
          created_at: string
          email: string
          id: string
          token: string
          used_at: string | null
        }
        Insert: {
          created_at?: string
          email: string
          id?: string
          token: string
          used_at?: string | null
        }
        Update: {
          created_at?: string
          email?: string
          id?: string
          token?: string
          used_at?: string | null
        }
        Relationships: []
      }
      imported_contacts: {
        Row: {
          created_at: string
          group_name: string
          id: string
          lead: string
          numero: string
          owner_id: string
        }
        Insert: {
          created_at?: string
          group_name?: string
          id?: string
          lead?: string
          numero: string
          owner_id: string
        }
        Update: {
          created_at?: string
          group_name?: string
          id?: string
          lead?: string
          numero?: string
          owner_id?: string
        }
        Relationships: []
      }
      page_views: {
        Row: {
          browser: string | null
          city: string | null
          country: string | null
          created_at: string
          device_type: string | null
          duration_seconds: number | null
          id: string
          ip_address: string | null
          os: string | null
          owner_id: string | null
          page_type: string
          page_url: string | null
          referrer: string | null
          region: string | null
          session_id: string
          slug: string | null
          updated_at: string
        }
        Insert: {
          browser?: string | null
          city?: string | null
          country?: string | null
          created_at?: string
          device_type?: string | null
          duration_seconds?: number | null
          id?: string
          ip_address?: string | null
          os?: string | null
          owner_id?: string | null
          page_type?: string
          page_url?: string | null
          referrer?: string | null
          region?: string | null
          session_id: string
          slug?: string | null
          updated_at?: string
        }
        Update: {
          browser?: string | null
          city?: string | null
          country?: string | null
          created_at?: string
          device_type?: string | null
          duration_seconds?: number | null
          id?: string
          ip_address?: string | null
          os?: string | null
          owner_id?: string | null
          page_type?: string
          page_url?: string | null
          referrer?: string | null
          region?: string | null
          session_id?: string
          slug?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      prize_payments: {
        Row: {
          account_id: string
          amount: number
          auto_payment: boolean
          created_at: string
          edpay_transaction_id: string | null
          hidden_from_influencer: boolean
          id: string
          notes: string | null
          owner_id: string
          paid_at: string | null
          pix_key: string | null
          pix_key_type: string | null
          prize: string
          spin_result_id: string | null
          status: string
          updated_at: string
          user_email: string
          user_name: string
          wheel_user_id: string | null
        }
        Insert: {
          account_id: string
          amount?: number
          auto_payment?: boolean
          created_at?: string
          edpay_transaction_id?: string | null
          hidden_from_influencer?: boolean
          id?: string
          notes?: string | null
          owner_id: string
          paid_at?: string | null
          pix_key?: string | null
          pix_key_type?: string | null
          prize?: string
          spin_result_id?: string | null
          status?: string
          updated_at?: string
          user_email?: string
          user_name?: string
          wheel_user_id?: string | null
        }
        Update: {
          account_id?: string
          amount?: number
          auto_payment?: boolean
          created_at?: string
          edpay_transaction_id?: string | null
          hidden_from_influencer?: boolean
          id?: string
          notes?: string | null
          owner_id?: string
          paid_at?: string | null
          pix_key?: string | null
          pix_key_type?: string | null
          prize?: string
          spin_result_id?: string | null
          status?: string
          updated_at?: string
          user_email?: string
          user_name?: string
          wheel_user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "prize_payments_spin_result_id_fkey"
            columns: ["spin_result_id"]
            isOneToOne: false
            referencedRelation: "spin_results"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "prize_payments_wheel_user_id_fkey"
            columns: ["wheel_user_id"]
            isOneToOne: false
            referencedRelation: "wheel_users"
            referencedColumns: ["id"]
          },
        ]
      }
      referral_links: {
        Row: {
          auto_payment: boolean
          code: string
          created_at: string
          expires_at: string | null
          fixed_prize_segment: number | null
          fixed_prize_segments: Json | null
          id: string
          is_active: boolean
          label: string
          max_registrations: number | null
          owner_id: string
          page_config: Json
          registrations_count: number
          spins_per_registration: number
          updated_at: string
        }
        Insert: {
          auto_payment?: boolean
          code?: string
          created_at?: string
          expires_at?: string | null
          fixed_prize_segment?: number | null
          fixed_prize_segments?: Json | null
          id?: string
          is_active?: boolean
          label?: string
          max_registrations?: number | null
          owner_id: string
          page_config?: Json
          registrations_count?: number
          spins_per_registration?: number
          updated_at?: string
        }
        Update: {
          auto_payment?: boolean
          code?: string
          created_at?: string
          expires_at?: string | null
          fixed_prize_segment?: number | null
          fixed_prize_segments?: Json | null
          id?: string
          is_active?: boolean
          label?: string
          max_registrations?: number | null
          owner_id?: string
          page_config?: Json
          registrations_count?: number
          spins_per_registration?: number
          updated_at?: string
        }
        Relationships: []
      }
      referral_redemptions: {
        Row: {
          account_id: string
          cpf: string
          created_at: string
          email: string
          id: string
          referral_link_id: string
        }
        Insert: {
          account_id: string
          cpf?: string
          created_at?: string
          email: string
          id?: string
          referral_link_id: string
        }
        Update: {
          account_id?: string
          cpf?: string
          created_at?: string
          email?: string
          id?: string
          referral_link_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "referral_redemptions_referral_link_id_fkey"
            columns: ["referral_link_id"]
            isOneToOne: false
            referencedRelation: "referral_links"
            referencedColumns: ["id"]
          },
        ]
      }
      scheduled_messages: {
        Row: {
          channel: string
          created_at: string
          id: string
          last_sent_at: string | null
          media_filename: string | null
          media_mimetype: string | null
          media_type: string | null
          media_url: string | null
          mention_all: boolean | null
          message: string
          next_run_at: string | null
          owner_id: string
          recipient_label: string
          recipient_type: string
          recipient_value: string
          recurrence: string
          scheduled_at: string
          status: string
          updated_at: string
        }
        Insert: {
          channel?: string
          created_at?: string
          id?: string
          last_sent_at?: string | null
          media_filename?: string | null
          media_mimetype?: string | null
          media_type?: string | null
          media_url?: string | null
          mention_all?: boolean | null
          message: string
          next_run_at?: string | null
          owner_id: string
          recipient_label?: string
          recipient_type?: string
          recipient_value: string
          recurrence?: string
          scheduled_at: string
          status?: string
          updated_at?: string
        }
        Update: {
          channel?: string
          created_at?: string
          id?: string
          last_sent_at?: string | null
          media_filename?: string | null
          media_mimetype?: string | null
          media_type?: string | null
          media_url?: string | null
          mention_all?: boolean | null
          message?: string
          next_run_at?: string | null
          owner_id?: string
          recipient_label?: string
          recipient_type?: string
          recipient_value?: string
          recurrence?: string
          scheduled_at?: string
          status?: string
          updated_at?: string
        }
        Relationships: []
      }
      site_settings: {
        Row: {
          bg_image_url: string | null
          created_at: string
          favicon_url: string | null
          home_mode: string
          id: number
          site_description: string | null
          site_title: string | null
          updated_at: string
        }
        Insert: {
          bg_image_url?: string | null
          created_at?: string
          favicon_url?: string | null
          home_mode?: string
          id?: number
          site_description?: string | null
          site_title?: string | null
          updated_at?: string
        }
        Update: {
          bg_image_url?: string | null
          created_at?: string
          favicon_url?: string | null
          home_mode?: string
          id?: number
          site_description?: string | null
          site_title?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      sms_message_log: {
        Row: {
          batch_id: string | null
          created_at: string
          error_message: string | null
          id: string
          message: string
          owner_id: string
          recipient_name: string
          recipient_phone: string
          status: string
        }
        Insert: {
          batch_id?: string | null
          created_at?: string
          error_message?: string | null
          id?: string
          message: string
          owner_id: string
          recipient_name?: string
          recipient_phone: string
          status?: string
        }
        Update: {
          batch_id?: string | null
          created_at?: string
          error_message?: string | null
          id?: string
          message?: string
          owner_id?: string
          recipient_name?: string
          recipient_phone?: string
          status?: string
        }
        Relationships: []
      }
      spin_results: {
        Row: {
          account_id: string
          id: string
          owner_id: string | null
          prize: string
          spun_at: string
          user_email: string
          user_name: string
        }
        Insert: {
          account_id: string
          id?: string
          owner_id?: string | null
          prize: string
          spun_at?: string
          user_email: string
          user_name: string
        }
        Update: {
          account_id?: string
          id?: string
          owner_id?: string | null
          prize?: string
          spun_at?: string
          user_email?: string
          user_name?: string
        }
        Relationships: []
      }
      suppressed_emails: {
        Row: {
          created_at: string
          email: string
          id: string
          metadata: Json | null
          reason: string
        }
        Insert: {
          created_at?: string
          email: string
          id?: string
          metadata?: Json | null
          reason: string
        }
        Update: {
          created_at?: string
          email?: string
          id?: string
          metadata?: Json | null
          reason?: string
        }
        Relationships: []
      }
      user_roles: {
        Row: {
          id: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Insert: {
          id?: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Update: {
          id?: string
          role?: Database["public"]["Enums"]["app_role"]
          user_id?: string
        }
        Relationships: []
      }
      whatsapp_message_log: {
        Row: {
          created_at: string
          error_message: string | null
          id: string
          message: string
          owner_id: string
          recipient_name: string
          recipient_phone: string
          status: string
        }
        Insert: {
          created_at?: string
          error_message?: string | null
          id?: string
          message: string
          owner_id: string
          recipient_name?: string
          recipient_phone: string
          status?: string
        }
        Update: {
          created_at?: string
          error_message?: string | null
          id?: string
          message?: string
          owner_id?: string
          recipient_name?: string
          recipient_phone?: string
          status?: string
        }
        Relationships: []
      }
      wheel_configs: {
        Row: {
          clone_code: string
          config: Json
          created_at: string
          id: string
          slug: string
          updated_at: string
          user_id: string
        }
        Insert: {
          clone_code?: string
          config?: Json
          created_at?: string
          id?: string
          slug: string
          updated_at?: string
          user_id: string
        }
        Update: {
          clone_code?: string
          config?: Json
          created_at?: string
          id?: string
          slug?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      wheel_users: {
        Row: {
          account_id: string
          archived: boolean
          auto_payment: boolean
          blacklisted: boolean
          created_at: string | null
          email: string
          fixed_prize_enabled: boolean
          fixed_prize_segment: number | null
          guaranteed_next_win: boolean
          id: string
          name: string
          owner_id: string | null
          phone: string
          pix_key: string | null
          pix_key_type: string | null
          referral_link_id: string | null
          responsible: string | null
          spins_available: number
          spins_expire_at: string | null
          updated_at: string | null
          user_type: string | null
        }
        Insert: {
          account_id: string
          archived?: boolean
          auto_payment?: boolean
          blacklisted?: boolean
          created_at?: string | null
          email: string
          fixed_prize_enabled?: boolean
          fixed_prize_segment?: number | null
          guaranteed_next_win?: boolean
          id?: string
          name: string
          owner_id?: string | null
          phone?: string
          pix_key?: string | null
          pix_key_type?: string | null
          referral_link_id?: string | null
          responsible?: string | null
          spins_available?: number
          spins_expire_at?: string | null
          updated_at?: string | null
          user_type?: string | null
        }
        Update: {
          account_id?: string
          archived?: boolean
          auto_payment?: boolean
          blacklisted?: boolean
          created_at?: string | null
          email?: string
          fixed_prize_enabled?: boolean
          fixed_prize_segment?: number | null
          guaranteed_next_win?: boolean
          id?: string
          name?: string
          owner_id?: string | null
          phone?: string
          pix_key?: string | null
          pix_key_type?: string | null
          referral_link_id?: string | null
          responsible?: string | null
          spins_available?: number
          spins_expire_at?: string | null
          updated_at?: string | null
          user_type?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "wheel_users_referral_link_id_fkey"
            columns: ["referral_link_id"]
            isOneToOne: false
            referencedRelation: "referral_links"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      authenticate_wheel_user: {
        Args: { p_account_id: string; p_email: string; p_owner_id?: string }
        Returns: {
          account_id: string
          blacklisted: boolean
          fixed_prize_enabled: boolean
          fixed_prize_segment: number
          id: string
          name: string
          owner_id: string
          spins_available: number
        }[]
      }
      create_prize_payment:
        | {
            Args: {
              p_account_id?: string
              p_amount?: number
              p_owner_id: string
              p_prize?: string
              p_spin_result_id?: string
              p_user_email?: string
              p_user_name?: string
            }
            Returns: Json
          }
        | {
            Args: {
              p_account_id?: string
              p_amount?: number
              p_force_auto?: boolean
              p_owner_id: string
              p_prize?: string
              p_spin_result_id?: string
              p_user_email?: string
              p_user_name?: string
            }
            Returns: Json
          }
      decrement_wheel_user_spins: {
        Args: { p_account_id: string; p_owner_id?: string }
        Returns: {
          owner_id: string
          spins_available: number
        }[]
      }
      delete_email: {
        Args: { message_id: number; queue_name: string }
        Returns: boolean
      }
      enqueue_email: {
        Args: { payload: Json; queue_name: string }
        Returns: number
      }
      get_prize_history: {
        Args: { p_account_id: string; p_owner_id: string }
        Returns: {
          id: string
          prize: string
          spun_at: string
        }[]
      }
      get_wheel_config_by_slug: {
        Args: { p_slug: string }
        Returns: {
          config: Json
          user_id: string
        }[]
      }
      get_wheel_user_spins: {
        Args: { p_account_id: string; p_owner_id?: string }
        Returns: {
          blacklisted: boolean
          fixed_prize_enabled: boolean
          fixed_prize_segment: number
          name: string
          owner_id: string
          spins_available: number
        }[]
      }
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
      move_to_dlq: {
        Args: {
          dlq_name: string
          message_id: number
          payload: Json
          source_queue: string
        }
        Returns: number
      }
      read_email_batch: {
        Args: { batch_size: number; queue_name: string; vt: number }
        Returns: {
          message: Json
          msg_id: number
          read_ct: number
        }[]
      }
      record_spin_result: {
        Args: {
          p_account_id: string
          p_owner_id?: string
          p_prize: string
          p_user_email: string
          p_user_name: string
        }
        Returns: string
      }
      register_via_gorjeta: {
        Args: {
          p_account_id: string
          p_code: string
          p_cpf?: string
          p_email: string
          p_name?: string
          p_phone?: string
          p_pix_key?: string
          p_pix_key_type?: string
        }
        Returns: Json
      }
      register_via_referral:
        | {
            Args: {
              p_account_id: string
              p_code: string
              p_cpf?: string
              p_email: string
              p_name?: string
            }
            Returns: Json
          }
        | {
            Args: {
              p_account_id: string
              p_code: string
              p_cpf?: string
              p_email: string
              p_name?: string
              p_phone?: string
              p_pix_key?: string
              p_pix_key_type?: string
            }
            Returns: Json
          }
    }
    Enums: {
      app_role: "admin" | "user"
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
      app_role: ["admin", "user"],
    },
  },
} as const
