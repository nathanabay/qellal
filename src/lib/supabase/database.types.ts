// Hand-written to match supabase/migrations/0001_schema.sql.
// Keep in sync when the schema changes. (Later we can auto-generate this with the
// Supabase CLI, but we're avoiding that dependency during the MVP.)
//
// Convention: Postgres `date`/`timestamptz` come back as ISO strings over the wire,
// so they're typed as `string` here.

export type TenderStatus = "pending_review" | "published" | "rejected";
export type UserRole = "user" | "staff" | "admin";
export type NotificationChannel = "email" | "telegram";
export type NotificationKind =
  | "digest"
  | "reminder_7"
  | "reminder_3"
  | "reminder_1";

export type Database = {
  public: {
    Tables: {
      payments: {
        Relationships: [];
        Row: {
          id: string;
          user_id: string;
          tx_ref: string;
          provider: string;
          plan_id: string;
          amount: number;
          currency: string;
          status: string;
          created_at: string | null;
          paid_at: string | null;
        };
        Insert: {
          id?: string;
          user_id: string;
          tx_ref: string;
          provider?: string;
          plan_id?: string;
          amount: number;
          currency?: string;
          status?: string;
          created_at?: string | null;
          paid_at?: string | null;
        };
        Update: {
          id?: string;
          user_id?: string;
          tx_ref?: string;
          provider?: string;
          plan_id?: string;
          amount?: number;
          currency?: string;
          status?: string;
          created_at?: string | null;
          paid_at?: string | null;
        };
      };
      invoices: {
        Relationships: [];
        Row: {
          id: string;
          user_id: string;
          number: string;
          status: string;
          currency: string;
          total: number;
          period_start: string | null;
          period_end: string | null;
          issued_at: string | null;
          paid_at: string | null;
          created_at: string | null;
        };
        Insert: {
          id?: string;
          user_id: string;
          number: string;
          status?: string;
          currency?: string;
          total?: number;
          period_start?: string | null;
          period_end?: string | null;
          issued_at?: string | null;
          paid_at?: string | null;
          created_at?: string | null;
        };
        Update: {
          id?: string;
          user_id?: string;
          number?: string;
          status?: string;
          currency?: string;
          total?: number;
          period_start?: string | null;
          period_end?: string | null;
          issued_at?: string | null;
          paid_at?: string | null;
          created_at?: string | null;
        };
      };
      invoice_lines: {
        Relationships: [];
        Row: {
          id: string;
          invoice_id: string;
          description: string;
          amount: number;
          created_at: string | null;
        };
        Insert: {
          id?: string;
          invoice_id: string;
          description: string;
          amount?: number;
          created_at?: string | null;
        };
        Update: {
          id?: string;
          invoice_id?: string;
          description?: string;
          amount?: number;
          created_at?: string | null;
        };
      };
      billing_subscriptions: {
        Relationships: [];
        Row: {
          user_id: string;
          plan_id: string;
          status: string;
          trial_ends_at: string | null;
          current_period_start: string | null;
          current_period_end: string | null;
          cancel_at_period_end: boolean;
          canceled_at: string | null;
          past_due_since: string | null;
          dunning_attempt: number;
          created_at: string | null;
          updated_at: string | null;
        };
        Insert: {
          user_id: string;
          plan_id?: string;
          status?: string;
          trial_ends_at?: string | null;
          current_period_start?: string | null;
          current_period_end?: string | null;
          cancel_at_period_end?: boolean;
          canceled_at?: string | null;
          past_due_since?: string | null;
          dunning_attempt?: number;
          created_at?: string | null;
          updated_at?: string | null;
        };
        Update: {
          user_id?: string;
          plan_id?: string;
          status?: string;
          trial_ends_at?: string | null;
          current_period_start?: string | null;
          current_period_end?: string | null;
          cancel_at_period_end?: boolean;
          canceled_at?: string | null;
          past_due_since?: string | null;
          dunning_attempt?: number;
          created_at?: string | null;
          updated_at?: string | null;
        };
      };
      saved_tenders: {
        Relationships: [];
        Row: { user_id: string; tender_id: string; created_at: string | null };
        Insert: {
          user_id: string;
          tender_id: string;
          created_at?: string | null;
        };
        Update: {
          user_id?: string;
          tender_id?: string;
          created_at?: string | null;
        };
      };
      categories: {
        Relationships: [];
        Row: {
          id: number;
          name: string;
          slug: string;
          position: number | null;
          parent_id: number | null;
        };
        Insert: {
          id?: number;
          name: string;
          slug: string;
          position?: number | null;
          parent_id?: number | null;
        };
        Update: {
          id?: number;
          name?: string;
          slug?: string;
          position?: number | null;
          parent_id?: number | null;
        };
      };
      tender_categories: {
        Relationships: [];
        Row: { tender_id: string; category_id: number };
        Insert: { tender_id: string; category_id: number };
        Update: { tender_id?: string; category_id?: number };
      };
      tenders: {
        Relationships: [];
        Row: {
          id: string;
          title: string;
          description: string | null;
          category_id: number | null;
          region: string | null;
          publishing_entity: string | null;
          published_date: string | null;
          deadline: string;
          source_name: string;
          source_url: string | null;
          status: TenderStatus;
          created_by: string;
          created_at: string | null;
          published_at: string | null;
          bid_bond: string | null;
          bid_document_price: string | null;
          published_on: string | null;
        };
        Insert: {
          id?: string;
          title: string;
          description?: string | null;
          category_id?: number | null;
          region?: string | null;
          publishing_entity?: string | null;
          published_date?: string | null;
          deadline: string;
          source_name: string;
          source_url?: string | null;
          status?: TenderStatus;
          created_by?: string;
          created_at?: string | null;
          published_at?: string | null;
          bid_bond?: string | null;
          bid_document_price?: string | null;
          published_on?: string | null;
        };
        Update: {
          id?: string;
          title?: string;
          description?: string | null;
          category_id?: number | null;
          region?: string | null;
          publishing_entity?: string | null;
          published_date?: string | null;
          deadline?: string;
          source_name?: string;
          source_url?: string | null;
          status?: TenderStatus;
          created_by?: string;
          created_at?: string | null;
          published_at?: string | null;
          bid_bond?: string | null;
          bid_document_price?: string | null;
          published_on?: string | null;
        };
      };
      profiles: {
        Relationships: [];
        Row: {
          id: string;
          email: string | null;
          full_name: string | null;
          company_name: string | null;
          role: UserRole;
          plan: string;
          telegram_chat_id: string | null;
          email_notifications: boolean | null;
          telegram_notifications: boolean | null;
          digest_mode: boolean | null;
          digest_frequency: string;
          deadline_reminders: boolean | null;
          telegram_link_token: string;
          unsubscribe_token: string;
          notifications_paused_until: string | null;
          created_at: string | null;
        };
        Insert: {
          id: string;
          email?: string | null;
          full_name?: string | null;
          company_name?: string | null;
          role?: UserRole;
          plan?: string;
          telegram_chat_id?: string | null;
          email_notifications?: boolean | null;
          telegram_notifications?: boolean | null;
          digest_mode?: boolean | null;
          digest_frequency?: string;
          deadline_reminders?: boolean | null;
          telegram_link_token?: string;
          unsubscribe_token?: string;
          notifications_paused_until?: string | null;
          created_at?: string | null;
        };
        Update: {
          id?: string;
          email?: string | null;
          full_name?: string | null;
          company_name?: string | null;
          role?: UserRole;
          plan?: string;
          telegram_chat_id?: string | null;
          email_notifications?: boolean | null;
          telegram_notifications?: boolean | null;
          digest_mode?: boolean | null;
          digest_frequency?: string;
          deadline_reminders?: boolean | null;
          telegram_link_token?: string;
          unsubscribe_token?: string;
          notifications_paused_until?: string | null;
          created_at?: string | null;
        };
      };
      subscriptions: {
        Relationships: [];
        Row: {
          id: string;
          user_id: string;
          category_id: number | null;
          keyword: string | null;
          region: string | null;
          created_at: string | null;
        };
        Insert: {
          id?: string;
          user_id: string;
          category_id?: number | null;
          keyword?: string | null;
          region?: string | null;
          created_at?: string | null;
        };
        Update: {
          id?: string;
          user_id?: string;
          category_id?: number | null;
          keyword?: string | null;
          region?: string | null;
          created_at?: string | null;
        };
      };
      notifications_sent: {
        Relationships: [];
        Row: {
          id: string;
          user_id: string;
          tender_id: string;
          channel: NotificationChannel;
          kind: NotificationKind;
          sent_at: string | null;
        };
        Insert: {
          id?: string;
          user_id: string;
          tender_id: string;
          channel: NotificationChannel;
          kind?: NotificationKind;
          sent_at?: string | null;
        };
        Update: {
          id?: string;
          user_id?: string;
          tender_id?: string;
          channel?: NotificationChannel;
          sent_at?: string | null;
        };
      };
    };
    Views: Record<string, never>;
    Functions: {
      current_user_role: {
        Args: Record<string, never>;
        Returns: string;
      };
    };
    Enums: Record<string, never>;
    CompositeTypes: Record<string, never>;
  };
};
