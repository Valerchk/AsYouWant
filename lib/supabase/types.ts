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
  /* Preferences (migration 0003). Every default matches the behaviour that
     was hard-coded before them, so an untouched account is unchanged. */
  ribbon_density: "compact" | "comfortable";
  collapse_past: boolean;
  notify_live: boolean;
  notify_lead_min: number;
  quiet_from_min: number | null;
  quiet_to_min: number | null;
  require_confirm: boolean;
  /** A read-only ICS subscription (migration 0004). Never written back to. */
  calendar_url: string | null;
}

type ThreadRow = {
  id: string;
  user_id: string;
  name: string;
  color_index: number;
  icon: string | null;
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
  /** The routine this block grew from (migration 0004). */
  routine_id: string | null;
  /** The block's own colour, 0–15. NULL borrows its goal's (migration 0006). */
  color_index: number | null;
  /** The block's own icon. NULL borrows its goal's (migration 0006). */
  icon: string | null;
}

type RoutineRow = {
  id: string;
  user_id: string;
  title: string;
  kind: BlockKind;
  start_min: number | null;
  planned_min: number;
  thread_id: string | null;
  /** Bit per weekday, Sunday = bit 0. */
  repeat_mask: number;
  created_at: string;
};

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
  /** NULL is "someday"; a date makes it an intention for that day. */
  planned_for: string | null;
  /** When it was ticked off. NULL means still open (migration 0005). */
  done_at: string | null;
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
        | "id"
        | "color_index"
        | "sort_order"
        | "archived_at"
        | "created_at"
        | "weekly_target_min"
        | "icon"
      >;
      blocks: Table<
        BlockRow,
        "id" | "status" | "sort_order" | "created_at" | "updated_at" |
        "thread_id" | "actual_start_min" | "actual_end_min" | "carried_from" |
        "routine_id" | "color_index" | "icon"
      >;
      routines: Table<RoutineRow, "id" | "created_at" | "kind" | "thread_id">;
      day_templates: Table<DayTemplateRow, "id" | "created_at">;
      notes: Table<NoteRow, "id" | "created_at" | "planned_for" | "done_at">;
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
