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
    PostgrestVersion: "14.1"
  }
  public: {
    Tables: {
      ad_rewards: {
        Row: {
          ad_type: string
          created_at: string
          id: string
          reward_credits: number
          user_id: string
        }
        Insert: {
          ad_type?: string
          created_at?: string
          id?: string
          reward_credits?: number
          user_id: string
        }
        Update: {
          ad_type?: string
          created_at?: string
          id?: string
          reward_credits?: number
          user_id?: string
        }
        Relationships: []
      }
      connect_products: {
        Row: {
          connected_account_id: string
          created_at: string
          created_by: string
          currency: string
          description: string | null
          id: string
          name: string
          price_cents: number
          stripe_price_id: string | null
          stripe_product_id: string
        }
        Insert: {
          connected_account_id: string
          created_at?: string
          created_by: string
          currency?: string
          description?: string | null
          id?: string
          name: string
          price_cents: number
          stripe_price_id?: string | null
          stripe_product_id: string
        }
        Update: {
          connected_account_id?: string
          created_at?: string
          created_by?: string
          currency?: string
          description?: string | null
          id?: string
          name?: string
          price_cents?: number
          stripe_price_id?: string | null
          stripe_product_id?: string
        }
        Relationships: []
      }
      connected_accounts: {
        Row: {
          contact_email: string | null
          created_at: string
          display_name: string | null
          id: string
          stripe_account_id: string
          updated_at: string
          user_id: string
        }
        Insert: {
          contact_email?: string | null
          created_at?: string
          display_name?: string | null
          id?: string
          stripe_account_id: string
          updated_at?: string
          user_id: string
        }
        Update: {
          contact_email?: string | null
          created_at?: string
          display_name?: string | null
          id?: string
          stripe_account_id?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      connector_activity_logs: {
        Row: {
          connector_slug: string
          created_at: string
          event_type: string
          id: string
          message: string
          metadata: Json | null
          status: string
          user_id: string
        }
        Insert: {
          connector_slug: string
          created_at?: string
          event_type: string
          id?: string
          message: string
          metadata?: Json | null
          status?: string
          user_id: string
        }
        Update: {
          connector_slug?: string
          created_at?: string
          event_type?: string
          id?: string
          message?: string
          metadata?: Json | null
          status?: string
          user_id?: string
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
      github_connections: {
        Row: {
          access_token: string
          connected_at: string
          github_avatar_url: string | null
          github_username: string | null
          id: string
          scope: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          access_token: string
          connected_at?: string
          github_avatar_url?: string | null
          github_username?: string | null
          id?: string
          scope?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          access_token?: string
          connected_at?: string
          github_avatar_url?: string | null
          github_username?: string | null
          id?: string
          scope?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      orchestration_plans: {
        Row: {
          capabilities: string[]
          created_at: string
          id: string
          intent: string
          model: string
          prompt: string
          stack: Json
          tasks: Json
          updated_at: string
          user_id: string
        }
        Insert: {
          capabilities?: string[]
          created_at?: string
          id?: string
          intent: string
          model?: string
          prompt: string
          stack?: Json
          tasks?: Json
          updated_at?: string
          user_id: string
        }
        Update: {
          capabilities?: string[]
          created_at?: string
          id?: string
          intent?: string
          model?: string
          prompt?: string
          stack?: Json
          tasks?: Json
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      profiles: {
        Row: {
          avatar_url: string | null
          created_at: string
          display_name: string | null
          id: string
          referral_code: string | null
          updated_at: string
        }
        Insert: {
          avatar_url?: string | null
          created_at?: string
          display_name?: string | null
          id: string
          referral_code?: string | null
          updated_at?: string
        }
        Update: {
          avatar_url?: string | null
          created_at?: string
          display_name?: string | null
          id?: string
          referral_code?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      project_versions: {
        Row: {
          created_at: string | null
          description: string | null
          generated_code: string | null
          id: string
          project_id: string
          published_at: string | null
          title: string
          version_number: number
        }
        Insert: {
          created_at?: string | null
          description?: string | null
          generated_code?: string | null
          id?: string
          project_id: string
          published_at?: string | null
          title: string
          version_number?: number
        }
        Update: {
          created_at?: string | null
          description?: string | null
          generated_code?: string | null
          id?: string
          project_id?: string
          published_at?: string | null
          title?: string
          version_number?: number
        }
        Relationships: []
      }
      projects: {
        Row: {
          created_at: string
          description: string | null
          generated_code: string | null
          id: string
          is_published: boolean
          messages: Json | null
          published_at: string | null
          published_url: string | null
          title: string
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          description?: string | null
          generated_code?: string | null
          id?: string
          is_published?: boolean
          messages?: Json | null
          published_at?: string | null
          published_url?: string | null
          title?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          description?: string | null
          generated_code?: string | null
          id?: string
          is_published?: boolean
          messages?: Json | null
          published_at?: string | null
          published_url?: string | null
          title?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      referrals: {
        Row: {
          created_at: string
          credits_awarded: number
          id: string
          referred_id: string
          referrer_id: string
        }
        Insert: {
          created_at?: string
          credits_awarded?: number
          id?: string
          referred_id: string
          referrer_id: string
        }
        Update: {
          created_at?: string
          credits_awarded?: number
          id?: string
          referred_id?: string
          referrer_id?: string
        }
        Relationships: []
      }
      shortlink_clicks: {
        Row: {
          clicked_at: string
          completed: boolean
          completed_at: string | null
          id: string
          ip_address: string | null
          reward_credited: number
          shortlink_id: string
          user_id: string
        }
        Insert: {
          clicked_at?: string
          completed?: boolean
          completed_at?: string | null
          id?: string
          ip_address?: string | null
          reward_credited?: number
          shortlink_id: string
          user_id: string
        }
        Update: {
          clicked_at?: string
          completed?: boolean
          completed_at?: string | null
          id?: string
          ip_address?: string | null
          reward_credited?: number
          shortlink_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "shortlink_clicks_shortlink_id_fkey"
            columns: ["shortlink_id"]
            isOneToOne: false
            referencedRelation: "shortlinks"
            referencedColumns: ["id"]
          },
        ]
      }
      shortlinks: {
        Row: {
          created_at: string
          destination_url: string
          id: string
          is_active: boolean
          reward_credits: number
          slug: string
          title: string
          wait_seconds: number
        }
        Insert: {
          created_at?: string
          destination_url: string
          id?: string
          is_active?: boolean
          reward_credits?: number
          slug: string
          title?: string
          wait_seconds?: number
        }
        Update: {
          created_at?: string
          destination_url?: string
          id?: string
          is_active?: boolean
          reward_credits?: number
          slug?: string
          title?: string
          wait_seconds?: number
        }
        Relationships: []
      }
      subscriptions: {
        Row: {
          created_at: string
          edits_limit: number
          edits_used: number
          id: string
          is_active: boolean
          paid_at: string | null
          plan: string
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          edits_limit?: number
          edits_used?: number
          id?: string
          is_active?: boolean
          paid_at?: string | null
          plan?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          edits_limit?: number
          edits_used?: number
          id?: string
          is_active?: boolean
          paid_at?: string | null
          plan?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      support_tickets: {
        Row: {
          created_at: string
          id: string
          message: string
          status: string
          subject: string
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          message: string
          status?: string
          subject: string
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          message?: string
          status?: string
          subject?: string
          updated_at?: string
          user_id?: string
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
      user_badges: {
        Row: {
          badge_type: string
          id: string
          unlocked_at: string
          user_id: string
        }
        Insert: {
          badge_type: string
          id?: string
          unlocked_at?: string
          user_id: string
        }
        Update: {
          badge_type?: string
          id?: string
          unlocked_at?: string
          user_id?: string
        }
        Relationships: []
      }
      user_streaks: {
        Row: {
          created_at: string
          current_streak: number
          id: string
          last_activity_date: string | null
          longest_streak: number
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          current_streak?: number
          id?: string
          last_activity_date?: string | null
          longest_streak?: number
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          current_streak?: number
          id?: string
          last_activity_date?: string | null
          longest_streak?: number
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      admin_clear_connector_run: {
        Args: { _connector_slug: string; _run_id: string }
        Returns: number
      }
      admin_list_connector_runs: {
        Args: { _connector_slug: string; _limit?: number }
        Returns: {
          event_count: number
          is_mine: boolean
          run_id: string
          run_label: string
          started_at: string
          user_id: string
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
      is_kubo_admin: { Args: never; Returns: boolean }
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
