export type NodeType =
  | "identity"
  | "value"
  | "goal"
  | "project"
  | "action"
  | "habit"
  | "anti-habit"
  | "skill"
  | "acquisition"
  | "bottleneck"
  | "resistance"
  | "question"
  | "decision"
  | "experiment"
  | "ritual"
  | "constraint"
  | "resource"
  | "person"
  | "spark"
  | "evidence"
  | "sidelined"
  | "unsorted";

export type TerminalForm =
  | "action"
  | "repetition"
  | "decision"
  | "understanding"
  | "waiting"
  | null;

export type EdgeType =
  | "serves"
  | "blocks"
  | "requires"
  | "evidence-for"
  | "contradicts"
  | "member-of"
  | "version-of";

export type EventKind =
  | "created"
  | "started"
  | "abandoned"
  | "completed"
  | "revised"
  | "touched";

export const PASS1_LABELS = [
  "thing-I-want-to-be",
  "thing-to-do",
  "thing-to-have",
  "thing-to-stop",
  "thing-in-the-way",
  "unsorted",
] as const;
export type Pass1Label = (typeof PASS1_LABELS)[number];

// These are `type` aliases rather than `interface`s deliberately: Partial<>
// (used when deriving the Supabase Insert/Update shapes in database.types.ts)
// only produces a type assignable to postgrest-js's `Record<string, unknown>`
// constraint for object-literal type aliases, not for interfaces — an
// interface's lack of an implicit index signature makes Partial<Interface>
// fail that constraint and silently collapses the whole schema to `never`.
export type NodeRow = {
  id: string;
  type: NodeType;
  title: string;
  body: string | null;
  status: string | null;
  terminal_form: TerminalForm;
  owner: string | null;
  external_holder: string | null;
  due_date: string | null;
  irreversible: boolean;
  cost_money: number | null;
  cost_hours: number | null;
  cost_exposure: string | null;
  domain: string | null;
  lane: string | null;
  x: number | null;
  y: number | null;
  created_at: string;
  updated_at: string;
  last_touched_at: string;
};

export type EdgeRow = {
  id: string;
  from_id: string;
  to_id: string;
  type: EdgeType;
  undecided: boolean;
  created_at: string;
};

export type EventRow = {
  id: string;
  node_id: string;
  kind: EventKind;
  at: string;
  note: string | null;
};

export type ClassificationPass1 = {
  label: Pass1Label;
};

export type ClassificationPass2Node = {
  type: NodeType;
  title: string;
  terminal_form: TerminalForm;
  domain: string | null;
  lane: string | null;
  owner: string | null;
  external_holder: string | null;
  due_date: string | null;
};

export type ClassificationPass2 = {
  node: ClassificationPass2Node;
  additional_nodes: Array<{
    type: NodeType;
    title: string;
    terminal_form: TerminalForm;
    relation: EdgeType;
  }>;
  suggested_edges: Array<{ to_title: string; type: EdgeType }>;
};

export type CaptureRow = {
  id: string;
  raw_text: string;
  created_at: string;
  node_id: string | null;
  classification_json: {
    pass1?: ClassificationPass1;
    pass2?: ClassificationPass2;
  } | null;
  corrected: boolean;
};

export type TypeRow = {
  key: NodeType;
  label: string;
  terminal_form: TerminalForm;
  colour: string;
  notes: string | null;
};
