// Hand-written to match supabase/migrations/0001_schema.sql.
// Keep in sync when the schema changes. (Later we can auto-generate this with the
// Supabase CLI, but we're avoiding that dependency during the MVP.)
//
// Convention: Postgres `date`/`timestamptz` come back as ISO strings over the wire,
// so they're typed as `string` here.

export type TenderStatus = "pending_review" | "published" | "rejected";
export type UserRole = "user" | "staff" | "admin";
export type NotificationChannel = "email" | "telegram";

export type Database = {
  public: {
    Tables: {
      categories: {
        Row: { id: number; name: string; slug: string };
        Insert: { id?: number; name: string; slug: string };
        Update: { id?: number; name?: string; slug?: string };
      };
      tenders: {
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
        };
      };
      profiles: {
        Row: {
          id: string;
          full_name: string | null;
          company_name: string | null;
          role: UserRole;
          plan: string;
          telegram_chat_id: string | null;
          email_notifications: boolean | null;
          telegram_notifications: boolean | null;
          digest_mode: boolean | null;
          created_at: string | null;
        };
        Insert: {
          id: string;
          full_name?: string | null;
          company_name?: string | null;
          role?: UserRole;
          plan?: string;
          telegram_chat_id?: string | null;
          email_notifications?: boolean | null;
          telegram_notifications?: boolean | null;
          digest_mode?: boolean | null;
          created_at?: string | null;
        };
        Update: {
          id?: string;
          full_name?: string | null;
          company_name?: string | null;
          role?: UserRole;
          plan?: string;
          telegram_chat_id?: string | null;
          email_notifications?: boolean | null;
          telegram_notifications?: boolean | null;
          digest_mode?: boolean | null;
          created_at?: string | null;
        };
      };
      subscriptions: {
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
        Row: {
          id: string;
          user_id: string;
          tender_id: string;
          channel: NotificationChannel;
          sent_at: string | null;
        };
        Insert: {
          id?: string;
          user_id: string;
          tender_id: string;
          channel: NotificationChannel;
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
