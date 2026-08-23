// Hand-written to match supabase/migrations/0001_init.sql. If you regenerate
// this from a live project later (`supabase gen types typescript`), keep the
// shape — server.ts/browser.ts pass it as the createClient generic so every
// query is checked against the real schema instead of falling back to `any`.
import type { CaptureRow, EdgeRow, EventRow, NodeRow, TypeRow } from "./types";

type InsertOf<Row, Required extends keyof Row> = Partial<Row> & Pick<Row, Required>;

// postgrest-js's GenericTable requires a `Relationships` array even though
// we never use FK-embed queries here — an empty tuple satisfies the
// constraint without claiming any actual foreign-key relationships exist.
export interface Database {
  public: {
    Tables: {
      types: {
        Row: TypeRow;
        Insert: InsertOf<TypeRow, "key" | "label">;
        Update: Partial<TypeRow>;
        Relationships: [];
      };
      nodes: {
        Row: NodeRow;
        Insert: InsertOf<NodeRow, "type" | "title">;
        Update: Partial<NodeRow>;
        Relationships: [];
      };
      edges: {
        Row: EdgeRow;
        Insert: InsertOf<EdgeRow, "from_id" | "to_id" | "type">;
        Update: Partial<EdgeRow>;
        Relationships: [];
      };
      events: {
        Row: EventRow;
        Insert: InsertOf<EventRow, "node_id" | "kind">;
        Update: Partial<EventRow>;
        Relationships: [];
      };
      captures: {
        Row: CaptureRow;
        Insert: InsertOf<CaptureRow, "raw_text">;
        Update: Partial<CaptureRow>;
        Relationships: [];
      };
    };
    Views: Record<string, never>;
    Functions: Record<string, never>;
    Enums: Record<string, never>;
    CompositeTypes: Record<string, never>;
  };
}
