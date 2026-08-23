import type { EdgeType, NodeType, Pass1Label, TerminalForm } from "./types";

// Mirrors the seed of the `types` table (supabase/migrations/0001_init.sql).
// Kept in code too so the classification prompt doesn't need a DB round trip.
export const NODE_TYPES: Array<{
  key: NodeType;
  label: string;
  terminalForm: TerminalForm;
  notes: string;
}> = [
  { key: "identity", label: "Identity", terminalForm: null, notes: "Root node — the kind of person you want to be" },
  { key: "value", label: "Value", terminalForm: null, notes: "" },
  { key: "goal", label: "Goal", terminalForm: null, notes: "Decomposes into projects/actions" },
  { key: "project", label: "Project", terminalForm: null, notes: "Has stages, multiple children" },
  { key: "action", label: "Action", terminalForm: "action", notes: "Done once, ticked" },
  { key: "habit", label: "Habit", terminalForm: "repetition", notes: "Cadence + streak, never done" },
  { key: "anti-habit", label: "Anti-habit", terminalForm: "repetition", notes: "A habit you want rid of" },
  { key: "skill", label: "Skill", terminalForm: null, notes: "Decomposes into a practice ladder + a repetition — never a checklist" },
  { key: "acquisition", label: "Acquisition", terminalForm: "action", notes: "Something to buy or get" },
  { key: "bottleneck", label: "Bottleneck", terminalForm: null, notes: "External — in the way" },
  { key: "resistance", label: "Resistance", terminalForm: null, notes: "Internal — in the way" },
  { key: "question", label: "Question", terminalForm: "understanding", notes: "" },
  { key: "decision", label: "Decision", terminalForm: "decision", notes: "Resolves by choosing, not doing" },
  { key: "experiment", label: "Experiment", terminalForm: "action", notes: "" },
  { key: "ritual", label: "Ritual", terminalForm: "repetition", notes: "" },
  { key: "constraint", label: "Constraint", terminalForm: null, notes: "Never actionable, always relevant" },
  { key: "resource", label: "Resource", terminalForm: null, notes: "" },
  { key: "person", label: "Person", terminalForm: null, notes: "" },
  { key: "spark", label: "Spark", terminalForm: null, notes: "Non-actionable idea worth keeping" },
  { key: "evidence", label: "Evidence", terminalForm: null, notes: "Logged wins, attaches upward to the identity it served" },
  { key: "sidelined", label: "Sidelined", terminalForm: null, notes: "Parked, not abandoned — his own word for it" },
  { key: "unsorted", label: "Unsorted", terminalForm: null, notes: "A legitimate permanent resting state, not an error" },
];

export const NODE_TYPE_KEYS = NODE_TYPES.map((t) => t.key) as [NodeType, ...NodeType[]];

export const EDGE_TYPES: EdgeType[] = [
  "serves",
  "blocks",
  "requires",
  "evidence-for",
  "contradicts",
  "member-of",
  "version-of",
];

// v1 only renders/creates these two specially; others fall back to a generic style.
export const V1_EDGE_TYPES: EdgeType[] = ["serves", "blocks"];

export const PASS1_LABEL_MEANING: Record<Pass1Label, string> = {
  "thing-I-want-to-be": "an identity, value, or aspirational quality",
  "thing-to-do": "an action, habit, project, goal, ritual, or experiment",
  "thing-to-have": "an acquisition or resource",
  "thing-to-stop": "an anti-habit or something to eliminate",
  "thing-in-the-way": "a bottleneck, resistance, or constraint",
  unsorted: "unclear, or doesn't fit any of the above yet",
};

// Kept separate from NODE_TYPES (rather than a `colour` field there) so the
// palette can be restyled without touching the taxonomy data.
const TYPE_COLOURS: Record<NodeType, string> = {
  identity: "#f5c518",
  value: "#f5c518",
  goal: "#e0a72e",
  project: "#e0a72e",
  action: "#4caf7d",
  habit: "#38a3a5",
  "anti-habit": "#38a3a5",
  skill: "#3a86ff",
  acquisition: "#4caf7d",
  bottleneck: "#e63946",
  resistance: "#e63946",
  question: "#8338ec",
  decision: "#ff6b6b",
  experiment: "#4caf7d",
  ritual: "#38a3a5",
  constraint: "#6c757d",
  resource: "#6c757d",
  person: "#adb5bd",
  spark: "#ffb703",
  evidence: "#2ec4b6",
  sidelined: "#495057",
  unsorted: "#343a40",
};

export function typeColour(key: NodeType): string {
  return TYPE_COLOURS[key] ?? "#6c757d";
}
