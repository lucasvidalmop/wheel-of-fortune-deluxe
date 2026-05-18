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
      battle_configs: {
        Row: {
          config: Json
          created_at: string
          id: string
          updated_at: string
          user_id: string
        }
        Insert: {
          config?: Json
          created_at?: string
          id?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          config?: Json
          created_at?: string
          id?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      battle_participants: {
        Row: {
          consumed: boolean
          created_at: string
          edpay_transaction_id: string | null
          game: string
          id: string
          name: string
          owner_id: string
          source: string
          updated_at: string
        }
        Insert: {
          consumed?: boolean
          created_at?: string
          edpay_transaction_id?: string | null
          game?: string
          id?: string
          name?: string
          owner_id: string
          source?: string
          updated_at?: string
        }
        Update: {
          consumed?: boolean
          created_at?: string
          edpay_transaction_id?: string | null
          game?: string
          id?: string
          name?: string
          owner_id?: string
          source?: string
          updated_at?: string
        }
        Relationships: []
      }
      bet_events: {
        Row: {
          bets_config_id: string
          category: string
          closes_at: string | null
          created_at: string
          id: string
          image_url: string
          max_bet: number
          min_bet: number
          owner_id: string
          payout_case_id: string | null
          payout_case_qty_per_unit: number
          payout_mode: string
          position: number
          resolved_at: string | null
          starts_at: string | null
          status: string
          subtitle: string
          title: string
          updated_at: string
          winning_outcome_id: string | null
        }
        Insert: {
          bets_config_id: string
          category?: string
          closes_at?: string | null
          created_at?: string
          id?: string
          image_url?: string
          max_bet?: number
          min_bet?: number
          owner_id: string
          payout_case_id?: string | null
          payout_case_qty_per_unit?: number
          payout_mode?: string
          position?: number
          resolved_at?: string | null
          starts_at?: string | null
          status?: string
          subtitle?: string
          title?: string
          updated_at?: string
          winning_outcome_id?: string | null
        }
        Update: {
          bets_config_id?: string
          category?: string
          closes_at?: string | null
          created_at?: string
          id?: string
          image_url?: string
          max_bet?: number
          min_bet?: number
          owner_id?: string
          payout_case_id?: string | null
          payout_case_qty_per_unit?: number
          payout_mode?: string
          position?: number
          resolved_at?: string | null
          starts_at?: string | null
          status?: string
          subtitle?: string
          title?: string
          updated_at?: string
          winning_outcome_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "bet_events_bets_config_id_fkey"
            columns: ["bets_config_id"]
            isOneToOne: false
            referencedRelation: "bets_configs"
            referencedColumns: ["id"]
          },
        ]
      }
      bet_outcomes: {
        Row: {
          created_at: string
          event_id: string
          id: string
          is_winner: boolean
          label: string
          odd: number
          owner_id: string
          position: number
        }
        Insert: {
          created_at?: string
          event_id: string
          id?: string
          is_winner?: boolean
          label?: string
          odd?: number
          owner_id: string
          position?: number
        }
        Update: {
          created_at?: string
          event_id?: string
          id?: string
          is_winner?: boolean
          label?: string
          odd?: number
          owner_id?: string
          position?: number
        }
        Relationships: [
          {
            foreignKeyName: "bet_outcomes_event_id_fkey"
            columns: ["event_id"]
            isOneToOne: false
            referencedRelation: "bet_events"
            referencedColumns: ["id"]
          },
        ]
      }
      bet_wagers: {
        Row: {
          account_id: string
          amount_coins: number
          created_at: string
          event_id: string
          id: string
          odd_snapshot: number
          outcome_id: string
          owner_id: string
          payout_coins: number
          payout_grant_id: string | null
          payout_mode: string
          resolved_at: string | null
          status: string
          user_email: string
          user_name: string
          wheel_user_id: string | null
        }
        Insert: {
          account_id?: string
          amount_coins?: number
          created_at?: string
          event_id: string
          id?: string
          odd_snapshot?: number
          outcome_id: string
          owner_id: string
          payout_coins?: number
          payout_grant_id?: string | null
          payout_mode?: string
          resolved_at?: string | null
          status?: string
          user_email?: string
          user_name?: string
          wheel_user_id?: string | null
        }
        Update: {
          account_id?: string
          amount_coins?: number
          created_at?: string
          event_id?: string
          id?: string
          odd_snapshot?: number
          outcome_id?: string
          owner_id?: string
          payout_coins?: number
          payout_grant_id?: string | null
          payout_mode?: string
          resolved_at?: string | null
          status?: string
          user_email?: string
          user_name?: string
          wheel_user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "bet_wagers_event_id_fkey"
            columns: ["event_id"]
            isOneToOne: false
            referencedRelation: "bet_events"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "bet_wagers_outcome_id_fkey"
            columns: ["outcome_id"]
            isOneToOne: false
            referencedRelation: "bet_outcomes"
            referencedColumns: ["id"]
          },
        ]
      }
      bets_configs: {
        Row: {
          coin_icon_url: string
          coin_name: string
          created_at: string
          id: string
          is_active: boolean
          owner_id: string
          page_config: Json
          tag: string
          updated_at: string
        }
        Insert: {
          coin_icon_url?: string
          coin_name?: string
          created_at?: string
          id?: string
          is_active?: boolean
          owner_id: string
          page_config?: Json
          tag: string
          updated_at?: string
        }
        Update: {
          coin_icon_url?: string
          coin_name?: string
          created_at?: string
          id?: string
          is_active?: boolean
          owner_id?: string
          page_config?: Json
          tag?: string
          updated_at?: string
        }
        Relationships: []
      }
      config_backups: {
        Row: {
          created_at: string
          email_templates: Json
          id: string
          label: string
          referral_links: Json
          trigger: string
          user_id: string
          whatsapp_share_templates: Json
          wheel_configs: Json
        }
        Insert: {
          created_at?: string
          email_templates?: Json
          id?: string
          label?: string
          referral_links?: Json
          trigger?: string
          user_id: string
          whatsapp_share_templates?: Json
          wheel_configs?: Json
        }
        Update: {
          created_at?: string
          email_templates?: Json
          id?: string
          label?: string
          referral_links?: Json
          trigger?: string
          user_id?: string
          whatsapp_share_templates?: Json
          wheel_configs?: Json
        }
        Relationships: []
      }
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
          owner_id: string | null
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
          owner_id?: string | null
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
          owner_id?: string | null
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
      luckybox_cases: {
        Row: {
          created_at: string
          id: string
          image_url: string
          is_active: boolean
          mode: string
          name: string
          owner_id: string
          position: number
          price_tokens: number
          prize_pool: Json | null
          prizes: Json
          rarity: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          id?: string
          image_url?: string
          is_active?: boolean
          mode?: string
          name?: string
          owner_id: string
          position?: number
          price_tokens?: number
          prize_pool?: Json | null
          prizes?: Json
          rarity?: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          id?: string
          image_url?: string
          is_active?: boolean
          mode?: string
          name?: string
          owner_id?: string
          position?: number
          price_tokens?: number
          prize_pool?: Json | null
          prizes?: Json
          rarity?: string
          updated_at?: string
        }
        Relationships: []
      }
      luckybox_configs: {
        Row: {
          coin_icon_url: string
          coin_name: string
          created_at: string
          id: string
          is_active: boolean
          owner_id: string
          page_config: Json
          tag: string
          tokens_symbol: string
          updated_at: string
        }
        Insert: {
          coin_icon_url?: string
          coin_name?: string
          created_at?: string
          id?: string
          is_active?: boolean
          owner_id: string
          page_config?: Json
          tag: string
          tokens_symbol?: string
          updated_at?: string
        }
        Update: {
          coin_icon_url?: string
          coin_name?: string
          created_at?: string
          id?: string
          is_active?: boolean
          owner_id?: string
          page_config?: Json
          tag?: string
          tokens_symbol?: string
          updated_at?: string
        }
        Relationships: []
      }
      luckybox_grants: {
        Row: {
          batch_id: string | null
          case_id: string
          case_name: string
          code: string
          created_at: string
          forced_prizes: Json | null
          id: string
          one_per_user: boolean
          owner_id: string
          quantity: number
          recipient_account_id: string
          recipient_email: string
          recipient_name: string
          recipient_phone: string
          redeemed_at: string | null
          redeemed_browser: string | null
          redeemed_city: string | null
          redeemed_country: string | null
          redeemed_device: string | null
          redeemed_ip: string | null
          redeemed_os: string | null
          redeemed_region: string | null
          redeemed_user_agent: string | null
          status: string
          updated_at: string
          whatsapp_error: string | null
          whatsapp_status: string
          wheel_user_id: string | null
        }
        Insert: {
          batch_id?: string | null
          case_id: string
          case_name?: string
          code: string
          created_at?: string
          forced_prizes?: Json | null
          id?: string
          one_per_user?: boolean
          owner_id: string
          quantity?: number
          recipient_account_id?: string
          recipient_email?: string
          recipient_name?: string
          recipient_phone?: string
          redeemed_at?: string | null
          redeemed_browser?: string | null
          redeemed_city?: string | null
          redeemed_country?: string | null
          redeemed_device?: string | null
          redeemed_ip?: string | null
          redeemed_os?: string | null
          redeemed_region?: string | null
          redeemed_user_agent?: string | null
          status?: string
          updated_at?: string
          whatsapp_error?: string | null
          whatsapp_status?: string
          wheel_user_id?: string | null
        }
        Update: {
          batch_id?: string | null
          case_id?: string
          case_name?: string
          code?: string
          created_at?: string
          forced_prizes?: Json | null
          id?: string
          one_per_user?: boolean
          owner_id?: string
          quantity?: number
          recipient_account_id?: string
          recipient_email?: string
          recipient_name?: string
          recipient_phone?: string
          redeemed_at?: string | null
          redeemed_browser?: string | null
          redeemed_city?: string | null
          redeemed_country?: string | null
          redeemed_device?: string | null
          redeemed_ip?: string | null
          redeemed_os?: string | null
          redeemed_region?: string | null
          redeemed_user_agent?: string | null
          status?: string
          updated_at?: string
          whatsapp_error?: string | null
          whatsapp_status?: string
          wheel_user_id?: string | null
        }
        Relationships: []
      }
      luckybox_openings: {
        Row: {
          account_id: string
          case_id: string | null
          case_name: string
          created_at: string
          id: string
          owner_id: string
          price_tokens: number
          prize_amount: number
          prize_image: string
          prize_index: number | null
          prize_label: string
          prize_payment_id: string | null
          user_email: string
          user_name: string
          wheel_user_id: string | null
        }
        Insert: {
          account_id?: string
          case_id?: string | null
          case_name?: string
          created_at?: string
          id?: string
          owner_id: string
          price_tokens?: number
          prize_amount?: number
          prize_image?: string
          prize_index?: number | null
          prize_label?: string
          prize_payment_id?: string | null
          user_email?: string
          user_name?: string
          wheel_user_id?: string | null
        }
        Update: {
          account_id?: string
          case_id?: string | null
          case_name?: string
          created_at?: string
          id?: string
          owner_id?: string
          price_tokens?: number
          prize_amount?: number
          prize_image?: string
          prize_index?: number | null
          prize_label?: string
          prize_payment_id?: string | null
          user_email?: string
          user_name?: string
          wheel_user_id?: string | null
        }
        Relationships: []
      }
      operator_permissions: {
        Row: {
          analytics: boolean
          apostas: boolean
          auth: boolean
          batalha_slot: boolean
          configuracoes: boolean
          created_at: string
          email: boolean
          email_brevo: boolean
          financeiro: boolean
          gorjeta: boolean
          history: boolean
          inscritos: boolean
          luckybox: boolean
          msg_analytics: boolean
          notificacoes: boolean
          painel_casa: boolean
          referral: boolean
          roleta: boolean
          sms: boolean
          sms_cs: boolean
          sms_mb: boolean
          updated_at: string
          user_id: string
          whatsapp: boolean
          whatsapp2: boolean
        }
        Insert: {
          analytics?: boolean
          apostas?: boolean
          auth?: boolean
          batalha_slot?: boolean
          configuracoes?: boolean
          created_at?: string
          email?: boolean
          email_brevo?: boolean
          financeiro?: boolean
          gorjeta?: boolean
          history?: boolean
          inscritos?: boolean
          luckybox?: boolean
          msg_analytics?: boolean
          notificacoes?: boolean
          painel_casa?: boolean
          referral?: boolean
          roleta?: boolean
          sms?: boolean
          sms_cs?: boolean
          sms_mb?: boolean
          updated_at?: string
          user_id: string
          whatsapp?: boolean
          whatsapp2?: boolean
        }
        Update: {
          analytics?: boolean
          apostas?: boolean
          auth?: boolean
          batalha_slot?: boolean
          configuracoes?: boolean
          created_at?: string
          email?: boolean
          email_brevo?: boolean
          financeiro?: boolean
          gorjeta?: boolean
          history?: boolean
          inscritos?: boolean
          luckybox?: boolean
          msg_analytics?: boolean
          notificacoes?: boolean
          painel_casa?: boolean
          referral?: boolean
          roleta?: boolean
          sms?: boolean
          sms_cs?: boolean
          sms_mb?: boolean
          updated_at?: string
          user_id?: string
          whatsapp?: boolean
          whatsapp2?: boolean
        }
        Relationships: []
      }
      operator_permissions_defaults: {
        Row: {
          analytics: boolean
          apostas: boolean
          auth: boolean
          batalha_slot: boolean
          configuracoes: boolean
          email: boolean
          email_brevo: boolean
          financeiro: boolean
          gorjeta: boolean
          history: boolean
          id: number
          inscritos: boolean
          luckybox: boolean
          msg_analytics: boolean
          notificacoes: boolean
          painel_casa: boolean
          referral: boolean
          roleta: boolean
          sms: boolean
          sms_cs: boolean
          sms_mb: boolean
          updated_at: string
          whatsapp: boolean
          whatsapp2: boolean
        }
        Insert: {
          analytics?: boolean
          apostas?: boolean
          auth?: boolean
          batalha_slot?: boolean
          configuracoes?: boolean
          email?: boolean
          email_brevo?: boolean
          financeiro?: boolean
          gorjeta?: boolean
          history?: boolean
          id?: number
          inscritos?: boolean
          luckybox?: boolean
          msg_analytics?: boolean
          notificacoes?: boolean
          painel_casa?: boolean
          referral?: boolean
          roleta?: boolean
          sms?: boolean
          sms_cs?: boolean
          sms_mb?: boolean
          updated_at?: string
          whatsapp?: boolean
          whatsapp2?: boolean
        }
        Update: {
          analytics?: boolean
          apostas?: boolean
          auth?: boolean
          batalha_slot?: boolean
          configuracoes?: boolean
          email?: boolean
          email_brevo?: boolean
          financeiro?: boolean
          gorjeta?: boolean
          history?: boolean
          id?: number
          inscritos?: boolean
          luckybox?: boolean
          msg_analytics?: boolean
          notificacoes?: boolean
          painel_casa?: boolean
          referral?: boolean
          roleta?: boolean
          sms?: boolean
          sms_cs?: boolean
          sms_mb?: boolean
          updated_at?: string
          whatsapp?: boolean
          whatsapp2?: boolean
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
      redemption_codes: {
        Row: {
          code: string
          created_at: string
          id: string
          owner_id: string
          redemption_page_id: string
          used_at: string | null
          used_by_account_id: string | null
          used_by_email: string | null
        }
        Insert: {
          code: string
          created_at?: string
          id?: string
          owner_id: string
          redemption_page_id: string
          used_at?: string | null
          used_by_account_id?: string | null
          used_by_email?: string | null
        }
        Update: {
          code?: string
          created_at?: string
          id?: string
          owner_id?: string
          redemption_page_id?: string
          used_at?: string | null
          used_by_account_id?: string | null
          used_by_email?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "redemption_codes_redemption_page_id_fkey"
            columns: ["redemption_page_id"]
            isOneToOne: false
            referencedRelation: "redemption_pages"
            referencedColumns: ["id"]
          },
        ]
      }
      redemption_pages: {
        Row: {
          created_at: string
          id: string
          is_active: boolean
          mode: string
          owner_id: string
          referral_link_id: string
          shared_code: string | null
          tag: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          id?: string
          is_active?: boolean
          mode?: string
          owner_id: string
          referral_link_id: string
          shared_code?: string | null
          tag: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          id?: string
          is_active?: boolean
          mode?: string
          owner_id?: string
          referral_link_id?: string
          shared_code?: string | null
          tag?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "redemption_pages_referral_link_id_fkey"
            columns: ["referral_link_id"]
            isOneToOne: false
            referencedRelation: "referral_links"
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
          fixed_prize_plan: Json | null
          fixed_prize_pool: Json | null
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
          fixed_prize_plan?: Json | null
          fixed_prize_pool?: Json | null
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
          fixed_prize_plan?: Json | null
          fixed_prize_pool?: Json | null
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
          link_code: string | null
          link_label: string | null
          owner_id: string | null
          referral_link_id: string | null
        }
        Insert: {
          account_id: string
          cpf?: string
          created_at?: string
          email: string
          id?: string
          link_code?: string | null
          link_label?: string | null
          owner_id?: string | null
          referral_link_id?: string | null
        }
        Update: {
          account_id?: string
          cpf?: string
          created_at?: string
          email?: string
          id?: string
          link_code?: string | null
          link_label?: string | null
          owner_id?: string | null
          referral_link_id?: string | null
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
      registration_update_logs: {
        Row: {
          account_id: string
          after_data: Json
          before_data: Json
          browser: string | null
          changed_fields: Json
          city: string | null
          country: string | null
          created_at: string
          device_type: string | null
          id: string
          ip_address: string | null
          os: string | null
          owner_id: string
          page_url: string | null
          referrer: string | null
          region: string | null
          session_id: string | null
          user_agent: string | null
          user_email: string
          user_name: string
          wheel_user_id: string | null
        }
        Insert: {
          account_id?: string
          after_data?: Json
          before_data?: Json
          browser?: string | null
          changed_fields?: Json
          city?: string | null
          country?: string | null
          created_at?: string
          device_type?: string | null
          id?: string
          ip_address?: string | null
          os?: string | null
          owner_id: string
          page_url?: string | null
          referrer?: string | null
          region?: string | null
          session_id?: string | null
          user_agent?: string | null
          user_email?: string
          user_name?: string
          wheel_user_id?: string | null
        }
        Update: {
          account_id?: string
          after_data?: Json
          before_data?: Json
          browser?: string | null
          changed_fields?: Json
          city?: string | null
          country?: string | null
          created_at?: string
          device_type?: string | null
          id?: string
          ip_address?: string | null
          os?: string | null
          owner_id?: string
          page_url?: string | null
          referrer?: string | null
          region?: string | null
          session_id?: string | null
          user_agent?: string | null
          user_email?: string
          user_name?: string
          wheel_user_id?: string | null
        }
        Relationships: []
      }
      scheduled_brevo_emails: {
        Row: {
          created_at: string
          csv_recipients: Json
          html_content: string | null
          id: string
          last_result: Json | null
          last_sent_at: string | null
          next_run_at: string | null
          owner_id: string
          recurrence: string
          reply_to: string | null
          scheduled_at: string
          selected_emails: Json
          sender_email: string
          sender_name: string
          source: string
          status: string
          subject: string
          text_content: string | null
          updated_at: string
        }
        Insert: {
          created_at?: string
          csv_recipients?: Json
          html_content?: string | null
          id?: string
          last_result?: Json | null
          last_sent_at?: string | null
          next_run_at?: string | null
          owner_id: string
          recurrence?: string
          reply_to?: string | null
          scheduled_at: string
          selected_emails?: Json
          sender_email: string
          sender_name?: string
          source?: string
          status?: string
          subject: string
          text_content?: string | null
          updated_at?: string
        }
        Update: {
          created_at?: string
          csv_recipients?: Json
          html_content?: string | null
          id?: string
          last_result?: Json | null
          last_sent_at?: string | null
          next_run_at?: string | null
          owner_id?: string
          recurrence?: string
          reply_to?: string | null
          scheduled_at?: string
          selected_emails?: Json
          sender_email?: string
          sender_name?: string
          source?: string
          status?: string
          subject?: string
          text_content?: string | null
          updated_at?: string
        }
        Relationships: []
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
          poll: Json | null
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
          poll?: Json | null
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
          poll?: Json | null
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
          dashboard_description: string | null
          dashboard_favicon_url: string | null
          dashboard_title: string | null
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
          dashboard_description?: string | null
          dashboard_favicon_url?: string | null
          dashboard_title?: string | null
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
          dashboard_description?: string | null
          dashboard_favicon_url?: string | null
          dashboard_title?: string | null
          favicon_url?: string | null
          home_mode?: string
          id?: number
          site_description?: string | null
          site_title?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      sms_cs_message_log: {
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
      sms_mb_message_log: {
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
      whatsapp_share_templates: {
        Row: {
          created_at: string
          id: string
          message: string
          name: string
          owner_id: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          id?: string
          message?: string
          name: string
          owner_id: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          id?: string
          message?: string
          name?: string
          owner_id?: string
          updated_at?: string
        }
        Relationships: []
      }
      whatsapp2_message_log: {
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
          case_grants: Json
          cpf: string
          created_at: string | null
          email: string
          fixed_prize_enabled: boolean
          fixed_prize_queue: Json
          fixed_prize_segment: number | null
          forced_prize_queue: Json
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
          tokens_balance: number
          updated_at: string | null
          user_type: string | null
        }
        Insert: {
          account_id: string
          archived?: boolean
          auto_payment?: boolean
          blacklisted?: boolean
          case_grants?: Json
          cpf?: string
          created_at?: string | null
          email: string
          fixed_prize_enabled?: boolean
          fixed_prize_queue?: Json
          fixed_prize_segment?: number | null
          forced_prize_queue?: Json
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
          tokens_balance?: number
          updated_at?: string | null
          user_type?: string | null
        }
        Update: {
          account_id?: string
          archived?: boolean
          auto_payment?: boolean
          blacklisted?: boolean
          case_grants?: Json
          cpf?: string
          created_at?: string | null
          email?: string
          fixed_prize_enabled?: boolean
          fixed_prize_queue?: Json
          fixed_prize_segment?: number | null
          forced_prize_queue?: Json
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
          tokens_balance?: number
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
      adjust_luckybox_tokens:
        | {
            Args: { p_account_id: string; p_delta: number; p_owner_id: string }
            Returns: number
          }
        | {
            Args: {
              p_delta: number
              p_owner_id: string
              p_wheel_user_id: string
            }
            Returns: number
          }
      authenticate_luckybox_user: {
        Args: { p_account_id: string; p_email: string; p_owner_id: string }
        Returns: {
          account_id: string
          blacklisted: boolean
          email: string
          id: string
          name: string
          owner_id: string
        }[]
      }
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
      build_fixed_prize_queue:
        | {
            Args: {
              p_legacy_segment?: number
              p_legacy_segments?: Json
              p_plan: Json
              p_spins: number
            }
            Returns: Json
          }
        | {
            Args: {
              p_legacy_segment?: number
              p_legacy_segments?: Json
              p_plan: Json
              p_spins: number
              p_total_segments?: number
            }
            Returns: Json
          }
        | {
            Args: {
              p_legacy_segment?: number
              p_legacy_segments?: Json
              p_plan: Json
              p_segments?: Json
              p_spins: number
              p_total_segments?: number
            }
            Returns: Json
          }
      build_link_prize_pool: { Args: { p_plan: Json }; Returns: Json }
      cancel_bet_event: { Args: { p_event_id: string }; Returns: Json }
      consume_fixed_prize_spin: {
        Args: { p_account_id: string; p_owner_id?: string }
        Returns: {
          blacklisted: boolean
          fixed_prize_enabled: boolean
          fixed_prize_segment: number
          owner_id: string
          segment_index: number
          spins_available: number
        }[]
      }
      create_config_backup: {
        Args: { _label?: string; _trigger?: string }
        Returns: string
      }
      create_prize_payment: {
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
      decrement_claimed_spin: {
        Args: { p_account_id: string; p_owner_id?: string }
        Returns: {
          owner_id: string
          spins_available: number
        }[]
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
      get_battle_config_default: {
        Args: never
        Returns: {
          config: Json
          user_id: string
        }[]
      }
      get_bs_deposit_stats:
        | {
            Args: { p_owner_id: string }
            Returns: {
              total_amount: number
              total_count: number
            }[]
          }
        | {
            Args: { p_owner_id: string; p_since?: string }
            Returns: {
              total_amount: number
              total_count: number
            }[]
          }
      get_default_referral_code: {
        Args: { p_owner_id: string }
        Returns: string
      }
      get_deposit_config_by_tag: {
        Args: { p_tag: string }
        Returns: {
          config: Json
          user_id: string
        }[]
      }
      get_luckybox_page_by_tag: { Args: { p_tag: string }; Returns: Json }
      get_luckybox_user_state: { Args: { p_user_id: string }; Returns: Json }
      get_prize_history: {
        Args: { p_account_id: string; p_owner_id: string }
        Returns: {
          id: string
          prize: string
          spun_at: string
        }[]
      }
      get_public_deposit_status: {
        Args: { p_edpay_id: string }
        Returns: string
      }
      get_redemption_page_by_tag: { Args: { p_tag: string }; Returns: Json }
      get_referral_page_data: { Args: { p_code: string }; Returns: Json }
      get_wheel_config_by_slug: {
        Args: { p_slug: string }
        Returns: {
          config: Json
          user_id: string
        }[]
      }
      get_wheel_config_slug_only: {
        Args: { p_user_id: string }
        Returns: {
          slug: string
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
      open_luckybox_case: {
        Args: { p_account_id: string; p_case_id: string; p_owner_id: string }
        Returns: Json
      }
      open_luckybox_case_pool: {
        Args: { p_account_id: string; p_case_id: string; p_owner_id: string }
        Returns: Json
      }
      place_bet: {
        Args: {
          p_account_id: string
          p_amount: number
          p_email: string
          p_event_id: string
          p_outcome_id: string
          p_owner_id: string
        }
        Returns: Json
      }
      pop_link_prize_pool: {
        Args: { p_count: number; p_link_id: string }
        Returns: Json
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
      redeem_luckybox_grant:
        | {
            Args: {
              p_account_id: string
              p_code: string
              p_email: string
              p_owner_id: string
            }
            Returns: Json
          }
        | {
            Args: {
              p_account_id: string
              p_browser?: string
              p_city?: string
              p_code: string
              p_country?: string
              p_device?: string
              p_email: string
              p_ip?: string
              p_os?: string
              p_owner_id: string
              p_region?: string
              p_user_agent?: string
            }
            Returns: Json
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
      register_via_redemption: {
        Args: {
          p_account_id: string
          p_code: string
          p_cpf?: string
          p_email: string
          p_name?: string
          p_phone?: string
          p_pix_key?: string
          p_pix_key_type?: string
          p_tag: string
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
      resolve_bet_event: {
        Args: { p_event_id: string; p_winning_outcome_id: string }
        Returns: Json
      }
      restore_config_backup: { Args: { _backup_id: string }; Returns: Json }
      segment_is_paying_prize: { Args: { p_segment: Json }; Returns: boolean }
      update_wheel_user_self: {
        Args: {
          p_allowed_fields?: Json
          p_cpf: string
          p_email: string
          p_mode?: string
          p_name?: string
          p_new_account_id?: string
          p_owner_id: string
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
