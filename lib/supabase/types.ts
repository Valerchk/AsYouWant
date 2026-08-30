/* Hand-written to match supabase/migrations/0001_init.sql exactly.
   Once the project exists these can be regenerated instead:

     npx supabase gen types typescript --project-id <ref> > lib/supabase/types.ts

   Every row below must stay a `type` and never become an `interface`.
   postgrest-js constrains its tables to Record<string, unknown>, and TypeScript
   grants an implicit index signature to type aliases but not to interfaces —
   declaring these as interfaces makes every query resolve to `never`, with
   errors that point at the call sites rather than at this file.
*/

export type BlockKind = "anchor" | "flow";
export type BlockStatus =
  | "planned"
  | "active"
  | "done"
  | "dropped"
  | "carried";

type ProfileRow = {
  id: string;
  timezone: string;
  day_start_min: number;
  day_end_min: number;
  evening_review_min: number;
  day_confirmed_on: string | null;
  created_at: string;
}

type ThreadRow = {
  id: string;
  user_id: string;
  name: string;
  color_index: number;
  weekly_target_min: number | null;
  sort_order: number;
  archived_at: string | null;
  created_at: string;
}

type BlockRow = {
  id: string;
  user_id: string;
  thread_id: string | null;
  title: string;
  /** YYYY-MM-DD in the profile's timezone. */
  day: string;
  start_min: number | null;
  planned_min: number;
  kind: BlockKind;
  status: BlockStatus;
  actual_start_min: number | null;
  actual_end_min: number | null;
  carried_from: string | null;
  sort_order: number;
  created_at: string;
  updated_at: string;
}

type DayTemplateRow = {
  id: string;
  user_id: string;
  name: string;
  payload: unknown;
  created_at: string;
}

type NoteRow = {
  id: string;
  user_id: string;
  text: string;
  created_at: string;
};

type PushSubscriptionRow = {
  id: string;
  user_id: string;
  endpoint: string;
  p256dh: string;
  auth: string;
  fail_count: number;
  last_ok_at: string | null;
  created_at: string;
}

type NotificationStateRow = {
  user_id: string;
  tag: string;
  content_hash: string;
  sent_at: string;
}

/** Columns the database fills in itself are optional on insert. */
type Table<Row, Generated extends keyof Row> = {
  Row: Row;
  Insert: Omit<Row, Generated> & Partial<Pick<Row, Generated>>;
  Update: Partial<Row>;
  Relationships: [];
};

export interface Database {
  public: {
    Tables: {
      profiles: Table<ProfileRow, keyof ProfileRow>;
      threads: Table<
        ThreadRow,
        "id" | "color_index" | "sort_order" | "archived_at" | "created_at" | "weekly_target_min"
      >;
      blocks: Table<
        BlockRow,
        "id" | "status" | "sort_order" | "created_at" | "updated_at" |
        "thread_id" | "actual_start_min" | "actual_end_min" | "carried_from"
      >;
      day_templates: Table<DayTemplateRow, "id" | "created_at">;
      notes: Table<NoteRow, "id" | "created_at">;
      push_subscriptions: Table<
        PushSubscriptionRow,
        "id" | "fail_count" | "last_ok_at" | "created_at"
      >;
      notification_state: Table<NotificationStateRow, "sent_at">;
    };
    Views: Record<never, never>;
    Functions: Record<never, never>;
    Enums: {
      block_kind: BlockKind;
      block_status: BlockStatus;
    };
    CompositeTypes: Record<never, never>;
  };
}
